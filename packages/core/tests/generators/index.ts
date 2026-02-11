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
