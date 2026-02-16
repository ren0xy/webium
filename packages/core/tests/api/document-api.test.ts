import { describe, it, expect, vi } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { DocumentAPI } from "../../src/api/document-api.js";

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
 * Create fresh instances of all dependencies needed to construct a DocumentAPI.
 */
function createDocAPIDeps() {
  const dom = new VirtualDOM();
  const reconciliation = new ReconciliationEngine(
    dom,
    stubStyleResolver,
    new StyleSheetManager(),
  );
  const stylesheetManager = new StyleSheetManager();
  const selectorMatcher = new SelectorMatcher();
  const doc = new DocumentAPI(dom, reconciliation, stylesheetManager, selectorMatcher);
  return { doc, dom, reconciliation, stylesheetManager, selectorMatcher };
}

/**
 * Unit tests for DocumentAPI
 * Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 3.1
 */
describe("DocumentAPI.getElementById", () => {
  it("returns the wrapped element when a node with the given id exists", () => {
    const { doc, dom } = createDocAPIDeps();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    node.attributes.set("id", "myId");

    const result = doc.getElementById("myId");

    expect(result).not.toBeNull();
    expect(result!._node).toBe(node);
  });

  it("returns null when no node has the given id", () => {
    const { doc, dom } = createDocAPIDeps();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    node.attributes.set("id", "other");

    expect(doc.getElementById("missing")).toBeNull();
  });

  it("returns the first match in tree order when multiple nodes share the same id", () => {
    const { doc, dom } = createDocAPIDeps();
    const first = dom.createElement(NodeTag.Div);
    const second = dom.createElement(NodeTag.Span);
    dom.appendChild(dom.root, first);
    dom.appendChild(dom.root, second);
    first.attributes.set("id", "dup");
    second.attributes.set("id", "dup");

    const result = doc.getElementById("dup");
    expect(result).not.toBeNull();
    expect(result!._node).toBe(first);
  });

  it("finds nodes nested deep in the tree", () => {
    const { doc, dom } = createDocAPIDeps();
    const parent = dom.createElement(NodeTag.Div);
    const child = dom.createElement(NodeTag.Span);
    const grandchild = dom.createElement(NodeTag.P);
    dom.appendChild(dom.root, parent);
    dom.appendChild(parent, child);
    dom.appendChild(child, grandchild);
    grandchild.attributes.set("id", "deep");

    const result = doc.getElementById("deep");
    expect(result).not.toBeNull();
    expect(result!._node).toBe(grandchild);
  });
});

describe("DocumentAPI.querySelector", () => {
  it("returns the first matching element for a tag selector", () => {
    const { doc, dom } = createDocAPIDeps();
    const span1 = dom.createElement(NodeTag.Span);
    const span2 = dom.createElement(NodeTag.Span);
    const p = dom.createElement(NodeTag.P);
    dom.appendChild(dom.root, span1);
    dom.appendChild(dom.root, p);
    dom.appendChild(dom.root, span2);

    const result = doc.querySelector("span");
    expect(result).not.toBeNull();
    expect(result!._node).toBe(span1);
  });

  it("returns null when no element matches", () => {
    const { doc, dom } = createDocAPIDeps();
    const div = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, div);

    expect(doc.querySelector("span")).toBeNull();
  });

  it("returns the first match by class selector", () => {
    const { doc, dom } = createDocAPIDeps();
    const a = dom.createElement(NodeTag.Div);
    const b = dom.createElement(NodeTag.Span);
    dom.appendChild(dom.root, a);
    dom.appendChild(dom.root, b);
    a.attributes.set("class", "card");
    b.attributes.set("class", "card");

    const result = doc.querySelector(".card");
    expect(result).not.toBeNull();
    expect(result!._node).toBe(a);
  });
});

describe("DocumentAPI.querySelectorAll", () => {
  it("returns all matching elements in tree order", () => {
    const { doc, dom } = createDocAPIDeps();
    const span1 = dom.createElement(NodeTag.Span);
    const p = dom.createElement(NodeTag.P);
    const span2 = dom.createElement(NodeTag.Span);
    dom.appendChild(dom.root, span1);
    dom.appendChild(dom.root, p);
    dom.appendChild(dom.root, span2);

    const results = doc.querySelectorAll("span");
    expect(results.length).toBe(2);
    expect(results[0]._node).toBe(span1);
    expect(results[1]._node).toBe(span2);
  });

  it("returns an empty array when nothing matches", () => {
    const { doc, dom } = createDocAPIDeps();
    const div = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, div);

    expect(doc.querySelectorAll("button")).toEqual([]);
  });

  it("returns all matches by class selector in tree order", () => {
    const { doc, dom } = createDocAPIDeps();
    const parent = dom.createElement(NodeTag.Div);
    const child1 = dom.createElement(NodeTag.Span);
    const child2 = dom.createElement(NodeTag.P);
    dom.appendChild(dom.root, parent);
    dom.appendChild(parent, child1);
    dom.appendChild(parent, child2);
    child1.attributes.set("class", "item");
    child2.attributes.set("class", "item");

    const results = doc.querySelectorAll(".item");
    expect(results.length).toBe(2);
    expect(results[0]._node).toBe(child1);
    expect(results[1]._node).toBe(child2);
  });
});

describe("DocumentAPI.createElement", () => {
  it('createElement("div") returns an element with NodeTag.Div', () => {
    const { doc } = createDocAPIDeps();
    const el = doc.createElement("div");
    expect(el._node.tag).toBe(NodeTag.Div);
  });

  it('createElement("custom") returns an element with NodeTag.Unknown', () => {
    const { doc } = createDocAPIDeps();
    const el = doc.createElement("custom");
    expect(el._node.tag).toBe(NodeTag.Unknown);
  });

  it("createElement calls markCreated with the new node id", () => {
    const { doc, reconciliation } = createDocAPIDeps();
    const spy = vi.spyOn(reconciliation, "markCreated");

    const el = doc.createElement("div");

    const calledIds = spy.mock.calls.map((c) => c[0]);
    expect(calledIds).toContain(el._node.id);
    spy.mockRestore();
  });

  it("createElement is case-insensitive for tag name mapping", () => {
    const { doc } = createDocAPIDeps();
    const el = doc.createElement("DIV");
    expect(el._node.tag).toBe(NodeTag.Div);
  });
});

describe("DocumentAPI.createTextNode", () => {
  it('createTextNode("hello") creates a text node with correct textContent', () => {
    const { doc } = createDocAPIDeps();
    const el = doc.createTextNode("hello");
    expect(el._node.tag).toBe(NodeTag.Text);
    expect(el._node.textContent).toBe("hello");
  });

  it("createTextNode calls markCreated with the new node id", () => {
    const { doc, reconciliation } = createDocAPIDeps();
    const spy = vi.spyOn(reconciliation, "markCreated");

    const el = doc.createTextNode("world");

    const calledIds = spy.mock.calls.map((c) => c[0]);
    expect(calledIds).toContain(el._node.id);
    spy.mockRestore();
  });

  it("createTextNode with empty string creates a text node with empty content", () => {
    const { doc } = createDocAPIDeps();
    const el = doc.createTextNode("");
    expect(el._node.tag).toBe(NodeTag.Text);
    expect(el._node.textContent).toBe("");
  });
});

describe("DocumentAPI.body", () => {
  it("returns the <body> element when one exists", () => {
    const { doc, dom } = createDocAPIDeps();
    const body = dom.createElement(NodeTag.Body);
    dom.appendChild(dom.root, body);

    const result = doc.body;
    expect(result._node).toBe(body);
  });

  it("returns the root node when no explicit <body> exists", () => {
    const { doc, dom } = createDocAPIDeps();
    // Only add non-body elements
    const div = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, div);

    const result = doc.body;
    expect(result._node).toBe(dom.root);
  });

  it("finds <body> nested under <html>", () => {
    const { doc, dom } = createDocAPIDeps();
    const html = dom.createElement(NodeTag.Html);
    const body = dom.createElement(NodeTag.Body);
    dom.appendChild(dom.root, html);
    dom.appendChild(html, body);

    const result = doc.body;
    expect(result._node).toBe(body);
  });
});

describe("DocumentAPI wrapper cache identity", () => {
  it("getElementById returns the same wrapper instance for the same node", () => {
    const { doc, dom } = createDocAPIDeps();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    node.attributes.set("id", "x");

    const first = doc.getElementById("x");
    const second = doc.getElementById("x");
    expect(first).toBe(second);
  });

  it("wrap returns the same instance for the same VirtualNode", () => {
    const { doc, dom } = createDocAPIDeps();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    const a = doc.wrap(node);
    const b = doc.wrap(node);
    expect(a).toBe(b);
  });

  it("getElementById and querySelector return the same wrapper for the same node", () => {
    const { doc, dom } = createDocAPIDeps();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    node.attributes.set("id", "shared");

    const byId = doc.getElementById("shared");
    const bySelector = doc.querySelector("#shared");
    expect(byId).toBe(bySelector);
  });
});
