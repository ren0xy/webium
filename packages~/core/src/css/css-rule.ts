import type { Specificity } from "./specificity.js";

/**
 * Represents a single CSS rule with its selector, declarations, specificity,
 * and source order for cascade resolution.
 *
 * @see Requirements 3.4
 */
export interface CSSRule {
  readonly selector: string;
  readonly declarations: ReadonlyMap<string, string>;
  readonly specificity: Specificity;
  readonly sourceOrder: number;
}

/**
 * Concrete implementation of CSSRule.
 */
export class CSSRuleImpl implements CSSRule {
  constructor(
    public readonly selector: string,
    public readonly declarations: ReadonlyMap<string, string>,
    public readonly specificity: Specificity,
    public readonly sourceOrder: number,
  ) {}
}
