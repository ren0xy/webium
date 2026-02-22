import type { VirtualNode } from "./virtual-node.js";

/**
 * Deduplicated queue of VirtualNodes that have been modified since the last tick.
 * Uses an array for ordered storage and a Set for O(1) deduplication.
 *
 * @see Requirements 2.2, 2.3
 */
export class DirtyQueue {
  private readonly _queue: VirtualNode[] = [];
  private readonly _set: Set<VirtualNode> = new Set();

  /** Number of nodes currently in the queue. */
  get count(): number {
    return this._queue.length;
  }

  /** True if the queue has no nodes. */
  get isEmpty(): boolean {
    return this._queue.length === 0;
  }

  /**
   * Enqueue a node. If the node is already in the queue, this is a no-op.
   */
  enqueue(node: VirtualNode): void {
    if (this._set.has(node)) {
      return;
    }
    this._set.add(node);
    this._queue.push(node);
  }

  /**
   * Return a copy of all queued nodes and clear the queue.
   */
  drainAll(): VirtualNode[] {
    const result = this._queue.slice();
    this._queue.length = 0;
    this._set.clear();
    return result;
  }
}
