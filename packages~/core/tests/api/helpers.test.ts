import { describe, it, expect } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import {
  serializeNode,
  serializeChildren,
  walkTree,
  NODE_TAG_TO_STRING,
} from "../../src/api/helpers.js";
import { HTML_TAG_MAP } from "../../src/parser/html-parser.js";

/**
 * Unit tests for helper functions in packages~/core/src/api/helpers.ts.
 *
 * Validates: Requirements 7.2, 9.5
 */

/** Create a fresh VirtualDOM for test isolation. */
function createHelperDeps() {
  const dom = new VirtualDOM();
  return { dom };
}

describe("serializeNode", () => {
  it("serializes a text node as its textContent", () => {
    const { dom } = createHelperDeps();
    const text = dom.createTextNode("hello world");
    expect(serializeNode(text)).toBe("hello world");
  });

  it("serializes a text node with empty string", () => {
    const { dom } = createHelperDeps();
    const text = dom.createTextNode("");
    expect(serializeNode(text)).toBe("");
  });

  it("serializes a text node with null textContent as empty string", () => {
    const { dom } = createHelperDeps();
    const text = dom.createTextNode("");
    text.textContent = null;
    expect(serializeNode(text)).toBe("");
  });

  it("serializes an element node with no children or attributes", () => {
    const { dom } = createHelperDeps();
    const div = dom.createElement(NodeTag.Div);
    expect(serializeNode(div)).toBe("<div></div>");
  });

  it("serializes an element node with attributes", () => {
    const { dom } = createHelperDeps();
    const div = dom.createElement(NodeTag.Div);
    div.attributes.set("id", "main");
    div.attributes.set("class", "container");
    expect(serializeNode(div)).toBe('<div id="main" class="container"></div>');
  });

  it("serializes a self-closing (void) element without closing tag", () => {
    const { dom } = createHelperDeps();
    const img = dom.createElement(NodeTag.Img);
    img.attributes.set("src", "logo.png");
    expect(serializeNode(img)).toBe('<img src="logo.png">');
  });

  it("serializes input as a void element", () => {
    const { dom } = createHelperDeps();
    const input = dom.createElement(NodeTag.Input);
    input.attributes.set("type", "text");
    expect(serializeNode(input)).toBe('<input type="text">');
  });

  it("serializes link as a void element", () => {
    const { dom } = createHelperDeps();
    const link = dom.createElement(NodeTag.Link);
    link.attributes.set("rel", "stylesheet");
    expect(serializeNode(link)).toBe('<link rel="stylesheet">');
  });

  it("serializes nested tree correctly", () => {
    const { dom } = createHelperDeps();
    const div = dom.createElement(NodeTag.Div);
    const span = dom.createElement(NodeTag.Span);
    const text = dom.createTextNode("hi");
    dom.appendChild(div, span);
    dom.appendChild(span, text);
    expect(serializeNode(div)).toBe("<div><span>hi</span></div>");
  });

  it("serializes deeply nested tree", () => {
    const { dom } = createHelperDeps();
    const outer = dom.createElement(NodeTag.Div);
    const middle = dom.createElement(NodeTag.P);
    const inner = dom.createElement(NodeTag.Span);
    const text = dom.createTextNode("deep");
    dom.appendChild(outer, middle);
    dom.appendChild(middle, inner);
    dom.appendChild(inner, text);
    expect(serializeNode(outer)).toBe("<div><p><span>deep</span></p></div>");
  });

  it("serializes multiple children in order", () => {
    const { dom } = createHelperDeps();
    const div = dom.createElement(NodeTag.Div);
    const t1 = dom.createTextNode("a");
    const t2 = dom.createTextNode("b");
    const span = dom.createElement(NodeTag.Span);
    dom.appendChild(div, t1);
    dom.appendChild(div, span);
    dom.appendChild(div, t2);
    expect(serializeNode(div)).toBe("<div>a<span></span>b</div>");
  });

  it("returns empty string for Unknown tag nodes", () => {
    const { dom } = createHelperDeps();
    const node = dom.createElement(NodeTag.Unknown);
    expect(serializeNode(node)).toBe("");
  });
});

describe("serializeChildren", () => {
  it("returns empty string for node with no children", () => {
    const { dom } = createHelperDeps();
    const div = dom.createElement(NodeTag.Div);
    expect(serializeChildren(div)).toBe("");
  });

  it("serializes all children concatenated", () => {
    const { dom } = createHelperDeps();
    const parent = dom.createElement(NodeTag.Div);
    const child1 = dom.createElement(NodeTag.Span);
    const child2 = dom.createTextNode("text");
    dom.appendChild(parent, child1);
    dom.appendChild(parent, child2);
    expect(serializeChildren(parent)).toBe("<span></span>text");
  });
});

describe("walkTree", () => {
  it("visits nodes in pre-order DFS", () => {
    const { dom } = createHelperDeps();
    const root = dom.createElement(NodeTag.Div);
    const a = dom.createElement(NodeTag.Span);
    const b = dom.createElement(NodeTag.P);
    const c = dom.createElement(NodeTag.Li);
    dom.appendChild(root, a);
    dom.appendChild(root, b);
    dom.appendChild(a, c);

    // Expected pre-order: root, a, c, b
    const visited: number[] = [];
    walkTree(root, (node) => {
      visited.push(node.id);
      return false;
    });
    expect(visited).toEqual([root.id, a.id, c.id, b.id]);
  });

  it("stops early when visitor returns true", () => {
    const { dom } = createHelperDeps();
    const root = dom.createElement(NodeTag.Div);
    const a = dom.createElement(NodeTag.Span);
    const b = dom.createElement(NodeTag.P);
    const c = dom.createElement(NodeTag.Li);
    dom.appendChild(root, a);
    dom.appendChild(root, b);
    dom.appendChild(a, c);

    const visited: number[] = [];
    walkTree(root, (node) => {
      visited.push(node.id);
      // Stop when we reach node 'a'
      return node === a;
    });
    // Should only visit root and a (stops at a)
    expect(visited).toEqual([root.id, a.id]);
  });

  it("visits single node with no children", () => {
    const { dom } = createHelperDeps();
    const leaf = dom.createElement(NodeTag.Div);
    const visited: number[] = [];
    walkTree(leaf, (node) => {
      visited.push(node.id);
      return false;
    });
    expect(visited).toEqual([leaf.id]);
  });

  it("stops immediately when visitor returns true on root", () => {
    const { dom } = createHelperDeps();
    const root = dom.createElement(NodeTag.Div);
    const child = dom.createElement(NodeTag.Span);
    dom.appendChild(root, child);

    const visited: number[] = [];
    walkTree(root, (node) => {
      visited.push(node.id);
      return true; // stop immediately
    });
    expect(visited).toEqual([root.id]);
  });
});

describe("NODE_TAG_TO_STRING", () => {
  it("covers all NodeTag values present in HTML_TAG_MAP", () => {
    // HTML_TAG_MAP maps tag name strings to NodeTag values.
    // NODE_TAG_TO_STRING should be the reverse: NodeTag value → tag name string.
    for (const [tagName, nodeTag] of HTML_TAG_MAP) {
      expect(NODE_TAG_TO_STRING.get(nodeTag)).toBe(tagName);
    }
  });

  it("does not contain Text or Unknown", () => {
    expect(NODE_TAG_TO_STRING.has(NodeTag.Text)).toBe(false);
    expect(NODE_TAG_TO_STRING.has(NodeTag.Unknown)).toBe(false);
  });

  it("contains all NodeTag values except Text and Unknown", () => {
    const allTags = Object.values(NodeTag).filter(
      (v): v is NodeTag => typeof v === "number",
    );
    for (const tag of allTags) {
      if (tag === NodeTag.Text || tag === NodeTag.Unknown) {
        expect(NODE_TAG_TO_STRING.has(tag)).toBe(false);
      } else {
        expect(NODE_TAG_TO_STRING.has(tag)).toBe(true);
      }
    }
  });

  it("maps to lowercase tag name strings", () => {
    for (const [, tagName] of NODE_TAG_TO_STRING) {
      expect(tagName).toBe(tagName.toLowerCase());
    }
  });
});
