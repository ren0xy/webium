import { describe, it, expect, vi } from "vitest";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { DOMEventImpl } from "../../src/events/dom-event.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag } from "../../src/dom/types.js";
import { EventPhase } from "../../src/events/types.js";
import type { DOMEvent } from "../../src/events/types.js";

function makeNode(tag: NodeTag = NodeTag.Div): VirtualNode {
  const n = new VirtualNode();
  n.tag = tag;
  return n;
}

/** Build a simple chain: root → mid → leaf */
function makeChain(): { root: VirtualNode; mid: VirtualNode; leaf: VirtualNode } {
  const root = makeNode();
  root.id = 1;
  const mid = makeNode();
  mid.id = 2;
  const leaf = makeNode();
  leaf.id = 3;
  root.children.push(mid);
  mid.parent = root;
  mid.children.push(leaf);
  leaf.parent = mid;
  return { root, mid, leaf };
}

describe("EventDispatcher", () => {
  const dispatcher = new EventDispatcher();

  describe("basic dispatch", () => {
    it("sets target on the event", () => {
      const node = makeNode();
      const evt = new DOMEventImpl("click");
      dispatcher.dispatchEvent(node, evt);
      expect(evt.target).toBe(node);
    });

    it("returns true when default not prevented", () => {
      const node = makeNode();
      const evt = new DOMEventImpl("click");
      expect(dispatcher.dispatchEvent(node, evt)).toBe(true);
    });

    it("returns false when default is prevented", () => {
      const node = makeNode();
      node.addEventListener("click", (e) => e.preventDefault(), false);
      const evt = new DOMEventImpl("click", false, true);
      expect(dispatcher.dispatchEvent(node, evt)).toBe(false);
    });

    it("cleans up currentTarget and eventPhase after dispatch", () => {
      const node = makeNode();
      const evt = new DOMEventImpl("click");
      dispatcher.dispatchEvent(node, evt);
      expect(evt.currentTarget).toBeNull();
      expect(evt.eventPhase).toBe(EventPhase.None);
    });
  });

  describe("capture phase", () => {
    it("invokes capture listeners on ancestors in root-first order", () => {
      const { root, mid, leaf } = makeChain();
      const order: number[] = [];
      root.addEventListener("click", () => order.push(1), true);
      mid.addEventListener("click", () => order.push(2), true);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      expect(order).toEqual([1, 2]);
    });

    it("does not invoke bubble listeners during capture phase", () => {
      const { root, leaf } = makeChain();
      const called = vi.fn();
      root.addEventListener("click", called, false); // bubble listener
      root.addEventListener("click", () => {}, true); // capture listener

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      // The bubble listener on root should only be called during bubble phase
      // Let's check it was called (during bubble phase)
      expect(called).toHaveBeenCalledTimes(1);
    });
  });

  describe("target phase", () => {
    it("invokes both capture and bubble listeners on target", () => {
      const node = makeNode();
      const order: string[] = [];
      node.addEventListener("click", () => order.push("capture"), true);
      node.addEventListener("click", () => order.push("bubble"), false);

      dispatcher.dispatchEvent(node, new DOMEventImpl("click", true));
      expect(order).toEqual(["capture", "bubble"]);
    });
  });

  describe("bubble phase", () => {
    it("invokes bubble listeners on ancestors in leaf-to-root order", () => {
      const { root, mid, leaf } = makeChain();
      const order: number[] = [];
      mid.addEventListener("click", () => order.push(2), false);
      root.addEventListener("click", () => order.push(1), false);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      expect(order).toEqual([2, 1]);
    });

    it("does not bubble when event.bubbles is false", () => {
      const { root, leaf } = makeChain();
      const called = vi.fn();
      root.addEventListener("test", called, false);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("test", false));
      expect(called).not.toHaveBeenCalled();
    });
  });

  describe("stopPropagation", () => {
    it("stops propagation to subsequent nodes but allows current node listeners", () => {
      const { root, mid, leaf } = makeChain();
      const order: string[] = [];
      root.addEventListener("click", () => order.push("root-cap"), true);
      mid.addEventListener(
        "click",
        (e) => {
          order.push("mid-cap-stop");
          e.stopPropagation();
        },
        true,
      );
      mid.addEventListener("click", () => order.push("mid-cap-2"), true);
      leaf.addEventListener("click", () => order.push("leaf"), false);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      expect(order).toEqual(["root-cap", "mid-cap-stop", "mid-cap-2"]);
    });
  });

  describe("stopImmediatePropagation", () => {
    it("stops all remaining listeners including on current node", () => {
      const { root, leaf } = makeChain();
      const order: string[] = [];
      root.addEventListener(
        "click",
        (e) => {
          order.push("root-1");
          e.stopImmediatePropagation();
        },
        true,
      );
      root.addEventListener("click", () => order.push("root-2"), true);
      leaf.addEventListener("click", () => order.push("leaf"), false);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      expect(order).toEqual(["root-1"]);
    });
  });

  describe("full phase ordering", () => {
    it("executes capture → target → bubble in correct order", () => {
      const { root, mid, leaf } = makeChain();
      const order: string[] = [];
      root.addEventListener("click", () => order.push("root-cap"), true);
      mid.addEventListener("click", () => order.push("mid-cap"), true);
      leaf.addEventListener("click", () => order.push("leaf-cap"), true);
      leaf.addEventListener("click", () => order.push("leaf-bub"), false);
      mid.addEventListener("click", () => order.push("mid-bub"), false);
      root.addEventListener("click", () => order.push("root-bub"), false);

      dispatcher.dispatchEvent(leaf, new DOMEventImpl("click", true));
      expect(order).toEqual([
        "root-cap", "mid-cap",
        "leaf-cap", "leaf-bub",
        "mid-bub", "root-bub",
      ]);
    });
  });

  describe("error handling", () => {
    it("catches listener exceptions and continues", () => {
      const logger = { logWarning: vi.fn(), logException: vi.fn() };
      const d = new EventDispatcher(logger);
      const node = makeNode();
      const order: string[] = [];

      node.addEventListener(
        "click",
        () => {
          throw new Error("boom");
        },
        false,
      );
      node.addEventListener("click", () => order.push("after"), false);

      d.dispatchEvent(node, new DOMEventImpl("click"));
      expect(order).toEqual(["after"]);
      expect(logger.logException).toHaveBeenCalledTimes(1);
    });

    it("throws on null target", () => {
      expect(() => dispatcher.dispatchEvent(null as any, new DOMEventImpl("click"))).toThrow();
    });

    it("throws on null event", () => {
      expect(() => dispatcher.dispatchEvent(makeNode(), null as any)).toThrow();
    });
  });
});

import fc from "fast-check";

/** Build a linear chain of nodes of given depth */
function makeLinearTree(depth: number): VirtualNode[] {
  const nodes: VirtualNode[] = [];
  for (let i = 0; i < depth; i++) {
    const n = makeNode();
    n.id = i + 1;
    if (i > 0) {
      nodes[i - 1].children.push(n);
      n.parent = nodes[i - 1];
    }
    nodes.push(n);
  }
  return nodes;
}

// Feature: js-core-migration, Property 14: Event dispatch phase ordering and listener filtering
describe("Property 14: Event dispatch phase ordering and listener filtering", () => {
  const dispatcher = new EventDispatcher();

  it("capture listeners fire root→parent, then all on target, then bubble parent→root", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 2, max: 6 }),
        fc.boolean(),
        (depth, bubbles) => {
          const nodes = makeLinearTree(depth);
          const target = nodes[nodes.length - 1];
          const log: string[] = [];

          for (const node of nodes) {
            const id = node.id;
            node.addEventListener("evt", () => log.push(`${id}-cap`), true);
            node.addEventListener("evt", () => log.push(`${id}-bub`), false);
          }

          dispatcher.dispatchEvent(target, new DOMEventImpl("evt", bubbles));

          // Verify capture phase: root→parent (excludes target)
          const ancestors = nodes.slice(0, -1);
          const expected: string[] = [];
          for (const a of ancestors) expected.push(`${a.id}-cap`);
          // Target phase: both capture and bubble
          expected.push(`${target.id}-cap`);
          expected.push(`${target.id}-bub`);
          // Bubble phase (if bubbles): parent→root
          if (bubbles) {
            for (let i = ancestors.length - 1; i >= 0; i--) {
              expected.push(`${ancestors[i].id}-bub`);
            }
          }

          expect(log).toEqual(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: js-core-migration, Property 15: stopPropagation halts propagation but not current node
describe("Property 15: stopPropagation halts propagation but not current node", () => {
  const dispatcher = new EventDispatcher();

  it("remaining listeners on current node still fire after stopPropagation", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 0, max: 4 }),
        (depth, stopAtRaw) => {
          const nodes = makeLinearTree(depth);
          const target = nodes[nodes.length - 1];
          const stopAt = stopAtRaw % (nodes.length - 1); // ancestor index
          const stopNode = nodes[stopAt];
          const log: number[] = [];

          // Add capture listeners on all ancestors
          for (let i = 0; i < nodes.length - 1; i++) {
            const id = nodes[i].id;
            if (i === stopAt) {
              nodes[i].addEventListener(
                "evt",
                (e) => {
                  log.push(id);
                  e.stopPropagation();
                },
                true,
              );
              // Second listener on same node — should still fire
              nodes[i].addEventListener("evt", () => log.push(id * 100), true);
            } else {
              nodes[i].addEventListener("evt", () => log.push(id), true);
            }
          }
          target.addEventListener("evt", () => log.push(target.id), false);

          dispatcher.dispatchEvent(target, new DOMEventImpl("evt", true));

          // Nodes before stopAt should have fired
          for (let i = 0; i < stopAt; i++) {
            expect(log).toContain(nodes[i].id);
          }
          // The stop node should have fired both listeners
          expect(log).toContain(stopNode.id);
          expect(log).toContain(stopNode.id * 100);
          // Target should NOT have fired (propagation stopped)
          expect(log).not.toContain(target.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: js-core-migration, Property 16: stopImmediatePropagation halts everything
describe("Property 16: stopImmediatePropagation halts everything", () => {
  const dispatcher = new EventDispatcher();

  it("no remaining listeners on current or subsequent nodes fire", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 3, max: 6 }),
        fc.integer({ min: 0, max: 4 }),
        (depth, stopAtRaw) => {
          const nodes = makeLinearTree(depth);
          const target = nodes[nodes.length - 1];
          const stopAt = stopAtRaw % (nodes.length - 1);
          const stopNode = nodes[stopAt];
          const log: number[] = [];

          for (let i = 0; i < nodes.length - 1; i++) {
            const id = nodes[i].id;
            if (i === stopAt) {
              nodes[i].addEventListener(
                "evt",
                (e) => {
                  log.push(id);
                  e.stopImmediatePropagation();
                },
                true,
              );
              // Second listener — should NOT fire
              nodes[i].addEventListener("evt", () => log.push(id * 100), true);
            } else {
              nodes[i].addEventListener("evt", () => log.push(id), true);
            }
          }
          target.addEventListener("evt", () => log.push(target.id), false);

          dispatcher.dispatchEvent(target, new DOMEventImpl("evt", true));

          // Nodes before stopAt should have fired
          for (let i = 0; i < stopAt; i++) {
            expect(log).toContain(nodes[i].id);
          }
          // The stop node's first listener fired
          expect(log).toContain(stopNode.id);
          // The stop node's second listener did NOT fire
          expect(log).not.toContain(stopNode.id * 100);
          // Target did NOT fire
          expect(log).not.toContain(target.id);
        },
      ),
      { numRuns: 100 },
    );
  });
});
