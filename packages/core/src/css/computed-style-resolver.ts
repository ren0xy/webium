import type { VirtualNode } from "../dom/virtual-node.js";
import { DirtyFlags } from "../dom/types.js";
import type { CSSRule } from "./css-rule.js";
import { SelectorMatcher } from "./selector-matcher.js";
import { CascadeResolver } from "./cascade-resolver.js";
import { StyleInheritance } from "./style-inheritance.js";

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
