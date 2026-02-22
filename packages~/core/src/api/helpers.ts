import { NodeTag } from "../dom/types.js";
import { HTML_TAG_MAP } from "../parser/html-parser.js";
import type { VirtualNode } from "../dom/virtual-node.js";

/**
 * Convert a camelCase CSS property name to kebab-case.
 * e.g. "backgroundColor" → "background-color"
 */
export function camelToKebab(name: string): string {
  return name.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Convert a kebab-case CSS property name to camelCase.
 * e.g. "background-color" → "backgroundColor"
 */
export function kebabToCamel(name: string): string {
  return name.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/**
 * Reverse map from NodeTag enum values to lowercase HTML tag name strings.
 * Derived from HTML_TAG_MAP. Excludes Text and Unknown.
 */
export const NODE_TAG_TO_STRING: ReadonlyMap<number, string> = (() => {
  const map = new Map<number, string>();
  for (const [tagName, nodeTag] of HTML_TAG_MAP) {
    map.set(nodeTag, tagName);
  }
  return map;
})();

/** Set of void (self-closing) HTML elements that should not have closing tags. */
const VOID_ELEMENTS = new Set(["img", "input", "link", "br", "hr", "meta", "area", "base", "col", "embed", "source", "track", "wbr"]);

/**
 * Walk a VirtualNode tree in document order (pre-order DFS).
 * Calls the visitor for each node. If visitor returns true, stop early.
 */
export function walkTree(root: VirtualNode, visitor: (node: VirtualNode) => boolean): void {
  const stack: VirtualNode[] = [root];
  while (stack.length > 0) {
    const node = stack.pop()!;
    if (visitor(node)) return;
    // Push children in reverse order so leftmost child is visited first
    for (let i = node.children.length - 1; i >= 0; i--) {
      stack.push(node.children[i]);
    }
  }
}

/**
 * Serialize a single VirtualNode (and its subtree) to an HTML string.
 */
export function serializeNode(node: VirtualNode): string {
  // Text nodes serialize as just their textContent
  if (node.tag === NodeTag.Text) {
    return node.textContent ?? "";
  }

  const tagName = NODE_TAG_TO_STRING.get(node.tag);
  if (!tagName) return "";

  // Build opening tag with attributes
  let html = `<${tagName}`;
  for (const [key, value] of node.attributes) {
    html += ` ${key}="${value}"`;
  }
  html += ">";

  // Void elements don't get closing tags or children
  if (VOID_ELEMENTS.has(tagName)) {
    return html;
  }

  // Serialize children
  html += serializeChildren(node);

  html += `</${tagName}>`;
  return html;
}

/**
 * Serialize a VirtualNode's children to an HTML string.
 * Used by innerHTML getter.
 */
export function serializeChildren(node: VirtualNode): string {
  let html = "";
  for (const child of node.children) {
    html += serializeNode(child);
  }
  return html;
}
