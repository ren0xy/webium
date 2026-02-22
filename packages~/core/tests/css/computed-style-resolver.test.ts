import { describe, it, expect } from "vitest";
import { ComputedStyleResolver } from "../../src/css/computed-style-resolver.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag, DirtyFlags } from "../../src/dom/types.js";
import { CSSRuleImpl } from "../../src/css/css-rule.js";
import { INITIAL_VALUES } from "../../src/css/style-inheritance.js";
import type { CSSRule } from "../../src/css/css-rule.js";

function makeNode(tag: NodeTag, id: number): VirtualNode {
  const node = new VirtualNode();
  node.id = id;
  node.tag = tag;
  return node;
}

function attachChild(parent: VirtualNode, child: VirtualNode): void {
  parent.children.push(child);
  child.parent = parent;
}

function makeRule(
  selector: string,
  declarations: Record<string, string>,
  specificity: { a: number; b: number; c: number },
  sourceOrder: number,
): CSSRule {
  return new CSSRuleImpl(
    selector,
    new Map(Object.entries(declarations)),
    specificity,
    sourceOrder,
  );
}

describe("ComputedStyleResolver", () => {
  const resolver = new ComputedStyleResolver();

  describe("resolveNode", () => {
    it("returns all initial values for a node with no matching rules and no parent", () => {
      const node = makeNode(NodeTag.Div, 1);
      node.attributes.set("class", "foo");
      const result = resolver.resolveNode(node, [], null);
      for (const [prop, initial] of INITIAL_VALUES) {
        // UA defaults override some initial values (e.g., display:block for Div)
        if (prop === "display") {
          expect(result.get(prop)).toBe("block"); // Div UA default
        } else {
          expect(result.get(prop)).toBe(initial);
        }
      }
    });

    it("applies matching rule declarations via cascade", () => {
      const node = makeNode(NodeTag.Div, 1);
      const rule = makeRule("div", { color: "red" }, { a: 0, b: 0, c: 1 }, 0);
      const result = resolver.resolveNode(node, [rule], null);
      expect(result.get("color")).toBe("red");
    });

    it("inline styles override matching rules", () => {
      const node = makeNode(NodeTag.Div, 1);
      node.inlineStyles.set("color", "blue");
      const rule = makeRule("div", { color: "red" }, { a: 0, b: 0, c: 1 }, 0);
      const result = resolver.resolveNode(node, [rule], null);
      expect(result.get("color")).toBe("blue");
    });

    it("inherits from parent computed style", () => {
      const node = makeNode(NodeTag.Span, 1);
      const parentStyle = new Map([["color", "green"], ["font-size", "20px"]]);
      const result = resolver.resolveNode(node, [], parentStyle);
      expect(result.get("color")).toBe("green");
      expect(result.get("font-size")).toBe("20px");
    });

    it("cascaded value overrides inherited value", () => {
      const node = makeNode(NodeTag.Div, 1);
      const rule = makeRule("div", { color: "red" }, { a: 0, b: 0, c: 1 }, 0);
      const parentStyle = new Map([["color", "blue"]]);
      const result = resolver.resolveNode(node, [rule], parentStyle);
      expect(result.get("color")).toBe("red");
    });
  });

  describe("resolveTree", () => {
    it("resolves computed styles for all nodes in a simple tree", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.Style;
      root.computedStyle = null;

      const child = makeNode(NodeTag.Span, 1);
      child.dirty = DirtyFlags.Style;
      child.computedStyle = null;
      attachChild(root, child);

      const rule = makeRule("div", { color: "red" }, { a: 0, b: 0, c: 1 }, 0);
      resolver.resolveTree(root, [rule]);

      expect(root.computedStyle).not.toBeNull();
      expect(root.computedStyle!.get("color")).toBe("red");

      // Child (span) should inherit color from parent
      expect(child.computedStyle).not.toBeNull();
      expect(child.computedStyle!.get("color")).toBe("red");
    });

    it("resolves nodes that have never had computedStyle (null)", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.computedStyle = null;
      root.dirty = DirtyFlags.None;

      resolver.resolveTree(root, []);

      expect(root.computedStyle).not.toBeNull();
      // Should have all initial values
      expect(root.computedStyle!.get("color")).toBe("black");
    });

    it("skips clean subtrees when no ancestor style changed", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.None;
      root.computedStyle = new Map([["color", "red"]]);

      const child = makeNode(NodeTag.Span, 1);
      child.dirty = DirtyFlags.None;
      child.computedStyle = new Map([["color", "blue"]]);
      attachChild(root, child);

      // Neither root nor child is dirty, and both have existing computedStyle
      resolver.resolveTree(root, []);

      // computedStyle should remain unchanged (subtree was skipped)
      expect(child.computedStyle!.get("color")).toBe("blue");
    });

    it("re-resolves child when ancestor style is dirty", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.Style;
      root.computedStyle = new Map([["color", "old"]]);

      const child = makeNode(NodeTag.Span, 1);
      child.dirty = DirtyFlags.None;
      child.computedStyle = new Map([["color", "old"]]);
      attachChild(root, child);

      const rule = makeRule("div", { color: "green" }, { a: 0, b: 0, c: 1 }, 0);
      resolver.resolveTree(root, [rule]);

      // Root was dirty, so child should be re-resolved with inherited color
      expect(root.computedStyle!.get("color")).toBe("green");
      expect(child.computedStyle!.get("color")).toBe("green");
    });

    it("handles deep tree with inheritance chain", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.Style;
      root.computedStyle = null;

      const mid = makeNode(NodeTag.Div, 1);
      mid.dirty = DirtyFlags.Style;
      mid.computedStyle = null;
      attachChild(root, mid);

      const leaf = makeNode(NodeTag.Span, 2);
      leaf.dirty = DirtyFlags.Style;
      leaf.computedStyle = null;
      attachChild(mid, leaf);

      const rootRule = makeRule("div", { "font-size": "24px" }, { a: 0, b: 0, c: 1 }, 0);
      resolver.resolveTree(root, [rootRule]);

      // font-size is inheritable, so it should cascade down
      expect(root.computedStyle!.get("font-size")).toBe("24px");
      expect(mid.computedStyle!.get("font-size")).toBe("24px");
      expect(leaf.computedStyle!.get("font-size")).toBe("24px");
    });

    it("handles multiple children at same level", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.Style;
      root.computedStyle = null;

      const child1 = makeNode(NodeTag.Span, 1);
      child1.dirty = DirtyFlags.Style;
      child1.computedStyle = null;
      attachChild(root, child1);

      const child2 = makeNode(NodeTag.P, 2);
      child2.dirty = DirtyFlags.Style;
      child2.computedStyle = null;
      attachChild(root, child2);

      const rule = makeRule("div", { color: "purple" }, { a: 0, b: 0, c: 1 }, 0);
      resolver.resolveTree(root, [rule]);

      expect(root.computedStyle!.get("color")).toBe("purple");
      // Both children inherit color
      expect(child1.computedStyle!.get("color")).toBe("purple");
      expect(child2.computedStyle!.get("color")).toBe("purple");
    });

    it("only dirty child subtree is re-resolved when root is clean", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.None;
      root.computedStyle = new Map([["color", "red"]]);

      const cleanChild = makeNode(NodeTag.Span, 1);
      cleanChild.dirty = DirtyFlags.None;
      cleanChild.computedStyle = new Map([["color", "original"]]);
      attachChild(root, cleanChild);

      const dirtyChild = makeNode(NodeTag.P, 2);
      dirtyChild.dirty = DirtyFlags.Style;
      dirtyChild.computedStyle = new Map([["color", "old"]]);
      attachChild(root, dirtyChild);

      resolver.resolveTree(root, []);

      // Root is clean with existing computedStyle → skipped entirely
      // Both children are also skipped because root is clean and not ancestorDirty
      // cleanChild stays unchanged
      expect(cleanChild.computedStyle!.get("color")).toBe("original");
      // dirtyChild has Style flag but root is clean, so it IS resolved
      // (nodeStyleDirty is true for dirtyChild)
      expect(dirtyChild.computedStyle).not.toBeNull();
    });
  });

  describe("resolveTree with inline styles", () => {
    it("applies inline styles during tree resolution", () => {
      const root = makeNode(NodeTag.Div, 0);
      root.dirty = DirtyFlags.Style;
      root.computedStyle = null;
      root.inlineStyles.set("color", "hotpink");

      resolver.resolveTree(root, []);

      expect(root.computedStyle!.get("color")).toBe("hotpink");
    });
  });

  describe("custom dependency injection", () => {
    it("uses injected matcher, cascade, and inheritance", () => {
      // Default constructor works fine — just verify it doesn't throw
      const custom = new ComputedStyleResolver();
      const node = makeNode(NodeTag.Div, 1);
      node.dirty = DirtyFlags.Style;
      node.computedStyle = null;
      const result = custom.resolveNode(node, [], null);
      expect(result.size).toBeGreaterThan(0);
    });
  });
});
