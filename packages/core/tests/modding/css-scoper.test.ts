import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { CSSScoper } from "../../src/modding/css-scoper.js";

describe("CSSScoper", () => {
  const scoper = new CSSScoper();

  it("prefixes a simple selector", () => {
    const result = scoper.scopeCSS("div { color: red; }", "mymod");
    expect(result).toContain('[data-mod-id="mymod"] div');
  });

  it("handles comma-separated selectors", () => {
    const result = scoper.scopeCSS("div, span { color: red; }", "mymod");
    expect(result).toContain('[data-mod-id="mymod"] div');
    expect(result).toContain('[data-mod-id="mymod"] span');
  });

  it("passes through @-rules", () => {
    const result = scoper.scopeCSS("@charset 'utf-8';", "mymod");
    expect(result).toContain("@charset");
  });

  it("handles empty CSS", () => {
    expect(scoper.scopeCSS("", "mymod")).toBe("");
  });

  it("handles null CSS", () => {
    expect(scoper.scopeCSS(null as any, "mymod")).toBe("");
  });

  it("is idempotent — double scoping produces same result", () => {
    const css = "div { color: red; } .foo { margin: 0; }";
    const once = scoper.scopeCSS(css, "mymod");
    const twice = scoper.scopeCSS(once, "mymod");
    expect(twice).toBe(once);
  });

  it("handles complex selectors", () => {
    const result = scoper.scopeCSS(".card > .title { font-size: 16px; }", "mymod");
    expect(result).toContain('[data-mod-id="mymod"] .card > .title');
  });

  it("handles multiple rules", () => {
    const css = "div { color: red; } span { color: blue; }";
    const result = scoper.scopeCSS(css, "mymod");
    expect(result).toContain('[data-mod-id="mymod"] div');
    expect(result).toContain('[data-mod-id="mymod"] span');
  });
});

// Feature: js-core-migration, Property 22: CSSScoper correctness
describe("Property 22: CSSScoper correctness", () => {
  const scoper = new CSSScoper();

  const arbSelector = fc.constantFrom("div", ".foo", "#bar", "span.cls", "p > a", "h1, h2");
  const arbProp = fc.constantFrom("color", "margin", "padding", "display");
  const arbVal = fc.constantFrom("red", "0", "10px", "flex");
  const arbModId = fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s));

  it("all selectors in scoped output contain the mod prefix", () => {
    fc.assert(
      fc.property(arbSelector, arbProp, arbVal, arbModId, (sel, prop, val, modId) => {
        const css = `${sel} { ${prop}: ${val}; }`;
        const result = scoper.scopeCSS(css, modId);
        const prefix = `[data-mod-id="${modId}"]`;
        // Every rule's selector should contain the prefix
        // Extract selectors before '{'
        const selectorMatch = result.match(/^[^{]+/);
        if (selectorMatch) {
          const selectors = selectorMatch[0].split(",");
          for (const s of selectors) {
            expect(s.trim()).toContain(prefix);
          }
        }
      }),
      { numRuns: 100 },
    );
  });
});

// Feature: js-core-migration, Property 23: CSSScoper idempotence
describe("Property 23: CSSScoper idempotence", () => {
  const scoper = new CSSScoper();

  const arbSelector = fc.constantFrom("div", ".foo", "#bar", "span", "p");
  const arbProp = fc.constantFrom("color", "margin", "padding");
  const arbVal = fc.constantFrom("red", "0", "10px");
  const arbModId = fc.string({ minLength: 1, maxLength: 10 }).filter(s => /^[a-z][a-z0-9-]*$/.test(s));

  it("scopeCSS(scopeCSS(css, id), id) === scopeCSS(css, id)", () => {
    fc.assert(
      fc.property(arbSelector, arbProp, arbVal, arbModId, (sel, prop, val, modId) => {
        const css = `${sel} { ${prop}: ${val}; }`;
        const once = scoper.scopeCSS(css, modId);
        const twice = scoper.scopeCSS(once, modId);
        expect(twice).toBe(once);
      }),
      { numRuns: 100 },
    );
  });
});
