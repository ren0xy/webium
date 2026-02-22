import { describe, it, expect } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { SelectorMatcher } from "../../src/css/selector-matcher.js";
import { ComputedStyleResolver } from "../../src/css/computed-style-resolver.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { DOMEventImpl } from "../../src/events/dom-event.js";
import { CSSLoader } from "../../src/css/css-loader.js";
import type { FileProvider } from "../../src/css/css-loader.js";
import { createDocumentAPI } from "../../src/api/index.js";
import { ScriptExecutor } from "../../src/api/script-executor.js";
import { parseHTML } from "../../src/parser/html-parser.js";
import { walkTree } from "../../src/api/helpers.js";
import type { VirtualNode } from "../../src/dom/virtual-node.js";
import { RenderOp } from "../../src/bridge/render-command.js";

/**
 * HelloWorld integration test: parse + CSS + script execution.
 *
 * Validates: Requirements 5.4, 8.1, 8.2, 8.3
 */

const HELLO_HTML = `<!DOCTYPE html>
<html>
<head>
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <h1>Hello, Webium!</h1>
  <p>A UI rendered entirely inside Unity.</p>
  <button id="click-me">Click Me</button>
  <div id="output"></div>
  <script src="main.js"></script>
</body>
</html>`;

const HELLO_CSS = `body {
  background-color: #1a1a2e;
  font-family: sans-serif;
  padding: 20px;
}

h1 {
  color: #e94560;
  margin: 0 0 10px 0;
}

button {
  background-color: #e94560;
  color: #ffffff;
  padding: 10px 20px;
  font-size: 16px;
  cursor: pointer;
}

#output {
  margin-top: 15px;
  color: #ffffff;
}`;

const HELLO_JS = `var clickCount = 0;
var button = document.getElementById("click-me");
var output = document.getElementById("output");

button.addEventListener("click", function() {
  clickCount++;
  output.textContent = "Button was clicked " + clickCount + " time(s)!";
});`;

/** Mock FileProvider that serves HelloWorld files from memory. */
function createMockFileProvider(): FileProvider {
  const files: Record<string, string> = {
    "style.css": HELLO_CSS,
    "main.js": HELLO_JS,
  };
  return (path: string) => files[path] ?? null;
}

/** Create all dependencies for the integration test, mirroring bootstrap.ts wiring. */
function createIntegrationDeps() {
  const dom = new VirtualDOM();
  const stylesheetManager = new StyleSheetManager();
  const selectorMatcher = new SelectorMatcher();
  const computedStyleResolver = new ComputedStyleResolver();
  const reconciliation = new ReconciliationEngine(
    dom,
    computedStyleResolver,
    stylesheetManager,
  );
  const eventDispatcher = new EventDispatcher();
  return { dom, stylesheetManager, selectorMatcher, reconciliation, eventDispatcher };
}

/** Find the first node with a given tag in the tree. */
function findNodeByTag(root: VirtualNode, tag: NodeTag): VirtualNode | null {
  let found: VirtualNode | null = null;
  walkTree(root, (node) => {
    if (node.tag === tag) {
      found = node;
      return true;
    }
    return false;
  });
  return found;
}

/** Find a node by its id attribute. */
function findNodeById(root: VirtualNode, id: string): VirtualNode | null {
  let found: VirtualNode | null = null;
  walkTree(root, (node) => {
    if (node.attributes.get("id") === id) {
      found = node;
      return true;
    }
    return false;
  });
  return found;
}

/**
 * Run the full HelloWorld initialization sequence:
 * parse HTML → load CSS → create document API → execute scripts.
 */
function initializeHelloWorld() {
  const deps = createIntegrationDeps();
  const fileProvider = createMockFileProvider();

  // 1. Parse HTML
  const parseResult = parseHTML(
    HELLO_HTML,
    deps.dom,
    deps.reconciliation,
    deps.stylesheetManager,
  );

  // 2. Load external CSS
  const cssLoader = new CSSLoader(deps.stylesheetManager, fileProvider, deps.dom, "");
  cssLoader.loadLinks(parseResult.links);

  // 3. Create document API
  const document = createDocumentAPI(
    deps.dom,
    deps.reconciliation,
    deps.stylesheetManager,
    deps.selectorMatcher,
  );

  // 4. Execute scripts
  const scriptExecutor = new ScriptExecutor(
    fileProvider,
    (code, scope) => {
      const fn = new Function(...Object.keys(scope), code);
      fn(...Object.values(scope));
    },
    "",
  );
  scriptExecutor.executeScripts(parseResult.scripts, {
    document,
    console: globalThis.console,
  });

  return { ...deps, parseResult, document, fileProvider };
}

describe("HelloWorld integration: parse + CSS + script", () => {
  describe("HTML parsing — VirtualDOM tree structure (Req 5.4, 8.1)", () => {
    it("tree contains an h1 node with 'Hello, Webium!' text", () => {
      const { dom } = initializeHelloWorld();
      const h1 = findNodeByTag(dom.root, NodeTag.H1);
      expect(h1).not.toBeNull();
      // h1 should have a text child with the greeting
      const textChild = h1!.children.find((c) => c.tag === NodeTag.Text);
      expect(textChild).toBeDefined();
      expect(textChild!.textContent).toBe("Hello, Webium!");
    });

    it("tree contains a p node with descriptive text", () => {
      const { dom } = initializeHelloWorld();
      const p = findNodeByTag(dom.root, NodeTag.P);
      expect(p).not.toBeNull();
      const textChild = p!.children.find((c) => c.tag === NodeTag.Text);
      expect(textChild).toBeDefined();
      expect(textChild!.textContent).toBe("A UI rendered entirely inside Unity.");
    });

    it("tree contains a button node with id='click-me'", () => {
      const { dom } = initializeHelloWorld();
      const button = findNodeById(dom.root, "click-me");
      expect(button).not.toBeNull();
      expect(button!.tag).toBe(NodeTag.Button);
      const textChild = button!.children.find((c) => c.tag === NodeTag.Text);
      expect(textChild).toBeDefined();
      expect(textChild!.textContent).toBe("Click Me");
    });

    it("tree contains a div node with id='output'", () => {
      const { dom } = initializeHelloWorld();
      const output = findNodeById(dom.root, "output");
      expect(output).not.toBeNull();
      expect(output!.tag).toBe(NodeTag.Div);
    });
  });

  describe("CSS loading — StyleSheetManager rules (Req 8.2)", () => {
    it("StyleSheetManager has rules after CSS loading", () => {
      const { stylesheetManager } = initializeHelloWorld();
      expect(stylesheetManager.allRules.length).toBeGreaterThan(0);
    });

    it("contains a rule for body selector", () => {
      const { stylesheetManager } = initializeHelloWorld();
      const bodyRule = stylesheetManager.allRules.find((r) => r.selector === "body");
      expect(bodyRule).toBeDefined();
      expect(bodyRule!.declarations.get("background-color")).toBe("#1a1a2e");
    });

    it("contains a rule for h1 selector", () => {
      const { stylesheetManager } = initializeHelloWorld();
      const h1Rule = stylesheetManager.allRules.find((r) => r.selector === "h1");
      expect(h1Rule).toBeDefined();
      expect(h1Rule!.declarations.get("color")).toBe("#e94560");
    });

    it("contains a rule for button selector", () => {
      const { stylesheetManager } = initializeHelloWorld();
      const btnRule = stylesheetManager.allRules.find((r) => r.selector === "button");
      expect(btnRule).toBeDefined();
      expect(btnRule!.declarations.get("background-color")).toBe("#e94560");
    });

    it("contains a rule for #output selector", () => {
      const { stylesheetManager } = initializeHelloWorld();
      const outputRule = stylesheetManager.allRules.find((r) => r.selector === "#output");
      expect(outputRule).toBeDefined();
      expect(outputRule!.declarations.get("margin-top")).toBe("15px");
    });
  });

  describe("Script execution — event listener binding (Req 8.3)", () => {
    it("button node has a click event listener after script execution", () => {
      const { dom } = initializeHelloWorld();
      const button = findNodeById(dom.root, "click-me");
      expect(button).not.toBeNull();
      const listeners = button!.eventListeners.getListeners("click");
      expect(listeners.length).toBeGreaterThan(0);
    });

    it("output div has no click listeners (only button does)", () => {
      const { dom } = initializeHelloWorld();
      const output = findNodeById(dom.root, "output");
      expect(output).not.toBeNull();
      // Output node should not have click listeners — only the button does
      const listeners = output!.eventListeners.getListeners("click");
      expect(listeners.length).toBe(0);
    });
  });
});

/**
 * End-to-end roadmap validation test.
 *
 * Full initialization + click + tick — verifies all 5 JS-testable roadmap bullets:
 *   8.1 HTML parser: VirtualDOM tree has h1, p, button, div nodes
 *   8.2 CSS loading: style.css loaded via <link> and applied through CSS pipeline
 *   8.3 Browser API: main.js calls getElementById and addEventListener
 *   8.4 DOM mutations: click handler sets textContent → reconciliation → UpdateText command
 *   8.5 Event round-trip: clicking button → JS dispatch → handler executes
 *
 * Validates: Requirements 8.1, 8.2, 8.3, 8.4, 8.5
 */
describe("End-to-end roadmap validation (Req 8.1–8.5)", () => {
  it("full initialization + click + tick validates all 5 roadmap bullets", () => {
    // --- Initialize HelloWorld (parse + CSS + scripts) ---
    const { dom, stylesheetManager, reconciliation, eventDispatcher } =
      initializeHelloWorld();

    // --- 8.1 HTML parser: tree has h1, p, button, div nodes ---
    const h1 = findNodeByTag(dom.root, NodeTag.H1);
    const p = findNodeByTag(dom.root, NodeTag.P);
    const button = findNodeById(dom.root, "click-me");
    const output = findNodeById(dom.root, "output");

    expect(h1).not.toBeNull();
    expect(p).not.toBeNull();
    expect(button).not.toBeNull();
    expect(button!.tag).toBe(NodeTag.Button);
    expect(output).not.toBeNull();
    expect(output!.tag).toBe(NodeTag.Div);

    // --- 8.2 CSS loading: StyleSheetManager has rules from style.css ---
    expect(stylesheetManager.allRules.length).toBeGreaterThan(0);
    const bodyRule = stylesheetManager.allRules.find((r) => r.selector === "body");
    const h1Rule = stylesheetManager.allRules.find((r) => r.selector === "h1");
    const btnRule = stylesheetManager.allRules.find((r) => r.selector === "button");
    const outputRule = stylesheetManager.allRules.find((r) => r.selector === "#output");
    expect(bodyRule).toBeDefined();
    expect(h1Rule).toBeDefined();
    expect(btnRule).toBeDefined();
    expect(outputRule).toBeDefined();

    // --- 8.3 Browser API: button has click listener (getElementById + addEventListener) ---
    const listeners = button!.eventListeners.getListeners("click");
    expect(listeners.length).toBeGreaterThan(0);

    // --- Drain initial dirty nodes before mutation assertions ---
    reconciliation.tick();

    // --- 8.5 Event round-trip: dispatch click → JS handler executes ---
    const clickEvent = new DOMEventImpl("click", true, true);
    eventDispatcher.dispatchEvent(button!, clickEvent);

    // --- 8.4 DOM mutations: output.textContent changed by click handler ---
    expect(output!.textContent).toContain("1");

    // --- 8.4 continued: tick() produces UpdateText render command ---
    const buffer = reconciliation.tick();
    const updateTextCmds = buffer.commands.filter(
      (cmd) => cmd.op === RenderOp.UpdateText && cmd.nodeId === output!.id,
    );
    expect(updateTextCmds.length).toBeGreaterThanOrEqual(1);
  });
});

