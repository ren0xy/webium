// API barrel export — browser-like document/element API surface

export { DocumentAPI } from "./document-api.js";
export { ElementAPI } from "./element-api.js";
export { ScriptExecutor } from "./script-executor.js";
export type { RuntimeEvaluator } from "./script-executor.js";
export {
  camelToKebab,
  kebabToCamel,
  serializeChildren,
  serializeNode,
} from "./helpers.js";

import type { VirtualDOM } from "../dom/virtual-dom.js";
import type { ReconciliationEngine } from "../reconciliation/reconciliation-engine.js";
import type { StyleSheetManager } from "../css/stylesheet-manager.js";
import type { SelectorMatcher } from "../css/selector-matcher.js";
import { DocumentAPI } from "./document-api.js";

/**
 * Convenience factory that wires up all dependencies and returns a DocumentAPI.
 *
 * @see Requirement 12.1
 */
export function createDocumentAPI(
  dom: VirtualDOM,
  reconciliation: ReconciliationEngine,
  stylesheetManager: StyleSheetManager,
  selectorMatcher: SelectorMatcher,
): DocumentAPI {
  return new DocumentAPI(dom, reconciliation, stylesheetManager, selectorMatcher);
}
