import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
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
 * Feature: 007-hello-world-integration
 * Property 4: Click handler increments counter in textContent
 *
 * Validates: Requirements 7.2
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
h1 { color: #e94560; margin: 0 0 10px 0; }
button { background-color: #e94560; color: #ffffff; padding: 10px 20px; font-size: 16px; cursor: pointer; }
#output { margin-top: 15px; color: #ffffff; }`;

const HELLO_JS = `var clickCount = 0;
var button = document.getElementById("click-me");
var output = document.getElementById("output");

button.addEventListener("click", function() {
  clickCount++;
  output.textContent = "Button was clicked " + clickCount + " time(s)!";
});`;

function createMockFileProvider(): FileProvider {
  const files: Record<string, string> = {
    "style.css": HELLO_CSS,
    "main.js": HELLO_JS,
  };
  return (path: string) => files[path] ?? null;
}

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

/** Initialize the full HelloWorld runtime and return key objects. */
function initializeHelloWorld() {
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
  const fileProvider = createMockFileProvider();

  const parseResult = parseHTML(HELLO_HTML, dom, reconciliation, stylesheetManager);

  const cssLoader = new CSSLoader(stylesheetManager, fileProvider, dom, "");
  cssLoader.loadLinks(parseResult.links);

  const document = createDocumentAPI(dom, reconciliation, stylesheetManager, selectorMatcher);

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

  return { dom, reconciliation, eventDispatcher };
}

// Feature: 007-hello-world-integration, Property 4: Click handler increments counter in textContent
describe("Property 4: Click handler increments counter in textContent", () => {
  it("after k-th click, output.textContent contains the string k", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 50 }),
        (n) => {
          const { dom, eventDispatcher } = initializeHelloWorld();

          const buttonNode = findNodeById(dom.root, "click-me");
          const outputNode = findNodeById(dom.root, "output");
          expect(buttonNode).not.toBeNull();
          expect(outputNode).not.toBeNull();

          for (let k = 1; k <= n; k++) {
            const clickEvent = new DOMEventImpl("click", true, true);
            eventDispatcher.dispatchEvent(buttonNode!, clickEvent);

            // After the k-th click, textContent must contain the string representation of k
            const text = outputNode!.textContent;
            expect(text).not.toBeNull();
            expect(text).toContain(String(k));
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


/**
 * Feature: 007-hello-world-integration
 * Property 5: Click event produces UpdateText render command
 *
 * Validates: Requirements 8.4
 */

// Feature: 007-hello-world-integration, Property 5: Click event produces UpdateText render command
describe("Property 5: Click event produces UpdateText render command", () => {
  it("dispatching N clicks and calling tick() after each produces an UpdateText command for the output node", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        (n) => {
          const { dom, reconciliation, eventDispatcher } = initializeHelloWorld();

          const buttonNode = findNodeById(dom.root, "click-me");
          const outputNode = findNodeById(dom.root, "output");
          expect(buttonNode).not.toBeNull();
          expect(outputNode).not.toBeNull();

          // Drain initial dirty nodes — creation commands from parsing
          reconciliation.tick();

          for (let k = 1; k <= n; k++) {
            // Dispatch click event
            const clickEvent = new DOMEventImpl("click", true, true);
            eventDispatcher.dispatchEvent(buttonNode!, clickEvent);

            // Call tick() to produce render commands
            const buffer = reconciliation.tick();

            // Verify the buffer contains at least one UpdateText command
            // whose nodeId matches the output div
            const updateTextCmds = buffer.commands.filter(
              (cmd) => cmd.op === RenderOp.UpdateText && cmd.nodeId === outputNode!.id,
            );
            expect(updateTextCmds.length).toBeGreaterThanOrEqual(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
