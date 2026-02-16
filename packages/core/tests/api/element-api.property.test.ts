import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { DirtyFlags, NodeTag } from "../../src/dom/types.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { ElementAPI } from "../../src/api/element-api.js";
import { parseHTML } from "../../src/parser/html-parser.js";
import { NODE_TAG_TO_STRING } from "../../src/api/helpers.js";

/**
 * Minimal stub for IComputedStyleResolver — not exercised by attribute tests.
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
 * Create an ElementAPI wrapping a fresh div node.
 */
function createElementAPI() {
  const deps = createAPIDeps();
  const node = deps.dom.createElement(NodeTag.Div);
  deps.dom.appendChild(deps.dom.root, node);
  const wrapFn = (n: VirtualNode) =>
    new ElementAPI(n, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
  const el = wrapFn(node);
  return { el, node, ...deps };
}

/**
 * Property 7: setAttribute/getAttribute round-trip and dirty flags
 *
 * For any attribute name (non-empty string) and value, calling
 * element.setAttribute(name, value) followed by element.getAttribute(name)
 * should return value. After setAttribute, the node should be marked dirty
 * with DirtyFlags.Attributes (and additionally DirtyFlags.Style if the
 * attribute is style, class, or id). After removeAttribute(name),
 * getAttribute(name) should return null.
 *
 * **Validates: Requirements 5.1, 5.2, 5.3**
 */
describe("Feature: browser-api-surface, Property 7: setAttribute/getAttribute round-trip and dirty flags", () => {
  // Generator for generic attribute names (lowercase letters, excludes style/class/id)
  const arbAttrName = fc
    .stringMatching(/^[a-z]{1,10}$/)
    .filter((s) => s !== "style" && s !== "class" && s !== "id");

  // Generator for attribute values
  const arbAttrValue = fc.string({ minLength: 0, maxLength: 50 });

  it("setAttribute then getAttribute returns the same value", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None; // reset dirty from creation

        el.setAttribute(name, value);
        expect(el.getAttribute(name)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("setAttribute marks node dirty with DirtyFlags.Attributes for generic attributes", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None;

        el.setAttribute(name, value);
        expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("setAttribute('class', v) marks dirty with both Attributes and Style", () => {
    fc.assert(
      fc.property(arbAttrValue, (value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None;

        el.setAttribute("class", value);
        expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
        expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("setAttribute('id', v) marks dirty with both Attributes and Style", () => {
    fc.assert(
      fc.property(arbAttrValue, (value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None;

        el.setAttribute("id", value);
        expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
        expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("setAttribute('style', v) marks dirty with DirtyFlags.Style", () => {
    // Use simple valid inline style values to avoid parse issues
    const arbStyleValue = fc
      .stringMatching(/^[a-z]{1,8}$/)
      .map((v) => `color: ${v}`);

    fc.assert(
      fc.property(arbStyleValue, (value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None;

        el.setAttribute("style", value);
        expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("removeAttribute then getAttribute returns null", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, node } = createElementAPI();

        el.setAttribute(name, value);
        node.dirty = DirtyFlags.None;

        el.removeAttribute(name);
        expect(el.getAttribute(name)).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("removeAttribute marks node dirty with DirtyFlags.Attributes", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, node } = createElementAPI();

        el.setAttribute(name, value);
        node.dirty = DirtyFlags.None;

        el.removeAttribute(name);
        expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("node is enqueued in dirty queue after setAttribute", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, dom } = createElementAPI();
        dom.dirtyQueue.drainAll(); // clear queue from creation

        el.setAttribute(name, value);
        expect(dom.dirtyQueue.count).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });

  it("node is enqueued in dirty queue after removeAttribute", () => {
    fc.assert(
      fc.property(arbAttrName, arbAttrValue, (name, value) => {
        const { el, dom } = createElementAPI();

        el.setAttribute(name, value);
        dom.dirtyQueue.drainAll(); // clear queue

        el.removeAttribute(name);
        expect(dom.dirtyQueue.count).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 8: Style proxy camelCase-to-kebab mapping and dirty flags
 *
 * For any camelCase CSS property name and value, setting
 * element.style[camelProp] = value should store the kebab-case equivalent
 * in VirtualNode.inlineStyles, and reading element.style[camelProp] should
 * return that value. After each set, the node should be marked dirty with
 * DirtyFlags.Style.
 *
 * **Validates: Requirements 6.1**
 */
describe("Feature: browser-api-surface, Property 8: Style proxy camelCase-to-kebab mapping and dirty flags", () => {
  // Generator for camelCase CSS property names:
  // 1-4 segments of lowercase letters, first segment stays lowercase, rest are capitalized
  const arbCamelCaseProp = fc
    .array(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 1, maxLength: 4 })
    .map((segments) =>
      segments
        .map((s, i) => (i === 0 ? s : s.charAt(0).toUpperCase() + s.slice(1)))
        .join(""),
    );

  // Generator for simple CSS values (color names, numbers with units)
  const arbCssValue = fc.oneof(
    fc.stringMatching(/^[a-z]{1,10}$/),
    fc.stringMatching(/^[0-9]{1,4}px$/),
  );

  /**
   * Helper: convert camelCase to kebab-case (mirrors the production camelToKebab).
   * Used to independently verify the mapping without importing the production code.
   */
  function expectedKebab(camelProp: string): string {
    return camelProp.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
  }

  it("setting style[camelProp] stores kebab-case key in inlineStyles", () => {
    fc.assert(
      fc.property(arbCamelCaseProp, arbCssValue, (prop, value) => {
        const { el, node } = createElementAPI();

        el.style[prop] = value;

        const kebab = expectedKebab(prop);
        expect(node.inlineStyles.get(kebab)).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("reading style[camelProp] returns the value that was set", () => {
    fc.assert(
      fc.property(arbCamelCaseProp, arbCssValue, (prop, value) => {
        const { el } = createElementAPI();

        el.style[prop] = value;

        expect(el.style[prop]).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("setting style[camelProp] marks node dirty with DirtyFlags.Style", () => {
    fc.assert(
      fc.property(arbCamelCaseProp, arbCssValue, (prop, value) => {
        const { el, node } = createElementAPI();
        node.dirty = DirtyFlags.None;

        el.style[prop] = value;

        expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("setting style[camelProp] enqueues node in dirty queue", () => {
    fc.assert(
      fc.property(arbCamelCaseProp, arbCssValue, (prop, value) => {
        const { el, dom } = createElementAPI();
        dom.dirtyQueue.drainAll();

        el.style[prop] = value;

        expect(dom.dirtyQueue.count).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 9: textContent setter replaces children
 *
 * For any element with existing children and for any text string, setting
 * element.textContent = text should remove all existing children and set
 * VirtualNode.textContent to the given text. The node should be marked
 * dirty with DirtyFlags.Text.
 *
 * **Validates: Requirements 7.1**
 */
describe("Feature: browser-api-surface, Property 9: textContent setter replaces children", () => {
  const arbText = fc.string({ minLength: 0, maxLength: 50 });
  const arbChildCount = fc.integer({ min: 0, max: 5 });

  it("textContent setter removes all children and sets text", () => {
    fc.assert(
      fc.property(arbChildCount, arbText, (numChildren, text) => {
        const { el, node, dom } = createElementAPI();

        // Add N children to the element
        for (let i = 0; i < numChildren; i++) {
          const child = dom.createElement(NodeTag.Div);
          dom.appendChild(node, child);
        }
        expect(node.children.length).toBe(numChildren);

        el.textContent = text;

        expect(node.children.length).toBe(0);
        expect(node.textContent).toBe(text);
      }),
      { numRuns: 100 },
    );
  });

  it("textContent setter marks node dirty with DirtyFlags.Text", () => {
    fc.assert(
      fc.property(arbChildCount, arbText, (numChildren, text) => {
        const { el, node, dom } = createElementAPI();

        for (let i = 0; i < numChildren; i++) {
          const child = dom.createElement(NodeTag.Div);
          dom.appendChild(node, child);
        }
        node.dirty = DirtyFlags.None;

        el.textContent = text;

        expect(node.dirty & DirtyFlags.Text).toBeTruthy();
      }),
      { numRuns: 100 },
    );
  });

  it("textContent setter enqueues node in dirty queue", () => {
    fc.assert(
      fc.property(arbChildCount, arbText, (numChildren, text) => {
        const { el, node, dom } = createElementAPI();

        for (let i = 0; i < numChildren; i++) {
          const child = dom.createElement(NodeTag.Div);
          dom.appendChild(node, child);
        }
        dom.dirtyQueue.drainAll();

        el.textContent = text;

        expect(dom.dirtyQueue.count).toBeGreaterThan(0);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 10: innerHTML serialization round-trip
 *
 * For any well-formed HTML fragment built from known tags (div, span) with
 * text content, setting element.innerHTML = html and then reading
 * element.innerHTML should produce an HTML string that, when parsed again,
 * yields an equivalent tree structure (same tags, same nesting, same text
 * content).
 *
 * **Validates: Requirements 7.2**
 */
describe("Feature: browser-api-surface, Property 10: innerHTML serialization round-trip", () => {
  /**
   * Recursive arbitrary that generates well-formed HTML fragments using
   * only div and span tags (the only tags that allow truly arbitrary nesting
   * in htmlparser2). Max depth 3, simple alphanumeric text content.
   */
  const arbHtmlFragment: fc.Arbitrary<string> = fc.letrec((tie) => ({
    tree: fc.oneof(
      { depthIdentifier: "html-depth", maxDepth: 3 },
      tie("text"),
      tie("element"),
    ),
    text: fc.stringMatching(/^[a-z0-9]{1,8}$/),
    element: fc.tuple(
      fc.constantFrom("div", "span"),
      fc.array(tie("tree"), { minLength: 0, maxLength: 3, depthIdentifier: "html-depth" }),
    ).map(([tag, children]) => `<${tag}>${children.join("")}</${tag}>`),
  })).tree;

  /**
   * Normalize a tree structure into a comparable form.
   * Returns a nested array representation: for element nodes [tagName, ...children],
   * for text nodes just the text string.
   */
  type TreeShape = string | [string, ...TreeShape[]];

  function treeShape(node: VirtualNode): TreeShape[] {
    return node.children.map((child): TreeShape => {
      if (child.tag === NodeTag.Text) {
        return child.textContent ?? "";
      }
      const tagName =
        child.tag === NodeTag.Div ? "div" : child.tag === NodeTag.Span ? "span" : "unknown";
      return [tagName, ...treeShape(child)];
    });
  }

  /**
   * Parse an HTML string into a VirtualDOM and return the tree shape of the root's children.
   */
  function parseToShape(html: string): TreeShape[] {
    const deps = createAPIDeps();
    const tempDom = new VirtualDOM();
    const result = parseHTML(html, tempDom, deps.reconciliation, deps.stylesheetManager);
    return treeShape(result.root);
  }

  it("innerHTML round-trip preserves tree structure", () => {
    fc.assert(
      fc.property(arbHtmlFragment, (html) => {
        const { el } = createElementAPI();

        // Set innerHTML with the generated HTML
        el.innerHTML = html;

        // Read it back
        const serialized = el.innerHTML;

        // Parse the serialized output again
        const originalShape = treeShape(el._node);
        const roundTripShape = parseToShape(serialized);

        expect(roundTripShape).toEqual(originalShape);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 11: addEventListener/removeEventListener round-trip
 *
 * For any event type string and callback function, calling
 * element.addEventListener(type, cb) should add the listener to the
 * underlying VirtualNode's event listener store, and subsequently calling
 * element.removeEventListener(type, cb) should remove it, leaving the
 * store in its original state for that type.
 *
 * **Validates: Requirements 8.1, 8.2**
 */
describe("Feature: browser-api-surface, Property 11: addEventListener/removeEventListener round-trip", () => {
  // Generator for valid event type strings (lowercase, 1-12 chars)
  const arbEventType = fc.stringMatching(/^[a-z]{1,12}$/);

  it("addEventListener adds the listener to the VirtualNode event store", () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const { el, node } = createElementAPI();
        const cb = () => {};

        el.addEventListener(eventType, cb);

        const listeners = node.eventListeners.getListeners(eventType);
        expect(listeners.length).toBe(1);
        expect(listeners[0].listener).toBe(cb);
        expect(listeners[0].useCapture).toBe(false);
      }),
      { numRuns: 100 },
    );
  });

  it("removeEventListener removes the listener, restoring original state", () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const { el, node } = createElementAPI();
        const cb = () => {};

        // Capture original state (no listeners for this type)
        const beforeListeners = node.eventListeners.getListeners(eventType);
        expect(beforeListeners.length).toBe(0);

        // Add then remove
        el.addEventListener(eventType, cb);
        el.removeEventListener(eventType, cb);

        // Should be back to original state
        const afterListeners = node.eventListeners.getListeners(eventType);
        expect(afterListeners.length).toBe(0);
      }),
      { numRuns: 100 },
    );
  });

  it("addEventListener with useCapture=true is distinguishable from useCapture=false", () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const { el, node } = createElementAPI();
        const cb = () => {};

        // Add same callback with both capture modes
        el.addEventListener(eventType, cb, false);
        el.addEventListener(eventType, cb, true);

        const listeners = node.eventListeners.getListeners(eventType);
        expect(listeners.length).toBe(2);

        // Removing only the bubble-phase listener leaves the capture one
        el.removeEventListener(eventType, cb, false);
        const remaining = node.eventListeners.getListeners(eventType);
        expect(remaining.length).toBe(1);
        expect(remaining[0].useCapture).toBe(true);
      }),
      { numRuns: 100 },
    );
  });

  it("duplicate addEventListener with same callback and capture is a no-op", () => {
    fc.assert(
      fc.property(arbEventType, (eventType) => {
        const { el, node } = createElementAPI();
        const cb = () => {};

        el.addEventListener(eventType, cb);
        el.addEventListener(eventType, cb); // duplicate

        const listeners = node.eventListeners.getListeners(eventType);
        expect(listeners.length).toBe(1);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 12: Convenience properties equivalent to getAttribute/setAttribute
 *
 * For any string value, setting element.id = value should be equivalent to
 * element.setAttribute("id", value), and reading element.id should be
 * equivalent to element.getAttribute("id"). The same holds for
 * element.className and the "class" attribute.
 *
 * **Validates: Requirements 9.1, 9.2**
 */
describe("Feature: browser-api-surface, Property 12: Convenience properties equivalent to getAttribute/setAttribute", () => {
  const arbValue = fc.string({ minLength: 0, maxLength: 30 });

  it("setting element.id = value is equivalent to setAttribute('id', value)", () => {
    fc.assert(
      fc.property(arbValue, (value) => {
        const viaProperty = createElementAPI();
        const viaSetAttr = createElementAPI();

        viaProperty.el.id = value;
        viaSetAttr.el.setAttribute("id", value);

        // Both should produce the same getAttribute result
        expect(viaProperty.el.getAttribute("id")).toBe(value);
        expect(viaSetAttr.el.getAttribute("id")).toBe(value);

        // Both underlying nodes should have the same attribute
        expect(viaProperty.node.attributes.get("id")).toBe(value);
        expect(viaSetAttr.node.attributes.get("id")).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("reading element.id is equivalent to getAttribute('id')", () => {
    fc.assert(
      fc.property(arbValue, (value) => {
        const { el } = createElementAPI();

        el.setAttribute("id", value);

        expect(el.id).toBe(el.getAttribute("id"));
      }),
      { numRuns: 100 },
    );
  });

  it("setting element.className = value is equivalent to setAttribute('class', value)", () => {
    fc.assert(
      fc.property(arbValue, (value) => {
        const viaProperty = createElementAPI();
        const viaSetAttr = createElementAPI();

        viaProperty.el.className = value;
        viaSetAttr.el.setAttribute("class", value);

        // Both should produce the same getAttribute result
        expect(viaProperty.el.getAttribute("class")).toBe(value);
        expect(viaSetAttr.el.getAttribute("class")).toBe(value);

        // Both underlying nodes should have the same attribute
        expect(viaProperty.node.attributes.get("class")).toBe(value);
        expect(viaSetAttr.node.attributes.get("class")).toBe(value);
      }),
      { numRuns: 100 },
    );
  });

  it("reading element.className is equivalent to getAttribute('class')", () => {
    fc.assert(
      fc.property(arbValue, (value) => {
        const { el } = createElementAPI();

        el.setAttribute("class", value);

        expect(el.className).toBe(el.getAttribute("class"));
      }),
      { numRuns: 100 },
    );
  });

  it("element.id defaults to empty string when no id attribute is set", () => {
    fc.assert(
      fc.property(arbValue, (_value) => {
        const { el } = createElementAPI();

        // No id set — should return empty string (not null)
        expect(el.id).toBe("");
      }),
      { numRuns: 100 },
    );
  });

  it("element.className defaults to empty string when no class attribute is set", () => {
    fc.assert(
      fc.property(arbValue, (_value) => {
        const { el } = createElementAPI();

        // No class set — should return empty string (not null)
        expect(el.className).toBe("");
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 13: Read-only convenience properties
 *
 * For any element with a mix of element and text node children,
 * element.children should return only the element children (excluding text
 * nodes) as wrapped ElementAPI instances in order. element.parentElement
 * should return the wrapped parent (or null for root-level nodes).
 * element.tagName should return the uppercase tag name string corresponding
 * to the node's NodeTag.
 *
 * **Validates: Requirements 9.3, 9.4, 9.5**
 */
describe("Feature: browser-api-surface, Property 13: Read-only convenience properties", () => {
  // Generator for a mix of element and text children: true = element, false = text
  const arbChildMix = fc.array(fc.boolean(), { minLength: 1, maxLength: 6 });

  // Generator for tags that have string mappings in NODE_TAG_TO_STRING
  const arbNodeTag = fc.constantFrom(
    NodeTag.Div,
    NodeTag.Span,
    NodeTag.P,
    NodeTag.Button,
    NodeTag.Input,
    NodeTag.A,
    NodeTag.Ul,
    NodeTag.Ol,
    NodeTag.Li,
    NodeTag.H1,
    NodeTag.H2,
    NodeTag.H3,
    NodeTag.H4,
    NodeTag.H5,
    NodeTag.H6,
    NodeTag.Img,
    NodeTag.Style,
    NodeTag.Script,
    NodeTag.Link,
    NodeTag.Body,
    NodeTag.Head,
    NodeTag.Html,
  );

  it("element.children returns only element children, excluding text nodes, in order", () => {
    fc.assert(
      fc.property(arbChildMix, (mix) => {
        const { el, node, dom } = createElementAPI();

        // Track which children are elements (not text)
        const expectedElementNodes: VirtualNode[] = [];

        for (const isElement of mix) {
          if (isElement) {
            const child = dom.createElement(NodeTag.Span);
            dom.appendChild(node, child);
            expectedElementNodes.push(child);
          } else {
            const text = dom.createTextNode("text");
            dom.appendChild(node, text);
          }
        }

        const children = el.children;

        // Should have exactly the element children count
        expect(children.length).toBe(expectedElementNodes.length);

        // Each returned child should wrap the correct VirtualNode in order
        for (let i = 0; i < children.length; i++) {
          expect(children[i]._node).toBe(expectedElementNodes[i]);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("element.children returns ElementAPI instances", () => {
    fc.assert(
      fc.property(arbChildMix, (mix) => {
        const { el, node, dom } = createElementAPI();

        for (const isElement of mix) {
          if (isElement) {
            dom.appendChild(node, dom.createElement(NodeTag.Div));
          } else {
            dom.appendChild(node, dom.createTextNode("t"));
          }
        }

        const children = el.children;
        for (const child of children) {
          expect(child).toBeInstanceOf(ElementAPI);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("element.parentElement returns the wrapped parent element", () => {
    fc.assert(
      fc.property(arbChildMix, (mix) => {
        const { el, node, dom, reconciliation, stylesheetManager, selectorMatcher } = createElementAPI();

        // Create a child element and check its parentElement
        if (mix.some((v) => v)) {
          const child = dom.createElement(NodeTag.Div);
          dom.appendChild(node, child);

          const wrapFn = (n: VirtualNode) =>
            new ElementAPI(n, dom, reconciliation, stylesheetManager, selectorMatcher, wrapFn);
          const childAPI = wrapFn(child);

          const parent = childAPI.parentElement;
          expect(parent).not.toBeNull();
          expect(parent!._node).toBe(node);
        }
      }),
      { numRuns: 100 },
    );
  });

  it("element.parentElement returns null for root-level nodes", () => {
    fc.assert(
      fc.property(arbNodeTag, (_tag) => {
        const deps = createAPIDeps();
        // The root node has no parent
        const wrapFn = (n: VirtualNode) =>
          new ElementAPI(n, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
        const rootAPI = wrapFn(deps.dom.root);

        expect(rootAPI.parentElement).toBeNull();
      }),
      { numRuns: 100 },
    );
  });

  it("element.tagName returns the uppercase tag name string for the node's NodeTag", () => {
    fc.assert(
      fc.property(arbNodeTag, (tag) => {
        const deps = createAPIDeps();
        const node = deps.dom.createElement(tag);
        deps.dom.appendChild(deps.dom.root, node);

        const wrapFn = (n: VirtualNode) =>
          new ElementAPI(n, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
        const el = wrapFn(node);

        const tagName = el.tagName;

        // tagName should be uppercase
        expect(tagName).toBe(tagName.toUpperCase());

        // tagName should match the NODE_TAG_TO_STRING mapping
        const expected = NODE_TAG_TO_STRING.get(tag);
        expect(tagName).toBe(expected?.toUpperCase() ?? "");
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 4: appendChild delegation
 *
 * For any parent ElementAPI and N child ElementAPIs, calling
 * parent.appendChild(child) for each should result in the children's
 * underlying VirtualNodes appearing as children of the parent's VirtualNode
 * in append order, and each return value should be the same child wrapper.
 *
 * **Validates: Requirements 4.1**
 */
describe("Feature: browser-api-surface, Property 4: appendChild delegation", () => {
  const arbChildCount = fc.integer({ min: 1, max: 5 });

  // Tag names for children — use a few distinct tags so nodes are distinguishable
  const arbChildTag = fc.constantFrom(
    NodeTag.Div,
    NodeTag.Span,
    NodeTag.P,
    NodeTag.Li,
    NodeTag.Button,
  );

  it("appendChild places children in append order on the parent's VirtualNode", () => {
    fc.assert(
      fc.property(
        arbChildCount,
        fc.array(arbChildTag, { minLength: 1, maxLength: 5 }),
        (n, tags) => {
          const count = Math.min(n, tags.length);
          const deps = createAPIDeps();
          const parentNode = deps.dom.createElement(NodeTag.Div);
          deps.dom.appendChild(deps.dom.root, parentNode);

          const wrapFn = (nd: VirtualNode) =>
            new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
          const parentAPI = wrapFn(parentNode);

          const childAPIs: ElementAPI[] = [];
          const childNodes: VirtualNode[] = [];

          for (let i = 0; i < count; i++) {
            const childNode = deps.dom.createElement(tags[i]);
            const childAPI = wrapFn(childNode);
            childAPIs.push(childAPI);
            childNodes.push(childNode);

            const result = parentAPI.appendChild(childAPI);

            // Return value should be the same child wrapper
            expect(result).toBe(childAPI);
          }

          // Parent's VirtualNode children should match append order
          expect(parentNode.children.length).toBe(count);
          for (let i = 0; i < count; i++) {
            expect(parentNode.children[i]).toBe(childNodes[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("appendChild return value is the same child wrapper", () => {
    fc.assert(
      fc.property(arbChildTag, (tag) => {
        const deps = createAPIDeps();
        const parentNode = deps.dom.createElement(NodeTag.Div);
        deps.dom.appendChild(deps.dom.root, parentNode);

        const wrapFn = (nd: VirtualNode) =>
          new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
        const parentAPI = wrapFn(parentNode);

        const childNode = deps.dom.createElement(tag);
        const childAPI = wrapFn(childNode);

        const result = parentAPI.appendChild(childAPI);
        expect(result).toBe(childAPI);
        expect(result._node).toBe(childNode);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 5: removeChild delegation
 *
 * For any parent ElementAPI with at least one child, calling
 * parent.removeChild(child) should remove the child's VirtualNode from the
 * parent's children list, and the return value should be the same child wrapper.
 *
 * **Validates: Requirements 4.2**
 */
describe("Feature: browser-api-surface, Property 5: removeChild delegation", () => {
  const arbChildCount = fc.integer({ min: 1, max: 5 });

  it("removeChild removes the child and preserves remaining order", () => {
    fc.assert(
      fc.property(
        arbChildCount,
        fc.integer({ min: 0, max: 100 }),
        (n, rawIdx) => {
          const deps = createAPIDeps();
          const parentNode = deps.dom.createElement(NodeTag.Div);
          deps.dom.appendChild(deps.dom.root, parentNode);

          const wrapFn = (nd: VirtualNode) =>
            new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
          const parentAPI = wrapFn(parentNode);

          // Create and append N children
          const childAPIs: ElementAPI[] = [];
          const childNodes: VirtualNode[] = [];
          for (let i = 0; i < n; i++) {
            const childNode = deps.dom.createElement(NodeTag.Span);
            const childAPI = wrapFn(childNode);
            parentAPI.appendChild(childAPI);
            childAPIs.push(childAPI);
            childNodes.push(childNode);
          }

          // Pick a random child to remove
          const removeIdx = rawIdx % n;
          const removedAPI = childAPIs[removeIdx];
          const removedNode = childNodes[removeIdx];

          const result = parentAPI.removeChild(removedAPI);

          // Return value should be the same child wrapper
          expect(result).toBe(removedAPI);

          // The removed node should no longer be in parent's children
          expect(parentNode.children).not.toContain(removedNode);

          // Remaining children should be in original order minus the removed one
          const expectedRemaining = childNodes.filter((_, i) => i !== removeIdx);
          expect(parentNode.children.length).toBe(expectedRemaining.length);
          for (let i = 0; i < expectedRemaining.length; i++) {
            expect(parentNode.children[i]).toBe(expectedRemaining[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("removeChild return value is the same child wrapper", () => {
    fc.assert(
      fc.property(arbChildCount, (n) => {
        const deps = createAPIDeps();
        const parentNode = deps.dom.createElement(NodeTag.Div);
        deps.dom.appendChild(deps.dom.root, parentNode);

        const wrapFn = (nd: VirtualNode) =>
          new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
        const parentAPI = wrapFn(parentNode);

        // Append one child
        const childNode = deps.dom.createElement(NodeTag.Div);
        const childAPI = wrapFn(childNode);
        parentAPI.appendChild(childAPI);

        const result = parentAPI.removeChild(childAPI);
        expect(result).toBe(childAPI);
        expect(result._node).toBe(childNode);
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 6: insertBefore delegation
 *
 * For any parent ElementAPI with at least one child (the reference child),
 * calling parent.insertBefore(newChild, refChild) should place the new
 * child's VirtualNode immediately before the reference child in the parent's
 * children list, and the return value should be the new child wrapper.
 *
 * **Validates: Requirements 4.3**
 */
describe("Feature: browser-api-surface, Property 6: insertBefore delegation", () => {
  const arbChildCount = fc.integer({ min: 1, max: 5 });

  it("insertBefore places newChild immediately before refChild", () => {
    fc.assert(
      fc.property(
        arbChildCount,
        fc.integer({ min: 0, max: 100 }),
        (n, rawIdx) => {
          const deps = createAPIDeps();
          const parentNode = deps.dom.createElement(NodeTag.Div);
          deps.dom.appendChild(deps.dom.root, parentNode);

          const wrapFn = (nd: VirtualNode) =>
            new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
          const parentAPI = wrapFn(parentNode);

          // Create and append N existing children
          const childAPIs: ElementAPI[] = [];
          const childNodes: VirtualNode[] = [];
          for (let i = 0; i < n; i++) {
            const childNode = deps.dom.createElement(NodeTag.Span);
            const childAPI = wrapFn(childNode);
            parentAPI.appendChild(childAPI);
            childAPIs.push(childAPI);
            childNodes.push(childNode);
          }

          // Pick a random ref child
          const refIdx = rawIdx % n;
          const refChildAPI = childAPIs[refIdx];

          // Create a new child to insert
          const newChildNode = deps.dom.createElement(NodeTag.P);
          const newChildAPI = wrapFn(newChildNode);

          const result = parentAPI.insertBefore(newChildAPI, refChildAPI);

          // Return value should be the new child wrapper
          expect(result).toBe(newChildAPI);

          // The new child should be immediately before the ref child
          const newIdx = parentNode.children.indexOf(newChildNode);
          const refNodeIdx = parentNode.children.indexOf(childNodes[refIdx]);
          expect(newIdx).toBe(refNodeIdx - 1);

          // Total children should be n + 1
          expect(parentNode.children.length).toBe(n + 1);

          // Build expected order: original children with newChild inserted before refIdx
          const expected = [...childNodes];
          expected.splice(refIdx, 0, newChildNode);
          for (let i = 0; i < expected.length; i++) {
            expect(parentNode.children[i]).toBe(expected[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("insertBefore return value is the new child wrapper", () => {
    fc.assert(
      fc.property(arbChildCount, (n) => {
        const deps = createAPIDeps();
        const parentNode = deps.dom.createElement(NodeTag.Div);
        deps.dom.appendChild(deps.dom.root, parentNode);

        const wrapFn = (nd: VirtualNode) =>
          new ElementAPI(nd, deps.dom, deps.reconciliation, deps.stylesheetManager, deps.selectorMatcher, wrapFn);
        const parentAPI = wrapFn(parentNode);

        // Append one ref child
        const refNode = deps.dom.createElement(NodeTag.Div);
        const refAPI = wrapFn(refNode);
        parentAPI.appendChild(refAPI);

        // Insert a new child before the ref
        const newNode = deps.dom.createElement(NodeTag.Span);
        const newAPI = wrapFn(newNode);

        const result = parentAPI.insertBefore(newAPI, refAPI);
        expect(result).toBe(newAPI);
        expect(result._node).toBe(newNode);
      }),
      { numRuns: 100 },
    );
  });
});
