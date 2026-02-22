import * as csstree from "css-tree";
import type { VirtualNode } from "../dom/virtual-node.js";
import type { CSSRule } from "./css-rule.js";
import { CSSRuleImpl } from "./css-rule.js";
import { SpecificityCalculator } from "./specificity.js";

/**
 * Manages a list of stylesheets, rebuilds the combined rule list on
 * add/update/remove, and tracks source order for cascade resolution.
 *
 * Integrates css-tree for CSS parsing.
 *
 * @see Requirements 3.7, 3.1
 */
export interface IStyleSheetManager {
  readonly allRules: ReadonlyArray<CSSRule>;
  addStyleSheet(styleNode: VirtualNode): void;
  updateStyleSheet(styleNode: VirtualNode): void;
  removeStyleSheet(styleNode: VirtualNode): void;
}

interface StyleSheet {
  sourceNode: VirtualNode;
  rules: CSSRule[];
}

export class StyleSheetManager implements IStyleSheetManager {
  private readonly _specificityCalc = new SpecificityCalculator();
  private readonly _sheets: StyleSheet[] = [];
  private _nextSourceOrder = 0;
  private _allRules: CSSRule[] = [];

  get allRules(): ReadonlyArray<CSSRule> {
    return this._allRules;
  }

  addStyleSheet(styleNode: VirtualNode): void {
    if (!styleNode) return;

    const cssText = styleNode.textContent ?? "";
    const rules = this._parseCss(cssText);
    this._sheets.push({ sourceNode: styleNode, rules });
    this._rebuildAllRules();
  }

  updateStyleSheet(styleNode: VirtualNode): void {
    if (!styleNode) return;

    for (let i = 0; i < this._sheets.length; i++) {
      if (this._sheets[i].sourceNode === styleNode) {
        const cssText = styleNode.textContent ?? "";
        const rules = this._parseCss(cssText);
        this._sheets[i] = { sourceNode: styleNode, rules };
        this._rebuildAllRules();
        return;
      }
    }
  }

  removeStyleSheet(styleNode: VirtualNode): void {
    if (!styleNode) return;

    for (let i = this._sheets.length - 1; i >= 0; i--) {
      if (this._sheets[i].sourceNode === styleNode) {
        this._sheets.splice(i, 1);
        this._rebuildAllRules();
        return;
      }
    }
  }

  /**
   * Parse CSS text using css-tree and produce CSSRule instances
   * with correct specificity and source order.
   */
  private _parseCss(cssText: string): CSSRule[] {
    const rules: CSSRule[] = [];

    if (!cssText.trim()) return rules;

    let ast: csstree.CssNode;
    try {
      ast = csstree.parse(cssText);
    } catch {
      // Malformed CSS — return empty rules
      return rules;
    }

    csstree.walk(ast, {
      visit: "Rule",
      enter: (node) => {
        if (node.type !== "Rule" || !node.prelude || !node.block) return;

        const selectorText = csstree.generate(node.prelude);
        const declarations = new Map<string, string>();

        csstree.walk(node.block, {
          visit: "Declaration",
          enter: (decl) => {
            if (decl.type === "Declaration") {
              const prop = decl.property;
              const value = csstree.generate(decl.value);
              declarations.set(prop, value);
            }
          },
        });

        if (declarations.size > 0) {
          const specificity = this._specificityCalc.calculate(selectorText);
          const sourceOrder = this._nextSourceOrder++;
          rules.push(
            new CSSRuleImpl(selectorText, declarations, specificity, sourceOrder),
          );
        }
      },
    });

    return rules;
  }

  private _rebuildAllRules(): void {
    const result: CSSRule[] = [];
    for (const sheet of this._sheets) {
      for (const rule of sheet.rules) {
        result.push(rule);
      }
    }
    this._allRules = result;
  }
}
