import { VirtualNode } from "./virtual-node.js";
import { NodeTag, DirtyFlags } from "./types.js";
import { NodePool } from "./node-pool.js";
import { DirtyQueue } from "./dirty-queue.js";

/**
 * Virtual DOM tree manager.
 *
 * Owns the node registry (id→node), node pool, dirty queue, and tree
 * operations (appendChild, removeChild, insertBefore).
 *
 * @see Requirements 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.4
 */
export class VirtualDOM {
  private readonly _registry: Map<number, VirtualNode> = new Map();
  private readonly _pool: NodePool;
  private readonly _dirtyQueue: DirtyQueue;
  private _nextId: number = 1;
  private readonly _root: VirtualNode;

  constructor(pool?: NodePool, dirtyQueue?: DirtyQueue) {
    this._pool = pool ?? new NodePool();
    this._dirtyQueue = dirtyQueue ?? new DirtyQueue();

    // Create the root node directly (not from pool) with id 0
    this._root = new VirtualNode();
    this._root.id = 0;
    this._root.tag = NodeTag.Div;
    this._registry.set(0, this._root);
  }

  /** The root node of the virtual DOM tree. */
  get root(): VirtualNode {
    return this._root;
  }

  /** The dirty queue, exposed for the ReconciliationEngine to drain. */
  get dirtyQueue(): DirtyQueue {
    return this._dirtyQueue;
  }

  /**
   * Create an element node with the given tag.
   * Assigns a unique monotonically increasing id and registers the node.
   */
  createElement(tag: NodeTag): VirtualNode {
    const node = this._pool.rent(tag);
    node.id = this._nextId++;
    this._registry.set(node.id, node);
    return node;
  }

  /**
   * Create a text node with the given text content.
   * Assigns a unique monotonically increasing id and registers the node.
   */
  createTextNode(text: string): VirtualNode {
    const node = this._pool.rent(NodeTag.Text);
    node.id = this._nextId++;
    node.textContent = text;
    this._registry.set(node.id, node);
    return node;
  }

  /**
   * Append child to parent.
   *
   * - Detaches child from old parent if any.
   * - Throws if the operation would create a cycle.
   * - Marks both parent and child dirty with Tree flag and enqueues them.
   */
  appendChild(parent: VirtualNode, child: VirtualNode): void {
    this._detectCycle(parent, child);
    this._detachFromParent(child);

    parent.children.push(child);
    child.parent = parent;

    parent.markDirty(DirtyFlags.Tree);
    child.markDirty(DirtyFlags.Tree);
    this._dirtyQueue.enqueue(parent);
    this._dirtyQueue.enqueue(child);
  }

  /**
   * Remove child from parent.
   *
   * @throws Error if child is not in parent's children list.
   */
  removeChild(parent: VirtualNode, child: VirtualNode): void {
    const idx = parent.children.indexOf(child);
    if (idx === -1) {
      throw new Error("The node to be removed is not a child of this node.");
    }

    parent.children.splice(idx, 1);
    child.parent = null;

    parent.markDirty(DirtyFlags.Tree);
    this._dirtyQueue.enqueue(parent);
  }

  /**
   * Insert newChild before refChild in parent's children list.
   *
   * - If refChild is null, behaves like appendChild.
   * - Throws if refChild is not in parent's children list.
   * - Throws if the operation would create a cycle.
   * - Detaches newChild from old parent if any.
   */
  insertBefore(
    parent: VirtualNode,
    newChild: VirtualNode,
    refChild: VirtualNode | null,
  ): void {
    if (refChild === null) {
      this.appendChild(parent, newChild);
      return;
    }

    const refIdx = parent.children.indexOf(refChild);
    if (refIdx === -1) {
      throw new Error(
        "The node before which the new node is to be inserted is not a child of this node.",
      );
    }

    this._detectCycle(parent, newChild);
    this._detachFromParent(newChild);

    parent.children.splice(refIdx, 0, newChild);
    newChild.parent = parent;

    parent.markDirty(DirtyFlags.Tree);
    newChild.markDirty(DirtyFlags.Tree);
    this._dirtyQueue.enqueue(parent);
    this._dirtyQueue.enqueue(newChild);
  }

  /**
   * Look up a node by its id.
   * Returns null if no node with that id is registered.
   */
  getNodeById(id: number): VirtualNode | null {
    return this._registry.get(id) ?? null;
  }

  /**
   * Walk up from parent to root. If we encounter child, it would create a cycle.
   * Also checks the trivial case: parent === child.
   */
  private _detectCycle(parent: VirtualNode, child: VirtualNode): void {
    if (parent === child) {
      throw new Error("Cannot append a node to itself.");
    }
    let current: VirtualNode | null = parent;
    while (current !== null) {
      if (current === child) {
        throw new Error(
          "Cannot append a node to one of its descendants (cycle detected).",
        );
      }
      current = current.parent;
    }
  }

  /**
   * If the child currently has a parent, remove it from that parent's children list.
   */
  private _detachFromParent(child: VirtualNode): void {
    if (child.parent !== null) {
      const oldParent = child.parent;
      const idx = oldParent.children.indexOf(child);
      if (idx !== -1) {
        oldParent.children.splice(idx, 1);
      }
      child.parent = null;
    }
  }
}
