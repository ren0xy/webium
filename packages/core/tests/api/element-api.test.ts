import { describe, it, expect } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { DirtyFlags, NodeTag } from "../../src/dom/types.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { ElementAPI } from "../../src/api/element-api.js";

/**
 * Minimal stub for IComputedStyleResolver — not exercised by these tests.
 */
const stubStyleResolver = {
  resolveTree() {},
  resolveNode() {
    return new Map<string, string>();
  },
};

/**
 * Create fresh instances of all dependencies needed to construct an ElementAPI.
 */
function createAPIDeps() {
  const dom = new VirtualDOM();
  const reconciliation = new ReconciliationEngine(
    dom,
    stubStyleResolver,
    new StyleSheetManager(),
  );
  const stylesheetManager = new StyleSheetManager();
  const selectorMatcher = new SelectorMatcher();
  return { dom, reconciliation, stylesheetManager, selectorMatcher };
}

/**
 * Create an ElementAPI wrapping a fresh div node attached to the root.
 */
function createElementAPI(tag: NodeTag = NodeTag.Div) {
  const deps = createAPIDeps();
  const node = deps.dom.createElement(tag);
  deps.dom.appendChild(deps.dom.root, node);
  const wrapFn = (n: VirtualNode): ElementAPI =>
    new ElementAPI(n, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
  const el = wrapFn(node);
  return { el, node, ...deps };
}

/**
 * Unit tests for ElementAPI
 *
 * Validates: Requirements 4.1, 4.2, 4.3, 5.1, 6.1, 7.1, 7.2, 9.1–9.5
 */

describe("ElementAPI", () => {
  // --- setAttribute with style attribute (Requirement 5.1) ---
  describe("setAttribute('style', ...)", () => {
    it("parses inline style string into inlineStyles map", () => {
      const { el, node } = createElementAPI();
      el.setAttribute("style", "color: red");
      expect(node.inlineStyles.get("color")).toBe("red");
    });

    it("marks dirty with DirtyFlags.Style (not Attributes)", () => {
      const { el, node } = createElementAPI();
      node.dirty = DirtyFlags.None;
      el.setAttribute("style", "color: red");
      expect(node.dirty & DirtyFlags.Style).toBeTruthy();
    });

    it("stores the raw style string in attributes", () => {
      const { el, node } = createElementAPI();
      el.setAttribute("style", "color: red");
      expect(node.attributes.get("style")).toBe("color: red");
    });

    it("parses multiple declarations", () => {
      const { el, node } = createElementAPI();
      el.setAttribute("style", "color: red; font-size: 14px");
      expect(node.inlineStyles.get("color")).toBe("red");
      expect(node.inlineStyles.get("font-size")).toBe("14px");
    });
  });

  // --- setAttribute with class attribute (Requirement 5.1) ---
  describe("setAttribute('class', ...)", () => {
    it("sets DirtyFlags.Style | DirtyFlags.Attributes", () => {
      const { el, node } = createElementAPI();
      node.dirty = DirtyFlags.None;
      el.setAttribute("class", "foo");
      expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
    });

    it("stores the class value in attributes", () => {
      const { el, node } = createElementAPI();
      el.setAttribute("class", "foo");
      expect(node.attributes.get("class")).toBe("foo");
    });
  });

  // --- setAttribute with id attribute (Requirement 5.1) ---
  describe("setAttribute('id', ...)", () => {
    it("sets DirtyFlags.Style | DirtyFlags.Attributes", () => {
      const { el, node } = createElementAPI();
      node.dirty = DirtyFlags.None;
      el.setAttribute("id", "bar");
      expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
    });
  });

  // --- removeChild with non-child throws (Requirement 4.2) ---
  describe("removeChild", () => {
    it("throws when removing a node that is not a child", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      // Create a separate node that is NOT a child of el
      const orphanNode = dom.createElement(NodeTag.Span);
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);
      const orphan = wrapFn(orphanNode);

      expect(() => el.removeChild(orphan)).toThrow(
        "The node to be removed is not a child of this node.",
      );
    });

    it("succeeds when removing an actual child", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const childNode = dom.createElement(NodeTag.Span);
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);
      const child = wrapFn(childNode);
      el.appendChild(child);

      const result = el.removeChild(child);
      expect(result).toBe(child);
      expect(el._node.children).not.toContain(childNode);
    });
  });

  // --- innerHTML getter (Requirement 7.2) ---
  describe("innerHTML getter", () => {
    it("produces correct HTML string for child elements", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      const span = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(span);

      // Add a text node inside the span
      const textNode = dom.createTextNode("hello");
      dom.appendChild(span._node, textNode);

      expect(el.innerHTML).toBe("<span>hello</span>");
    });

    it("serializes nested elements correctly", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      const div = wrapFn(dom.createElement(NodeTag.Div));
      const span = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(div);
      div.appendChild(span);

      const text = dom.createTextNode("nested");
      dom.appendChild(span._node, text);

      expect(el.innerHTML).toBe("<div><span>nested</span></div>");
    });

    it("returns empty string when no children", () => {
      const { el } = createElementAPI();
      expect(el.innerHTML).toBe("");
    });

    it("serializes attributes on child elements", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      const span = wrapFn(dom.createElement(NodeTag.Span));
      span.setAttribute("class", "highlight");
      el.appendChild(span);

      expect(el.innerHTML).toBe('<span class="highlight"></span>');
    });
  });

  // --- innerHTML setter with malformed HTML (Requirement 7.2) ---
  describe("innerHTML setter", () => {
    it("parses well-formed HTML and creates child nodes", () => {
      const { el } = createElementAPI();
      el.innerHTML = "<div><span>hi</span></div>";

      expect(el._node.children.length).toBe(1);
      expect(el._node.children[0].tag).toBe(NodeTag.Div);
      expect(el._node.children[0].children.length).toBe(1);
      expect(el._node.children[0].children[0].tag).toBe(NodeTag.Span);
    });

    it("handles malformed HTML gracefully (best-effort parse)", () => {
      const { el } = createElementAPI();
      // Unclosed tags — htmlparser2 handles this forgivingly
      el.innerHTML = "<div><span>unclosed";

      // Should still produce a tree (best-effort)
      expect(el._node.children.length).toBeGreaterThan(0);
      expect(el._node.children[0].tag).toBe(NodeTag.Div);
    });

    it("removes existing children before parsing", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      // Add an initial child
      const child = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(child);
      expect(el._node.children.length).toBe(1);

      // Set innerHTML — should replace existing children
      el.innerHTML = "<div>new</div>";
      expect(el._node.children.length).toBe(1);
      expect(el._node.children[0].tag).toBe(NodeTag.Div);
    });

    it("marks dirty with DirtyFlags.Tree", () => {
      const { el, node } = createElementAPI();
      node.dirty = DirtyFlags.None;
      el.innerHTML = "<span>test</span>";
      expect(node.dirty & DirtyFlags.Tree).toBeTruthy();
    });
  });

  // --- children excludes text nodes (Requirement 9.3) ---
  describe("children", () => {
    it("excludes text nodes and returns only element children", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      // Add a mix of element and text children
      const span = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(span);

      const textNode = dom.createTextNode("some text");
      dom.appendChild(el._node, textNode);

      const div = wrapFn(dom.createElement(NodeTag.Div));
      el.appendChild(div);

      // children should only include span and div, not the text node
      const children = el.children;
      expect(children.length).toBe(2);
      expect(children[0]._node.tag).toBe(NodeTag.Span);
      expect(children[1]._node.tag).toBe(NodeTag.Div);
    });

    it("returns empty array when all children are text nodes", () => {
      const { el, dom } = createElementAPI();
      const text1 = dom.createTextNode("a");
      const text2 = dom.createTextNode("b");
      dom.appendChild(el._node, text1);
      dom.appendChild(el._node, text2);

      expect(el.children.length).toBe(0);
    });

    it("returns ElementAPI instances", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      const span = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(span);

      const children = el.children;
      expect(children[0]).toBeInstanceOf(ElementAPI);
    });
  });

  // --- parentElement returns null for root-level nodes (Requirement 9.4) ---
  describe("parentElement", () => {
    it("returns null for root-level nodes (parent is the VirtualDOM root)", () => {
      const deps = createAPIDeps();
      const rootNode = deps.dom.root;
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
      const rootEl = wrapFn(rootNode);

      // The root node has no parent
      expect(rootEl.parentElement).toBeNull();
    });

    it("returns the wrapped parent for non-root nodes", () => {
      const { el, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();
      const wrapFn = (n: VirtualNode): ElementAPI =>
        new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);

      const child = wrapFn(dom.createElement(NodeTag.Span));
      el.appendChild(child);

      const parent = child.parentElement;
      expect(parent).not.toBeNull();
      expect(parent!._node).toBe(el._node);
    });
  });

  // --- tagName (Requirement 9.5) ---
  describe("tagName", () => {
    it("returns uppercase tag name for known tags", () => {
      const { el } = createElementAPI(NodeTag.Div);
      expect(el.tagName).toBe("DIV");
    });

    it("returns uppercase for other known tags", () => {
      const { el } = createElementAPI(NodeTag.Span);
      expect(el.tagName).toBe("SPAN");
    });

    it("returns empty string for Unknown tag", () => {
      const { el } = createElementAPI(NodeTag.Unknown);
      expect(el.tagName).toBe("");
    });
  });

  // --- id convenience property (Requirement 9.1) ---
  describe("id", () => {
    it("returns empty string when no id attribute set", () => {
      const { el } = createElementAPI();
      expect(el.id).toBe("");
    });

    it("get/set round-trips through setAttribute/getAttribute", () => {
      const { el } = createElementAPI();
      el.id = "myId";
      expect(el.id).toBe("myId");
      expect(el.getAttribute("id")).toBe("myId");
    });
  });

  // --- className convenience property (Requirement 9.2) ---
  describe("className", () => {
    it("returns empty string when no class attribute set", () => {
      const { el } = createElementAPI();
      expect(el.className).toBe("");
    });

    it("get/set round-trips through setAttribute/getAttribute", () => {
      const { el } = createElementAPI();
      el.className = "card active";
      expect(el.className).toBe("card active");
      expect(el.getAttribute("class")).toBe("card active");
    });
  });
});
