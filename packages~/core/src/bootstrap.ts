import { VirtualDOM } from "./dom/virtual-dom.js";
import { StyleSheetManager } from "./css/stylesheet-manager.js";
import { ComputedStyleResolver } from "./css/computed-style-resolver.js";
import { ReconciliationEngine } from "./reconciliation/reconciliation-engine.js";
import { EventDispatcher } from "./events/event-dispatcher.js";
import { InputEventHandler } from "./bridge/input-event.js";
import { createHandleInputEvent } from "./bridge/handle-input-event.js";
import { CSSLoader } from "./css/css-loader.js";
import { SelectorMatcher } from "./css/selector-matcher.js";
import { CascadeResolver } from "./css/cascade-resolver.js";
import { StyleInheritance } from "./css/style-inheritance.js";
import { createDocumentAPI } from "./api/index.js";
import { ScriptExecutor } from "./api/script-executor.js";
import { parseHTML } from "./parser/html-parser.js";
// yoga-layout WASM is initialized synchronously via the yogaSyncWasmPlugin
// esbuild plugin (see esbuild.config.mjs). No top-level await needed.
import { YogaLayoutEngine } from "./layout/yoga-layout-engine.js";
import { initTextMeasureBridge } from "./bridge/text-measure-bridge.js";

// Capture the native text-measurement binding registered by C# before layout runs.
initTextMeasureBridge();

// Core objects (module-scoped)
const dom = new VirtualDOM();
const stylesheetManager = new StyleSheetManager();
const selectorMatcher = new SelectorMatcher();
const cascadeResolver = new CascadeResolver();
const styleInheritance = new StyleInheritance();
const computedStyleResolver = new ComputedStyleResolver(
  selectorMatcher,
  cascadeResolver,
  styleInheritance,
);
const layoutEngine = new YogaLayoutEngine();
const reconciliation = new ReconciliationEngine(
  dom,
  computedStyleResolver,
  stylesheetManager,
  layoutEngine,
);
const eventDispatcher = new EventDispatcher();
const inputEventHandler = new InputEventHandler(dom, eventDispatcher);

// Viewport size — set by C# before the first tick so Yoga knows the container dimensions.
let viewportWidth: number | undefined;
let viewportHeight: number | undefined;

(globalThis as Record<string, unknown>).setViewportSize = function (w: number, h: number): void {
  viewportWidth = w;
  viewportHeight = h;
};

// Exposed to C# via registered bindings
(globalThis as Record<string, unknown>).tick = function (): Uint8Array {
  const buffer = reconciliation.tick(viewportWidth, viewportHeight);
  const ab = buffer.toTypedArray();
  return new Uint8Array(ab);
};

(globalThis as Record<string, unknown>).handleInputEvent =
  createHandleInputEvent(inputEventHandler);

(globalThis as Record<string, unknown>).initialize = function (
  html: string,
): void {
  // readFile is registered as a C# binding before this is called
  const readFile = (globalThis as Record<string, unknown>).readFile as (
    path: string,
  ) => string | null;

  // Parse HTML
  const parseResult = parseHTML(html, dom, reconciliation, stylesheetManager);

  // Load external CSS
  const cssLoader = new CSSLoader(stylesheetManager, readFile, dom, "");
  cssLoader.loadLinks(parseResult.links);

  // Set up document API
  const document = createDocumentAPI(
    dom,
    reconciliation,
    stylesheetManager,
    selectorMatcher,
  );

  // Set up script executor
  const scriptExecutor = new ScriptExecutor(
    readFile,
    (code, scope) => {
      const fn = new Function(...Object.keys(scope), code);
      fn(...Object.values(scope));
    },
    "",
  );

  // Execute scripts with document in scope
  scriptExecutor.executeScripts(parseResult.scripts, {
    document,
    console: globalThis.console,
  });
};
