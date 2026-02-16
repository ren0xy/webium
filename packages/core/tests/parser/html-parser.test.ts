import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { NodeTag } from "../../src/dom/types";
import {
  ParseResult,
  HTML_TAG_MAP,
  parseHTML,
  parseInlineStyle,
} from "../../src/parser/html-parser";
import { VirtualDOM } from "../../src/dom/virtual-dom";
import { VirtualNode } from "../../src/dom/virtual-node";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine";
import { StyleSheetManager } from "../../src/css/stylesheet-manager";
import { ComputedStyleResolver } from "../../src/css/computed-style-resolver";
import { arbSimpleHtml } from "../generators";

describe("HTML_TAG_MAP", () => {
  it("maps all 22 known HTML tag names to correct NodeTag values", () => {
    const expected: [string, NodeTag][] = [
      ["div", NodeTag.Div],
      ["span", NodeTag.Span],
      ["p", NodeTag.P],
      ["img", NodeTag.Img],
      ["button", NodeTag.Button],
      ["input", NodeTag.Input],
      ["a", NodeTag.A],
      ["ul", NodeTag.Ul],
      ["ol", NodeTag.Ol],
      ["li", NodeTag.Li],
      ["h1", NodeTag.H1],
      ["h2", NodeTag.H2],
      ["h3", NodeTag.H3],
      ["h4", NodeTag.H4],
      ["h5", NodeTag.H5],
      ["h6", NodeTag.H6],
      ["style", NodeTag.Style],
      ["script", NodeTag.Script],
      ["link", NodeTag.Link],
      ["body", NodeTag.Body],
      ["head", NodeTag.Head],
      ["html", NodeTag.Html],
    ];

    expect(HTML_TAG_MAP.size).toBe(22);
    for (const [tagName, nodeTag] of expected) {
      expect(HTML_TAG_MAP.get(tagName)).toBe(nodeTag);
    }
  });

  it("returns undefined for unknown tag names", () => {
    expect(HTML_TAG_MAP.get("custom-element")).toBeUndefined();
    expect(HTML_TAG_MAP.get("section")).toBeUndefined();
    expect(HTML_TAG_MAP.get("")).toBeUndefined();
  });

  it("is read-only (no set method on ReadonlyMap)", () => {
    // TypeScript enforces this at compile time; runtime check that it's a Map
    expect(HTML_TAG_MAP).toBeInstanceOf(Map);
  });
});

describe("parseInlineStyle", () => {
  it("parses a single property-value pair", () => {
    const result = parseInlineStyle("color: red");
    expect(result.size).toBe(1);
    expect(result.get("color")).toBe("red");
  });

  it("parses multiple property-value pairs", () => {
    const result = parseInlineStyle("color: red; font-size: 16px");
    expect(result.size).toBe(2);
    expect(result.get("color")).toBe("red");
    expect(result.get("font-size")).toBe("16px");
  });

  it("trims whitespace from properties and values", () => {
    const result = parseInlineStyle("  color :  red  ;  font-size :  16px  ");
    expect(result.get("color")).toBe("red");
    expect(result.get("font-size")).toBe("16px");
  });

  it("handles trailing semicolon", () => {
    const result = parseInlineStyle("color: red;");
    expect(result.size).toBe(1);
    expect(result.get("color")).toBe("red");
  });

  it("returns empty map for empty string", () => {
    expect(parseInlineStyle("").size).toBe(0);
  });

  it("returns empty map for whitespace-only string", () => {
    expect(parseInlineStyle("   ").size).toBe(0);
  });

  it("skips declarations missing a colon", () => {
    const result = parseInlineStyle("color: red; invalid; font-size: 16px");
    expect(result.size).toBe(2);
    expect(result.get("color")).toBe("red");
    expect(result.get("font-size")).toBe("16px");
  });

  it("splits on first colon only (values with colons)", () => {
    const result = parseInlineStyle("background: url(http://example.com)");
    expect(result.size).toBe(1);
    expect(result.get("background")).toBe("url(http://example.com)");
  });

  it("skips entries with empty property or value", () => {
    const result = parseInlineStyle(": red; color: ; font-size: 16px");
    // ": red" has empty property → skip
    // "color: " has empty value → skip
    expect(result.size).toBe(1);
    expect(result.get("font-size")).toBe("16px");
  });

  /**
   * Property 4: Inline style parsing round-trip
   * Validates: Requirements 2.7
   *
   * For any set of valid CSS property-value pairs, formatting them as an
   * inline style string and parsing should produce a map with exactly those pairs.
   */
  it("Property 4: inline style parsing round-trip", () => {
    // Use known CSS property names to avoid generating semicolons/colons
    const arbCssProp = fc.constantFrom(
      "color", "font-size", "margin", "padding", "display",
      "background-color", "width", "height", "opacity", "position",
      "border", "top", "left", "right", "bottom",
    );

    // Use known CSS values to avoid generating semicolons/colons
    const arbCssValue = fc.constantFrom(
      "red", "blue", "16px", "10px", "auto", "flex", "block",
      "none", "1", "0", "100%", "inherit", "bold", "center",
      "rgb(0, 0, 0)", "url(http://example.com)",
    );

    const arbStylePairs = fc.uniqueArray(
      fc.tuple(arbCssProp, arbCssValue),
      { minLength: 0, maxLength: 8, selector: ([prop]) => prop },
    );

    fc.assert(
      fc.property(arbStylePairs, (pairs) => {
        const styleStr = pairs
          .map(([prop, val]) => `${prop}: ${val}`)
          .join("; ");

        const result = parseInlineStyle(styleStr);

        expect(result.size).toBe(pairs.length);
        for (const [prop, val] of pairs) {
          expect(result.get(prop)).toBe(val);
        }
      }),
      { numRuns: 100 },
    );
  });
});


describe("parseHTML", () => {
  /**
   * Property 1: Tag mapping correctness
   * Validates: Requirements 2.3
   *
   * For any HTML string containing a single element whose tag name
   * (case-insensitive) maps to a known NodeTag value, parsing that string
   * should produce a VirtualNode child whose tag equals the expected NodeTag.
   * For tag names not in the map, the node's tag should be NodeTag.Unknown.
   */
  it("Feature: html-parser, Property 1: Tag mapping correctness", () => {
    // Build reverse map: NodeTag → lowercase HTML tag name
    const nodeTagToHtmlName = new Map<NodeTag, string>();
    for (const [tagName, nodeTag] of HTML_TAG_MAP) {
      nodeTagToHtmlName.set(nodeTag, tagName);
    }

    // Self-closing (void) tags that don't use a closing tag
    const selfClosingTags = new Set(["img", "input", "link", "br", "hr"]);

    // Tags with special parsing behavior — style accumulates text for
    // StyleSheetManager, script accumulates text for textContent.
    // Exclude them to keep the property test focused on tag mapping only.
    const specialTags = new Set([NodeTag.Style, NodeTag.Script]);

    // All NodeTag values in the map (excluding Text which has no HTML tag)
    const mappedNodeTags = Array.from(HTML_TAG_MAP.values()).filter(
      (nt) => !specialTags.has(nt),
    );

    const arbKnownNodeTag = fc.constantFrom(...mappedNodeTags);

    fc.assert(
      fc.property(arbKnownNodeTag, (nodeTag) => {
        const tagName = nodeTagToHtmlName.get(nodeTag)!;
        const isSelfClosing = selfClosingTags.has(tagName);
        const html = isSelfClosing
          ? `<${tagName}>`
          : `<${tagName}></${tagName}>`;

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        // The root's children should contain exactly one element with the expected tag
        const children = dom.root.children;
        expect(children.length).toBeGreaterThanOrEqual(1);

        const child = children[0];
        expect(child.tag).toBe(nodeTag);
      }),
      { numRuns: 100 },
    );
  });

  it("Feature: html-parser, Property 1: Unknown tags map to NodeTag.Unknown", () => {
    const arbUnknownTag = fc.constantFrom(
      "section", "article", "nav", "header", "footer",
      "main", "aside", "custom-element", "x-widget", "my-component",
    );

    fc.assert(
      fc.property(arbUnknownTag, (tagName) => {
        const html = `<${tagName}></${tagName}>`;

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        const children = dom.root.children;
        expect(children.length).toBeGreaterThanOrEqual(1);

        const child = children[0];
        expect(child.tag).toBe(NodeTag.Unknown);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 2: Tree structure preservation
   * Validates: Requirements 2.3, 2.4, 2.5
   *
   * For any well-formed HTML string built from known tags with arbitrary
   * nesting, the parsed VirtualDOM tree should have the same parent-child
   * structure as the input HTML: each element's children in the tree
   * correspond to the nested elements and text nodes in the source, in
   * document order.
   */
  it("Feature: html-parser, Property 2: Tree structure preservation", () => {
    // Safe non-void, non-special tags for arbitrary nesting.
    // Excluded: p, h1-h6 (can't contain block elements — htmlparser2 auto-closes),
    //           li (auto-closes sibling li), ul/ol (expects li children),
    //           button (can't nest interactive content), a (can't nest inside a).
    // div and span can freely nest inside each other without implicit closing.
    const nestingTags = ["div", "span"] as const;

    const tagToNodeTag: Record<string, NodeTag> = {
      div: NodeTag.Div,
      span: NodeTag.Span,
    };

    // Tree node type for the generated structure
    interface TreeNode {
      tag: string;
      children: TreeNode[];
    }

    // Recursive arbitrary: generate a tree with depth ≤ 3, breadth ≤ 4
    const arbTag = fc.constantFrom(...nestingTags);

    const arbTree: fc.Arbitrary<TreeNode> = fc.letrec((tie) => ({
      tree: fc.record({
        tag: arbTag,
        children: fc.oneof(
          { depthIdentifier: "tree-depth", depthSize: "small" },
          fc.constant<TreeNode[]>([]),
          fc.array(tie("tree") as fc.Arbitrary<TreeNode>, { minLength: 1, maxLength: 4 }),
        ),
      }),
    })).tree;

    // Serialize a TreeNode to an HTML string
    function serialize(node: TreeNode): string {
      const childrenHtml = node.children.map(serialize).join("");
      return `<${node.tag}>${childrenHtml}</${node.tag}>`;
    }

    // Verify the VirtualDOM subtree matches the expected TreeNode structure
    function verifyTree(
      vnode: import("../../src/dom/virtual-node").VirtualNode,
      expected: TreeNode,
    ): void {
      // Tag should match
      expect(vnode.tag).toBe(tagToNodeTag[expected.tag]);

      // Filter out text nodes (whitespace text nodes may be skipped by parser,
      // but we don't generate text so there should be none)
      const elementChildren = vnode.children.filter(
        (c) => c.tag !== NodeTag.Text,
      );

      // Same number of children
      expect(elementChildren.length).toBe(expected.children.length);

      // Recurse in document order
      for (let i = 0; i < expected.children.length; i++) {
        verifyTree(elementChildren[i], expected.children[i]);
      }
    }

    fc.assert(
      fc.property(arbTree, (tree) => {
        const html = serialize(tree);

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        // The root's children should contain exactly one top-level element
        const rootChildren = dom.root.children.filter(
          (c) => c.tag !== NodeTag.Text,
        );
        expect(rootChildren.length).toBe(1);

        verifyTree(rootChildren[0], tree);
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 3: Attribute preservation
   * Validates: Requirements 2.6
   *
   * For any HTML element with a set of attributes (excluding style),
   * the parsed VirtualNode's attributes map should contain exactly
   * those key-value pairs.
   */
  it("Feature: html-parser, Property 3: Attribute preservation", () => {
    // Safe attribute names (htmlparser2 lowercases them)
    const attrNames = [
      "id", "class", "href", "src", "type",
      "data-x", "data-y", "data-z", "title", "alt",
    ];

    // Generate safe attribute values: alphanumeric strings only,
    // no characters that would break HTML parsing (no ", <, >, &)
    const arbAttrValue = fc.stringMatching(/^[a-z0-9 _-]{1,20}$/);

    // Generate a random subset of attributes as key-value pairs
    const arbAttributes = fc.uniqueArray(
      fc.tuple(fc.constantFrom(...attrNames), arbAttrValue),
      { minLength: 0, maxLength: attrNames.length, selector: ([key]) => key },
    );

    fc.assert(
      fc.property(arbAttributes, (attrs) => {
        // Build an HTML div element with the generated attributes
        const attrStr = attrs
          .map(([key, val]) => `${key}="${val}"`)
          .join(" ");
        const html = attrStr.length > 0
          ? `<div ${attrStr}></div>`
          : `<div></div>`;

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        const children = dom.root.children;
        expect(children.length).toBe(1);

        const node = children[0];
        expect(node.tag).toBe(NodeTag.Div);

        // The node's attributes map should contain exactly the generated pairs
        // (style is excluded from generation, so no filtering needed)
        expect(node.attributes.size).toBe(attrs.length);
        for (const [key, val] of attrs) {
          expect(node.attributes.get(key)).toBe(val);
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 5: markCreated coverage
   * Validates: Requirements 2.8
   *
   * For any HTML string, after parsing, reconciliationEngine.markCreated
   * should have been called exactly once for every node in the resulting
   * tree (excluding the pre-existing root).
   */
  it("Feature: html-parser, Property 5: markCreated coverage", () => {
    /** Recursively collect all node IDs in the tree (excluding root). */
    function collectNodeIds(node: VirtualNode): number[] {
      const ids: number[] = [];
      for (const child of node.children) {
        ids.push(child.id);
        ids.push(...collectNodeIds(child));
      }
      return ids;
    }

    fc.assert(
      fc.property(arbSimpleHtml, (html) => {
        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        const spy = vi.spyOn(reconciliationEngine, "markCreated");

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        // Collect all node IDs in the tree (excluding root id 0)
        const treeNodeIds = collectNodeIds(dom.root);

        // markCreated should have been called exactly once per node
        expect(spy.mock.calls.length).toBe(treeNodeIds.length);

        // Collect the IDs that markCreated was called with
        const calledIds = spy.mock.calls.map((call) => call[0] as number);

        // Every tree node ID should appear exactly once in the calls
        for (const id of treeNodeIds) {
          const count = calledIds.filter((cid) => cid === id).length;
          expect(count).toBe(1);
        }

        // No extra calls beyond the tree nodes
        for (const cid of calledIds) {
          expect(treeNodeIds).toContain(cid);
        }

        spy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 6: Script and link collection completeness and order
   * Validates: Requirements 2.9, 4.1, 4.3, 5.1, 5.2
   *
   * For any HTML string containing <script> and <link> elements, the
   * ParseResult.scripts array should contain all script nodes and
   * ParseResult.links should contain all link nodes, both in document
   * (parse) order, with correct src/href attributes and textContent.
   */
  it("Feature: html-parser, Property 6: Script and link collection completeness and order", () => {
    // Generator for a script entry: either external (src) or inline (textContent)
    const arbScript = fc.oneof(
      fc.stringMatching(/^[a-z][a-z0-9-]{0,10}\.js$/).map((src) => ({
        kind: "external" as const,
        src,
      })),
      fc
        .stringMatching(/^[a-zA-Z0-9 (){};=]+$/)
        .filter((s) => s.trim().length > 0)
        .map((code) => ({
          kind: "inline" as const,
          code,
        })),
    );

    // Generator for a link entry with href
    const arbLink = fc
      .stringMatching(/^[a-z][a-z0-9-]{0,10}\.css$/)
      .map((href) => ({ href }));

    // Tag type for ordering: script, link, or filler div
    type EntryType =
      | {
          type: "script";
          value:
            | { kind: "external"; src: string }
            | { kind: "inline"; code: string };
        }
      | { type: "link"; value: { href: string } }
      | { type: "div" };

    const arbEntry: fc.Arbitrary<EntryType> = fc.oneof(
      arbScript.map((value) => ({ type: "script" as const, value })),
      arbLink.map((value) => ({ type: "link" as const, value })),
      fc.constant({ type: "div" as const } as EntryType),
    );

    const arbEntries = fc.array(arbEntry, { minLength: 1, maxLength: 10 });

    fc.assert(
      fc.property(arbEntries, (entries) => {
        // Build HTML from entries
        let html = "";
        const expectedScripts: {
          kind: string;
          src?: string;
          code?: string;
        }[] = [];
        const expectedLinks: { href: string }[] = [];

        for (const entry of entries) {
          if (entry.type === "script") {
            const s = entry.value;
            if (s.kind === "external") {
              html += `<script src="${s.src}"></script>`;
              expectedScripts.push({ kind: "external", src: s.src });
            } else {
              html += `<script>${s.code}</script>`;
              expectedScripts.push({ kind: "inline", code: s.code });
            }
          } else if (entry.type === "link") {
            html += `<link rel="stylesheet" href="${entry.value.href}">`;
            expectedLinks.push({ href: entry.value.href });
          } else {
            html += `<div>filler</div>`;
          }
        }

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        const result: ParseResult = parseHTML(
          html,
          dom,
          reconciliationEngine,
          stylesheetManager,
        );

        // Verify script count matches
        expect(result.scripts.length).toBe(expectedScripts.length);

        // Verify each script in order
        for (let i = 0; i < expectedScripts.length; i++) {
          const node = result.scripts[i];
          const expected = expectedScripts[i];

          expect(node.tag).toBe(NodeTag.Script);

          if (expected.kind === "external") {
            expect(node.attributes.get("src")).toBe(expected.src);
          } else {
            expect(node.textContent).toBe(expected.code);
          }
        }

        // Verify link count matches
        expect(result.links.length).toBe(expectedLinks.length);

        // Verify each link in order
        for (let i = 0; i < expectedLinks.length; i++) {
          const node = result.links[i];
          const expected = expectedLinks[i];

          expect(node.tag).toBe(NodeTag.Link);
          expect(node.attributes.get("href")).toBe(expected.href);
          expect(node.attributes.get("rel")).toBe("stylesheet");
        }
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 7: Style element handling
   * Validates: Requirements 3.1, 3.2, 3.3
   *
   * For any HTML string containing <style> elements with CSS text,
   * stylesheetManager.addStyleSheet should be called once per <style>
   * element, and the style node passed to it should have textContent
   * equal to the CSS text inside the <style> tag.
   */
  it("Feature: html-parser, Property 7: Style element handling", () => {
    // Generator for CSS text snippets (safe strings that won't break HTML parsing)
    const arbCssText = fc
      .tuple(
        fc.constantFrom("div", "span", "p", ".foo", "#bar", "body", "h1"),
        fc.constantFrom("color", "margin", "padding", "display", "font-size"),
        fc.constantFrom("red", "blue", "0", "10px", "auto", "flex", "none"),
      )
      .map(([sel, prop, val]) => `${sel} { ${prop}: ${val}; }`);

    // Generate 1-3 CSS text blocks for <style> elements
    const arbStyleBlocks = fc.array(arbCssText, { minLength: 1, maxLength: 3 });

    fc.assert(
      fc.property(arbStyleBlocks, (cssBlocks) => {
        // Build HTML with <style> elements interspersed with <div> elements
        let html = "";
        for (let i = 0; i < cssBlocks.length; i++) {
          html += `<div>content ${i}</div>`;
          html += `<style>${cssBlocks[i]}</style>`;
        }

        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        const spy = vi.spyOn(stylesheetManager, "addStyleSheet");

        parseHTML(html, dom, reconciliationEngine, stylesheetManager);

        // addStyleSheet should be called exactly once per <style> element
        expect(spy.mock.calls.length).toBe(cssBlocks.length);

        // Each call should receive a style node with correct textContent
        for (let i = 0; i < cssBlocks.length; i++) {
          const styleNode = spy.mock.calls[i][0] as VirtualNode;
          expect(styleNode.tag).toBe(NodeTag.Style);
          expect(styleNode.textContent).toBe(cssBlocks[i]);
        }

        spy.mockRestore();
      }),
      { numRuns: 100 },
    );
  });

  /**
   * Property 8: Malformed HTML resilience
   * Validates: Requirements 6.1, 6.2
   *
   * For any arbitrary string (including malformed HTML, random bytes,
   * empty string), parseHTML should not throw an exception and should
   * return a valid ParseResult with a non-null root.
   */
  it("Feature: html-parser, Property 8: Malformed HTML resilience", () => {
    // Mix arbitrary strings with specific malformed HTML patterns
    const arbInput = fc.oneof(
      fc.string(),                                          // random strings, empty, unicode
      fc.constant(""),                                      // empty string
      fc.constant("<div><span></div>"),                     // misnested tags
      fc.constant("<div>"),                                 // unclosed tag
      fc.constant("<>"),                                    // empty tag
      fc.constant("<<<>>>"),                                // angle bracket soup
      fc.constant("</div>"),                                // closing tag without opener
      fc.constant("<div attr>no closing quote</div>"),      // unquoted attribute
      fc.constant('<div class="foo>broken</div>'),          // unclosed attribute quote
      fc.constant("<div><div><div><div>"),                   // deeply unclosed nesting
      fc.constant("plain text with no tags at all"),        // plain text
      fc.constant("<script><style></div></script>"),        // mixed special tags
      fc.constant("<img <br> <hr>"),                        // jammed self-closing tags
      fc.stringMatching(/^[\s\S]{0,50}$/),                    // broad character range including unicode
    );

    fc.assert(
      fc.property(arbInput, (input) => {
        const dom = new VirtualDOM();
        const styleResolver = new ComputedStyleResolver();
        const stylesheetManager = new StyleSheetManager();
        const reconciliationEngine = new ReconciliationEngine(
          dom,
          styleResolver,
          stylesheetManager,
        );

        // parseHTML must not throw for any input
        let result: ParseResult;
        expect(() => {
          result = parseHTML(input, dom, reconciliationEngine, stylesheetManager);
        }).not.toThrow();

        // Result must be a valid ParseResult
        expect(result!).toBeDefined();
        expect(result!.root).toBeDefined();
        expect(result!.root).not.toBeNull();
        expect(Array.isArray(result!.scripts)).toBe(true);
        expect(Array.isArray(result!.links)).toBe(true);
      }),
      { numRuns: 100 },
    );
  });
});


describe("parseHTML unit tests", () => {
  function createParserDeps() {
    const dom = new VirtualDOM();
    const styleResolver = new ComputedStyleResolver();
    const stylesheetManager = new StyleSheetManager();
    const reconciliationEngine = new ReconciliationEngine(dom, styleResolver, stylesheetManager);
    return { dom, stylesheetManager, reconciliationEngine };
  }

  it("parses a minimal full document into the correct tree structure", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = "<html><head></head><body><div>Hello</div></body></html>";

    const result = parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    // root > html
    const htmlNode = result.root.children[0];
    expect(htmlNode.tag).toBe(NodeTag.Html);

    // html > head + body
    const elementChildren = htmlNode.children.filter((c) => c.tag !== NodeTag.Text);
    expect(elementChildren.length).toBe(2);
    expect(elementChildren[0].tag).toBe(NodeTag.Head);
    expect(elementChildren[1].tag).toBe(NodeTag.Body);

    // body > div
    const bodyNode = elementChildren[1];
    const divNode = bodyNode.children.filter((c) => c.tag !== NodeTag.Text)[0];
    expect(divNode.tag).toBe(NodeTag.Div);

    // div > text "Hello"
    const textNode = divNode.children[0];
    expect(textNode.tag).toBe(NodeTag.Text);
    expect(textNode.textContent).toBe("Hello");
  });

  it("handles self-closing elements with correct tags and attributes", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = '<img src="a.png"><input type="text"><br><hr>';

    parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    const children = dom.root.children;
    expect(children.length).toBe(4);

    expect(children[0].tag).toBe(NodeTag.Img);
    expect(children[0].attributes.get("src")).toBe("a.png");

    expect(children[1].tag).toBe(NodeTag.Input);
    expect(children[1].attributes.get("type")).toBe("text");

    expect(children[2].tag).toBe(NodeTag.Unknown); // <br> maps to Unknown
    expect(children[3].tag).toBe(NodeTag.Unknown); // <hr> maps to Unknown
  });

  it("feeds <style> text content into stylesheetManager.addStyleSheet", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const spy = vi.spyOn(stylesheetManager, "addStyleSheet");
    const css = "body { color: red; }";
    const html = `<style>${css}</style>`;

    parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    expect(spy).toHaveBeenCalledTimes(1);
    const styleNode = spy.mock.calls[0][0] as VirtualNode;
    expect(styleNode.tag).toBe(NodeTag.Style);
    expect(styleNode.textContent).toBe(css);

    spy.mockRestore();
  });

  it("collects external script with src attribute", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = '<script src="app.js"></script>';

    const result = parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    expect(result.scripts.length).toBe(1);
    expect(result.scripts[0].tag).toBe(NodeTag.Script);
    expect(result.scripts[0].attributes.get("src")).toBe("app.js");
  });

  it("collects inline script with textContent", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = '<script>console.log("hi")</script>';

    const result = parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    expect(result.scripts.length).toBe(1);
    expect(result.scripts[0].tag).toBe(NodeTag.Script);
    expect(result.scripts[0].textContent).toBe('console.log("hi")');
  });

  it("collects link elements with href and rel attributes", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = '<link rel="stylesheet" href="style.css">';

    const result = parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    expect(result.links.length).toBe(1);
    expect(result.links[0].tag).toBe(NodeTag.Link);
    expect(result.links[0].attributes.get("href")).toBe("style.css");
    expect(result.links[0].attributes.get("rel")).toBe("stylesheet");
  });

  it("maps unknown tags to NodeTag.Unknown", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = "<custom-element></custom-element>";

    parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    expect(dom.root.children.length).toBe(1);
    expect(dom.root.children[0].tag).toBe(NodeTag.Unknown);
  });

  it("returns empty tree for empty string input", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();

    const result = parseHTML("", dom, reconciliationEngine, stylesheetManager);

    expect(result.root.children.length).toBe(0);
    expect(result.scripts.length).toBe(0);
    expect(result.links.length).toBe(0);
  });

  it("handles malformed HTML without throwing", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = "<div><span></div>";

    let result: ParseResult | undefined;
    expect(() => {
      result = parseHTML(html, dom, reconciliationEngine, stylesheetManager);
    }).not.toThrow();

    expect(result).toBeDefined();
    expect(result!.root).toBeDefined();
    // Best-effort tree: div and span should both exist
    expect(result!.root.children.length).toBeGreaterThanOrEqual(1);
  });

  it("parses inline style attribute into inlineStyles map", () => {
    const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
    const html = '<div style="color: red; font-size: 16px"></div>';

    parseHTML(html, dom, reconciliationEngine, stylesheetManager);

    const divNode = dom.root.children[0];
    expect(divNode.tag).toBe(NodeTag.Div);
    expect(divNode.inlineStyles.get("color")).toBe("red");
    expect(divNode.inlineStyles.get("font-size")).toBe("16px");
    expect(divNode.inlineStyles.size).toBe(2);
  });

  it("maps tag names case-insensitively", () => {
    for (const tagName of ["DIV", "Div", "div"]) {
      const { dom, stylesheetManager, reconciliationEngine } = createParserDeps();
      const html = `<${tagName}></${tagName}>`;

      parseHTML(html, dom, reconciliationEngine, stylesheetManager);

      expect(dom.root.children[0].tag).toBe(NodeTag.Div);
    }
  });
});
