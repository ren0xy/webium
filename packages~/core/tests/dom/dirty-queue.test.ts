import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { DirtyQueue } from "../../src/dom/dirty-queue.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";

describe("DirtyQueue", () => {
  it("starts empty", () => {
    const queue = new DirtyQueue();
    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it("enqueue increases count", () => {
    const queue = new DirtyQueue();
    const node = new VirtualNode();
    queue.enqueue(node);
    expect(queue.count).toBe(1);
    expect(queue.isEmpty).toBe(false);
  });

  it("enqueue deduplicates same node", () => {
    const queue = new DirtyQueue();
    const node = new VirtualNode();
    queue.enqueue(node);
    queue.enqueue(node);
    queue.enqueue(node);
    expect(queue.count).toBe(1);
  });

  it("enqueue accepts distinct nodes", () => {
    const queue = new DirtyQueue();
    const a = new VirtualNode();
    const b = new VirtualNode();
    queue.enqueue(a);
    queue.enqueue(b);
    expect(queue.count).toBe(2);
  });

  it("drainAll returns all nodes in enqueue order", () => {
    const queue = new DirtyQueue();
    const a = new VirtualNode();
    const b = new VirtualNode();
    const c = new VirtualNode();
    queue.enqueue(a);
    queue.enqueue(b);
    queue.enqueue(c);

    const result = queue.drainAll();
    expect(result).toEqual([a, b, c]);
  });

  it("drainAll returns a copy, not the internal array", () => {
    const queue = new DirtyQueue();
    const node = new VirtualNode();
    queue.enqueue(node);

    const result = queue.drainAll();
    result.push(new VirtualNode());
    // Queue should still be empty after drain
    expect(queue.count).toBe(0);
  });

  it("drainAll clears the queue", () => {
    const queue = new DirtyQueue();
    queue.enqueue(new VirtualNode());
    queue.enqueue(new VirtualNode());

    queue.drainAll();
    expect(queue.count).toBe(0);
    expect(queue.isEmpty).toBe(true);
  });

  it("drainAll on empty queue returns empty array", () => {
    const queue = new DirtyQueue();
    const result = queue.drainAll();
    expect(result).toEqual([]);
  });

  it("second drainAll returns empty after first drain", () => {
    const queue = new DirtyQueue();
    queue.enqueue(new VirtualNode());
    queue.drainAll();

    const result = queue.drainAll();
    expect(result).toEqual([]);
  });

  it("can enqueue again after drainAll", () => {
    const queue = new DirtyQueue();
    const node = new VirtualNode();
    queue.enqueue(node);
    queue.drainAll();

    // Same node can be re-enqueued after drain
    queue.enqueue(node);
    expect(queue.count).toBe(1);
    expect(queue.drainAll()).toEqual([node]);
  });

  it("deduplicates interleaved enqueue of same and different nodes", () => {
    const queue = new DirtyQueue();
    const a = new VirtualNode();
    const b = new VirtualNode();
    queue.enqueue(a);
    queue.enqueue(b);
    queue.enqueue(a);
    queue.enqueue(b);
    queue.enqueue(a);

    expect(queue.count).toBe(2);
    expect(queue.drainAll()).toEqual([a, b]);
  });
});


// Feature: js-core-migration, Property 8: DirtyQueue deduplication and drain
describe("Property 8: DirtyQueue deduplication and drain", () => {
  // **Validates: Requirements 2.2, 2.3**

  it("drainAll returns each distinct node exactly once, and a subsequent drainAll returns empty", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 20 }),
        fc.array(fc.integer({ min: 0, max: 19 }), { minLength: 1, maxLength: 100 }),
        (nodeCount, enqueueIndices) => {
          // Create a pool of distinct nodes
          const nodes: VirtualNode[] = [];
          for (let i = 0; i < nodeCount; i++) {
            const node = new VirtualNode();
            node.id = i;
            nodes.push(node);
          }

          const queue = new DirtyQueue();

          // Enqueue nodes using the generated indices (may repeat same node)
          const enqueuedSet = new Set<VirtualNode>();
          for (const idx of enqueueIndices) {
            const node = nodes[idx % nodeCount];
            queue.enqueue(node);
            enqueuedSet.add(node);
          }

          // drainAll should return each distinct node exactly once
          const drained = queue.drainAll();

          expect(drained.length).toBe(enqueuedSet.size);

          // Every drained node should be one we enqueued
          const drainedSet = new Set(drained);
          expect(drainedSet.size).toBe(drained.length); // no duplicates in result

          for (const node of drained) {
            expect(enqueuedSet.has(node)).toBe(true);
          }

          // All enqueued nodes should appear in the drain
          for (const node of enqueuedSet) {
            expect(drainedSet.has(node)).toBe(true);
          }

          // Subsequent drainAll returns empty
          const secondDrain = queue.drainAll();
          expect(secondDrain).toEqual([]);
        },
      ),
      { numRuns: 100 },
    );
  });
});
