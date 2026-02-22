import type { VirtualNode } from "../dom/virtual-node.js";
import { DirtyFlags, NodeTag } from "../dom/types.js";
import type { CSSRule } from "./css-rule.js";
import { SelectorMatcher } from "./selector-matcher.js";
import { CascadeResolver } from "./cascade-resolver.js";
import { StyleInheritance } from "./style-inheritance.js";

/**
 * User-agent default styles per tag. These have the lowest priority —
 * any stylesheet rule or inline style will override them.
 */
const UA_TAG_DEFAULTS: ReadonlyMap<NodeTag, ReadonlyMap<string, string>> = new Map([
  [NodeTag.Html,   new Map([["display", "block"]])],
  [NodeTag.Body,   new Map([["display", "block"], ["margin-top", "8px"], ["margin-right", "8px"], ["margin-bottom", "8px"], ["margin-left", "8px"]])],
  [NodeTag.Div,    new Map([["display", "block"]])],
  [NodeTag.P,      new Map([["display", "block"], ["margin-top", "16px"], ["margin-bottom", "16px"]])],
  [NodeTag.H1,     new Map([["display", "block"], ["font-size", "32px"], ["font-weight", "bold"], ["margin-top", "21.44px"], ["margin-bottom", "21.44px"]])],
  [NodeTag.H2,     new Map([["display", "block"], ["font-size", "24px"], ["font-weight", "bold"], ["margin-top", "19.92px"], ["margin-bottom", "19.92px"]])],
  [NodeTag.H3,     new Map([["display", "block"], ["font-size", "18.72px"], ["font-weight", "bold"], ["margin-top", "18.72px"], ["margin-bottom", "18.72px"]])],
  [NodeTag.H4,     new Map([["display", "block"], ["font-size", "16px"], ["font-weight", "bold"], ["margin-top", "21.28px"], ["margin-bottom", "21.28px"]])],
  [NodeTag.H5,     new Map([["display", "block"], ["font-size", "13.28px"], ["font-weight", "bold"], ["margin-top", "22.13px"], ["margin-bottom", "22.13px"]])],
  [NodeTag.H6,     new Map([["display", "block"], ["font-size", "10.72px"], ["font-weight", "bold"], ["margin-top", "24.97px"], ["margin-bottom", "24.97px"]])],
  [NodeTag.Ul,     new Map([["display", "block"], ["margin-top", "16px"], ["margin-bottom", "16px"], ["padding-left", "40px"]])],
  [NodeTag.Ol,     new Map([["display", "block"], ["margin-top", "16px"], ["margin-bottom", "16px"], ["padding-left", "40px"]])],
  [NodeTag.Li,     new Map([["display", "list-item"]])],
  [NodeTag.Button, new Map([["display", "inline-block"], ["border-top-width", "2px"], ["border-right-width", "2px"], ["border-bottom-width", "2px"], ["border-left-width", "2px"]])],
  [NodeTag.Input,  new Map([["display", "inline-block"]])],
  [NodeTag.Head,   new Map([["display", "none"]])],
  [NodeTag.Style,  new Map([["display", "none"]])],
  [NodeTag.Script, new Map([["display", "none"]])],
  [NodeTag.Link,   new Map([["display", "none"]])],
]);

/**
 * Orchestrates the match→cascade→inherit pipeline via depth-first tree
 * traversal. Skips clean subtrees when no ancestor style changed.
 *
 * @see Requirements 3.6
 */
export interface IComputedStyleResolver {
  resolveTree(root: VirtualNode, allRules: ReadonlyArray<CSSRule>): void;
  resolveNode(
    node: VirtualNode,
    allRules: ReadonlyArray<CSSRule>,
    parentComputedStyle: ReadonlyMap<string, string> | null,
  ): Map<string, string>;
}

export class ComputedStyleResolver implements IComputedStyleResolver {
  private readonly _matcher: SelectorMatcher;
  private readonly _cascade: CascadeResolver;
  private readonly _inheritance: StyleInheritance;

  constructor(
    matcher?: SelectorMatcher,
    cascade?: CascadeResolver,
    inheritance?: StyleInheritance,
  ) {
    this._matcher = matcher ?? new SelectorMatcher();
    this._cascade = cascade ?? new CascadeResolver();
    this._inheritance = inheritance ?? new StyleInheritance();
  }

  /**
   * Depth-first traversal of the tree rooted at `root`.
   *
   * For each node:
   *  1. Use SelectorMatcher to find matching rules
   *  2. Use CascadeResolver to resolve the cascade (matched rules + inline styles)
   *  3. Use StyleInheritance to apply inheritance (cascaded style + parent computed style)
   *  4. Set node.computedStyle to the result
   *
   * Optimization: skip clean subtrees when no ancestor style changed.
   */
  resolveTree(root: VirtualNode, allRules: ReadonlyArray<CSSRule>): void {
    this._visitNode(root, null, false, allRules);
    this._propagateBodyBackground(root);
  }

  /**
   * CSS 2.1 §14.2 background propagation: if the root element (html) has
   * a transparent background, the body's background-color propagates to it.
   * This ensures the viewport area behind the body margin is filled.
   */
  private _propagateBodyBackground(root: VirtualNode): void {
    // root is the VirtualDOM root (id 0), html is its first child
    let htmlNode: VirtualNode | null = null;
    let bodyNode: VirtualNode | null = null;
    for (const child of root.children) {
      if (child.tag === NodeTag.Html) { htmlNode = child; break; }
    }
    if (!htmlNode) return;
    for (const child of htmlNode.children) {
      if (child.tag === NodeTag.Body) { bodyNode = child; break; }
    }
    if (!bodyNode) return;

    const htmlBg = htmlNode.computedStyle?.get("background-color");
    if (!htmlBg || htmlBg === "transparent" || htmlBg === "rgba(0, 0, 0, 0)") {
      const bodyBg = bodyNode.computedStyle?.get("background-color");
      if (bodyBg && bodyBg !== "transparent" && bodyBg !== "rgba(0, 0, 0, 0)") {
        htmlNode.computedStyle?.set("background-color", bodyBg);
      }
    }
  }

  /**
   * Resolve a single node's computed style without traversing children.
   */
  resolveNode(
    node: VirtualNode,
    allRules: ReadonlyArray<CSSRule>,
    parentComputedStyle: ReadonlyMap<string, string> | null,
  ): Map<string, string> {
    const matchedRules = this._matcher.match(node, allRules);
    const cascaded = this._cascade.resolve(matchedRules, node.inlineStyles);

    // Apply UA tag defaults as lowest priority — only for properties
    // not already set by the cascade (stylesheet rules or inline styles).
    const uaDefaults = UA_TAG_DEFAULTS.get(node.tag);
    if (uaDefaults) {
      for (const [prop, value] of uaDefaults) {
        if (!cascaded.has(prop)) {
          cascaded.set(prop, value);
        }
      }
    }

    return this._inheritance.applyInheritance(cascaded, parentComputedStyle);
  }

  /**
   * Recursive depth-first visitor.
   *
   * @param node            Current node being visited
   * @param parentComputed  Parent's computed style (null for root)
   * @param ancestorDirty   Whether any ancestor had a style change this pass
   * @param allRules        The full set of CSS rules to match against
   */
  private _visitNode(
    node: VirtualNode,
    parentComputed: ReadonlyMap<string, string> | null,
    ancestorDirty: boolean,
    allRules: ReadonlyArray<CSSRule>,
  ): void {
    const nodeStyleDirty = (node.dirty & DirtyFlags.Style) !== 0;
    const needsResolve = nodeStyleDirty || ancestorDirty || node.computedStyle === null;

    if (!needsResolve) {
      // Skip this entire subtree — no ancestor changed and this node is clean
      return;
    }

    // Resolve this node's computed style
    const computed = this.resolveNode(node, allRules, parentComputed);
    node.computedStyle = computed;

    // Propagate: if this node's style was dirty, descendants may need
    // re-resolution due to inheritance changes.
    const childAncestorDirty = ancestorDirty || nodeStyleDirty;

    for (const child of node.children) {
      this._visitNode(child, computed, childAncestorDirty, allRules);
    }
  }
}
