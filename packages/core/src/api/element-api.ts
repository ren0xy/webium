import { DirtyFlags, NodeTag } from "../dom/types.js";
import type { VirtualNode } from "../dom/virtual-node.js";
import { VirtualDOM } from "../dom/virtual-dom.js";
import type { ReconciliationEngine } from "../reconciliation/reconciliation-engine.js";
import type { StyleSheetManager } from "../css/stylesheet-manager.js";
import type { SelectorMatcher } from "../css/selector-matcher.js";
import type { EventCallback } from "../events/types.js";
import { parseHTML, parseInlineStyle } from "../parser/html-parser.js";
import {
  camelToKebab,
  serializeChildren,
  walkTree,
  NODE_TAG_TO_STRING,
} from "./helpers.js";

/**
 * Browser-like Element wrapper around a VirtualNode.
 *
 * Thin facade that translates familiar DOM method calls into
 * VirtualDOM operations, dirty-flag marking, and dirty-queue enqueuing.
 *
 * @see Requirements 4.1–4.3, 5.1–5.3, 6.1, 7.1, 7.2, 8.1, 8.2, 9.1–9.5
 */
export class ElementAPI {
  readonly _node: VirtualNode;
  private readonly _dom: VirtualDOM;
  private readonly _reconciliation: ReconciliationEngine;
  private readonly _stylesheetManager: StyleSheetManager;
  private readonly _selectorMatcher: SelectorMatcher;
  private readonly _wrapFn: (node: VirtualNode) => ElementAPI;
  private _styleProxy: Record<string, string> | null = null;

  constructor(
    node: VirtualNode,
    dom: VirtualDOM,
    reconciliation: ReconciliationEngine,
    stylesheetManager: StyleSheetManager,
    selectorMatcher: SelectorMatcher,
    wrapFn: (node: VirtualNode) => ElementAPI,
  ) {
    this._node = node;
    this._dom = dom;
    this._reconciliation = reconciliation;
    this._stylesheetManager = stylesheetManager;
    this._selectorMatcher = selectorMatcher;
    this._wrapFn = wrapFn;
  }

  // --- Tree mutation (Requirements 4.1, 4.2, 4.3) ---

  appendChild(child: ElementAPI): ElementAPI {
    this._dom.appendChild(this._node, child._node);
    return child;
  }

  removeChild(child: ElementAPI): ElementAPI {
    this._dom.removeChild(this._node, child._node);
    return child;
  }

  insertBefore(newChild: ElementAPI, refChild: ElementAPI | null): ElementAPI {
    this._dom.insertBefore(
      this._node,
      newChild._node,
      refChild ? refChild._node : null,
    );
    return newChild;
  }

  // --- Attributes (Requirements 5.1, 5.2, 5.3) ---

  setAttribute(name: string, value: string): void {
    if (name === "style") {
      // Parse inline style string into individual CSS properties
      const parsed = parseInlineStyle(value);
      this._node.inlineStyles = parsed;
      this._node.attributes.set(name, value);
      this._node.markDirty(DirtyFlags.Style);
      this._dom.dirtyQueue.enqueue(this._node);
      return;
    }

    this._node.attributes.set(name, value);
    this._node.markDirty(DirtyFlags.Attributes);

    // class and id changes may affect selector matching
    if (name === "class" || name === "id") {
      this._node.markDirty(DirtyFlags.Style);
    }

    this._dom.dirtyQueue.enqueue(this._node);
  }

  getAttribute(name: string): string | null {
    return this._node.attributes.get(name) ?? null;
  }

  removeAttribute(name: string): void {
    this._node.attributes.delete(name);
    this._node.markDirty(DirtyFlags.Attributes);
    this._dom.dirtyQueue.enqueue(this._node);
  }

  // --- Style proxy (Requirement 6.1) ---

  get style(): Record<string, string> {
    if (this._styleProxy === null) {
      const node = this._node;
      const dom = this._dom;
      this._styleProxy = new Proxy<Record<string, string>>({} as Record<string, string>, {
        get(_target, prop: string): string {
          const kebab = camelToKebab(prop);
          return node.inlineStyles.get(kebab) ?? "";
        },
        set(_target, prop: string, value: string): boolean {
          const kebab = camelToKebab(prop);
          node.inlineStyles.set(kebab, value);
          node.markDirty(DirtyFlags.Style);
          dom.dirtyQueue.enqueue(node);
          return true;
        },
      });
    }
    return this._styleProxy;
  }

  // --- Content (Requirements 7.1, 7.2) ---

  get textContent(): string | null {
    return this._node.textContent;
  }

  set textContent(value: string | null) {
    // Remove all children
    this._node.children.length = 0;
    this._node.textContent = value;
    this._node.markDirty(DirtyFlags.Text);
    this._dom.dirtyQueue.enqueue(this._node);
  }

  get innerHTML(): string {
    return serializeChildren(this._node);
  }

  set innerHTML(html: string) {
    // Remove existing children
    for (const child of this._node.children) {
      child.parent = null;
    }
    this._node.children.length = 0;

    // Parse the HTML fragment into a temporary DOM, then move children here
    const tempDom = new VirtualDOM();
    const result = parseHTML(html, tempDom, this._reconciliation, this._stylesheetManager);

    // Move parsed children from temp root into this node
    for (const child of result.root.children) {
      child.parent = null;
      this._dom.appendChild(this._node, child);
    }

    this._node.markDirty(DirtyFlags.Tree);
    this._dom.dirtyQueue.enqueue(this._node);
  }

  // --- Events (Requirements 8.1, 8.2) ---

  addEventListener(type: string, callback: EventCallback, useCapture: boolean = false): void {
    this._node.addEventListener(type, callback, useCapture);
  }

  removeEventListener(type: string, callback: EventCallback, useCapture: boolean = false): void {
    this._node.removeEventListener(type, callback, useCapture);
  }

  // --- Convenience properties (Requirements 9.1–9.5) ---

  get id(): string {
    return this.getAttribute("id") ?? "";
  }

  set id(value: string) {
    this.setAttribute("id", value);
  }

  get className(): string {
    return this.getAttribute("class") ?? "";
  }

  set className(value: string) {
    this.setAttribute("class", value);
  }

  get children(): ElementAPI[] {
    return this._node.children
      .filter((child) => child.tag !== NodeTag.Text)
      .map((child) => this._wrapFn(child));
  }

  get parentElement(): ElementAPI | null {
    return this._node.parent ? this._wrapFn(this._node.parent) : null;
  }

  get tagName(): string {
    const name = NODE_TAG_TO_STRING.get(this._node.tag);
    return name ? name.toUpperCase() : "";
  }

  // --- Query (element-level) (Requirements 1.2, 1.3 at element scope) ---

  querySelector(selector: string): ElementAPI | null {
    let found: ElementAPI | null = null;
    walkTree(this._node, (node) => {
      // Skip the root element itself — only search descendants
      if (node === this._node) return false;
      try {
        if (this._selectorMatcher.matchesSelector(node, selector)) {
          found = this._wrapFn(node);
          return true; // stop walking
        }
      } catch {
        // Unsupported selector — skip
      }
      return false;
    });
    return found;
  }

  querySelectorAll(selector: string): ElementAPI[] {
    const results: ElementAPI[] = [];
    walkTree(this._node, (node) => {
      // Skip the root element itself — only search descendants
      if (node === this._node) return false;
      try {
        if (this._selectorMatcher.matchesSelector(node, selector)) {
          results.push(this._wrapFn(node));
        }
      } catch {
        // Unsupported selector — skip
      }
      return false;
    });
    return results;
  }
}
