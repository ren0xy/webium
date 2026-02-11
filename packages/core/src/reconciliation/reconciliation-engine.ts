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
  tick(): IRenderCommandBuffer;
}

export class ReconciliationEngine implements IReconciliationEngine {
  private readonly _dom: VirtualDOM;
  private readonly _styleResolver: IComputedStyleResolver;
  private readonly _styleSheetManager: IStyleSheetManager;
  private readonly _layoutEngine: ILayoutEngine | null;
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

  tick(): IRenderCommandBuffer {
    this._buffer.clear();

    const dirtyNodes = this._dom.dirtyQueue.drainAll();
    if (dirtyNodes.length === 0) return this._buffer;

    // 1. Resolve computed styles for dirty subtrees
    try {
      this._styleResolver.resolveTree(
        this._dom.root,
        this._styleSheetManager.allRules,
      );
    } catch (err) {
      this._logger?.logException(err);
    }

    // 2. Compute layout via yoga-layout (if available)
    if (this._layoutEngine) {
      try {
        this._layoutEngine.computeLayout(this._dom.root);
      } catch (err) {
        this._logger?.logException(err);
      }
    }

    // 3. Emit render commands by diffing previous vs current state
    for (const node of dirtyNodes) {
      try {
        this._emitCommands(node);
      } catch (err) {
        this._logger?.logException(err);
      }
      node.dirty = DirtyFlags.None;
    }

    return this._buffer;
  }

  private _emitCommands(node: VirtualNode): void {
    const flags = node.dirty;

    // Create command for newly created nodes
    if (this._createdNodes.has(node.id)) {
      this._createdNodes.delete(node.id);
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

    // Style changes
    if (flags & DirtyFlags.Style) {
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
