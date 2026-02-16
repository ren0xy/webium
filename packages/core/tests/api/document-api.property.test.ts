import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { DocumentAPI } from "../../src/api/document-api.js";
import { walkTree } from "../../src/api/helpers.js";
import { HTML_TAG_MAP } from "../../src/parser/html-parser.js";

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
 * Property 1: getElementById correctness
 *
 * For any VirtualDOM tree containing nodes with `id` attributes, calling
 * `document.getElementById(id)` should return the wrapped `ElementAPI` for
 * the node whose `id` attribute matches (case-sensitive), or `null` if no
 * node has that `id`. The returned wrapper's `_node` should be the same
 * `VirtualNode` instance found by tree traversal.
 *
 * **Validates: Requirements 1.1**
 */
describe("Feature: browser-api-surface, Property 1: getElementById correctness", () => {
  // Generator for node descriptors: each node optionally has an id
  const arbNodeDescriptors = fc.array(
    fc.record({
      hasId: fc.boolean(),
      id: fc.stringMatching(/^[a-z]{1,6}$/),
    }),
    { minLength: 1, maxLength: 10 },
  );

  // Generator for a search id (sometimes existing, sometimes not)
  const arbSearchId = fc.stringMatching(/^[a-z]{1,6}$/);

  it("getElementById returns the correct wrapped node for an existing id", () => {
    fc.assert(
      fc.property(arbNodeDescriptors, arbSearchId, (descriptors, searchId) => {
        const { doc, dom } = createDocAPIDeps();

        // Build tree: create elements and optionally set id attributes
        for (const desc of descriptors) {
          const node = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, node);
          if (desc.hasId) {
            node.attributes.set("id", desc.id);
          }
        }

        // Find the expected node by manual tree walk (first match)
        let expectedNode = null as import("../../src/dom/virtual-node.js").VirtualNode | null;
        walkTree(dom.root, (node) => {
          if (node.attributes.get("id") === searchId) {
            expectedNode = node;
            return true;
          }
          return false;
        });

        const result = doc.getElementById(searchId);

        if (expectedNode === null) {
          // No node with this id — should return null
          expect(result).toBeNull();
        } else {
          // Should return a wrapper whose _node is the same instance
          expect(result).not.toBeNull();
          expect(result!._node).toBe(expectedNode);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("getElementById is case-sensitive", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/),
        (id) => {
          const { doc, dom } = createDocAPIDeps();

          const node = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, node);
          node.attributes.set("id", id);

          // Exact match should find it
          expect(doc.getElementById(id)).not.toBeNull();

          // Uppercase version should NOT find it (unless id was already all same case)
          const upperId = id.toUpperCase();
          if (upperId !== id) {
            expect(doc.getElementById(upperId)).toBeNull();
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("getElementById returns the first matching node when duplicates exist", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/),
        fc.integer({ min: 2, max: 5 }),
        (id, count) => {
          const { doc, dom } = createDocAPIDeps();

          // Create multiple nodes with the same id
          const nodes = [];
          for (let i = 0; i < count; i++) {
            const node = dom.createElement(NodeTag.Div);
            dom.appendChild(dom.root, node);
            node.attributes.set("id", id);
            nodes.push(node);
          }

          const result = doc.getElementById(id);
          expect(result).not.toBeNull();

          // Should return the first one found in tree order (pre-order DFS)
          // Since all are direct children of root, the first appended is first in tree order
          expect(result!._node).toBe(nodes[0]);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("getElementById returns null for an id not present in the tree", () => {
    fc.assert(
      fc.property(arbNodeDescriptors, (descriptors) => {
        const { doc, dom } = createDocAPIDeps();

        // Build tree with ids from descriptors
        const usedIds = new Set<string>();
        for (const desc of descriptors) {
          const node = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, node);
          if (desc.hasId) {
            node.attributes.set("id", desc.id);
            usedIds.add(desc.id);
          }
        }

        // Search for an id that definitely doesn't exist
        const missingId = "zzzzzzz";
        if (!usedIds.has(missingId)) {
          expect(doc.getElementById(missingId)).toBeNull();
        }
      }),
      { numRuns: 100 },
    );
  });

  it("getElementById wrapper _node is the same VirtualNode instance from the tree", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,6}$/),
        (id) => {
          const { doc, dom } = createDocAPIDeps();

          const node = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, node);
          node.attributes.set("id", id);

          const result = doc.getElementById(id);
          expect(result).not.toBeNull();

          // The wrapper's _node should be the exact same object reference
          expect(result!._node).toBe(node);
        },
      ),
      { numRuns: 100 },
    );
  });
});

/**
 * Property 2: querySelector and querySelectorAll correctness
 *
 * For any VirtualDOM tree and for any CSS selector string that SelectorMatcher
 * supports, `document.querySelectorAll(selector)` should return all nodes
 * matching the selector in document (pre-order DFS) order, and
 * `document.querySelector(selector)` should return the first element of that
 * list (or `null` if empty).
 *
 * **Validates: Requirements 1.2, 1.3**
 */
describe("Feature: browser-api-surface, Property 2: querySelector and querySelectorAll correctness", () => {
  // Tags to use for generated nodes
  const TAGS = [NodeTag.Div, NodeTag.Span, NodeTag.P] as const;
  const TAG_NAMES_FOR_SELECTOR = ["div", "span", "p"] as const;

  // Generator for a single node descriptor
  const arbNodeDesc = fc.record({
    tagIndex: fc.integer({ min: 0, max: TAGS.length - 1 }),
    hasId: fc.boolean(),
    id: fc.stringMatching(/^[a-z]{1,6}$/),
    hasClass: fc.boolean(),
    cls: fc.stringMatching(/^[a-z]{1,6}$/),
  });

  // Generator for a tree of 3-8 node descriptors
  const arbTree = fc.array(arbNodeDesc, { minLength: 3, maxLength: 8 });

  // Generator for a selector: #id, .class, or tag name
  const arbSelector = fc.oneof(
    fc.stringMatching(/^[a-z]{1,6}$/).map((id) => `#${id}`),
    fc.stringMatching(/^[a-z]{1,6}$/).map((cls) => `.${cls}`),
    fc.constantFrom(...TAG_NAMES_FOR_SELECTOR),
  );

  /**
   * Build a tree from descriptors. Nodes are appended as children of the root
   * or randomly nested under a previously created node to produce varied shapes.
   */
  function buildTree(
    dom: VirtualDOM,
    descriptors: typeof arbTree extends fc.Arbitrary<infer T> ? T : never,
  ) {
    const nodes: import("../../src/dom/virtual-node.js").VirtualNode[] = [];
    for (const desc of descriptors) {
      const tag = TAGS[desc.tagIndex];
      const node = dom.createElement(tag);
      if (desc.hasId) node.attributes.set("id", desc.id);
      if (desc.hasClass) node.attributes.set("class", desc.cls);

      // Attach to root or a random existing node to create nesting
      const parent = nodes.length === 0 ? dom.root : nodes[Math.floor(nodes.length / 2)];
      dom.appendChild(parent, node);
      nodes.push(node);
    }
    return nodes;
  }

  /**
   * Manual oracle: walk the tree in pre-order DFS and collect all nodes
   * that match the selector via SelectorMatcher.matchesSelector.
   */
  function manualQueryAll(
    root: import("../../src/dom/virtual-node.js").VirtualNode,
    selector: string,
    matcher: SelectorMatcher,
  ) {
    const results: import("../../src/dom/virtual-node.js").VirtualNode[] = [];
    walkTree(root, (node) => {
      try {
        if (matcher.matchesSelector(node, selector)) {
          results.push(node);
        }
      } catch {
        // Unsupported selector — skip
      }
      return false;
    });
    return results;
  }

  it("querySelectorAll returns all matching nodes in document (DFS) order", () => {
    fc.assert(
      fc.property(arbTree, arbSelector, (descriptors, selector) => {
        const { doc, dom, selectorMatcher } = createDocAPIDeps();
        buildTree(dom, descriptors);

        const expected = manualQueryAll(dom.root, selector, selectorMatcher);
        const actual = doc.querySelectorAll(selector);

        expect(actual.length).toBe(expected.length);
        for (let i = 0; i < expected.length; i++) {
          expect(actual[i]._node).toBe(expected[i]);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("querySelector returns the first matching node or null", () => {
    fc.assert(
      fc.property(arbTree, arbSelector, (descriptors, selector) => {
        const { doc, dom, selectorMatcher } = createDocAPIDeps();
        buildTree(dom, descriptors);

        const expected = manualQueryAll(dom.root, selector, selectorMatcher);
        const result = doc.querySelector(selector);

        if (expected.length === 0) {
          expect(result).toBeNull();
        } else {
          expect(result).not.toBeNull();
          expect(result!._node).toBe(expected[0]);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("querySelector result is always the first element of querySelectorAll", () => {
    fc.assert(
      fc.property(arbTree, arbSelector, (descriptors, selector) => {
        const { doc, dom } = createDocAPIDeps();
        buildTree(dom, descriptors);

        const all = doc.querySelectorAll(selector);
        const first = doc.querySelector(selector);

        if (all.length === 0) {
          expect(first).toBeNull();
        } else {
          expect(first).not.toBeNull();
          expect(first!._node).toBe(all[0]._node);
        }
      }),
      { numRuns: 200 },
    );
  });

  it("querySelectorAll returns wrapped ElementAPI instances with correct _node references", () => {
    fc.assert(
      fc.property(arbTree, arbSelector, (descriptors, selector) => {
        const { doc, dom, selectorMatcher } = createDocAPIDeps();
        buildTree(dom, descriptors);

        const expected = manualQueryAll(dom.root, selector, selectorMatcher);
        const actual = doc.querySelectorAll(selector);

        // Every result should be a wrapped ElementAPI whose _node is the same VirtualNode
        for (let i = 0; i < actual.length; i++) {
          expect(actual[i]._node).toBe(expected[i]);
          // Wrapper cache identity: wrapping the same node twice gives the same wrapper
          expect(doc.wrap(expected[i])).toBe(actual[i]);
        }
      }),
      { numRuns: 100 },
    );
  });
});


/**
 * Property 3: Element creation and markCreated
 *
 * For any tag name string, `document.createElement(tagName)` should return an
 * `ElementAPI` whose underlying node has the correct `NodeTag` (mapped via
 * `HTML_TAG_MAP`, or `NodeTag.Unknown` for unrecognized tags), and
 * `ReconciliationEngine.markCreated` should have been called with that node's id.
 * Similarly, for any text string, `document.createTextNode(text)` should return
 * an `ElementAPI` whose node has `tag === NodeTag.Text` and `textContent === text`,
 * with `markCreated` called.
 *
 * **Validates: Requirements 2.1, 2.2, 11.2**
 */
describe("Feature: browser-api-surface, Property 3: Element creation and markCreated", () => {
  // Generator: mix of known HTML tags and random unknown strings
  const arbTagName = fc.oneof(
    fc.constantFrom("div", "span", "p", "button", "input", "a", "ul", "ol", "li"),
    fc.stringMatching(/^[a-z]{1,8}$/),
  );

  // Generator: random text strings for createTextNode
  const arbText = fc.string({ minLength: 0, maxLength: 50 });

  it("createElement returns an ElementAPI with the correct NodeTag from HTML_TAG_MAP", () => {
    fc.assert(
      fc.property(arbTagName, (tagName) => {
        const { doc, reconciliation } = createDocAPIDeps();
        const spy = vi.spyOn(reconciliation, "markCreated");

        const el = doc.createElement(tagName);

        const expectedTag = HTML_TAG_MAP.get(tagName.toLowerCase()) ?? NodeTag.Unknown;
        expect(el._node.tag).toBe(expectedTag);

        spy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });

  it("createElement calls markCreated with the new node's id", () => {
    fc.assert(
      fc.property(arbTagName, (tagName) => {
        const { doc, reconciliation } = createDocAPIDeps();
        const spy = vi.spyOn(reconciliation, "markCreated");

        const el = doc.createElement(tagName);

        expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
        // The last call should be for the newly created node's id
        const calledIds = spy.mock.calls.map((c) => c[0]);
        expect(calledIds).toContain(el._node.id);

        spy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });

  it("createElement maps unknown tags to NodeTag.Unknown", () => {
    fc.assert(
      fc.property(
        fc.stringMatching(/^[a-z]{1,8}$/).filter(
          (s) => !HTML_TAG_MAP.has(s.toLowerCase()),
        ),
        (tagName) => {
          const { doc } = createDocAPIDeps();

          const el = doc.createElement(tagName);
          expect(el._node.tag).toBe(NodeTag.Unknown);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("createTextNode returns an ElementAPI with NodeTag.Text and correct textContent", () => {
    fc.assert(
      fc.property(arbText, (text) => {
        const { doc, reconciliation } = createDocAPIDeps();
        const spy = vi.spyOn(reconciliation, "markCreated");

        const el = doc.createTextNode(text);

        expect(el._node.tag).toBe(NodeTag.Text);
        expect(el._node.textContent).toBe(text);

        spy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });

  it("createTextNode calls markCreated with the new node's id", () => {
    fc.assert(
      fc.property(arbText, (text) => {
        const { doc, reconciliation } = createDocAPIDeps();
        const spy = vi.spyOn(reconciliation, "markCreated");

        const el = doc.createTextNode(text);

        expect(spy.mock.calls.length).toBeGreaterThanOrEqual(1);
        const calledIds = spy.mock.calls.map((c) => c[0]);
        expect(calledIds).toContain(el._node.id);

        spy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });
});
