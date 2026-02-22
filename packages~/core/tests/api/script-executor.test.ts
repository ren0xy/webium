import { describe, it, expect, vi } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { ScriptExecutor } from "../../src/api/script-executor.js";
import type { RuntimeEvaluator } from "../../src/api/script-executor.js";
import type { FileProvider } from "../../src/css/css-loader.js";

/**
 * Unit tests for ScriptExecutor
 * Requirements: 10.1, 10.2, 10.3, 10.4
 */

/**
 * Helper: create a script VirtualNode with inline textContent.
 */
function createInlineScript(dom: VirtualDOM, code: string) {
  const script = dom.createElement(NodeTag.Script);
  script.textContent = code;
  return script;
}

/**
 * Helper: create a script VirtualNode with an external src attribute.
 */
function createExternalScript(dom: VirtualDOM, src: string) {
  const script = dom.createElement(NodeTag.Script);
  script.attributes.set("src", src);
  return script;
}

describe("ScriptExecutor — inline script execution", () => {
  it("evaluates inline script textContent via the RuntimeEvaluator", () => {
    const dom = new VirtualDOM();
    const script = createInlineScript(dom, "console.log('hello')");

    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => { calls.push(code); };
    const fileProvider: FileProvider = () => null;

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([script], { document: {}, console });

    expect(calls).toEqual(["console.log('hello')"]);
  });

  it("executes multiple inline scripts in document order", () => {
    const dom = new VirtualDOM();
    const s1 = createInlineScript(dom, "first()");
    const s2 = createInlineScript(dom, "second()");
    const s3 = createInlineScript(dom, "third()");

    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => { calls.push(code); };
    const fileProvider: FileProvider = () => null;

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([s1, s2, s3], { document: {}, console });

    expect(calls).toEqual(["first()", "second()", "third()"]);
  });
});

describe("ScriptExecutor — external script loading and execution", () => {
  it("loads external script via FileProvider and evaluates the content", () => {
    const dom = new VirtualDOM();
    const script = createExternalScript(dom, "app.js");

    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => { calls.push(code); };
    const fileProvider: FileProvider = (path) =>
      path === "app.js" ? "var x = 42;" : null;

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([script], { document: {}, console });

    expect(calls).toEqual(["var x = 42;"]);
  });

  it("resolves external script path relative to basePath", () => {
    const dom = new VirtualDOM();
    const script = createExternalScript(dom, "lib/utils.js");

    const requestedPaths: string[] = [];
    const fileProvider: FileProvider = (path) => {
      requestedPaths.push(path);
      return "// utils";
    };
    const evaluator: RuntimeEvaluator = () => {};

    const executor = new ScriptExecutor(fileProvider, evaluator, "assets");
    executor.executeScripts([script], { document: {}, console });

    expect(requestedPaths).toEqual(["assets/lib/utils.js"]);
  });
});

describe("ScriptExecutor — missing external file logs warning and skips", () => {
  it("logs a warning and skips when FileProvider returns null", () => {
    const dom = new VirtualDOM();
    const script = createExternalScript(dom, "missing.js");

    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => { calls.push(code); };
    const fileProvider: FileProvider = () => null;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([script], { document: {}, console });

    expect(calls).toHaveLength(0);
    expect(warnSpy.mock.calls.length).toBe(1);
    expect(warnSpy.mock.calls[0][0]).toContain("missing.js");

    warnSpy.mockRestore();
  });

  it("continues executing subsequent scripts after a missing file", () => {
    const dom = new VirtualDOM();
    const s1 = createExternalScript(dom, "missing.js");
    const s2 = createInlineScript(dom, "afterMissing()");

    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => { calls.push(code); };
    const fileProvider: FileProvider = () => null;

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([s1, s2], { document: {}, console });

    expect(calls).toEqual(["afterMissing()"]);

    warnSpy.mockRestore();
  });
});

describe("ScriptExecutor — runtime error is caught, next script still executes", () => {
  it("catches evaluator error and continues with the next script", () => {
    const dom = new VirtualDOM();
    const s1 = createInlineScript(dom, "throw new Error('boom')");
    const s2 = createInlineScript(dom, "success()");

    let callCount = 0;
    const calls: string[] = [];
    const evaluator: RuntimeEvaluator = (code) => {
      callCount++;
      if (callCount === 1) {
        throw new Error("boom");
      }
      calls.push(code);
    };
    const fileProvider: FileProvider = () => null;

    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([s1, s2], { document: {}, console });

    // Second script still executed
    expect(calls).toEqual(["success()"]);
    // Error was logged
    expect(errorSpy.mock.calls.length).toBe(1);

    errorSpy.mockRestore();
  });
});

describe("ScriptExecutor — scope contains document and console", () => {
  it("passes scope with document and console to the evaluator", () => {
    const dom = new VirtualDOM();
    const script = createInlineScript(dom, "doStuff()");

    let receivedScope: Record<string, unknown> | null = null;
    const evaluator: RuntimeEvaluator = (_code, scope) => {
      receivedScope = scope;
    };
    const fileProvider: FileProvider = () => null;

    const mockDoc = { getElementById: () => null };
    const scope = { document: mockDoc, console };

    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([script], scope);

    expect(receivedScope).not.toBeNull();
    expect(receivedScope!).toHaveProperty("document");
    expect(receivedScope!).toHaveProperty("console");
    expect(receivedScope!["document"]).toBe(mockDoc);
    expect(receivedScope!["console"]).toBe(console);
  });

  it("passes the same scope object to every script", () => {
    const dom = new VirtualDOM();
    const s1 = createInlineScript(dom, "a()");
    const s2 = createInlineScript(dom, "b()");

    const receivedScopes: Record<string, unknown>[] = [];
    const evaluator: RuntimeEvaluator = (_code, scope) => {
      receivedScopes.push(scope);
    };
    const fileProvider: FileProvider = () => null;

    const scope = { document: {}, console };
    const executor = new ScriptExecutor(fileProvider, evaluator, "");
    executor.executeScripts([s1, s2], scope);

    expect(receivedScopes).toHaveLength(2);
    expect(receivedScopes[0]).toBe(scope);
    expect(receivedScopes[1]).toBe(scope);
  });
});
