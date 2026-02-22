import { VirtualNode } from "./virtual-node.js";
import type { NodeTag } from "./types.js";

/**
 * Stack-based free list for reusing VirtualNode instances to reduce GC pressure.
 *
 * @see Requirements 1.8, 1.9, 1.10, 1.11
 */
export class NodePool {
  private readonly _pool: VirtualNode[] = [];

  /** Number of nodes currently available in the pool. */
  get pooledCount(): number {
    return this._pool.length;
  }

  /**
   * Rent a VirtualNode from the pool. If the pool has nodes, pops one from the
   * stack and sets its tag. Otherwise creates a new VirtualNode with the tag.
   */
  rent(tag: NodeTag): VirtualNode {
    if (this._pool.length > 0) {
      const node = this._pool.pop()!;
      node.tag = tag;
      node.inPool = false;
      return node;
    }
    const node = new VirtualNode();
    node.tag = tag;
    return node;
  }

  /**
   * Return a VirtualNode to the pool for reuse.
   *
   * @throws Error if the node still has a parent.
   * No-op if the node is already in the pool (idempotent).
   */
  return(node: VirtualNode): void {
    if (node.parent !== null) {
      throw new Error("Cannot return a node that still has a parent.");
    }
    if (node.inPool) {
      return;
    }
    node.reset();
    node.inPool = true;
    this._pool.push(node);
  }
}
