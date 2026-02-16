/**
 * Shared fast-check arbitraries for @webium/core tests.
 */
import fc from "fast-check";
import { NodeTag, DirtyFlags } from "../../src/dom/types.js";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { CSSRuleImpl } from "../../src/css/css-rule.js";
import type { CSSRule } from "../../src/css/css-rule.js";
import type { Specificity } from "../../src/css/specificity.js";
import { RenderOp } from "../../src/bridge/render-command.js";
import type { RenderCommand } from "../../src/bridge/render-command.js";
import type { ModManifest } from "../../src/modding/manifest-parser.js";

export const arbNodeTag = fc.constantFrom(
  NodeTag.Div, NodeTag.Span, NodeTag.P, NodeTag.Img, NodeTag.Text, NodeTag.Style,
  NodeTag.Unknown, NodeTag.Button, NodeTag.Input, NodeTag.A, NodeTag.Ul, NodeTag.Ol,
  NodeTag.Li, NodeTag.H1, NodeTag.H2, NodeTag.H3, NodeTag.H4, NodeTag.H5, NodeTag.H6,
  NodeTag.Script, NodeTag.Link, NodeTag.Body, NodeTag.Head, NodeTag.Html,
);

export const arbSpecificity: fc.Arbitrary<Specificity> = fc.record({
  a: fc.integer({ min: 0, max: 3 }),
  b: fc.integer({ min: 0, max: 5 }),
  c: fc.integer({ min: 0, max: 5 }),
});

export const arbCSSPropName = fc.constantFrom(
  "color", "display", "margin", "padding", "font-size",
  "background-color", "width", "height", "opacity", "position",
);

export const arbCSSValue = fc.constantFrom(
  "red", "blue", "green", "0", "10px", "auto", "flex", "block", "none", "1",
);

export const arbCSSRule: fc.Arbitrary<CSSRule> = fc.tuple(
  fc.constantFrom("div", ".cls", "#id", "span", "p"),
  fc.dictionary(arbCSSPropName, arbCSSValue, { minKeys: 1, maxKeys: 3 }),
  arbSpecificity,
  fc.nat({ max: 1000 }),
).map(([sel, decls, spec, order]) =>
  new CSSRuleImpl(sel, new Map(Object.entries(decls)), spec, order),
);

export const arbCSSSelector = fc.constantFrom(
  "div", ".foo", "#bar", "span.cls", "div > p", "div .card", "h1, h2",
  "div:hover", ".card[type]", "#main .content",
);

export const arbRenderOp = fc.constantFrom(
  RenderOp.Create, RenderOp.Destroy, RenderOp.UpdateLayout,
  RenderOp.UpdateStyle, RenderOp.UpdateText, RenderOp.Reparent,
);

export const arbRenderCommand: fc.Arbitrary<RenderCommand> = arbRenderOp.chain((op) => {
  switch (op) {
    case RenderOp.Create:
      return fc.tuple(fc.nat({ max: 10000 }), arbNodeTag, fc.nat({ max: 10000 }), fc.nat({ max: 100 }))
        .map(([nodeId, tag, parentId, siblingIndex]) => ({ op, nodeId, tag, parentId, siblingIndex }));
    case RenderOp.Destroy:
      return fc.nat({ max: 10000 }).map((nodeId) => ({ op, nodeId }));
    case RenderOp.UpdateText:
      return fc.tuple(fc.nat({ max: 10000 }), fc.string({ minLength: 0, maxLength: 20 }))
        .map(([nodeId, text]) => ({ op, nodeId, text }));
    default:
      return fc.nat({ max: 10000 }).map((nodeId) => ({ op, nodeId }));
  }
});

export const arbDOMEventType = fc.constantFrom(
  "click", "pointerdown", "pointerup", "pointermove",
  "focus", "blur", "focusin", "focusout", "custom",
);

export const arbModManifest: fc.Arbitrary<ModManifest> = fc.record({
  id: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  name: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  version: fc.option(fc.string({ minLength: 1, maxLength: 10 }), { nil: null }),
  entry: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  description: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  author: fc.option(fc.string({ minLength: 1, maxLength: 20 }), { nil: null }),
  dependencies: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }), { nil: null }),
  html: fc.option(fc.string({ minLength: 1, maxLength: 30 }), { nil: null }),
  css: fc.option(fc.array(fc.string({ minLength: 1, maxLength: 10 }), { maxLength: 3 }), { nil: null }),
});

export const arbCSS = fc.tuple(
  fc.constantFrom("div", "span", "p", ".foo", "#bar"),
  fc.constantFrom("color", "margin", "padding"),
  fc.constantFrom("red", "0", "10px"),
).map(([sel, prop, val]) => `${sel} { ${prop}: ${val}; }`);

/**
 * Build a VirtualDOM tree with a given number of children under root.
 */
export function arbVirtualDOMTree(childCount: number): { dom: VirtualDOM; nodes: VirtualNode[] } {
  const dom = new VirtualDOM();
  const nodes: VirtualNode[] = [];
  for (let i = 0; i < childCount; i++) {
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    nodes.push(node);
  }
  return { dom, nodes };
}

// ---------------------------------------------------------------------------
// HTML Parser generators (Task 4.1)
// ---------------------------------------------------------------------------
import { HTML_TAG_MAP } from "../../src/parser/html-parser.js";

/**
 * Random known HTML tag name string (lowercase) from HTML_TAG_MAP.
 * Validates: Requirements 2.3
 */
export const arbHtmlTagName: fc.Arbitrary<string> = fc.constantFrom(
  ...Array.from(HTML_TAG_MAP.keys()),
);

/**
 * Random attribute key-value tuples (excluding `style`).
 * Keys drawn from common HTML attributes plus random data-* names.
 * Values are safe alphanumeric strings (no `"`, `<`, `>`, `&`).
 * Validates: Requirements 2.6
 */
export const arbHtmlAttributes: fc.Arbitrary<[string, string][]> = fc
  .array(
    fc.tuple(
      fc.oneof(
        fc.constantFrom("id", "class", "src", "href", "type"),
        fc.stringMatching(/^data-[a-z]{1,6}$/),
      ),
      fc.stringMatching(/^[a-zA-Z0-9 ]{0,20}$/),
    ),
    { maxLength: 5 },
  )
  .map((pairs) => {
    // Deduplicate by key, keeping first occurrence; exclude `style`
    const seen = new Set<string>();
    const result: [string, string][] = [];
    for (const [k, v] of pairs) {
      if (k !== "style" && !seen.has(k)) {
        seen.add(k);
        result.push([k, v]);
      }
    }
    return result;
  });

/**
 * Random CSS property-value pairs for inline styles.
 * Uses known CSS property names and safe values.
 * Returns unique property-value tuples.
 * Validates: Requirements 2.7
 */
export const arbInlineStylePairs: fc.Arbitrary<[string, string][]> = fc
  .array(
    fc.tuple(
      fc.constantFrom(
        "color", "display", "margin", "padding", "font-size",
        "background-color", "width", "height", "opacity", "position",
        "border", "text-align", "line-height", "font-weight",
      ),
      fc.constantFrom(
        "red", "blue", "green", "0", "10px", "auto", "flex",
        "block", "none", "1", "center", "bold", "20px", "inherit",
      ),
    ),
    { minLength: 1, maxLength: 5 },
  )
  .map((pairs) => {
    // Deduplicate by property name, keeping first occurrence
    const seen = new Set<string>();
    const result: [string, string][] = [];
    for (const [prop, val] of pairs) {
      if (!seen.has(prop)) {
        seen.add(prop);
        result.push([prop, val]);
      }
    }
    return result;
  });

/**
 * Random well-formed HTML string built from known tags with configurable
 * depth/breadth. Uses only `div` and `span` for nesting (other tags have
 * implicit closing behavior in htmlparser2 that complicates round-tripping).
 * Validates: Requirements 2.3
 */
export const arbSimpleHtml: fc.Arbitrary<string> = fc
  .tuple(
    fc.integer({ min: 1, max: 3 }), // depth
    fc.integer({ min: 1, max: 3 }), // breadth per level
    fc.array(fc.constantFrom("div", "span"), { minLength: 1, maxLength: 12 }),
  )
  .map(([depth, breadth, tags]) => {
    let tagIdx = 0;
    function build(d: number): string {
      if (d <= 0 || tagIdx >= tags.length) return "";
      let html = "";
      const count = Math.min(breadth, tags.length - tagIdx);
      for (let i = 0; i < count && tagIdx < tags.length; i++) {
        const tag = tags[tagIdx++];
        const inner = d > 1 ? build(d - 1) : "text";
        html += `<${tag}>${inner}</${tag}>`;
      }
      return html;
    }
    return build(depth);
  })
  .filter((s) => s.length > 0);

// ---------------------------------------------------------------------------
// Browser API Surface generators (Task 8.1)
// ---------------------------------------------------------------------------

/**
 * Random camelCase CSS property name (1-4 segments).
 * E.g. "backgroundColor", "fontSize", "color"
 * Supports testing for: 5.1, 6.1, 10.1
 */
export const arbCamelCaseProp: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 4 })
  .filter((segs) => segs.every((s) => s.length > 0))
  .map((segs) =>
    segs
      .map((s, i) => (i === 0 ? s : s[0].toUpperCase() + s.slice(1)))
      .join(""),
  );

/**
 * Random kebab-case CSS property name (1-4 segments joined by hyphens).
 * E.g. "background-color", "font-size", "color"
 * Supports testing for: 5.1, 6.1, 10.1
 */
export const arbKebabCaseProp: fc.Arbitrary<string> = fc
  .array(fc.stringMatching(/^[a-z]{1,6}$/), { minLength: 1, maxLength: 4 })
  .filter((segs) => segs.every((s) => s.length > 0))
  .map((segs) => segs.join("-"));

/**
 * Random HTML attribute name (lowercase letters, 1-10 chars, excluding "style").
 * E.g. "class", "id", "data"
 * Supports testing for: 5.1, 6.1, 10.1
 */
export const arbAttributeName: fc.Arbitrary<string> = fc
  .stringMatching(/^[a-z]{1,10}$/)
  .filter((s) => s.length > 0 && s !== "style");

/**
 * Random script VirtualNode (inline with textContent or external with src attribute).
 * Requires a VirtualDOM instance to create nodes.
 * Supports testing for: 5.1, 6.1, 10.1
 */
export function arbScriptNode(
  dom: VirtualDOM,
): fc.Arbitrary<VirtualNode> {
  const arbInlineScript = fc
    .stringMatching(/^[a-zA-Z0-9 =;().]{1,40}$/)
    .map((code) => {
      const node = dom.createElement(NodeTag.Script);
      node.textContent = code;
      return node;
    });

  const arbExternalScript = fc
    .stringMatching(/^[a-z]{1,10}\.js$/)
    .map((src) => {
      const node = dom.createElement(NodeTag.Script);
      node.attributes.set("src", src);
      return node;
    });

  return fc.oneof(arbInlineScript, arbExternalScript);
}
