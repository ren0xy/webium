import type { VirtualDOM } from "../dom/virtual-dom.js";
import type { VirtualNode } from "../dom/virtual-node.js";
import { DirtyFlags } from "../dom/types.js";
import type { IComputedStyleResolver } from "../css/computed-style-resolver.js";
import type { IStyleSheetManager } from "../css/stylesheet-manager.js";
import type { ILayoutEngine, LayoutResult } from "../layout/yoga-layout-engine.js";
import {
  RenderCommandBuffer,
  RenderOp,
  type IRenderCommandBuffer,
  type RenderCommand,
} from "../bridge/render-command.js";
import type { ILogger } from "../events/event-dispatcher.js";

/**
 * The reconciliation engine: drains the dirty queue, resolves styles,
 * computes layout, and emits render commands each tick.
 *
 * @see Requirements 14.1, 14.2, 14.3, 14.4, 6.2
 */
export interface IReconciliationEngine {
  tick(viewportWidth?: number, viewportHeight?: number): IRenderCommandBuffer;
}

export class ReconciliationEngine implements IReconciliationEngine {
  private readonly _dom: VirtualDOM;
  private readonly _styleResolver: IComputedStyleResolver;
  private readonly _styleSheetManager: IStyleSheetManager;
  private _layoutEngine: ILayoutEngine | null;
  private readonly _logger: ILogger | null;
  private readonly _buffer = new RenderCommandBuffer();

  /** Track previous computed styles for diffing */
  private readonly _prevStyles = new Map<number, Map<string, string>>();
  /** Track previous layout for diffing */
  private readonly _prevLayout = new Map<number, LayoutResult>();
  /** Track previous text content for diffing */
  private readonly _prevText = new Map<number, string | null>();
  /** Track nodes that have been created (need Create command) */
  private readonly _createdNodes = new Set<number>();

  constructor(
    dom: VirtualDOM,
    styleResolver: IComputedStyleResolver,
    styleSheetManager: IStyleSheetManager,
    layoutEngine?: ILayoutEngine | null,
    logger?: ILogger | null,
  ) {
    this._dom = dom;
    this._styleResolver = styleResolver;
    this._styleSheetManager = styleSheetManager;
    this._layoutEngine = layoutEngine ?? null;
    this._logger = logger ?? null;
  }

  /** Late-bind a layout engine (e.g. after async yoga WASM init).
   *  Re-dirties all existing nodes so the next tick computes layout. */
  setLayoutEngine(engine: ILayoutEngine): void {
    this._layoutEngine = engine;
    this._redirtyAllNodes(this._dom.root);
  }

  /** Recursively enqueue all nodes in the tree so layout is computed on next tick. */
  private _redirtyAllNodes(node: VirtualNode): void {
    node.markDirty(DirtyFlags.Style);
    this._dom.dirtyQueue.enqueue(node);
    for (const child of node.children) {
      this._redirtyAllNodes(child);
    }
  }

  /** Mark a node as newly created (will emit Create command on next tick). */
  markCreated(nodeId: number): void {
    this._createdNodes.add(nodeId);
  }

  /** Mark a node as destroyed (will emit Destroy command). */
  markDestroyed(nodeId: number): void {
    this._prevStyles.delete(nodeId);
    this._prevLayout.delete(nodeId);
    this._prevText.delete(nodeId);
    this._createdNodes.delete(nodeId);
  }

  tick(viewportWidth?: number, viewportHeight?: number): IRenderCommandBuffer {
    this._buffer.clear();

    const dirtyNodes = this._dom.dirtyQueue.drainAll();
    if (dirtyNodes.length === 0) return this._buffer;

    // 1. Ensure yoga nodes exist and tree structure is synced for dirty nodes
    if (this._layoutEngine) {
      for (const node of dirtyNodes) {
        this._layoutEngine.createYogaNode(node);
        if (node.parent) {
          // Ensure parent yoga node exists too
          this._layoutEngine.createYogaNode(node.parent);
          const idx = node.parent.children.indexOf(node);
          this._layoutEngine.insertChild(node.parent, node, idx);
        }
      }
    }

    // 2. Resolve computed styles for dirty subtrees
    try {
      this._styleResolver.resolveTree(
        this._dom.root,
        this._styleSheetManager.allRules,
      );
    } catch (err) {
      console.error("[Webium] Style resolution error:", err);
      this._logger?.logException(err);
    }

    // 3. Sync styles to yoga nodes and compute layout
    if (this._layoutEngine) {
      try {
        for (const node of dirtyNodes) {
          this._layoutEngine.syncStyles(node);
        }
        this._layoutEngine.collapseMargins(this._dom.root);
        this._layoutEngine.computeLayout(this._dom.root, viewportWidth, viewportHeight);
      } catch (err) {
        console.error("[Webium] Layout computation error:", err);
        this._logger?.logException(err);
      }
    }

    // 4. Emit render commands by diffing previous vs current state
    for (const node of dirtyNodes) {
      try {
        this._emitCommands(node);
      } catch (err) {
        console.error("[Webium] Render command emission error:", err);
        this._logger?.logException(err);
      }
      node.dirty = DirtyFlags.None;
    }

    return this._buffer;
  }

  private _emitCommands(node: VirtualNode): void {
    const flags = node.dirty;
    let isNewlyCreated = false;

    // Create command for newly created nodes
    if (this._createdNodes.has(node.id)) {
      this._createdNodes.delete(node.id);
      isNewlyCreated = true;
      const parentId = node.parent?.id ?? 0;
      const siblingIndex = node.parent
        ? node.parent.children.indexOf(node)
        : 0;
      this._buffer.push({
        op: RenderOp.Create,
        nodeId: node.id,
        tag: node.tag,
        parentId,
        siblingIndex,
      });

      // Newly created nodes with text content need an UpdateText command
      // even if DirtyFlags.Text isn't set (createTextNode doesn't set it)
      if (node.textContent != null && node.textContent !== "") {
        this._buffer.push({
          op: RenderOp.UpdateText,
          nodeId: node.id,
          text: node.textContent,
        });
        this._prevText.set(node.id, node.textContent);
      }
    }

    // Tree changes (reparent)
    if (flags & DirtyFlags.Tree) {
      // If node has a parent and was reparented, emit Reparent
      if (node.parent) {
        const siblingIndex = node.parent.children.indexOf(node);
        // Only emit reparent if this isn't a newly created node
        if (!this._createdNodes.has(node.id)) {
          // Check if we already emitted a Create for this node in this tick
          const alreadyCreated = this._buffer.commands.some(
            (c) => c.nodeId === node.id && c.op === RenderOp.Create,
          );
          if (!alreadyCreated) {
            this._buffer.push({
              op: RenderOp.Reparent,
              nodeId: node.id,
              parentId: node.parent.id,
              siblingIndex,
            });
          }
        }
      }
    }

    // Style changes — emit for newly created nodes OR when Style flag is set
    if ((flags & DirtyFlags.Style) || isNewlyCreated) {
      const current = node.computedStyle;
      const prev = this._prevStyles.get(node.id);
      if (current) {
        const changed = this._diffStyles(prev ?? null, current);
        if (Object.keys(changed).length > 0) {
          this._buffer.push({
            op: RenderOp.UpdateStyle,
            nodeId: node.id,
            styles: changed,
          });
        }
        this._prevStyles.set(node.id, new Map(current));
      }
    }

    // Text changes
    if (flags & DirtyFlags.Text) {
      const prevText = this._prevText.get(node.id) ?? null;
      if (node.textContent !== prevText) {
        this._buffer.push({
          op: RenderOp.UpdateText,
          nodeId: node.id,
          text: node.textContent ?? "",
        });
        this._prevText.set(node.id, node.textContent);
      }
    }

    // Layout changes
    if (this._layoutEngine) {
      const layout = this._layoutEngine.getLayout(node);
      if (layout) {
        const prev = this._prevLayout.get(node.id);
        if (
          !prev ||
          prev.x !== layout.x ||
          prev.y !== layout.y ||
          prev.width !== layout.width ||
          prev.height !== layout.height
        ) {
          this._buffer.push({
            op: RenderOp.UpdateLayout,
            nodeId: node.id,
            x: layout.x,
            y: layout.y,
            width: layout.width,
            height: layout.height,
          });
          this._prevLayout.set(node.id, { ...layout });
        }
      }
    }
  }

  private _diffStyles(
    prev: ReadonlyMap<string, string> | null,
    current: ReadonlyMap<string, string>,
  ): Record<string, string> {
    const changed: Record<string, string> = {};
    for (const [prop, value] of current) {
      if (!prev || prev.get(prop) !== value) {
        changed[prop] = value;
      }
    }
    return changed;
  }
}
