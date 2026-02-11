import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { NodePool } from "../../src/dom/node-pool.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag, DirtyFlags, PseudoStates } from "../../src/dom/types.js";

describe("NodePool", () => {
  it("starts with zero pooled nodes", () => {
    const pool = new NodePool();
    expect(pool.pooledCount).toBe(0);
  });

  describe("rent", () => {
    it("creates a new node when pool is empty", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      expect(node).toBeInstanceOf(VirtualNode);
      expect(node.tag).toBe(NodeTag.Div);
    });

    it("reuses a pooled node when available", () => {
      const pool = new NodePool();
      const original = pool.rent(NodeTag.Div);
      pool.return(original);
      expect(pool.pooledCount).toBe(1);

      const reused = pool.rent(NodeTag.Span);
      expect(reused).toBe(original);
      expect(reused.tag).toBe(NodeTag.Span);
      expect(pool.pooledCount).toBe(0);
    });

    it("sets the tag on the rented node", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Img);
      expect(node.tag).toBe(NodeTag.Img);
    });

    it("sets inPool to false on rented node", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      pool.return(node);
      const rented = pool.rent(NodeTag.P);
      expect(rented.inPool).toBe(false);
    });
  });

  describe("return", () => {
    it("adds node to pool and increments pooledCount", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      pool.return(node);
      expect(pool.pooledCount).toBe(1);
    });

    it("throws if node still has a parent", () => {
      const pool = new NodePool();
      const node = new VirtualNode();
      node.parent = new VirtualNode();
      expect(() => pool.return(node)).toThrow(
        "Cannot return a node that still has a parent.",
      );
    });

    it("is a no-op when node is already in pool (idempotent)", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      pool.return(node);
      expect(pool.pooledCount).toBe(1);

      pool.return(node);
      expect(pool.pooledCount).toBe(1);
    });

    it("resets node fields on return", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      node.id = 99;
      node.attributes.set("class", "test");
      node.inlineStyles.set("color", "red");
      node.textContent = "hello";
      node.pseudoStates = PseudoStates.Hover;
      node.computedStyle = new Map([["color", "blue"]]);
      node.dirty = DirtyFlags.All;
      node.addEventListener("click", () => {});

      pool.return(node);

      // After return, node is reset (except inPool which is true)
      expect(node.id).toBe(0);
      expect(node.tag).toBe(NodeTag.Unknown);
      expect(node.parent).toBeNull();
      expect(node.children).toHaveLength(0);
      expect(node.attributes.size).toBe(0);
      expect(node.inlineStyles.size).toBe(0);
      expect(node.textContent).toBeNull();
      expect(node.pseudoStates).toBe(PseudoStates.None);
      expect(node.computedStyle).toBeNull();
      expect(node.dirty).toBe(DirtyFlags.None);
      expect(node.inPool).toBe(true);
    });

    it("sets inPool to true", () => {
      const pool = new NodePool();
      const node = pool.rent(NodeTag.Div);
      expect(node.inPool).toBe(false);
      pool.return(node);
      expect(node.inPool).toBe(true);
    });
  });

  describe("stack behavior (LIFO)", () => {
    it("returns the most recently pooled node first", () => {
      const pool = new NodePool();
      const a = pool.rent(NodeTag.Div);
      const b = pool.rent(NodeTag.Span);
      pool.return(a);
      pool.return(b);
      expect(pool.pooledCount).toBe(2);

      const first = pool.rent(NodeTag.P);
      expect(first).toBe(b);
      const second = pool.rent(NodeTag.Img);
      expect(second).toBe(a);
    });
  });
});


const arbNodeTag = fc.constantFrom(
  NodeTag.Div,
  NodeTag.Span,
  NodeTag.P,
  NodeTag.Img,
  NodeTag.Text,
  NodeTag.Style,
  NodeTag.Unknown,
);

// Feature: js-core-migration, Property 6: NodePool reuse and reset
describe("Property 6: NodePool reuse and reset", () => {
  // **Validates: Requirements 1.8, 1.9**

  it("rented node after return is the same instance with all fields reset to defaults", () => {
    fc.assert(
      fc.property(
        arbNodeTag,
        arbNodeTag,
        fc.string(),
        fc.string(),
        fc.string(),
        fc.string(),
        (rentTag, reRentTag, attrKey, attrVal, styleKey, styleVal) => {
          const pool = new NodePool();
          const node = pool.rent(rentTag);

          // Mutate the node to simulate usage
          node.id = 42;
          node.attributes.set(attrKey, attrVal);
          node.inlineStyles.set(styleKey, styleVal);
          node.textContent = "some text";
          node.computedStyle = new Map([["color", "red"]]);
          node.pseudoStates = PseudoStates.Hover | PseudoStates.Focus;
          node.dirty = DirtyFlags.All;

          // Return and re-rent
          pool.return(node);
          const rented = pool.rent(reRentTag);

          // Same object instance
          expect(rented).toBe(node);

          // Tag is set to the new rent tag
          expect(rented.tag).toBe(reRentTag);

          // All other fields are reset to defaults
          expect(rented.parent).toBeNull();
          expect(rented.children).toHaveLength(0);
          expect(rented.attributes.size).toBe(0);
          expect(rented.inlineStyles.size).toBe(0);
          expect(rented.textContent).toBeNull();
          expect(rented.computedStyle).toBeNull();
          expect(rented.inPool).toBe(false);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("event listeners are cleared after return and re-rent", () => {
    fc.assert(
      fc.property(
        arbNodeTag,
        arbNodeTag,
        fc.integer({ min: 1, max: 5 }),
        (rentTag, reRentTag, listenerCount) => {
          const pool = new NodePool();
          const node = pool.rent(rentTag);

          // Add event listeners
          for (let i = 0; i < listenerCount; i++) {
            node.addEventListener("click", () => {});
          }
          expect(node.eventListeners.getListeners("click").length).toBeGreaterThan(0);

          // Return and re-rent
          pool.return(node);
          const rented = pool.rent(reRentTag);

          expect(rented).toBe(node);
          // eventListeners should be reset — getListeners on a fresh store returns empty
          expect(rented.eventListeners.getListeners("click")).toHaveLength(0);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: js-core-migration, Property 7: NodePool return preconditions
describe("Property 7: NodePool return preconditions", () => {
  // **Validates: Requirements 1.10, 1.11**

  it("returning a node that still has a parent throws an error", () => {
    fc.assert(
      fc.property(
        arbNodeTag,
        arbNodeTag,
        (childTag, parentTag) => {
          const pool = new NodePool();
          const child = pool.rent(childTag);
          const parent = pool.rent(parentTag);

          // Simulate a parent relationship
          child.parent = parent;

          expect(() => pool.return(child)).toThrow(
            "Cannot return a node that still has a parent.",
          );
        },
      ),
      { numRuns: 100 },
    );
  });

  it("returning an already-pooled node is a no-op (pool count does not change)", () => {
    fc.assert(
      fc.property(
        arbNodeTag,
        fc.integer({ min: 2, max: 10 }),
        (tag, extraReturnCount) => {
          const pool = new NodePool();
          const node = pool.rent(tag);

          pool.return(node);
          const countAfterFirstReturn = pool.pooledCount;

          // Return the same node multiple additional times
          for (let i = 0; i < extraReturnCount; i++) {
            pool.return(node);
          }

          expect(pool.pooledCount).toBe(countAfterFirstReturn);
        },
      ),
      { numRuns: 100 },
    );
  });
});
