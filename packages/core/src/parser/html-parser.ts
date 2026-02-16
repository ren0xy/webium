import { Parser } from "htmlparser2";
import type { VirtualDOM } from "../dom/virtual-dom.js";
import type { VirtualNode } from "../dom/virtual-node.js";
import type { ReconciliationEngine } from "../reconciliation/reconciliation-engine.js";
import type { StyleSheetManager } from "../css/stylesheet-manager.js";
import { NodeTag } from "../dom/types.js";

/**
 * Result of parsing an HTML string into a VirtualDOM tree.
 *
 * @see Requirements 2.1, 2.9
 */
export interface ParseResult {
  /** The root node of the parsed tree (the VirtualDOM root). */
  root: VirtualNode;
  /** Script nodes collected in parse order. */
  scripts: VirtualNode[];
  /** Link nodes collected in parse order. */
  links: VirtualNode[];
}

/**
 * Maps lowercase HTML tag names to NodeTag enum values.
 * Tags not in this map resolve to NodeTag.Unknown.
 *
 * @see Requirements 2.3
 */
export const HTML_TAG_MAP: ReadonlyMap<string, NodeTag> = new Map([
  ["div", NodeTag.Div],
  ["span", NodeTag.Span],
  ["p", NodeTag.P],
  ["img", NodeTag.Img],
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
  ["style", NodeTag.Style],
  ["script", NodeTag.Script],
  ["link", NodeTag.Link],
  ["body", NodeTag.Body],
  ["head", NodeTag.Head],
  ["html", NodeTag.Html],
]);

/**
 * Parses a CSS inline style string into a Map of property-value pairs.
 *
 * Splits on `;`, then on the first `:` per declaration.
 * Trims whitespace from both property and value.
 * Skips empty declarations and malformed entries (missing colon).
 *
 * @see Requirements 2.7
 */
export function parseInlineStyle(styleStr: string): Map<string, string> {
  const result = new Map<string, string>();
  if (!styleStr || !styleStr.trim()) {
    return result;
  }

  const declarations = styleStr.split(";");
  for (const decl of declarations) {
    const colonIndex = decl.indexOf(":");
    if (colonIndex === -1) {
      continue;
    }
    const property = decl.slice(0, colonIndex).trim();
    const value = decl.slice(colonIndex + 1).trim();
    if (property && value) {
      result.set(property, value);
    }
  }

  return result;
}

/**
 * Parse an HTML string into a VirtualDOM tree using htmlparser2's SAX callbacks.
 *
 * - Maps tag names to NodeTag via HTML_TAG_MAP (unknown → NodeTag.Unknown)
 * - Sets node attributes and parses inline styles
 * - Collects <script> and <link> nodes in parse order
 * - Feeds <style> blocks into StyleSheetManager
 * - Calls reconciliationEngine.markCreated for every created node
 *
 * @see Requirements 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.8, 2.9, 3.1, 3.2, 3.3, 4.1, 4.2, 4.3, 5.1, 5.2, 6.1, 6.2
 */
export function parseHTML(
  html: string,
  dom: VirtualDOM,
  reconciliationEngine: ReconciliationEngine,
  stylesheetManager: StyleSheetManager,
): ParseResult {
  const scripts: VirtualNode[] = [];
  const links: VirtualNode[] = [];
  const parentStack: VirtualNode[] = [dom.root];

  let insideStyle = false;
  let styleNode: VirtualNode | null = null;
  let styleText = "";

  let insideScript = false;
  let scriptNode: VirtualNode | null = null;

  const parser = new Parser(
    {
      onopentag(name: string, attribs: { [key: string]: string }) {
        const tag = HTML_TAG_MAP.get(name.toLowerCase()) ?? NodeTag.Unknown;
        const node = dom.createElement(tag);

        // Set attributes from htmlparser2's attribs object
        for (const key of Object.keys(attribs)) {
          node.attributes.set(key, attribs[key]);
        }

        // Parse inline style attribute into node.inlineStyles
        const styleAttr = attribs["style"];
        if (styleAttr) {
          node.inlineStyles = parseInlineStyle(styleAttr);
        }

        const currentParent = parentStack[parentStack.length - 1];
        dom.appendChild(currentParent, node);
        reconciliationEngine.markCreated(node.id);
        parentStack.push(node);

        // Track <style> context
        if (tag === NodeTag.Style) {
          insideStyle = true;
          styleNode = node;
          styleText = "";
        }

        // Track <script> context and collect
        if (tag === NodeTag.Script) {
          insideScript = true;
          scriptNode = node;
          scripts.push(node);
        }

        // Collect <link> nodes
        if (tag === NodeTag.Link) {
          links.push(node);
        }
      },

      ontext(text: string) {
        // Accumulate text inside <style> elements
        if (insideStyle && styleNode) {
          styleText += text;
          return;
        }

        // Accumulate text inside <script> elements
        if (insideScript && scriptNode) {
          scriptNode.textContent =
            (scriptNode.textContent ?? "") + text;
          return;
        }

        // Skip whitespace-only text nodes
        if (!text.trim()) {
          return;
        }

        const currentParent = parentStack[parentStack.length - 1];
        const textNode = dom.createTextNode(text);
        dom.appendChild(currentParent, textNode);
        reconciliationEngine.markCreated(textNode.id);
      },

      onclosetag(_name: string) {
        // If closing a <style> tag, set textContent and feed to StyleSheetManager
        if (insideStyle && styleNode) {
          styleNode.textContent = styleText;
          stylesheetManager.addStyleSheet(styleNode);
          insideStyle = false;
          styleNode = null;
          styleText = "";
        }

        // If closing a <script> tag, reset tracking
        if (insideScript) {
          insideScript = false;
          scriptNode = null;
        }

        parentStack.pop();
      },
    },
    { recognizeSelfClosing: true },
  );

  parser.write(html);
  parser.end();

  return {
    root: dom.root,
    scripts,
    links,
  };
}

