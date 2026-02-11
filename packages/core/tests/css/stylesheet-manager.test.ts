import { describe, it, expect } from "vitest";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag } from "../../src/dom/types.js";

function makeStyleNode(cssText: string): VirtualNode {
  const node = new VirtualNode();
  node.tag = NodeTag.Style;
  node.textContent = cssText;
  return node;
}

describe("StyleSheetManager", () => {
  it("starts with empty allRules", () => {
    const mgr = new StyleSheetManager();
    expect(mgr.allRules).toHaveLength(0);
  });

  it("addStyleSheet parses CSS and populates allRules", () => {
    const mgr = new StyleSheetManager();
    const node = makeStyleNode("div { color: red; }");
    mgr.addStyleSheet(node);

    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].selector).toBe("div");
    expect(mgr.allRules[0].declarations.get("color")).toBe("red");
  });

  it("addStyleSheet handles multiple rules in one stylesheet", () => {
    const mgr = new StyleSheetManager();
    const node = makeStyleNode("div { color: red; } .foo { margin: 0; }");
    mgr.addStyleSheet(node);

    expect(mgr.allRules).toHaveLength(2);
    expect(mgr.allRules[0].selector).toBe("div");
    expect(mgr.allRules[1].selector).toBe(".foo");
  });

  it("addStyleSheet assigns monotonically increasing source order", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode("div { color: red; }"));
    mgr.addStyleSheet(makeStyleNode("span { color: blue; }"));

    expect(mgr.allRules[0].sourceOrder).toBeLessThan(mgr.allRules[1].sourceOrder);
  });

  it("addStyleSheet computes specificity correctly", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode("#main .card { color: red; }"));

    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].specificity).toEqual({ a: 1, b: 1, c: 0 });
  });

  it("addStyleSheet handles empty textContent", () => {
    const mgr = new StyleSheetManager();
    const node = new VirtualNode();
    node.tag = NodeTag.Style;
    node.textContent = null;
    mgr.addStyleSheet(node);

    expect(mgr.allRules).toHaveLength(0);
  });

  it("addStyleSheet handles empty CSS string", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode(""));
    expect(mgr.allRules).toHaveLength(0);
  });

  it("addStyleSheet handles malformed CSS gracefully", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode("{{{invalid css"));
    // Should not throw, may produce 0 or some rules depending on css-tree recovery
    expect(mgr.allRules.length).toBeGreaterThanOrEqual(0);
  });

  it("updateStyleSheet replaces rules for existing node", () => {
    const mgr = new StyleSheetManager();
    const node = makeStyleNode("div { color: red; }");
    mgr.addStyleSheet(node);

    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].declarations.get("color")).toBe("red");

    node.textContent = "div { color: blue; }";
    mgr.updateStyleSheet(node);

    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].declarations.get("color")).toBe("blue");
  });

  it("updateStyleSheet is a no-op for unknown node", () => {
    const mgr = new StyleSheetManager();
    const node1 = makeStyleNode("div { color: red; }");
    const node2 = makeStyleNode("span { color: blue; }");
    mgr.addStyleSheet(node1);

    mgr.updateStyleSheet(node2);
    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].selector).toBe("div");
  });

  it("removeStyleSheet removes rules for existing node", () => {
    const mgr = new StyleSheetManager();
    const node = makeStyleNode("div { color: red; }");
    mgr.addStyleSheet(node);
    expect(mgr.allRules).toHaveLength(1);

    mgr.removeStyleSheet(node);
    expect(mgr.allRules).toHaveLength(0);
  });

  it("removeStyleSheet is a no-op for unknown node", () => {
    const mgr = new StyleSheetManager();
    const node1 = makeStyleNode("div { color: red; }");
    const node2 = makeStyleNode("span { color: blue; }");
    mgr.addStyleSheet(node1);

    mgr.removeStyleSheet(node2);
    expect(mgr.allRules).toHaveLength(1);
  });

  it("multiple stylesheets aggregate rules in order", () => {
    const mgr = new StyleSheetManager();
    const node1 = makeStyleNode("div { color: red; }");
    const node2 = makeStyleNode(".foo { margin: 0; }");
    const node3 = makeStyleNode("#bar { padding: 10px; }");

    mgr.addStyleSheet(node1);
    mgr.addStyleSheet(node2);
    mgr.addStyleSheet(node3);

    expect(mgr.allRules).toHaveLength(3);
    expect(mgr.allRules[0].selector).toBe("div");
    expect(mgr.allRules[1].selector).toBe(".foo");
    expect(mgr.allRules[2].selector).toBe("#bar");
  });

  it("removing middle stylesheet preserves order of remaining", () => {
    const mgr = new StyleSheetManager();
    const node1 = makeStyleNode("div { color: red; }");
    const node2 = makeStyleNode(".foo { margin: 0; }");
    const node3 = makeStyleNode("#bar { padding: 10px; }");

    mgr.addStyleSheet(node1);
    mgr.addStyleSheet(node2);
    mgr.addStyleSheet(node3);

    mgr.removeStyleSheet(node2);

    expect(mgr.allRules).toHaveLength(2);
    expect(mgr.allRules[0].selector).toBe("div");
    expect(mgr.allRules[1].selector).toBe("#bar");
  });

  it("source order is globally unique across multiple add operations", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode("div { color: red; } span { color: blue; }"));
    mgr.addStyleSheet(makeStyleNode("p { color: green; }"));

    const orders = mgr.allRules.map((r) => r.sourceOrder);
    const uniqueOrders = new Set(orders);
    expect(uniqueOrders.size).toBe(orders.length);

    // Verify monotonically increasing
    for (let i = 1; i < orders.length; i++) {
      expect(orders[i]).toBeGreaterThan(orders[i - 1]);
    }
  });

  it("handles CSS with multiple declarations per rule", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(
      makeStyleNode("div { color: red; font-size: 14px; margin: 0; }"),
    );

    expect(mgr.allRules).toHaveLength(1);
    const decls = mgr.allRules[0].declarations;
    expect(decls.get("color")).toBe("red");
    expect(decls.get("font-size")).toBe("14px");
    expect(decls.get("margin")).toBe("0");
  });

  it("handles complex selectors", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(
      makeStyleNode("div > .card:hover { color: red; }"),
    );

    expect(mgr.allRules).toHaveLength(1);
    expect(mgr.allRules[0].specificity).toEqual({ a: 0, b: 2, c: 1 });
  });

  it("skips rules with no declarations", () => {
    const mgr = new StyleSheetManager();
    mgr.addStyleSheet(makeStyleNode("div { }"));
    expect(mgr.allRules).toHaveLength(0);
  });
});

import fc from "fast-check";

// Feature: js-core-migration, Property 13: StyleSheetManager rule aggregation
describe("Property 13: StyleSheetManager rule aggregation", () => {
  /** Generate a simple valid CSS string with 1-3 rules */
  const arbCssRule = fc
    .tuple(
      fc.constantFrom("div", "span", "p", ".foo", "#bar", ".card", "h1"),
      fc.constantFrom("color", "margin", "padding", "display", "font-size"),
      fc.constantFrom("red", "0", "10px", "flex", "16px"),
    )
    .map(([sel, prop, val]) => `${sel} { ${prop}: ${val}; }`);

  const arbCssText = fc
    .array(arbCssRule, { minLength: 1, maxLength: 3 })
    .map((rules) => rules.join(" "));

  it("allRules contains exactly the rules from active stylesheets", () => {
    fc.assert(
      fc.property(
        fc.array(arbCssText, { minLength: 1, maxLength: 5 }),
        (cssTexts) => {
          const mgr = new StyleSheetManager();
          const nodes: VirtualNode[] = [];

          for (const css of cssTexts) {
            const node = makeStyleNode(css);
            nodes.push(node);
            mgr.addStyleSheet(node);
          }

          // Total rules should equal sum of rules per stylesheet
          let expectedCount = 0;
          for (const css of cssTexts) {
            // Count rules by counting '{' occurrences (simple heuristic for our generated CSS)
            expectedCount += (css.match(/{/g) || []).length;
          }
          expect(mgr.allRules.length).toBe(expectedCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("removing a stylesheet removes exactly its rules", () => {
    fc.assert(
      fc.property(
        fc.array(arbCssText, { minLength: 2, maxLength: 5 }),
        fc.nat(),
        (cssTexts, removeIdx) => {
          const mgr = new StyleSheetManager();
          const nodes: VirtualNode[] = [];

          for (const css of cssTexts) {
            const node = makeStyleNode(css);
            nodes.push(node);
            mgr.addStyleSheet(node);
          }

          const totalBefore = mgr.allRules.length;
          const idx = removeIdx % nodes.length;
          const removedRuleCount = (cssTexts[idx].match(/{/g) || []).length;

          mgr.removeStyleSheet(nodes[idx]);
          expect(mgr.allRules.length).toBe(totalBefore - removedRuleCount);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("source order is preserved across add operations", () => {
    fc.assert(
      fc.property(
        fc.array(arbCssText, { minLength: 2, maxLength: 5 }),
        (cssTexts) => {
          const mgr = new StyleSheetManager();

          for (const css of cssTexts) {
            mgr.addStyleSheet(makeStyleNode(css));
          }

          // Source orders should be strictly increasing
          const orders = mgr.allRules.map((r) => r.sourceOrder);
          for (let i = 1; i < orders.length; i++) {
            expect(orders[i]).toBeGreaterThan(orders[i - 1]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
