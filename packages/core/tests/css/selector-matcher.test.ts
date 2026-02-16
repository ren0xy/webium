import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag, PseudoStates } from "../../src/dom/types.js";
import { CSSRuleImpl } from "../../src/css/css-rule.js";
import type { CSSRule } from "../../src/css/css-rule.js";

// --- Helpers ---

function makeNode(tag: NodeTag, attrs?: Record<string, string>): VirtualNode {
  const node = new VirtualNode();
  node.tag = tag;
  node.id = Math.floor(Math.random() * 100000);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      node.attributes.set(k, v);
    }
  }
  return node;
}

function makeRule(selector: string, order = 0): CSSRule {
  return new CSSRuleImpl(selector, new Map(), { a: 0, b: 0, c: 0 }, order);
}

/** Attach child to parent (manual, no VirtualDOM needed). */
function attach(parent: VirtualNode, child: VirtualNode): void {
  child.parent = parent;
  parent.children.push(child);
}

describe("SelectorMatcher", () => {
  const matcher = new SelectorMatcher();

  // --- Simple selectors ---

  describe("type selectors", () => {
    it("matches div tag", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "div")).toBe(true);
    });

    it("matches span tag", () => {
      const node = makeNode(NodeTag.Span);
      expect(matcher.matchesSimpleSelector(node, "span")).toBe(true);
    });

    it("matches p tag", () => {
      const node = makeNode(NodeTag.P);
      expect(matcher.matchesSimpleSelector(node, "p")).toBe(true);
    });

    it("matches img tag", () => {
      const node = makeNode(NodeTag.Img);
      expect(matcher.matchesSimpleSelector(node, "img")).toBe(true);
    });

    it("is case-insensitive", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "DIV")).toBe(true);
      expect(matcher.matchesSimpleSelector(node, "Div")).toBe(true);
    });

    it("does not match wrong tag", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "span")).toBe(false);
    });

    it("unknown type selector does not match", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "section")).toBe(false);
    });
  });

  describe("universal selector", () => {
    it("matches any node", () => {
      expect(matcher.matchesSimpleSelector(makeNode(NodeTag.Div), "*")).toBe(true);
      expect(matcher.matchesSimpleSelector(makeNode(NodeTag.Span), "*")).toBe(true);
      expect(matcher.matchesSimpleSelector(makeNode(NodeTag.P), "*")).toBe(true);
    });
  });

  describe("class selectors", () => {
    it("matches single class", () => {
      const node = makeNode(NodeTag.Div, { class: "foo" });
      expect(matcher.matchesSimpleSelector(node, ".foo")).toBe(true);
    });

    it("matches class in space-separated list", () => {
      const node = makeNode(NodeTag.Div, { class: "foo bar baz" });
      expect(matcher.matchesSimpleSelector(node, ".bar")).toBe(true);
    });

    it("does not match absent class", () => {
      const node = makeNode(NodeTag.Div, { class: "foo" });
      expect(matcher.matchesSimpleSelector(node, ".bar")).toBe(false);
    });

    it("does not match when no class attribute", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, ".foo")).toBe(false);
    });

    it("is case-insensitive", () => {
      const node = makeNode(NodeTag.Div, { class: "Foo" });
      expect(matcher.matchesSimpleSelector(node, ".foo")).toBe(true);
    });
  });

  describe("id selectors", () => {
    it("matches id", () => {
      const node = makeNode(NodeTag.Div, { id: "main" });
      expect(matcher.matchesSimpleSelector(node, "#main")).toBe(true);
    });

    it("does not match wrong id", () => {
      const node = makeNode(NodeTag.Div, { id: "main" });
      expect(matcher.matchesSimpleSelector(node, "#sidebar")).toBe(false);
    });

    it("does not match when no id attribute", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "#main")).toBe(false);
    });

    it("is case-insensitive", () => {
      const node = makeNode(NodeTag.Div, { id: "Main" });
      expect(matcher.matchesSimpleSelector(node, "#main")).toBe(true);
    });
  });

  describe("attribute selectors", () => {
    it("matches presence: [attr]", () => {
      const node = makeNode(NodeTag.Div, { "data-x": "hello" });
      expect(matcher.matchesSimpleSelector(node, "[data-x]")).toBe(true);
    });

    it("does not match absent attribute", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, "[data-x]")).toBe(false);
    });

    it("matches exact value: [attr=\"value\"]", () => {
      const node = makeNode(NodeTag.Div, { type: "text" });
      expect(matcher.matchesSimpleSelector(node, '[type="text"]')).toBe(true);
    });

    it("matches exact value with single quotes", () => {
      const node = makeNode(NodeTag.Div, { type: "text" });
      expect(matcher.matchesSimpleSelector(node, "[type='text']")).toBe(true);
    });

    it("does not match wrong value", () => {
      const node = makeNode(NodeTag.Div, { type: "text" });
      expect(matcher.matchesSimpleSelector(node, '[type="number"]')).toBe(false);
    });
  });

  describe("pseudo-class selectors", () => {
    it("matches :hover when Hover state is set", () => {
      const node = makeNode(NodeTag.Div);
      node.pseudoStates = PseudoStates.Hover;
      expect(matcher.matchesSimpleSelector(node, ":hover")).toBe(true);
    });

    it("does not match :hover when no Hover state", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, ":hover")).toBe(false);
    });

    it("matches :focus when Focus state is set", () => {
      const node = makeNode(NodeTag.Div);
      node.pseudoStates = PseudoStates.Focus;
      expect(matcher.matchesSimpleSelector(node, ":focus")).toBe(true);
    });

    it("does not match :focus when no Focus state", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSimpleSelector(node, ":focus")).toBe(false);
    });

    it("matches :hover when both Hover and Focus are set", () => {
      const node = makeNode(NodeTag.Div);
      node.pseudoStates = PseudoStates.Hover | PseudoStates.Focus;
      expect(matcher.matchesSimpleSelector(node, ":hover")).toBe(true);
      expect(matcher.matchesSimpleSelector(node, ":focus")).toBe(true);
    });

    it("throws for unsupported pseudo-class", () => {
      const node = makeNode(NodeTag.Div);
      expect(() => matcher.matchesSimpleSelector(node, ":active")).toThrow();
    });
  });

  // --- Compound selectors ---

  describe("compound selectors", () => {
    it("matches div.foo", () => {
      const node = makeNode(NodeTag.Div, { class: "foo" });
      expect(matcher.matchesCompoundSelector(node, "div.foo")).toBe(true);
    });

    it("does not match div.foo on span.foo", () => {
      const node = makeNode(NodeTag.Span, { class: "foo" });
      expect(matcher.matchesCompoundSelector(node, "div.foo")).toBe(false);
    });

    it("matches div#main.active:hover", () => {
      const node = makeNode(NodeTag.Div, { id: "main", class: "active" });
      node.pseudoStates = PseudoStates.Hover;
      expect(matcher.matchesCompoundSelector(node, "div#main.active:hover")).toBe(true);
    });

    it("matches div[type]", () => {
      const node = makeNode(NodeTag.Div, { type: "text" });
      expect(matcher.matchesCompoundSelector(node, "div[type]")).toBe(true);
    });

    it("matches *.foo (universal + class)", () => {
      const node = makeNode(NodeTag.Span, { class: "foo" });
      expect(matcher.matchesCompoundSelector(node, "*.foo")).toBe(true);
    });
  });

  // --- Combinators ---

  describe("descendant combinator (space)", () => {
    it("matches child of matching ancestor", () => {
      const grandparent = makeNode(NodeTag.Div, { class: "container" });
      const parent = makeNode(NodeTag.Div);
      const child = makeNode(NodeTag.Span);
      attach(grandparent, parent);
      attach(parent, child);

      expect(matcher.matchesSelector(child, ".container span")).toBe(true);
    });

    it("matches grandchild of matching ancestor", () => {
      const root = makeNode(NodeTag.Div, { id: "root" });
      const mid = makeNode(NodeTag.Div);
      const leaf = makeNode(NodeTag.P);
      attach(root, mid);
      attach(mid, leaf);

      expect(matcher.matchesSelector(leaf, "#root p")).toBe(true);
    });

    it("does not match when no ancestor matches", () => {
      const parent = makeNode(NodeTag.Span);
      const child = makeNode(NodeTag.Div);
      attach(parent, child);

      expect(matcher.matchesSelector(child, ".missing div")).toBe(false);
    });
  });

  describe("child combinator (>)", () => {
    it("matches direct child", () => {
      const parent = makeNode(NodeTag.Div, { class: "parent" });
      const child = makeNode(NodeTag.Span);
      attach(parent, child);

      expect(matcher.matchesSelector(child, ".parent > span")).toBe(true);
    });

    it("does not match grandchild", () => {
      const grandparent = makeNode(NodeTag.Div, { class: "gp" });
      const parent = makeNode(NodeTag.Div);
      const child = makeNode(NodeTag.Span);
      attach(grandparent, parent);
      attach(parent, child);

      expect(matcher.matchesSelector(child, ".gp > span")).toBe(false);
    });
  });

  describe("adjacent sibling combinator (+)", () => {
    it("matches immediately preceding sibling", () => {
      const parent = makeNode(NodeTag.Div);
      const first = makeNode(NodeTag.Div, { class: "first" });
      const second = makeNode(NodeTag.Span);
      attach(parent, first);
      attach(parent, second);

      expect(matcher.matchesSelector(second, ".first + span")).toBe(true);
    });

    it("does not match non-adjacent sibling", () => {
      const parent = makeNode(NodeTag.Div);
      const first = makeNode(NodeTag.Div, { class: "first" });
      const middle = makeNode(NodeTag.P);
      const last = makeNode(NodeTag.Span);
      attach(parent, first);
      attach(parent, middle);
      attach(parent, last);

      expect(matcher.matchesSelector(last, ".first + span")).toBe(false);
    });

    it("does not match when no preceding sibling", () => {
      const parent = makeNode(NodeTag.Div);
      const only = makeNode(NodeTag.Span);
      attach(parent, only);

      expect(matcher.matchesSelector(only, ".first + span")).toBe(false);
    });
  });

  describe("general sibling combinator (~)", () => {
    it("matches any preceding sibling", () => {
      const parent = makeNode(NodeTag.Div);
      const first = makeNode(NodeTag.Div, { class: "first" });
      const middle = makeNode(NodeTag.P);
      const last = makeNode(NodeTag.Span);
      attach(parent, first);
      attach(parent, middle);
      attach(parent, last);

      expect(matcher.matchesSelector(last, ".first ~ span")).toBe(true);
    });

    it("does not match when no preceding sibling matches", () => {
      const parent = makeNode(NodeTag.Div);
      const first = makeNode(NodeTag.P);
      const second = makeNode(NodeTag.Span);
      attach(parent, first);
      attach(parent, second);

      expect(matcher.matchesSelector(second, ".missing ~ span")).toBe(false);
    });

    it("does not match following siblings", () => {
      const parent = makeNode(NodeTag.Div);
      const first = makeNode(NodeTag.Span);
      const second = makeNode(NodeTag.Div, { class: "after" });
      attach(parent, first);
      attach(parent, second);

      expect(matcher.matchesSelector(first, ".after ~ span")).toBe(false);
    });
  });

  // --- Complex selectors ---

  describe("complex selectors", () => {
    it("matches multi-level descendant: div .container p", () => {
      const root = makeNode(NodeTag.Div);
      const container = makeNode(NodeTag.Div, { class: "container" });
      const para = makeNode(NodeTag.P);
      attach(root, container);
      attach(container, para);

      expect(matcher.matchesSelector(para, "div .container p")).toBe(true);
    });

    it("matches mixed combinators: div > .list + .item", () => {
      const parent = makeNode(NodeTag.Div);
      const list = makeNode(NodeTag.Div, { class: "list" });
      const item = makeNode(NodeTag.Div, { class: "item" });
      attach(parent, list);
      attach(parent, item);

      // "div > .list + .item" right-to-left:
      // .item (key) ✓, + .list (adjacent sibling) ✓, > div (parent of .list) ✓
      expect(matcher.matchesSelector(item, "div > .list + .item")).toBe(true);
    });

    it("does not match mixed combinators when parent is wrong tag", () => {
      const parent = makeNode(NodeTag.Span); // not a div
      const list = makeNode(NodeTag.Div, { class: "list" });
      const item = makeNode(NodeTag.Div, { class: "item" });
      attach(parent, list);
      attach(parent, item);

      expect(matcher.matchesSelector(item, "div > .list + .item")).toBe(false);
    });

    it("matches compound + descendant: #main .sidebar div.widget", () => {
      const main = makeNode(NodeTag.Div, { id: "main" });
      const sidebar = makeNode(NodeTag.Div, { class: "sidebar" });
      const widget = makeNode(NodeTag.Div, { class: "widget" });
      attach(main, sidebar);
      attach(sidebar, widget);

      expect(matcher.matchesSelector(widget, "#main .sidebar div.widget")).toBe(true);
    });
  });

  // --- match() method ---

  describe("match()", () => {
    it("returns matching rules", () => {
      const node = makeNode(NodeTag.Div, { class: "foo" });
      const rules: CSSRule[] = [
        makeRule("div", 0),
        makeRule(".foo", 1),
        makeRule("span", 2),
        makeRule(".bar", 3),
      ];

      const matched = matcher.match(node, rules);
      expect(matched).toHaveLength(2);
      expect(matched[0].selector).toBe("div");
      expect(matched[1].selector).toBe(".foo");
    });

    it("returns empty array when no rules match", () => {
      const node = makeNode(NodeTag.Div);
      const rules: CSSRule[] = [makeRule("span"), makeRule(".foo")];

      expect(matcher.match(node, rules)).toHaveLength(0);
    });

    it("skips rules with empty selectors", () => {
      const node = makeNode(NodeTag.Div);
      const rules: CSSRule[] = [makeRule(""), makeRule("div")];

      const matched = matcher.match(node, rules);
      expect(matched).toHaveLength(1);
      expect(matched[0].selector).toBe("div");
    });

    it("skips rules with unsupported pseudo-classes gracefully", () => {
      const node = makeNode(NodeTag.Div);
      const rules: CSSRule[] = [makeRule(":active"), makeRule("div")];

      const matched = matcher.match(node, rules);
      expect(matched).toHaveLength(1);
      expect(matched[0].selector).toBe("div");
    });

    it("matches rules with combinators in context of a tree", () => {
      const parent = makeNode(NodeTag.Div, { class: "parent" });
      const child = makeNode(NodeTag.Span, { class: "child" });
      attach(parent, child);

      const rules: CSSRule[] = [
        makeRule(".parent > .child", 0),
        makeRule("div .child", 1),
        makeRule(".parent + .child", 2), // should not match (not siblings)
      ];

      const matched = matcher.match(child, rules);
      expect(matched).toHaveLength(2);
      expect(matched[0].selector).toBe(".parent > .child");
      expect(matched[1].selector).toBe("div .child");
    });
  });

  // --- Edge cases ---

  describe("edge cases", () => {
    it("empty selector returns false", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSelector(node, "")).toBe(false);
    });

    it("whitespace-only selector returns false", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSelector(node, "   ")).toBe(false);
    });

    it("node with no parent fails descendant combinator", () => {
      const node = makeNode(NodeTag.Div);
      expect(matcher.matchesSelector(node, "div span")).toBe(false);
    });

    it("attribute selector with value containing spaces", () => {
      const node = makeNode(NodeTag.Div, { title: "hello world" });
      expect(matcher.matchesSimpleSelector(node, '[title="hello world"]')).toBe(true);
    });
  });
});


// Feature: js-core-migration, Property 9: Selector matching correctness
describe("Property 9: Selector matching correctness", () => {
  const matcher = new SelectorMatcher();

  // --- Helpers for building trees ---

  const TAG_ENTRIES: Array<[string, NodeTag]> = [
    ["div", NodeTag.Div],
    ["span", NodeTag.Span],
    ["p", NodeTag.P],
    ["img", NodeTag.Img],
  ];

  const TAG_NAME_MAP = new Map(TAG_ENTRIES.map(([name, tag]) => [tag, name]));

  function makeTestNode(
    tag: NodeTag,
    attrs?: Record<string, string>,
    pseudo?: PseudoStates,
  ): VirtualNode {
    const node = new VirtualNode();
    node.tag = tag;
    node.id = Math.floor(Math.random() * 1000000);
    if (attrs) {
      for (const [k, v] of Object.entries(attrs)) {
        node.attributes.set(k, v);
      }
    }
    if (pseudo !== undefined) {
      node.pseudoStates = pseudo;
    }
    return node;
  }

  function attachNode(parent: VirtualNode, child: VirtualNode): void {
    child.parent = parent;
    parent.children.push(child);
  }

  // --- Generators ---

  const arbTag = fc.constantFrom(...TAG_ENTRIES);

  // Generate a node descriptor with optional class, id, and pseudo-state
  const arbNodeDescriptor = fc.record({
    tag: arbTag,
    className: fc.option(
      fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/),
      { nil: undefined },
    ),
    idAttr: fc.option(
      fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/),
      { nil: undefined },
    ),
    pseudo: fc.constantFrom(PseudoStates.None, PseudoStates.Hover, PseudoStates.Focus),
  });

  // Build a simple tree: root -> children (flat, 1-4 children)
  const arbSimpleTree = fc
    .record({
      root: arbNodeDescriptor,
      children: fc.array(arbNodeDescriptor, { minLength: 1, maxLength: 4 }),
    })
    .map(({ root: rootDesc, children: childDescs }) => {
      const attrs: Record<string, string> = {};
      if (rootDesc.className) attrs["class"] = rootDesc.className;
      if (rootDesc.idAttr) attrs["id"] = rootDesc.idAttr;
      const rootNode = makeTestNode(rootDesc.tag[1], attrs, rootDesc.pseudo);

      const childNodes: VirtualNode[] = [];
      for (const desc of childDescs) {
        const cAttrs: Record<string, string> = {};
        if (desc.className) cAttrs["class"] = desc.className;
        if (desc.idAttr) cAttrs["id"] = desc.idAttr;
        const child = makeTestNode(desc.tag[1], cAttrs, desc.pseudo);
        attachNode(rootNode, child);
        childNodes.push(child);
      }

      return { root: rootNode, children: childNodes, rootDesc, childDescs };
    });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9a: Type selector matching correctness.
   * For any node, a type selector matches iff the node's tag matches.
   */
  it("type selector matches iff node tag matches", () => {
    fc.assert(
      fc.property(
        arbNodeDescriptor,
        fc.constantFrom(...TAG_ENTRIES),
        (nodeDesc, [selectorTagName, selectorTag]) => {
          const attrs: Record<string, string> = {};
          if (nodeDesc.className) attrs["class"] = nodeDesc.className;
          if (nodeDesc.idAttr) attrs["id"] = nodeDesc.idAttr;
          const node = makeTestNode(nodeDesc.tag[1], attrs, nodeDesc.pseudo);

          const matches = matcher.matchesSelector(node, selectorTagName);
          const expected = node.tag === selectorTag;
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9b: Class selector matching correctness.
   * For any node, a class selector matches iff the node has that class.
   */
  it("class selector matches iff node has the class", () => {
    fc.assert(
      fc.property(
        arbNodeDescriptor,
        fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/),
        (nodeDesc, testClass) => {
          const attrs: Record<string, string> = {};
          if (nodeDesc.className) attrs["class"] = nodeDesc.className;
          if (nodeDesc.idAttr) attrs["id"] = nodeDesc.idAttr;
          const node = makeTestNode(nodeDesc.tag[1], attrs, nodeDesc.pseudo);

          const matches = matcher.matchesSelector(node, `.${testClass}`);
          const nodeClass = node.attributes.get("class") ?? "";
          // hasClass is case-insensitive, space-separated
          const classTokens = nodeClass
            .split(" ")
            .map((c) => c.toLowerCase())
            .filter((c) => c.length > 0);
          const expected = classTokens.includes(testClass.toLowerCase());
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9c: ID selector matching correctness.
   * For any node, an id selector matches iff the node has that id.
   */
  it("id selector matches iff node has the id", () => {
    fc.assert(
      fc.property(
        arbNodeDescriptor,
        fc.stringMatching(/^[a-z][a-z0-9]{0,4}$/),
        (nodeDesc, testId) => {
          const attrs: Record<string, string> = {};
          if (nodeDesc.className) attrs["class"] = nodeDesc.className;
          if (nodeDesc.idAttr) attrs["id"] = nodeDesc.idAttr;
          const node = makeTestNode(nodeDesc.tag[1], attrs, nodeDesc.pseudo);

          const matches = matcher.matchesSelector(node, `#${testId}`);
          const nodeId = node.attributes.get("id");
          const expected =
            nodeId !== undefined && nodeId.toLowerCase() === testId.toLowerCase();
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9d: Pseudo-class selector matching correctness.
   * :hover matches iff Hover state is set, :focus matches iff Focus state is set.
   */
  it("pseudo-class selector matches iff pseudo state is set", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(PseudoStates.None, PseudoStates.Hover, PseudoStates.Focus,
          PseudoStates.Hover | PseudoStates.Focus),
        fc.constantFrom(":hover", ":focus"),
        (pseudoState, pseudoSelector) => {
          const node = makeTestNode(NodeTag.Div, {}, pseudoState);

          const matches = matcher.matchesSelector(node, pseudoSelector);
          let expected: boolean;
          if (pseudoSelector === ":hover") {
            expected = (pseudoState & PseudoStates.Hover) !== 0;
          } else {
            expected = (pseudoState & PseudoStates.Focus) !== 0;
          }
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9e: Child combinator correctness.
   * "parentSelector > childSelector" matches a child node iff the child matches
   * childSelector AND its direct parent matches parentSelector.
   */
  it("child combinator matches iff direct parent matches", () => {
    fc.assert(
      fc.property(arbSimpleTree, ({ root, children, rootDesc, childDescs }) => {
        if (children.length === 0) return;

        // Pick a child to test
        const childIdx = 0;
        const child = children[childIdx];
        const childDesc = childDescs[childIdx];

        const childTagName = childDesc.tag[0];
        const rootTagName = rootDesc.tag[0];

        // Build selector: rootTag > childTag
        const selector = `${rootTagName} > ${childTagName}`;
        const matches = matcher.matchesSelector(child, selector);

        // Expected: child tag matches AND parent tag matches
        const expected = child.tag === childDesc.tag[1] && root.tag === rootDesc.tag[1];
        expect(matches).toBe(expected);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9f: Descendant combinator correctness.
   * "ancestorSelector descendantSelector" matches a node iff the node matches
   * descendantSelector AND some ancestor matches ancestorSelector.
   */
  it("descendant combinator matches iff some ancestor matches", () => {
    fc.assert(
      fc.property(
        arbSimpleTree,
        fc.constantFrom(...TAG_ENTRIES),
        ({ root, children, rootDesc }, [ancestorTagName, ancestorTag]) => {
          if (children.length === 0) return;

          const child = children[0];
          const childTagName = TAG_NAME_MAP.get(child.tag)!;

          // Build selector: ancestorTag childTag
          const selector = `${ancestorTagName} ${childTagName}`;
          const matches = matcher.matchesSelector(child, selector);

          // Expected: child tag matches childTagName (always true by construction)
          // AND some ancestor (root) matches ancestorTag
          const ancestorMatches = root.tag === ancestorTag;
          expect(matches).toBe(ancestorMatches);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9g: Adjacent sibling combinator correctness.
   * "siblingSelector + nodeSelector" matches a node iff the node matches
   * nodeSelector AND its immediately preceding sibling matches siblingSelector.
   */
  it("adjacent sibling combinator matches iff preceding sibling matches", () => {
    fc.assert(
      fc.property(
        arbSimpleTree,
        fc.constantFrom(...TAG_ENTRIES),
        ({ children, childDescs }, [sibTagName, sibTag]) => {
          if (children.length < 2) return;

          // Test the second child
          const targetChild = children[1];
          const targetTagName = childDescs[1].tag[0];
          const precedingSibling = children[0];

          const selector = `${sibTagName} + ${targetTagName}`;
          const matches = matcher.matchesSelector(targetChild, selector);

          // Expected: preceding sibling's tag matches sibTag
          const expected = precedingSibling.tag === sibTag;
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });

  /**
   * Validates: Requirements 3.2
   *
   * Property 9h: General sibling combinator correctness.
   * "siblingSelector ~ nodeSelector" matches a node iff the node matches
   * nodeSelector AND some preceding sibling matches siblingSelector.
   */
  it("general sibling combinator matches iff some preceding sibling matches", () => {
    fc.assert(
      fc.property(
        arbSimpleTree,
        fc.constantFrom(...TAG_ENTRIES),
        ({ children, childDescs }, [sibTagName, sibTag]) => {
          if (children.length < 2) return;

          // Test the last child
          const lastIdx = children.length - 1;
          const targetChild = children[lastIdx];
          const targetTagName = childDescs[lastIdx].tag[0];

          const selector = `${sibTagName} ~ ${targetTagName}`;
          const matches = matcher.matchesSelector(targetChild, selector);

          // Expected: some preceding sibling's tag matches sibTag
          const expected = children
            .slice(0, lastIdx)
            .some((sib) => sib.tag === sibTag);
          expect(matches).toBe(expected);
        },
      ),
      { numRuns: 100 },
    );
  });
});

// Feature: expanded-node-tags, Property 2: TAG_NAMES ↔ NodeTag selector matching consistency
describe("Property 2: TAG_NAMES ↔ NodeTag selector matching consistency", () => {
  const matcher = new SelectorMatcher();

  /**
   * All element NodeTag values mapped to their lowercase CSS type selector.
   * Excludes Text and Unknown since they don't represent HTML elements.
   */
  const ELEMENT_TAG_ENTRIES: Array<[NodeTag, string]> = [
    [NodeTag.Div, "div"],
    [NodeTag.Span, "span"],
    [NodeTag.P, "p"],
    [NodeTag.Img, "img"],
    [NodeTag.Style, "style"],
    [NodeTag.Button, "button"],
    [NodeTag.Input, "input"],
    [NodeTag.A, "a"],
    [NodeTag.Ul, "ul"],
    [NodeTag.Ol, "ol"],
    [NodeTag.Li, "li"],
    [NodeTag.H1, "h1"],
    [NodeTag.H2, "h2"],
    [NodeTag.H3, "h3"],
    [NodeTag.H4, "h4"],
    [NodeTag.H5, "h5"],
    [NodeTag.H6, "h6"],
    [NodeTag.Script, "script"],
    [NodeTag.Link, "link"],
    [NodeTag.Body, "body"],
    [NodeTag.Head, "head"],
    [NodeTag.Html, "html"],
  ];

  /**
   * Validates: Requirements 2.1, 2.2
   *
   * For any NodeTag value that represents an HTML element (excluding Text and Unknown),
   * creating a VirtualNode with that tag and matching it against the corresponding
   * lowercase CSS type selector via matchesSimpleSelector returns true.
   */
  it("matchesSimpleSelector returns true for every element NodeTag with its corresponding tag name", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...ELEMENT_TAG_ENTRIES),
        ([nodeTag, tagName]) => {
          const node = new VirtualNode();
          node.tag = nodeTag;
          node.id = 1;

          expect(matcher.matchesSimpleSelector(node, tagName)).toBe(true);
        },
      ),
      { numRuns: 100 },
    );
  });
});

