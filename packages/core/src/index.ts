// @webium/core — public API barrel export

// DOM
export { NodeTag, DirtyFlags, PseudoStates } from "./dom/types.js";
export { VirtualNode } from "./dom/virtual-node.js";
export { VirtualDOM } from "./dom/virtual-dom.js";
export { NodePool } from "./dom/node-pool.js";
export { DirtyQueue } from "./dom/dirty-queue.js";

// CSS
export type { Specificity } from "./css/specificity.js";
export { SpecificityCalculator, compareSpecificity, addSpecificity, ZERO_SPECIFICITY } from "./css/specificity.js";
export type { CSSRule } from "./css/css-rule.js";
export { CSSRuleImpl } from "./css/css-rule.js";
export { SelectorMatcher } from "./css/selector-matcher.js";
export { CascadeResolver } from "./css/cascade-resolver.js";
export { StyleInheritance, INHERITABLE_PROPERTIES, INITIAL_VALUES } from "./css/style-inheritance.js";
export { ComputedStyleResolver } from "./css/computed-style-resolver.js";
export type { IStyleSheetManager } from "./css/stylesheet-manager.js";
export { StyleSheetManager } from "./css/stylesheet-manager.js";

// Events
export type { DOMEvent, EventCallback, EventPhase, EventListenerEntry, IVirtualNode } from "./events/types.js";
export { EventPhase as EventPhaseEnum } from "./events/types.js";
export { EventListenerStore } from "./events/event-listener-store.js";
export { DOMEventImpl, PointerEvent, FocusEvent } from "./events/dom-event.js";
export type { IEventDispatcher, ILogger } from "./events/event-dispatcher.js";
export { EventDispatcher } from "./events/event-dispatcher.js";

// Layout
export type { ILayoutEngine, LayoutResult } from "./layout/yoga-layout-engine.js";
export { YogaLayoutEngine } from "./layout/yoga-layout-engine.js";

// Bridge
export { RenderOp, RenderCommandBuffer } from "./bridge/render-command.js";
export type { RenderCommand, IRenderCommandBuffer } from "./bridge/render-command.js";
export { deserializeTypedArray, deserializeJSON } from "./bridge/render-command-deserializer.js";
export type { InputEvent } from "./bridge/input-event.js";
export { InputEventHandler } from "./bridge/input-event.js";

// Reconciliation
export type { IReconciliationEngine } from "./reconciliation/reconciliation-engine.js";
export { ReconciliationEngine } from "./reconciliation/reconciliation-engine.js";

// Modding
export type { ModManifest, IManifestParser } from "./modding/manifest-parser.js";
export { ManifestParser } from "./modding/manifest-parser.js";
export type { ICSSScoper } from "./modding/css-scoper.js";
export { CSSScoper } from "./modding/css-scoper.js";
export type { IModManager } from "./modding/mod-manager.js";
export { ModManager } from "./modding/mod-manager.js";
