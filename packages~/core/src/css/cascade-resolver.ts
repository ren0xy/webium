import type { CSSRule } from "./css-rule.js";
import { CSSShorthandExpander } from "./shorthand-expander.js";
import { compareSpecificity } from "./specificity.js";

/**
 * Resolves the CSS cascade: sorts matched rules by specificity ascending
 * then source order ascending, applies declarations in order (later wins),
 * and finally applies inline styles (which always override stylesheet rules).
 *
 * @see Requirements 3.4
 */
export interface ICascadeResolver {
  resolve(
    matchedRules: ReadonlyArray<CSSRule>,
    inlineStyles: ReadonlyMap<string, string>,
  ): Map<string, string>;
}

export class CascadeResolver implements ICascadeResolver {
  private readonly _expander: CSSShorthandExpander;

  constructor(expander?: CSSShorthandExpander) {
    this._expander = expander ?? new CSSShorthandExpander();
  }

  resolve(
    matchedRules: ReadonlyArray<CSSRule>,
    inlineStyles: ReadonlyMap<string, string>,
  ): Map<string, string> {
    // Sort by specificity ascending, then source order ascending.
    // Because we apply in order (later overwrites earlier), the highest
    // specificity / source order ends up winning.
    const sorted = [...matchedRules].sort((a, b) => {
      const specCmp = compareSpecificity(a.specificity, b.specificity);
      if (specCmp !== 0) return specCmp;
      return a.sourceOrder - b.sourceOrder;
    });

    const result = new Map<string, string>();

    // Apply stylesheet declarations in sorted order (later overrides earlier)
    for (const rule of sorted) {
      for (const [prop, value] of rule.declarations) {
        result.set(prop, value);
      }
    }

    // Inline styles always win over stylesheet rules
    for (const [prop, value] of inlineStyles) {
      result.set(prop, value);
    }

    return this._expander.expand(result);
  }
}
