import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { ScriptExecutor } from "../../src/api/script-executor.js";
import type { RuntimeEvaluator } from "../../src/api/script-executor.js";
import type { FileProvider } from "../../src/css/css-loader.js";

/**
 * Property 14: ScriptExecutor executes scripts in order with correct content
 *
 * For any list of VirtualNode script elements (mix of inline with `textContent`
 * and external with `src` attribute), `ScriptExecutor.executeScripts` should
 * call the `RuntimeEvaluator` once per script in array order. For inline scripts,
 * the code passed should equal the node's `textContent`. For external scripts,
 * the code should equal the string returned by `FileProvider` for the resolved path.
 *
 * **Validates: Requirements 10.1, 10.2, 10.3**
 */
describe("Feature: browser-api-surface, Property 14: ScriptExecutor executes scripts in order with correct content", () => {
  // Generator for a single script descriptor: either inline or external
  const arbScriptDesc = fc.oneof(
    fc.record({
      type: fc.constant("inline" as const),
      code: fc.stringMatching(/^[a-z0-9 ]{1,20}$/),
    }),
    fc.record({
      type: fc.constant("external" as const),
      src: fc.stringMatching(/^[a-z]{1,8}\.js$/),
      code: fc.stringMatching(/^[a-z0-9 ]{1,20}$/),
    }),
  );

  // Generator for a list of 1-5 script descriptors
  const arbScriptList = fc.array(arbScriptDesc, { minLength: 1, maxLength: 5 });

  /**
   * Build VirtualNode script elements from descriptors and create the
   * mock FileProvider that returns the expected code for external scripts.
   */
  function buildScriptsAndProvider(
    dom: VirtualDOM,
    descriptors: Array<{ type: "inline"; code: string } | { type: "external"; src: string; code: string }>,
  ) {
    const fileMap = new Map<string, string>();
    const scripts = descriptors.map((desc, i) => {
      const node = dom.createElement(NodeTag.Script);
      if (desc.type === "external") {
        // Use indexed src to avoid Map collisions when generator produces duplicate src values
        const uniqueSrc = `${i}_${desc.src}`;
        node.attributes.set("src", uniqueSrc);
        fileMap.set(uniqueSrc, desc.code);
      } else {
        node.textContent = desc.code;
      }
      return node;
    });

    const fileProvider: FileProvider = (path: string) => {
      return fileMap.get(path) ?? null;
    };

    return { scripts, fileProvider };
  }

  it("calls RuntimeEvaluator once per script in array order", () => {
    fc.assert(
      fc.property(arbScriptList, (descriptors) => {
        const dom = new VirtualDOM();
        const { scripts, fileProvider } = buildScriptsAndProvider(dom, descriptors);

        const calls: { code: string; scope: Record<string, unknown> }[] = [];
        const evaluator: RuntimeEvaluator = (code, scope) => {
          calls.push({ code, scope });
        };

        const executor = new ScriptExecutor(fileProvider, evaluator, "");
        const scope = { document: {}, console };
        executor.executeScripts(scripts, scope);

        // Should be called exactly once per script
        expect(calls.length).toBe(descriptors.length);
      }),
      { numRuns: 200 },
    );
  });

  it("passes correct code for inline scripts (textContent)", () => {
    fc.assert(
      fc.property(arbScriptList, (descriptors) => {
        const dom = new VirtualDOM();
        const { scripts, fileProvider } = buildScriptsAndProvider(dom, descriptors);

        const calledCodes: string[] = [];
        const evaluator: RuntimeEvaluator = (code) => {
          calledCodes.push(code);
        };

        const executor = new ScriptExecutor(fileProvider, evaluator, "");
        executor.executeScripts(scripts, { document: {}, console });

        // For each inline script, the code should equal the node's textContent
        for (let i = 0; i < descriptors.length; i++) {
          const desc = descriptors[i];
          if (desc.type === "inline") {
            expect(calledCodes[i]).toBe(desc.code);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("passes correct code for external scripts (loaded via FileProvider)", () => {
    fc.assert(
      fc.property(arbScriptList, (descriptors) => {
        const dom = new VirtualDOM();
        const { scripts, fileProvider } = buildScriptsAndProvider(dom, descriptors);

        const calledCodes: string[] = [];
        const evaluator: RuntimeEvaluator = (code) => {
          calledCodes.push(code);
        };

        const executor = new ScriptExecutor(fileProvider, evaluator, "");
        executor.executeScripts(scripts, { document: {}, console });

        // For each external script, the code should equal what FileProvider returns
        for (let i = 0; i < descriptors.length; i++) {
          const desc = descriptors[i];
          if (desc.type === "external") {
            expect(calledCodes[i]).toBe(desc.code);
          }
        }
      }),
      { numRuns: 200 },
    );
  });

  it("preserves execution order matching the input array order", () => {
    fc.assert(
      fc.property(arbScriptList, (descriptors) => {
        const dom = new VirtualDOM();
        const { scripts, fileProvider } = buildScriptsAndProvider(dom, descriptors);

        const calledCodes: string[] = [];
        const evaluator: RuntimeEvaluator = (code) => {
          calledCodes.push(code);
        };

        const executor = new ScriptExecutor(fileProvider, evaluator, "");
        executor.executeScripts(scripts, { document: {}, console });

        // Build expected code sequence from descriptors
        const expectedCodes = descriptors.map((desc) => desc.code);

        expect(calledCodes).toEqual(expectedCodes);
      }),
      { numRuns: 200 },
    );
  });

  it("passes the same scope object to every script evaluation", () => {
    fc.assert(
      fc.property(arbScriptList, (descriptors) => {
        const dom = new VirtualDOM();
        const { scripts, fileProvider } = buildScriptsAndProvider(dom, descriptors);

        const calledScopes: Record<string, unknown>[] = [];
        const evaluator: RuntimeEvaluator = (_code, scope) => {
          calledScopes.push(scope);
        };

        const scope = { document: {}, console };
        const executor = new ScriptExecutor(fileProvider, evaluator, "");
        executor.executeScripts(scripts, scope);

        // Every call should receive the exact same scope object
        for (const s of calledScopes) {
          expect(s).toBe(scope);
        }
      }),
      { numRuns: 100 },
    );
  });
});
