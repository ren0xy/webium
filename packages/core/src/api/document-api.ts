import { NodeTag } from "../dom/types.js";
import type { VirtualNode } from "../dom/virtual-node.js";
import type { VirtualDOM } from "../dom/virtual-dom.js";
import type { ReconciliationEngine } from "../reconciliation/reconciliation-engine.js";
import type { StyleSheetManager } from "../css/stylesheet-manager.js";
import type { SelectorMatcher } from "../css/selector-matcher.js";
import { ElementAPI } from "./element-api.js";
import { HTML_TAG_MAP } from "../parser/html-parser.js";
import { walkTree } from "./helpers.js";

/**
 * The `document` object exposed to JS scripts.
 *
 * Thin facade over VirtualDOM that provides browser-like query, creation,
 * and body access methods. Maintains a wrapper cache so the same VirtualNode
 * always returns the same ElementAPI instance (referential identity).
 *
 * @see Requirements 1.1, 1.2, 1.3, 2.1, 2.2, 3.1, 11.2
 */
export class DocumentAPI {
  private readonly _dom: VirtualDOM;
  private readonly _reconciliation: ReconciliationEngine;
  private readonly _stylesheetManager: StyleSheetManager;
  private readonly _selectorMatcher: SelectorMatcher;
  /** Cache: VirtualNode id → ElementAPI wrapper (avoids creating duplicates). */
  private readonly _wrapperCache: Map<number, ElementAPI> = new Map();

  constructor(
    dom: VirtualDOM,
    reconciliation: ReconciliationEngine,
    stylesheetManager: StyleSheetManager,
    selectorMatcher: SelectorMatcher,
  ) {
    this._dom = dom;
    this._reconciliation = reconciliation;
    this._stylesheetManager = stylesheetManager;
    this._selectorMatcher = selectorMatcher;
  }

  /** Wrap a VirtualNode in an ElementAPI (cached). */
  wrap(node: VirtualNode): ElementAPI {
    const cached = this._wrapperCache.get(node.id);
    if (cached) return cached;

    const wrapper = new ElementAPI(
      node,
      this._dom,
      this._reconciliation,
      this._stylesheetManager,
      this._selectorMatcher,
      this.wrap.bind(this),
    );
    this._wrapperCache.set(node.id, wrapper);
    return wrapper;
  }

  // --- Query methods (Requirements 1.1, 1.2, 1.3) ---

  getElementById(id: string): ElementAPI | null {
    let found: ElementAPI | null = null;
    walkTree(this._dom.root, (node) => {
      if (node.attributes.get("id") === id) {
        found = this.wrap(node);
        return true; // stop walking
      }
      return false;
    });
    return found;
  }

  querySelector(selector: string): ElementAPI | null {
    let found: ElementAPI | null = null;
    walkTree(this._dom.root, (node) => {
      try {
        if (this._selectorMatcher.matchesSelector(node, selector)) {
          found = this.wrap(node);
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
    walkTree(this._dom.root, (node) => {
      try {
        if (this._selectorMatcher.matchesSelector(node, selector)) {
          results.push(this.wrap(node));
        }
      } catch {
        // Unsupported selector — skip
      }
      return false;
    });
    return results;
  }

  // --- Creation methods (Requirements 2.1, 2.2, 11.2) ---

  createElement(tagName: string): ElementAPI {
    const tag = HTML_TAG_MAP.get(tagName.toLowerCase()) ?? NodeTag.Unknown;
    const node = this._dom.createElement(tag);
    this._reconciliation.markCreated(node.id);
    return this.wrap(node);
  }

  createTextNode(text: string): ElementAPI {
    const node = this._dom.createTextNode(text);
    this._reconciliation.markCreated(node.id);
    return this.wrap(node);
  }

  // --- body property (Requirement 3.1) ---

  get body(): ElementAPI {
    let bodyNode: VirtualNode | null = null;
    walkTree(this._dom.root, (node) => {
      if (node.tag === NodeTag.Body) {
        bodyNode = node;
        return true; // stop walking
      }
      return false;
    });
    return this.wrap(bodyNode ?? this._dom.root);
  }
}
