import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag, DirtyFlags } from "../../src/dom/types.js";
import { NodePool } from "../../src/dom/node-pool.js";
import { DirtyQueue } from "../../src/dom/dirty-queue.js";

describe("VirtualDOM", () => {
  describe("constructor", () => {
    it("creates a root node with id 0 and tag Div", () => {
      const dom = new VirtualDOM();
      expect(dom.root).toBeInstanceOf(VirtualNode);
      expect(dom.root.id).toBe(0);
      expect(dom.root.tag).toBe(NodeTag.Div);
    });

    it("root is retrievable via getNodeById(0)", () => {
      const dom = new VirtualDOM();
      expect(dom.getNodeById(0)).toBe(dom.root);
    });

    it("exposes dirtyQueue", () => {
      const dom = new VirtualDOM();
      expect(dom.dirtyQueue).toBeInstanceOf(DirtyQueue);
    });

    it("accepts injected pool and dirtyQueue", () => {
      const pool = new NodePool();
      const queue = new DirtyQueue();
      const dom = new VirtualDOM(pool, queue);
      expect(dom.dirtyQueue).toBe(queue);
    });
  });

  describe("createElement", () => {
    it("creates a node with the given tag", () => {
      const dom = new VirtualDOM();
      const node = dom.createElement(NodeTag.Span);
      expect(node.tag).toBe(NodeTag.Span);
    });

    it("assigns monotonically increasing ids starting from 1", () => {
      const dom = new VirtualDOM();
      const a = dom.createElement(NodeTag.Div);
      const b = dom.createElement(NodeTag.Span);
      const c = dom.createElement(NodeTag.P);
      expect(a.id).toBe(1);
      expect(b.id).toBe(2);
      expect(c.id).toBe(3);
    });

    it("registers the node so getNodeById returns it", () => {
      const dom = new VirtualDOM();
      const node = dom.createElement(NodeTag.Div);
      expect(dom.getNodeById(node.id)).toBe(node);
    });
  });

  describe("createTextNode", () => {
    it("creates a text node with NodeTag.Text", () => {
      const dom = new VirtualDOM();
      const node = dom.createTextNode("hello");
      expect(node.tag).toBe(NodeTag.Text);
    });

    it("sets textContent", () => {
      const dom = new VirtualDOM();
      const node = dom.createTextNode("hello");
      expect(node.textContent).toBe("hello");
    });

    it("assigns a unique id and registers the node", () => {
      const dom = new VirtualDOM();
      const a = dom.createTextNode("a");
      const b = dom.createTextNode("b");
      expect(a.id).not.toBe(b.id);
      expect(dom.getNodeById(a.id)).toBe(a);
      expect(dom.getNodeById(b.id)).toBe(b);
    });
  });

  describe("appendChild", () => {
    it("appends child to parent's children list", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      expect(dom.root.children).toContain(child);
    });

    it("sets child.parent to the parent", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      expect(child.parent).toBe(dom.root);
    });

    it("marks both parent and child dirty with Tree flag", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      expect(dom.root.dirty & DirtyFlags.Tree).toBeTruthy();
      expect(child.dirty & DirtyFlags.Tree).toBeTruthy();
    });

    it("enqueues both parent and child in the dirty queue", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      const drained = dom.dirtyQueue.drainAll();
      expect(drained).toContain(dom.root);
      expect(drained).toContain(child);
    });

    it("detaches child from old parent when re-appending", () => {
      const dom = new VirtualDOM();
      const parent1 = dom.createElement(NodeTag.Div);
      const parent2 = dom.createElement(NodeTag.Div);
      const child = dom.createElement(NodeTag.Span);

      dom.appendChild(dom.root, parent1);
      dom.appendChild(dom.root, parent2);
      dom.appendChild(parent1, child);
      expect(parent1.children).toContain(child);

      dom.appendChild(parent2, child);
      expect(parent1.children).not.toContain(child);
      expect(parent2.children).toContain(child);
      expect(child.parent).toBe(parent2);
    });

    it("throws when appending a node to itself", () => {
      const dom = new VirtualDOM();
      const node = dom.createElement(NodeTag.Div);
      expect(() => dom.appendChild(node, node)).toThrow();
    });

    it("throws when appending an ancestor to a descendant (cycle)", () => {
      const dom = new VirtualDOM();
      const parent = dom.createElement(NodeTag.Div);
      const child = dom.createElement(NodeTag.Span);
      const grandchild = dom.createElement(NodeTag.P);

      dom.appendChild(dom.root, parent);
      dom.appendChild(parent, child);
      dom.appendChild(child, grandchild);

      expect(() => dom.appendChild(grandchild, parent)).toThrow();
    });

    it("leaves tree unchanged when cycle is detected", () => {
      const dom = new VirtualDOM();
      const parent = dom.createElement(NodeTag.Div);
      const child = dom.createElement(NodeTag.Span);

      dom.appendChild(dom.root, parent);
      dom.appendChild(parent, child);

      // Snapshot state before
      const parentChildrenBefore = [...parent.children];
      const childParentBefore = child.parent;

      expect(() => dom.appendChild(child, parent)).toThrow();

      // Tree unchanged
      expect(parent.children).toEqual(parentChildrenBefore);
      expect(child.parent).toBe(childParentBefore);
    });
  });

  describe("removeChild", () => {
    it("removes child from parent's children list", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      dom.removeChild(dom.root, child);
      expect(dom.root.children).not.toContain(child);
    });

    it("sets child.parent to null", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      dom.removeChild(dom.root, child);
      expect(child.parent).toBeNull();
    });

    it("marks parent dirty with Tree flag", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      dom.root.dirty = DirtyFlags.None; // reset
      dom.dirtyQueue.drainAll(); // clear queue

      dom.removeChild(dom.root, child);
      expect(dom.root.dirty & DirtyFlags.Tree).toBeTruthy();
    });

    it("enqueues parent in the dirty queue", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.appendChild(dom.root, child);
      dom.dirtyQueue.drainAll(); // clear

      dom.removeChild(dom.root, child);
      const drained = dom.dirtyQueue.drainAll();
      expect(drained).toContain(dom.root);
    });

    it("throws if child is not a child of the parent", () => {
      const dom = new VirtualDOM();
      const notChild = dom.createElement(NodeTag.Div);
      expect(() => dom.removeChild(dom.root, notChild)).toThrow(
        "The node to be removed is not a child of this node.",
      );
    });
  });

  describe("insertBefore", () => {
    it("inserts newChild before refChild", () => {
      const dom = new VirtualDOM();
      const a = dom.createElement(NodeTag.Div);
      const b = dom.createElement(NodeTag.Span);
      const c = dom.createElement(NodeTag.P);

      dom.appendChild(dom.root, a);
      dom.appendChild(dom.root, b);
      dom.insertBefore(dom.root, c, b);

      expect(dom.root.children.indexOf(c)).toBe(
        dom.root.children.indexOf(b) - 1,
      );
    });

    it("sets newChild.parent to parent", () => {
      const dom = new VirtualDOM();
      const ref = dom.createElement(NodeTag.Div);
      const newChild = dom.createElement(NodeTag.Span);
      dom.appendChild(dom.root, ref);
      dom.insertBefore(dom.root, newChild, ref);
      expect(newChild.parent).toBe(dom.root);
    });

    it("marks both parent and newChild dirty with Tree flag", () => {
      const dom = new VirtualDOM();
      const ref = dom.createElement(NodeTag.Div);
      const newChild = dom.createElement(NodeTag.Span);
      dom.appendChild(dom.root, ref);
      dom.root.dirty = DirtyFlags.None;
      dom.dirtyQueue.drainAll();

      dom.insertBefore(dom.root, newChild, ref);
      expect(dom.root.dirty & DirtyFlags.Tree).toBeTruthy();
      expect(newChild.dirty & DirtyFlags.Tree).toBeTruthy();
    });

    it("enqueues both parent and newChild in the dirty queue", () => {
      const dom = new VirtualDOM();
      const ref = dom.createElement(NodeTag.Div);
      const newChild = dom.createElement(NodeTag.Span);
      dom.appendChild(dom.root, ref);
      dom.dirtyQueue.drainAll();

      dom.insertBefore(dom.root, newChild, ref);
      const drained = dom.dirtyQueue.drainAll();
      expect(drained).toContain(dom.root);
      expect(drained).toContain(newChild);
    });

    it("behaves like appendChild when refChild is null", () => {
      const dom = new VirtualDOM();
      const child = dom.createElement(NodeTag.Div);
      dom.insertBefore(dom.root, child, null);
      expect(dom.root.children).toContain(child);
      expect(child.parent).toBe(dom.root);
    });

    it("detaches newChild from old parent", () => {
      const dom = new VirtualDOM();
      const oldParent = dom.createElement(NodeTag.Div);
      const newParent = dom.createElement(NodeTag.Div);
      const ref = dom.createElement(NodeTag.Span);
      const child = dom.createElement(NodeTag.P);

      dom.appendChild(dom.root, oldParent);
      dom.appendChild(dom.root, newParent);
      dom.appendChild(oldParent, child);
      dom.appendChild(newParent, ref);

      dom.insertBefore(newParent, child, ref);
      expect(oldParent.children).not.toContain(child);
      expect(newParent.children).toContain(child);
      expect(child.parent).toBe(newParent);
    });

    it("throws if refChild is not a child of parent", () => {
      const dom = new VirtualDOM();
      const notChild = dom.createElement(NodeTag.Div);
      const newChild = dom.createElement(NodeTag.Span);
      expect(() => dom.insertBefore(dom.root, newChild, notChild)).toThrow(
        "The node before which the new node is to be inserted is not a child of this node.",
      );
    });

    it("throws on cycle detection", () => {
      const dom = new VirtualDOM();
      const parent = dom.createElement(NodeTag.Div);
      const child = dom.createElement(NodeTag.Span);
      const ref = dom.createElement(NodeTag.P);

      dom.appendChild(dom.root, parent);
      dom.appendChild(parent, child);
      dom.appendChild(child, ref);

      expect(() => dom.insertBefore(child, parent, ref)).toThrow();
    });

    it("leaves tree unchanged when cycle is detected via insertBefore", () => {
      const dom = new VirtualDOM();
      const parent = dom.createElement(NodeTag.Div);
      const child = dom.createElement(NodeTag.Span);
      const ref = dom.createElement(NodeTag.P);

      dom.appendChild(dom.root, parent);
      dom.appendChild(parent, child);
      dom.appendChild(child, ref);

      const childChildrenBefore = [...child.children];
      const parentParentBefore = parent.parent;

      expect(() => dom.insertBefore(child, parent, ref)).toThrow();

      expect(child.children).toEqual(childChildrenBefore);
      expect(parent.parent).toBe(parentParentBefore);
    });
  });

  describe("getNodeById", () => {
    it("returns null for unregistered ids", () => {
      const dom = new VirtualDOM();
      expect(dom.getNodeById(999)).toBeNull();
    });

    it("returns the correct node for registered ids", () => {
      const dom = new VirtualDOM();
      const a = dom.createElement(NodeTag.Div);
      const b = dom.createElement(NodeTag.Span);
      expect(dom.getNodeById(a.id)).toBe(a);
      expect(dom.getNodeById(b.id)).toBe(b);
    });
  });
});

const numericNodeTags = Object.values(NodeTag).filter(
  (v): v is NodeTag => typeof v === "number",
);

describe("VirtualDOM Property Tests", () => {
  // Feature: js-core-migration, Property 1: Node creation produces unique, registered, retrievable nodes
  // **Validates: Requirements 1.2, 1.3**
  it("Property 1: all created nodes have unique ids and are retrievable", () => {
    fc.assert(
      fc.property(
        fc.array(fc.constantFrom(...numericNodeTags), {
          minLength: 1,
          maxLength: 50,
        }),
        (tags) => {
          const dom = new VirtualDOM();
          const ids = new Set<number>();
          let prevId = -1;
          for (const tag of tags) {
            const node = dom.createElement(tag);
            expect(ids.has(node.id)).toBe(false);
            expect(node.id).toBeGreaterThan(prevId);
            expect(dom.getNodeById(node.id)).toBe(node);
            ids.add(node.id);
            prevId = node.id;
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: js-core-migration, Property 2: appendChild correctness
  // **Validates: Requirements 1.4**
  it("Property 2: appendChild sets parent, adds to children, removes from old parent, and marks dirty", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 1, max: 10 }),
        (parentChildCount, reparentIndex) => {
          const dom = new VirtualDOM();

          // Build a parent with some children
          const parent1 = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, parent1);
          const children: VirtualNode[] = [];
          for (let i = 0; i < parentChildCount; i++) {
            const c = dom.createElement(NodeTag.Span);
            dom.appendChild(parent1, c);
            children.push(c);
          }

          // Pick a child to reparent
          const childIdx = reparentIndex % children.length;
          const child = children[childIdx];

          // Create a new parent
          const parent2 = dom.createElement(NodeTag.P);
          dom.appendChild(dom.root, parent2);

          // Clear dirty state
          dom.dirtyQueue.drainAll();
          parent1.dirty = DirtyFlags.None;
          parent2.dirty = DirtyFlags.None;
          child.dirty = DirtyFlags.None;

          // Perform appendChild
          dom.appendChild(parent2, child);

          // child's parent is the new parent
          expect(child.parent).toBe(parent2);
          // child appears in new parent's children
          expect(parent2.children).toContain(child);
          // child is removed from old parent's children
          expect(parent1.children).not.toContain(child);
          // both parent and child have Tree dirty flag
          expect(parent2.dirty & DirtyFlags.Tree).toBeTruthy();
          expect(child.dirty & DirtyFlags.Tree).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: js-core-migration, Property 3: removeChild correctness
  // **Validates: Requirements 1.5**
  it("Property 3: removeChild detaches child, clears parent, and marks parent dirty", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 15 }),
        fc.integer({ min: 0, max: 100 }),
        (childCount, removeIdx) => {
          const dom = new VirtualDOM();
          const parent = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, parent);

          const children: VirtualNode[] = [];
          for (let i = 0; i < childCount; i++) {
            const c = dom.createElement(NodeTag.Span);
            dom.appendChild(parent, c);
            children.push(c);
          }

          // Pick a child to remove
          const idx = removeIdx % children.length;
          const child = children[idx];

          // Clear dirty state
          dom.dirtyQueue.drainAll();
          parent.dirty = DirtyFlags.None;

          dom.removeChild(parent, child);

          // child's parent is null
          expect(child.parent).toBeNull();
          // parent's children list does not contain the child
          expect(parent.children).not.toContain(child);
          // parent has Tree dirty flag
          expect(parent.dirty & DirtyFlags.Tree).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: js-core-migration, Property 4: insertBefore correctness
  // **Validates: Requirements 1.6**
  it("Property 4: insertBefore places newChild immediately before refChild and marks dirty", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.integer({ min: 0, max: 100 }),
        (childCount, refIdx) => {
          const dom = new VirtualDOM();
          const parent = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, parent);

          // Add existing children to parent
          const existingChildren: VirtualNode[] = [];
          for (let i = 0; i < childCount; i++) {
            const c = dom.createElement(NodeTag.Span);
            dom.appendChild(parent, c);
            existingChildren.push(c);
          }

          // Pick a reference child
          const refChild = existingChildren[refIdx % existingChildren.length];

          // Create a new child to insert
          const newChild = dom.createElement(NodeTag.P);

          // Clear dirty state
          dom.dirtyQueue.drainAll();
          parent.dirty = DirtyFlags.None;
          newChild.dirty = DirtyFlags.None;

          dom.insertBefore(parent, newChild, refChild);

          // newChild appears immediately before refChild
          const newIdx = parent.children.indexOf(newChild);
          const refChildIdx = parent.children.indexOf(refChild);
          expect(newIdx).toBe(refChildIdx - 1);
          // newChild's parent is the parent
          expect(newChild.parent).toBe(parent);
          // both are marked dirty
          expect(parent.dirty & DirtyFlags.Tree).toBeTruthy();
          expect(newChild.dirty & DirtyFlags.Tree).toBeTruthy();
        },
      ),
      { numRuns: 100 },
    );
  });

  // Feature: js-core-migration, Property 5: Cycle detection prevents tree corruption
  // **Validates: Requirements 1.7**
  it("Property 5: appendChild(N, N) or appendChild(descendant, ancestor) throws and leaves tree unchanged", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        fc.boolean(),
        (depth, selfAppend) => {
          const dom = new VirtualDOM();

          // Build a chain: root -> n0 -> n1 -> ... -> n(depth-1)
          const chain: VirtualNode[] = [];
          let current: VirtualNode = dom.root;
          for (let i = 0; i < depth; i++) {
            const node = dom.createElement(NodeTag.Div);
            dom.appendChild(current, node);
            chain.push(node);
            current = node;
          }

          // Drain and clear dirty state
          dom.dirtyQueue.drainAll();

          // Snapshot the tree structure before the invalid operation
          const snapshot = chain.map((n) => ({
            parent: n.parent,
            children: [...n.children],
          }));

          if (selfAppend) {
            // Try appending a node to itself
            const node = chain[Math.floor(depth / 2)];
            expect(() => dom.appendChild(node, node)).toThrow();
          } else {
            // Try appending an ancestor to a descendant (cycle)
            const ancestor = chain[0]; // first in chain
            const descendant = chain[chain.length - 1]; // last in chain
            expect(() =>
              dom.appendChild(descendant, ancestor),
            ).toThrow();
          }

          // Verify tree structure is unchanged
          for (let i = 0; i < chain.length; i++) {
            expect(chain[i].parent).toBe(snapshot[i].parent);
            expect(chain[i].children).toEqual(snapshot[i].children);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
