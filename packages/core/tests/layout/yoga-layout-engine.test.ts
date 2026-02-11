import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { YogaLayoutEngine } from "../../src/layout/yoga-layout-engine.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag } from "../../src/dom/types.js";

function makeNode(id: number, tag: NodeTag = NodeTag.Div): VirtualNode {
  const n = new VirtualNode();
  n.id = id;
  n.tag = tag;
  return n;
}

describe("YogaLayoutEngine", () => {
  it("creates and retrieves layout for a single node", () => {
    const engine = new YogaLayoutEngine();
    const root = makeNode(1);
    root.computedStyle = new Map([["width", "100"], ["height", "50"]]);

    engine.createYogaNode(root);
    engine.syncStyles(root);
    engine.computeLayout(root, 100, 50);

    const layout = engine.getLayout(root);
    expect(layout).not.toBeNull();
    expect(layout!.width).toBe(100);
    expect(layout!.height).toBe(50);
  });

  it("handles parent-child layout", () => {
    const engine = new YogaLayoutEngine();
    const root = makeNode(1);
    const child = makeNode(2);
    root.computedStyle = new Map([["width", "200"], ["height", "100"], ["flex-direction", "row"]]);
    child.computedStyle = new Map([["flex-grow", "1"]]);

    root.children.push(child);
    child.parent = root;

    engine.createYogaNode(root);
    engine.createYogaNode(child);
    engine.syncStyles(root);
    engine.syncStyles(child);
    engine.appendChild(root, child);
    engine.computeLayout(root, 200, 100);

    const childLayout = engine.getLayout(child);
    expect(childLayout).not.toBeNull();
    expect(childLayout!.width).toBe(200);
    expect(childLayout!.height).toBe(100);
  });

  it("removeChild removes from yoga tree", () => {
    const engine = new YogaLayoutEngine();
    const root = makeNode(1);
    const child = makeNode(2);
    root.computedStyle = new Map([["width", "100"], ["height", "100"]]);
    child.computedStyle = new Map([["width", "50"], ["height", "50"]]);

    engine.createYogaNode(root);
    engine.createYogaNode(child);
    engine.syncStyles(root);
    engine.syncStyles(child);
    engine.appendChild(root, child);
    engine.removeChild(root, child);
    engine.computeLayout(root, 100, 100);

    // Root should still have layout
    const rootLayout = engine.getLayout(root);
    expect(rootLayout).not.toBeNull();
  });

  it("destroyYogaNode cleans up", () => {
    const engine = new YogaLayoutEngine();
    const node = makeNode(1);
    engine.createYogaNode(node);
    engine.destroyYogaNode(node);
    expect(engine.getLayout(node)).toBeNull();
  });

  it("getLayout returns null for unknown node", () => {
    const engine = new YogaLayoutEngine();
    const node = makeNode(999);
    expect(engine.getLayout(node)).toBeNull();
  });

  it("syncStyles handles missing computedStyle", () => {
    const engine = new YogaLayoutEngine();
    const node = makeNode(1);
    engine.createYogaNode(node);
    // Should not throw
    engine.syncStyles(node);
  });

  it("handles percentage dimensions", () => {
    const engine = new YogaLayoutEngine();
    const root = makeNode(1);
    const child = makeNode(2);
    root.computedStyle = new Map([["width", "200"], ["height", "100"]]);
    child.computedStyle = new Map([["width", "50%"], ["height", "50%"]]);

    engine.createYogaNode(root);
    engine.createYogaNode(child);
    engine.syncStyles(root);
    engine.syncStyles(child);
    engine.appendChild(root, child);
    engine.computeLayout(root, 200, 100);

    const childLayout = engine.getLayout(child);
    expect(childLayout).not.toBeNull();
    expect(childLayout!.width).toBe(100);
    expect(childLayout!.height).toBe(50);
  });

  it("insertChild at specific index", () => {
    const engine = new YogaLayoutEngine();
    const root = makeNode(1);
    const child1 = makeNode(2);
    const child2 = makeNode(3);
    root.computedStyle = new Map([["width", "200"], ["height", "100"], ["flex-direction", "row"]]);
    child1.computedStyle = new Map([["width", "100"], ["height", "100"]]);
    child2.computedStyle = new Map([["width", "50"], ["height", "100"]]);

    engine.createYogaNode(root);
    engine.createYogaNode(child1);
    engine.createYogaNode(child2);
    engine.syncStyles(root);
    engine.syncStyles(child1);
    engine.syncStyles(child2);
    engine.appendChild(root, child1);
    engine.insertChild(root, child2, 0); // Insert before child1
    engine.computeLayout(root, 200, 100);

    const layout2 = engine.getLayout(child2);
    expect(layout2).not.toBeNull();
    expect(layout2!.x).toBe(0); // child2 is first
  });
});

// Feature: js-core-migration, Property 25: Yoga tree mirrors VirtualDOM structure
describe("Property 25: Yoga tree mirrors VirtualDOM structure", () => {
  it("yoga tree mirrors virtual DOM parent-child structure", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 8 }),
        (childCount) => {
          const engine = new YogaLayoutEngine();
          const root = makeNode(0);
          root.computedStyle = new Map([
            ["width", "500"],
            ["height", "500"],
            ["flex-direction", "column"],
          ]);
          engine.createYogaNode(root);
          engine.syncStyles(root);

          const children: VirtualNode[] = [];
          for (let i = 0; i < childCount; i++) {
            const child = makeNode(i + 1);
            child.computedStyle = new Map([["height", "50"]]);
            child.parent = root;
            root.children.push(child);
            children.push(child);

            engine.createYogaNode(child);
            engine.syncStyles(child);
            engine.appendChild(root, child);
          }

          engine.computeLayout(root, 500, 500);

          // Each child should have a valid layout
          for (const child of children) {
            const layout = engine.getLayout(child);
            expect(layout).not.toBeNull();
            expect(layout!.height).toBe(50);
            expect(layout!.width).toBe(500); // stretches to parent width
          }

          // Children should be stacked vertically
          for (let i = 1; i < children.length; i++) {
            const prev = engine.getLayout(children[i - 1])!;
            const curr = engine.getLayout(children[i])!;
            expect(curr.y).toBe(prev.y + prev.height);
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("style changes on VirtualNode are reflected in Yoga layout", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 10, max: 200 }),
        fc.integer({ min: 10, max: 200 }),
        (w, h) => {
          const engine = new YogaLayoutEngine();
          const root = makeNode(0);
          root.computedStyle = new Map([
            ["width", String(w)],
            ["height", String(h)],
          ]);
          engine.createYogaNode(root);
          engine.syncStyles(root);
          engine.computeLayout(root, w, h);

          const layout = engine.getLayout(root)!;
          expect(layout.width).toBe(w);
          expect(layout.height).toBe(h);
        },
      ),
      { numRuns: 100 },
    );
  });
});
