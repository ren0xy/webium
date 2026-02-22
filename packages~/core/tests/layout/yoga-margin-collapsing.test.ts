import { describe, it, expect } from "vitest";
import { YogaLayoutEngine } from "../../src/layout/yoga-layout-engine.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag } from "../../src/dom/types.js";

function makeNode(id: number, tag: NodeTag = NodeTag.Div): VirtualNode {
  const n = new VirtualNode();
  n.id = id;
  n.tag = tag;
  return n;
}

/**
 * Create a root container that establishes a BFC (overflow:hidden) so it
 * doesn't collapse margins with its children — mirrors browser viewport behaviour.
 */
function makeRoot(id: number): VirtualNode {
  const root = makeNode(id);
  root.computedStyle = new Map([
    ["width", "400"],
    ["height", "800"],
    ["display", "block"],
    ["overflow", "hidden"],
  ]);
  return root;
}

/**
 * Helper: build a tree, create yoga nodes, sync styles, collapse margins, compute layout.
 * Returns the engine for querying layouts.
 */
function buildAndLayout(
  root: VirtualNode,
  children: VirtualNode[],
  viewportW = 400,
  viewportH = 800,
): YogaLayoutEngine {
  const engine = new YogaLayoutEngine();

  engine.createYogaNode(root);
  engine.syncStyles(root);

  for (const child of children) {
    child.parent = root;
    root.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(root, child);
  }

  engine.collapseMargins(root);
  engine.computeLayout(root, viewportW, viewportH);
  return engine;
}

describe("Yoga Margin Collapsing", () => {
  // --- MCR-1: Adjacent sibling collapsing ---

  it("adjacent block siblings: margin-bottom 10 / margin-top 16 → gap = 16 (VC-1)", () => {
    const root = makeRoot(1);

    const a = makeNode(2);
    a.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "10"]]);

    const b = makeNode(3);
    b.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "16"]]);

    const engine = buildAndLayout(root, [a, b]);

    const la = engine.getLayout(a)!;
    const lb = engine.getLayout(b)!;
    const gap = lb.y - (la.y + la.height);
    expect(gap).toBe(16);
  });

  it("adjacent block siblings with equal margins → gap = max (not doubled)", () => {
    const root = makeRoot(1);

    const a = makeNode(2);
    a.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "20"]]);

    const b = makeNode(3);
    b.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "20"]]);

    const engine = buildAndLayout(root, [a, b]);

    const la = engine.getLayout(a)!;
    const lb = engine.getLayout(b)!;
    const gap = lb.y - (la.y + la.height);
    expect(gap).toBe(20); // max(20,20) = 20, not 40
  });

  // --- MCR-2: Parent-first-child top margin collapsing ---

  it("parent-first-child top margin collapse when parent has no border/padding (VC-2)", () => {
    const root = makeRoot(1);

    const parent = makeNode(2);
    parent.computedStyle = new Map([["display", "block"], ["margin-top", "20"]]);

    const child = makeNode(3);
    child.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "10"]]);

    // Build: root > parent > child
    const engine = new YogaLayoutEngine();
    engine.createYogaNode(root);
    engine.syncStyles(root);

    parent.parent = root;
    root.children.push(parent);
    engine.createYogaNode(parent);
    engine.syncStyles(parent);
    engine.appendChild(root, parent);

    child.parent = parent;
    parent.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(parent, child);

    engine.collapseMargins(root);
    engine.computeLayout(root, 400, 800);

    const lp = engine.getLayout(parent)!;
    // Parent's top margin should be max(20, 10) = 20, child's top margin zeroed
    expect(lp.y).toBe(20);

    const lc = engine.getLayout(child)!;
    // Child should be at y=0 relative to parent (its margin-top was collapsed to 0)
    expect(lc.y).toBe(0);
  });

  // --- MCR-3: Parent-last-child bottom margin collapsing ---

  it("parent-last-child bottom margin collapse when parent has no border/padding (VC-3)", () => {
    const root = makeRoot(1);

    const parent = makeNode(2);
    parent.computedStyle = new Map([["display", "block"], ["height", "100"], ["margin-bottom", "20"]]);

    const child = makeNode(3);
    child.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "10"]]);

    const sibling = makeNode(4);
    sibling.computedStyle = new Map([["display", "block"], ["height", "40"]]);

    // Build: root > [parent > child, sibling]
    const engine = new YogaLayoutEngine();
    engine.createYogaNode(root);
    engine.syncStyles(root);

    parent.parent = root;
    root.children.push(parent);
    engine.createYogaNode(parent);
    engine.syncStyles(parent);
    engine.appendChild(root, parent);

    child.parent = parent;
    parent.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(parent, child);

    sibling.parent = root;
    root.children.push(sibling);
    engine.createYogaNode(sibling);
    engine.syncStyles(sibling);
    engine.appendChild(root, sibling);

    engine.collapseMargins(root);
    engine.computeLayout(root, 400, 800);

    const lp = engine.getLayout(parent)!;
    const ls = engine.getLayout(sibling)!;
    // Parent's bottom margin should be max(20, 10) = 20 (child's bottom collapsed into parent)
    const gapAfterParent = ls.y - (lp.y + lp.height);
    expect(gapAfterParent).toBe(20);
  });

  // --- MCR-4: Non-collapsing conditions ---

  it("non-collapsing: inline-block sibling does not collapse with adjacent block (VC-4)", () => {
    const root = makeRoot(1);

    const a = makeNode(2);
    a.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "10"]]);

    const b = makeNode(3);
    b.computedStyle = new Map([["display", "inline-block"], ["height", "40"], ["margin-top", "16"]]);

    const engine = buildAndLayout(root, [a, b]);

    const la = engine.getLayout(a)!;
    const lb = engine.getLayout(b)!;
    const gap = lb.y - (la.y + la.height);
    expect(gap).toBe(26); // 10 + 16, no collapsing
  });

  it("non-collapsing: parent with overflow:hidden does not collapse with children", () => {
    const root = makeRoot(1);

    const parent = makeNode(2);
    parent.computedStyle = new Map([["display", "block"], ["overflow", "hidden"], ["margin-top", "20"]]);

    const child = makeNode(3);
    child.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "10"]]);

    // Build: root > parent > child
    const engine = new YogaLayoutEngine();
    engine.createYogaNode(root);
    engine.syncStyles(root);

    parent.parent = root;
    root.children.push(parent);
    engine.createYogaNode(parent);
    engine.syncStyles(parent);
    engine.appendChild(root, parent);

    child.parent = parent;
    parent.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(parent, child);

    engine.collapseMargins(root);
    engine.computeLayout(root, 400, 800);

    const lp = engine.getLayout(parent)!;
    const lc = engine.getLayout(child)!;
    // Parent margin stays 20, child margin stays 10 (no collapse due to overflow:hidden BFC)
    expect(lp.y).toBe(20);
    expect(lc.y).toBe(10);
  });

  it("non-collapsing: parent with padding-top does not collapse top margin with first child", () => {
    const root = makeRoot(1);

    const parent = makeNode(2);
    parent.computedStyle = new Map([["display", "block"], ["padding-top", "5"], ["margin-top", "20"]]);

    const child = makeNode(3);
    child.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "10"]]);

    const engine = new YogaLayoutEngine();
    engine.createYogaNode(root);
    engine.syncStyles(root);

    parent.parent = root;
    root.children.push(parent);
    engine.createYogaNode(parent);
    engine.syncStyles(parent);
    engine.appendChild(root, parent);

    child.parent = parent;
    parent.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(parent, child);

    engine.collapseMargins(root);
    engine.computeLayout(root, 400, 800);

    const lp = engine.getLayout(parent)!;
    const lc = engine.getLayout(child)!;
    // Parent margin stays 20 (not collapsed), child margin stays 10 inside parent
    expect(lp.y).toBe(20);
    // Child is inside parent: padding-top(5) + margin-top(10) = 15
    expect(lc.y).toBe(15);
  });

  it("non-collapsing: parent with border-bottom-width does not collapse bottom margin with last child", () => {
    const root = makeRoot(1);

    const parent = makeNode(2);
    parent.computedStyle = new Map([
      ["display", "block"],
      ["height", "100"],
      ["margin-bottom", "20"],
      ["border-bottom-width", "2"],
    ]);

    const child = makeNode(3);
    child.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "15"]]);

    const sibling = makeNode(4);
    sibling.computedStyle = new Map([["display", "block"], ["height", "40"]]);

    const engine = new YogaLayoutEngine();
    engine.createYogaNode(root);
    engine.syncStyles(root);

    parent.parent = root;
    root.children.push(parent);
    engine.createYogaNode(parent);
    engine.syncStyles(parent);
    engine.appendChild(root, parent);

    child.parent = parent;
    parent.children.push(child);
    engine.createYogaNode(child);
    engine.syncStyles(child);
    engine.appendChild(parent, child);

    sibling.parent = root;
    root.children.push(sibling);
    engine.createYogaNode(sibling);
    engine.syncStyles(sibling);
    engine.appendChild(root, sibling);

    engine.collapseMargins(root);
    engine.computeLayout(root, 400, 800);

    const lp = engine.getLayout(parent)!;
    const ls = engine.getLayout(sibling)!;
    // Parent bottom margin stays 20 (border prevents collapse with child's 15)
    // Gap between parent and sibling = parent's margin-bottom (20) since sibling has no margin-top
    const gapAfterParent = ls.y - (lp.y + lp.height);
    expect(gapAfterParent).toBe(20);
  });

  // --- MCR-1 + MCR-4: Mixed block/inline siblings (VC-5) ---

  it("mixed block/inline siblings: only adjacent block pairs collapse (VC-5)", () => {
    const root = makeRoot(1);

    const blockA = makeNode(2);
    blockA.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-bottom", "10"]]);

    const inlineB = makeNode(3);
    inlineB.computedStyle = new Map([["display", "inline-block"], ["height", "30"], ["margin-top", "8"], ["margin-bottom", "8"]]);

    const blockC = makeNode(4);
    blockC.computedStyle = new Map([["display", "block"], ["height", "40"], ["margin-top", "12"]]);

    const engine = buildAndLayout(root, [blockA, inlineB, blockC]);

    const la = engine.getLayout(blockA)!;
    const lb = engine.getLayout(inlineB)!;
    const lc = engine.getLayout(blockC)!;

    // blockA → inlineB: no collapse (inlineB is inline-block), gap = 10 + 8 = 18
    const gapAB = lb.y - (la.y + la.height);
    expect(gapAB).toBe(18);

    // inlineB → blockC: no collapse (inlineB is inline-block), gap = 8 + 12 = 20
    const gapBC = lc.y - (lb.y + lb.height);
    expect(gapBC).toBe(20);
  });

  // --- Chain of 3+ block siblings ---

  it("chain of 3+ block siblings: each adjacent pair collapses independently", () => {
    const root = makeRoot(1);

    const a = makeNode(2);
    a.computedStyle = new Map([["display", "block"], ["height", "30"], ["margin-bottom", "10"]]);

    const b = makeNode(3);
    b.computedStyle = new Map([["display", "block"], ["height", "30"], ["margin-top", "16"], ["margin-bottom", "8"]]);

    const c = makeNode(4);
    c.computedStyle = new Map([["display", "block"], ["height", "30"], ["margin-top", "12"]]);

    const engine = buildAndLayout(root, [a, b, c]);

    const la = engine.getLayout(a)!;
    const lb = engine.getLayout(b)!;
    const lc = engine.getLayout(c)!;

    // a→b: max(10, 16) = 16
    const gapAB = lb.y - (la.y + la.height);
    expect(gapAB).toBe(16);

    // b→c: max(8, 12) = 12
    const gapBC = lc.y - (lb.y + lb.height);
    expect(gapBC).toBe(12);
  });
});

describe("Integration: hello-world structure", () => {
  /**
   * Mimics the hello-world example: body > h1 + p + button
   *
   * Styles (from style.css + UA defaults):
   *   body: display:block, overflow:hidden (BFC like viewport), padding:20px
   *   h1:   display:block, height:40px, margin:0 0 10px 0
   *   p:    display:block, height:20px, margin-top:16px, margin-bottom:16px
   *   button: display:inline-block, height:30px, padding:10px 20px
   *
   * Expected: gap between h1 and p = max(10, 16) = 16px (collapsed), not 26px.
   *
   * Validates: Requirements MCR-1, NFR-1
   * Validation: VC-6
   */
  it("p y-position reflects collapsed margins (gap = max(10,16) = 16, not 26)", () => {
    const body = makeNode(1, NodeTag.Body);
    body.computedStyle = new Map([
      ["display", "block"],
      ["overflow", "hidden"],
      ["width", "1920"],
      ["height", "1080"],
      ["padding-top", "20"],
      ["padding-right", "20"],
      ["padding-bottom", "20"],
      ["padding-left", "20"],
    ]);

    const h1 = makeNode(2, NodeTag.H1);
    h1.computedStyle = new Map([
      ["display", "block"],
      ["height", "40"],
      ["margin-top", "0"],
      ["margin-right", "0"],
      ["margin-bottom", "10"],
      ["margin-left", "0"],
    ]);

    const p = makeNode(3, NodeTag.P);
    p.computedStyle = new Map([
      ["display", "block"],
      ["height", "20"],
      ["margin-top", "16"],
      ["margin-bottom", "16"],
    ]);

    const button = makeNode(4, NodeTag.Button);
    button.computedStyle = new Map([
      ["display", "inline-block"],
      ["height", "30"],
      ["padding-top", "10"],
      ["padding-right", "20"],
      ["padding-bottom", "10"],
      ["padding-left", "20"],
    ]);

    // Build tree: body > h1 + p + button
    const engine = new YogaLayoutEngine();

    engine.createYogaNode(body);
    engine.syncStyles(body);

    for (const child of [h1, p, button]) {
      child.parent = body;
      body.children.push(child);
      engine.createYogaNode(child);
      engine.syncStyles(child);
      engine.appendChild(body, child);
    }

    // Full pipeline: collapseMargins → computeLayout
    engine.collapseMargins(body);
    engine.computeLayout(body, 1920, 1080);

    const lh1 = engine.getLayout(h1)!;
    const lp = engine.getLayout(p)!;
    const lbtn = engine.getLayout(button)!;

    // h1 starts at y = body padding-top (20) + h1 margin-top (0) = 20
    expect(lh1.y).toBe(20);

    // Gap between h1 bottom and p top should be collapsed: max(10, 16) = 16
    const gapH1P = lp.y - (lh1.y + lh1.height);
    expect(gapH1P).toBe(16);

    // p → button: button is inline-block, so no collapsing.
    // Gap = p margin-bottom (16) + button margin-top (0, not set) = 16
    const gapPBtn = lbtn.y - (lp.y + lp.height);
    expect(gapPBtn).toBe(16);
  });
});
