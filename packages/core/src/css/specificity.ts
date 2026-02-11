/**
 * CSS Specificity type and calculator.
 * Ported from C# SpecificityCalculator.cs and Specificity.cs
 */

export interface Specificity {
  /** Count of ID selectors (#foo) */
  a: number;
  /** Count of class, attribute, and pseudo-class selectors */
  b: number;
  /** Count of type selectors */
  c: number;
}

export const ZERO_SPECIFICITY: Specificity = { a: 0, b: 0, c: 0 };

export function compareSpecificity(left: Specificity, right: Specificity): number {
  if (left.a !== right.a) return left.a - right.a;
  if (left.b !== right.b) return left.b - right.b;
  return left.c - right.c;
}

export function addSpecificity(left: Specificity, right: Specificity): Specificity {
  return { a: left.a + right.a, b: left.b + right.b, c: left.c + right.c };
}

export interface ISpecificityCalculator {
  calculate(selector: string): Specificity;
}

export class SpecificityCalculator implements ISpecificityCalculator {
  calculate(selector: string): Specificity {
    if (!selector || !selector.trim()) {
      return { ...ZERO_SPECIFICITY };
    }

    // Handle comma-separated selector lists — return highest specificity
    const selectorList = selector.split(",");
    if (selectorList.length > 1) {
      let highest: Specificity = { a: 0, b: 0, c: 0 };
      for (const sel of selectorList) {
        const spec = this.calculateSingle(sel.trim());
        if (compareSpecificity(spec, highest) > 0) {
          highest = spec;
        }
      }
      return highest;
    }

    return this.calculateSingle(selector.trim());
  }

  private calculateSingle(selector: string): Specificity {
    if (!selector) return { ...ZERO_SPECIFICITY };

    let a = 0;
    let b = 0;
    let c = 0;

    const compounds = splitOnCombinators(selector);

    for (const compound of compounds) {
      if (!compound.trim()) continue;

      const simples = tokenizeCompound(compound.trim());
      for (const simple of simples) {
        if (simple === "*") continue; // universal selector: (0,0,0)

        if (simple.startsWith("::")) {
          // pseudo-elements are ignored for specificity in our implementation
          continue;
        } else if (simple.startsWith("#")) {
          a++; // ID selector
        } else if (simple.startsWith(".")) {
          b++; // class selector
        } else if (simple.startsWith("[")) {
          b++; // attribute selector
        } else if (simple.startsWith(":")) {
          b++; // pseudo-class selector
        } else {
          c++; // type selector
        }
      }
    }

    return { a, b, c };
  }
}


/**
 * Splits a full selector into compound selectors, stripping combinators.
 * Handles '>', '+', '~' and whitespace (descendant combinator).
 */
function splitOnCombinators(selector: string): string[] {
  const compounds: string[] = [];
  let start = 0;
  let i = 0;
  const len = selector.length;

  while (i < len) {
    const ch = selector[i];

    // Skip over attribute selectors entirely so brackets don't confuse us
    if (ch === "[") {
      i = skipBracket(selector, i);
      continue;
    }

    // Skip over parenthesized content (e.g., :nth-child(2n+1))
    if (ch === "(") {
      i = skipParens(selector, i);
      continue;
    }

    if (ch === ">" || ch === "+" || ch === "~") {
      // Explicit combinator — flush current compound
      if (i > start) {
        compounds.push(selector.substring(start, i).trim());
      }
      i++;
      // Skip whitespace after combinator
      while (i < len && selector[i] === " ") i++;
      start = i;
      continue;
    }

    if (ch === " ") {
      // Potential descendant combinator — but only if the next
      // non-space char is not an explicit combinator.
      let afterSpace = i;
      while (afterSpace < len && selector[afterSpace] === " ") afterSpace++;

      if (
        afterSpace < len &&
        (selector[afterSpace] === ">" ||
          selector[afterSpace] === "+" ||
          selector[afterSpace] === "~")
      ) {
        // The explicit combinator handler will deal with this
        i = afterSpace;
        continue;
      }

      // Descendant combinator — flush current compound
      if (i > start) {
        compounds.push(selector.substring(start, i).trim());
      }
      i = afterSpace;
      start = i;
      continue;
    }

    i++;
  }

  // Flush remaining
  if (start < len) {
    const remaining = selector.substring(start).trim();
    if (remaining.length > 0) {
      compounds.push(remaining);
    }
  }

  return compounds;
}

/**
 * Tokenizes a compound selector (e.g. "div.card#main:hover[type]") into
 * individual simple selectors: ["div", ".card", "#main", ":hover", "[type]"].
 */
function tokenizeCompound(compound: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = compound.length;

  while (i < len) {
    const ch = compound[i];

    if (ch === "#" || ch === ".") {
      // ID or class selector — read until next delimiter
      const start = i;
      i++;
      while (i < len && !isSimpleSelectorStart(compound[i])) i++;
      tokens.push(compound.substring(start, i));
    } else if (ch === "[") {
      // Attribute selector — read until closing ']'
      const start = i;
      i = skipBracket(compound, i);
      tokens.push(compound.substring(start, i));
    } else if (ch === ":") {
      // Check for pseudo-element (::) vs pseudo-class (:)
      const start = i;
      if (i + 1 < len && compound[i + 1] === ":") {
        // Pseudo-element — skip it entirely
        i += 2;
        while (i < len && !isSimpleSelectorStart(compound[i])) {
          if (compound[i] === "(") {
            i = skipParensInCompound(compound, i);
            break;
          }
          i++;
        }
        tokens.push(compound.substring(start, i));
      } else {
        // Pseudo-class selector
        i++;
        // Handle functional pseudo-classes like :nth-child(...)
        while (i < len && !isSimpleSelectorStart(compound[i])) {
          if (compound[i] === "(") {
            i = skipParensInCompound(compound, i);
            break;
          }
          i++;
        }
        tokens.push(compound.substring(start, i));
      }
    } else if (ch === "*") {
      tokens.push("*");
      i++;
    } else {
      // Type selector — read identifier chars
      const start = i;
      i++;
      while (i < len && !isSimpleSelectorStart(compound[i])) i++;
      tokens.push(compound.substring(start, i));
    }
  }

  return tokens;
}

function isSimpleSelectorStart(ch: string): boolean {
  return ch === "#" || ch === "." || ch === "[" || ch === ":" || ch === "*";
}

function skipBracket(s: string, i: number): number {
  i++; // skip '['
  while (i < s.length && s[i] !== "]") i++;
  if (i < s.length) i++; // skip ']'
  return i;
}

function skipParens(s: string, i: number): number {
  let depth = 1;
  i++; // skip '('
  while (i < s.length && depth > 0) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    i++;
  }
  return i;
}

function skipParensInCompound(s: string, i: number): number {
  let depth = 1;
  i++; // skip '('
  while (i < s.length && depth > 0) {
    if (s[i] === "(") depth++;
    else if (s[i] === ")") depth--;
    i++;
  }
  return i;
}
