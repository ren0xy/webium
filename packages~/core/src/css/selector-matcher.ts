import { VirtualNode } from "../dom/virtual-node.js";
import { NodeTag, PseudoStates } from "../dom/types.js";
import type { CSSRule } from "./css-rule.js";

/**
 * Selector matching engine.
 *
 * Matches CSS selectors against VirtualNodes, supporting:
 * - Simple selectors: type, class, id, attribute, pseudo-class
 * - Combinators: descendant (space), child (>), adjacent-sibling (+), general-sibling (~)
 * - Right-to-left matching with compound selector tokenization
 *
 * Ported from C# SelectorMatcher.cs
 * @see Requirements 3.2
 */

export interface ISelectorMatcher {
  match(node: VirtualNode, rules: ReadonlyArray<CSSRule>): CSSRule[];
}

const enum CombinatorType {
  None = 0,
  Descendant = 1,
  Child = 2,
  AdjacentSibling = 3,
  GeneralSibling = 4,
}

interface SelectorSegment {
  compound: string;
  combinator: CombinatorType;
}

/** Map NodeTag enum values to lowercase tag name strings. */
const TAG_NAMES: ReadonlyMap<string, NodeTag> = new Map([
  ["div", NodeTag.Div],
  ["span", NodeTag.Span],
  ["p", NodeTag.P],
  ["img", NodeTag.Img],
  ["text", NodeTag.Text],
  ["style", NodeTag.Style],
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
  ["script", NodeTag.Script],
  ["link", NodeTag.Link],
  ["body", NodeTag.Body],
  ["head", NodeTag.Head],
  ["html", NodeTag.Html],
]);

export class SelectorMatcher implements ISelectorMatcher {
  /**
   * Match a node against an array of CSS rules.
   * Returns the subset of rules whose selectors match the given node.
   */
  match(node: VirtualNode, rules: ReadonlyArray<CSSRule>): CSSRule[] {
    const result: CSSRule[] = [];

    for (let i = 0; i < rules.length; i++) {
      const rule = rules[i];
      if (!rule.selector) continue;

      try {
        if (this.matchesSelector(node, rule.selector)) {
          result.push(rule);
        }
      } catch {
        // Unsupported selector syntax — skip silently
      }
    }

    return result;
  }

  /**
   * Test whether a node matches a full selector string.
   * Uses right-to-left matching: the rightmost compound is the key selector.
   */
  matchesSelector(node: VirtualNode, selector: string): boolean {
    const segments = parseSelectorSegments(selector.trim());
    if (segments.length === 0) return false;

    // Right-to-left: last segment is the key selector
    let idx = segments.length - 1;
    const keySeg = segments[idx];

    if (keySeg.combinator !== CombinatorType.None) return false; // malformed

    if (!this.matchesCompoundSelector(node, keySeg.compound)) return false;

    idx--;
    let current: VirtualNode | null = node;

    while (idx >= 0) {
      const seg = segments[idx];

      switch (seg.combinator) {
        case CombinatorType.Descendant:
          current = findAncestorMatch(this, current!.parent, seg.compound);
          if (current === null) return false;
          break;

        case CombinatorType.Child:
          current = current!.parent;
          if (current === null || !this.matchesCompoundSelector(current, seg.compound))
            return false;
          break;

        case CombinatorType.AdjacentSibling:
          current = getPrecedingSibling(current!);
          if (current === null || !this.matchesCompoundSelector(current, seg.compound))
            return false;
          break;

        case CombinatorType.GeneralSibling:
          current = findPrecedingSiblingMatch(this, current!, seg.compound);
          if (current === null) return false;
          break;

        default:
          return false;
      }

      idx--;
    }

    return true;
  }

  /**
   * Test whether a node matches a compound selector (e.g. "div.card#main:hover").
   * All simple selectors in the compound must match.
   */
  matchesCompoundSelector(node: VirtualNode, compoundSelector: string): boolean {
    const simples = tokenizeCompound(compoundSelector.trim());
    if (simples.length === 0) return false;

    for (let i = 0; i < simples.length; i++) {
      if (!this.matchesSimpleSelector(node, simples[i])) return false;
    }
    return true;
  }

  /**
   * Test whether a node matches a single simple selector.
   */
  matchesSimpleSelector(node: VirtualNode, simpleSelector: string): boolean {
    if (!simpleSelector) return false;

    if (simpleSelector === "*") return true;

    const first = simpleSelector[0];

    if (first === "#") {
      // ID selector
      const id = simpleSelector.substring(1);
      const nodeId = node.attributes.get("id");
      return nodeId !== undefined && nodeId.toLowerCase() === id.toLowerCase();
    }

    if (first === ".") {
      // Class selector
      const cls = simpleSelector.substring(1);
      const classAttr = node.attributes.get("class");
      if (classAttr === undefined) return false;
      return hasClass(classAttr, cls);
    }

    if (first === "[") {
      // Attribute selector
      return matchesAttributeSelector(node, simpleSelector);
    }

    if (first === ":") {
      // Pseudo-class selector
      const pseudo = simpleSelector.substring(1).toLowerCase();
      switch (pseudo) {
        case "hover":
          return (node.pseudoStates & PseudoStates.Hover) !== 0;
        case "focus":
          return (node.pseudoStates & PseudoStates.Focus) !== 0;
        default:
          // Unsupported pseudo-class — throw to trigger skip in match()
          throw new Error(`Unsupported pseudo-class: ${simpleSelector}`);
      }
    }

    // Type selector — compare against NodeTag (case-insensitive)
    const tag = TAG_NAMES.get(simpleSelector.toLowerCase());
    if (tag !== undefined) return node.tag === tag;

    // Unknown type selector — no match
    return false;
  }
}

// --- Helper functions ---

function findAncestorMatch(
  matcher: SelectorMatcher,
  ancestor: VirtualNode | null,
  compound: string,
): VirtualNode | null {
  while (ancestor !== null) {
    if (matcher.matchesCompoundSelector(ancestor, compound)) return ancestor;
    ancestor = ancestor.parent;
  }
  return null;
}

function getPrecedingSibling(node: VirtualNode): VirtualNode | null {
  const parent = node.parent;
  if (parent === null) return null;
  const siblings = parent.children;
  const index = siblings.indexOf(node);
  if (index <= 0) return null;
  return siblings[index - 1];
}

function findPrecedingSiblingMatch(
  matcher: SelectorMatcher,
  node: VirtualNode,
  compound: string,
): VirtualNode | null {
  const parent = node.parent;
  if (parent === null) return null;
  const siblings = parent.children;
  const index = siblings.indexOf(node);
  for (let i = index - 1; i >= 0; i--) {
    if (matcher.matchesCompoundSelector(siblings[i], compound)) return siblings[i];
  }
  return null;
}

/**
 * Check if a space-separated class attribute contains a given class name.
 * Case-insensitive matching (matching C# behavior).
 */
function hasClass(classAttr: string, className: string): boolean {
  if (!classAttr) return false;

  const len = classAttr.length;
  const clsLen = className.length;
  let i = 0;

  while (i < len) {
    // Skip spaces
    while (i < len && classAttr[i] === " ") i++;

    const start = i;
    while (i < len && classAttr[i] !== " ") i++;

    const tokenLen = i - start;
    if (
      tokenLen === clsLen &&
      classAttr.substring(start, start + clsLen).toLowerCase() === className.toLowerCase()
    ) {
      return true;
    }
  }

  return false;
}

/**
 * Match an attribute selector like [attr], [attr="value"], [attr='value'].
 */
function matchesAttributeSelector(node: VirtualNode, selector: string): boolean {
  const inner = selector.substring(1, selector.length - 1); // strip [ and ]

  const eqIndex = inner.indexOf("=");
  if (eqIndex < 0) {
    // Presence check: [attr]
    return node.attributes.has(inner.trim());
  }

  const attrName = inner.substring(0, eqIndex).trim();
  let attrValue = inner.substring(eqIndex + 1).trim();

  // Strip quotes if present
  if (
    attrValue.length >= 2 &&
    ((attrValue[0] === '"' && attrValue[attrValue.length - 1] === '"') ||
      (attrValue[0] === "'" && attrValue[attrValue.length - 1] === "'"))
  ) {
    attrValue = attrValue.substring(1, attrValue.length - 1);
  }

  const nodeValue = node.attributes.get(attrName);
  return nodeValue !== undefined && nodeValue === attrValue;
}

// --- Selector parsing ---

/**
 * Parse a full selector into segments with their combinators.
 * Segments are returned left-to-right. The last segment has CombinatorType.None.
 * Each non-last segment's combinator indicates the relationship to the next segment.
 */
function parseSelectorSegments(selector: string): SelectorSegment[] {
  const segments: SelectorSegment[] = [];
  const len = selector.length;
  let i = 0;

  while (i < len) {
    // Skip leading whitespace
    while (i < len && selector[i] === " ") i++;
    if (i >= len) break;

    // Read compound selector
    const start = i;
    while (i < len && !isCombinatorChar(selector[i]) && selector[i] !== " ") {
      if (selector[i] === "[") i = skipBracket(selector, i);
      else if (selector[i] === "(") i = skipParens(selector, i);
      else i++;
    }

    const compound = selector.substring(start, i);

    // Determine the combinator that follows
    // Skip whitespace
    while (i < len && selector[i] === " ") i++;

    let comb = CombinatorType.None;
    if (i < len) {
      const ch = selector[i];
      if (ch === ">") {
        comb = CombinatorType.Child;
        i++;
      } else if (ch === "+") {
        comb = CombinatorType.AdjacentSibling;
        i++;
      } else if (ch === "~") {
        comb = CombinatorType.GeneralSibling;
        i++;
      } else {
        // If we're not at end and the next char starts a new compound,
        // this is a descendant combinator (whitespace was already consumed)
        if (!isCombinatorChar(ch) && ch !== " ") {
          comb = CombinatorType.Descendant;
        }
      }
    }

    if (compound) {
      segments.push({ compound, combinator: comb });
    }
  }

  return segments;
}

function isCombinatorChar(ch: string): boolean {
  return ch === ">" || ch === "+" || ch === "~";
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

/**
 * Tokenize a compound selector (e.g. "div.card#main:hover[type]") into
 * individual simple selectors: ["div", ".card", "#main", ":hover", "[type]"].
 */
function tokenizeCompound(compound: string): string[] {
  const tokens: string[] = [];
  let i = 0;
  const len = compound.length;

  while (i < len) {
    const ch = compound[i];

    if (ch === "#" || ch === ".") {
      const start = i;
      i++;
      while (i < len && !isSimpleSelectorStart(compound[i])) i++;
      tokens.push(compound.substring(start, i));
    } else if (ch === "[") {
      const start = i;
      i = skipBracket(compound, i);
      tokens.push(compound.substring(start, i));
    } else if (ch === ":") {
      const start = i;
      i++;
      while (i < len && !isSimpleSelectorStart(compound[i])) {
        if (compound[i] === "(") {
          i = skipParens(compound, i);
          break;
        }
        i++;
      }
      tokens.push(compound.substring(start, i));
    } else if (ch === "*") {
      tokens.push("*");
      i++;
    } else {
      // Type selector
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
