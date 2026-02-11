import { describe, it, expect } from "vitest";
import { CascadeResolver } from "../../src/css/cascade-resolver.js";
import { CSSRuleImpl } from "../../src/css/css-rule.js";
import type { Specificity } from "../../src/css/specificity.js";

function makeRule(
  selector: string,
  declarations: Record<string, string>,
  specificity: Specificity,
  sourceOrder: number,
) {
  return new CSSRuleImpl(selector, new Map(Object.entries(declarations)), specificity, sourceOrder);
}

describe("CascadeResolver", () => {
  const resolver = new CascadeResolver();

  describe("basic resolution", () => {
    it("returns empty map when no rules and no inline styles", () => {
      const result = resolver.resolve([], new Map());
      expect(result.size).toBe(0);
    });

    it("returns inline styles when no rules", () => {
      const inline = new Map([["color", "red"]]);
      const result = resolver.resolve([], inline);
      expect(result.get("color")).toBe("red");
    });

    it("returns rule declarations when no inline styles", () => {
      const rule = makeRule("div", { color: "blue" }, { a: 0, b: 0, c: 1 }, 0);
      const result = resolver.resolve([rule], new Map());
      expect(result.get("color")).toBe("blue");
    });
  });

  describe("specificity ordering", () => {
    it("higher specificity wins over lower specificity", () => {
      const low = makeRule("div", { color: "blue" }, { a: 0, b: 0, c: 1 }, 0);
      const high = makeRule(".foo", { color: "red" }, { a: 0, b: 1, c: 0 }, 1);
      // Pass in any order — specificity should determine winner
      const result = resolver.resolve([high, low], new Map());
      expect(result.get("color")).toBe("red");
    });

    it("higher specificity wins regardless of source order", () => {
      const high = makeRule("#id", { color: "green" }, { a: 1, b: 0, c: 0 }, 0);
      const low = makeRule(".cls", { color: "red" }, { a: 0, b: 1, c: 0 }, 5);
      const result = resolver.resolve([low, high], new Map());
      expect(result.get("color")).toBe("green");
    });
  });

  describe("source order tiebreaking", () => {
    it("later source order wins when specificity is equal", () => {
      const first = makeRule(".a", { color: "red" }, { a: 0, b: 1, c: 0 }, 0);
      const second = makeRule(".b", { color: "blue" }, { a: 0, b: 1, c: 0 }, 1);
      const result = resolver.resolve([first, second], new Map());
      expect(result.get("color")).toBe("blue");
    });

    it("later source order wins even if passed first in array", () => {
      const first = makeRule(".a", { color: "red" }, { a: 0, b: 1, c: 0 }, 0);
      const second = makeRule(".b", { color: "blue" }, { a: 0, b: 1, c: 0 }, 1);
      // Reverse input order — source order should still determine winner
      const result = resolver.resolve([second, first], new Map());
      expect(result.get("color")).toBe("blue");
    });
  });

  describe("inline styles override", () => {
    it("inline styles override stylesheet rules regardless of specificity", () => {
      const rule = makeRule("#id", { color: "green" }, { a: 1, b: 0, c: 0 }, 0);
      const inline = new Map([["color", "red"]]);
      const result = resolver.resolve([rule], inline);
      expect(result.get("color")).toBe("red");
    });

    it("inline styles override multiple rules", () => {
      const r1 = makeRule("#id", { color: "green" }, { a: 1, b: 0, c: 0 }, 0);
      const r2 = makeRule(".cls", { color: "blue" }, { a: 0, b: 1, c: 0 }, 1);
      const inline = new Map([["color", "yellow"]]);
      const result = resolver.resolve([r1, r2], inline);
      expect(result.get("color")).toBe("yellow");
    });
  });

  describe("multiple properties", () => {
    it("merges declarations from multiple rules", () => {
      const r1 = makeRule("div", { color: "red" }, { a: 0, b: 0, c: 1 }, 0);
      const r2 = makeRule(".cls", { "font-size": "14px" }, { a: 0, b: 1, c: 0 }, 1);
      const result = resolver.resolve([r1, r2], new Map());
      expect(result.get("color")).toBe("red");
      expect(result.get("font-size")).toBe("14px");
    });

    it("inline styles only override matching properties", () => {
      const rule = makeRule("div", { color: "red", "font-size": "14px" }, { a: 0, b: 0, c: 1 }, 0);
      const inline = new Map([["color", "blue"]]);
      const result = resolver.resolve([rule], inline);
      expect(result.get("color")).toBe("blue");
      expect(result.get("font-size")).toBe("14px");
    });
  });

  describe("complex cascade scenarios", () => {
    it("three rules with different specificities resolve correctly", () => {
      const r1 = makeRule("div", { color: "red", margin: "10px" }, { a: 0, b: 0, c: 1 }, 0);
      const r2 = makeRule(".cls", { color: "blue", padding: "5px" }, { a: 0, b: 1, c: 0 }, 1);
      const r3 = makeRule("#id", { color: "green" }, { a: 1, b: 0, c: 0 }, 2);
      const result = resolver.resolve([r1, r2, r3], new Map());
      expect(result.get("color")).toBe("green");
      expect(result.get("margin")).toBe("10px");
      expect(result.get("padding")).toBe("5px");
    });

    it("rules with same property at different specificities plus inline", () => {
      const r1 = makeRule("div", { display: "block" }, { a: 0, b: 0, c: 1 }, 0);
      const r2 = makeRule("#id", { display: "flex" }, { a: 1, b: 0, c: 0 }, 1);
      const inline = new Map([["display", "grid"]]);
      const result = resolver.resolve([r1, r2], inline);
      expect(result.get("display")).toBe("grid");
    });
  });
});

import fc from "fast-check";

// Feature: js-core-migration, Property 11: Cascade resolution ordering
describe("Property 11: Cascade resolution ordering", () => {
  const resolver = new CascadeResolver();

  /** Arbitrary for a specificity tuple */
  const arbSpecificity = fc.record({
    a: fc.integer({ min: 0, max: 3 }),
    b: fc.integer({ min: 0, max: 5 }),
    c: fc.integer({ min: 0, max: 5 }),
  });

  /** Arbitrary for a CSS property name */
  const arbPropName = fc.constantFrom(
    "color", "display", "margin", "padding", "font-size",
    "background-color", "width", "height", "opacity", "position",
  );

  /** Arbitrary for a CSS value */
  const arbValue = fc.constantFrom(
    "red", "blue", "green", "0", "10px", "auto", "flex", "block", "none", "1",
  );

  /** Arbitrary for a CSSRule */
  const arbRule = fc.tuple(arbPropName, arbValue, arbSpecificity, fc.nat({ max: 1000 })).map(
    ([prop, value, spec, order]) =>
      makeRule("sel", { [prop]: value }, spec, order),
  );

  it("inline styles always override stylesheet rules for the same property", () => {
    fc.assert(
      fc.property(
        fc.array(arbRule, { minLength: 1, maxLength: 10 }),
        arbPropName,
        arbValue,
        (rules, prop, inlineValue) => {
          const inline = new Map([[prop, inlineValue]]);
          const result = resolver.resolve(rules, inline);
          expect(result.get(prop)).toBe(inlineValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("for same property, highest specificity wins among stylesheet rules", () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        arbValue,
        arbSpecificity,
        arbSpecificity,
        fc.nat({ max: 500 }),
        fc.nat({ max: 500 }),
        (prop, val1, val2, spec1, spec2, order1, order2) => {
          // Ensure distinct source orders
          const o2 = order1 === order2 ? order2 + 1 : order2;
          const r1 = makeRule("a", { [prop]: val1 }, spec1, order1);
          const r2 = makeRule("b", { [prop]: val2 }, spec2, o2);
          const result = resolver.resolve([r1, r2], new Map());

          const specCmp =
            spec1.a !== spec2.a ? spec1.a - spec2.a :
            spec1.b !== spec2.b ? spec1.b - spec2.b :
            spec1.c - spec2.c;

          if (specCmp > 0) {
            expect(result.get(prop)).toBe(val1);
          } else if (specCmp < 0) {
            expect(result.get(prop)).toBe(val2);
          } else {
            // Equal specificity — higher source order wins
            expect(result.get(prop)).toBe(order1 > o2 ? val1 : val2);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("for equal specificity, higher source order wins", () => {
    fc.assert(
      fc.property(
        arbPropName,
        arbValue,
        arbValue,
        arbSpecificity,
        (prop, val1, val2, spec) => {
          const r1 = makeRule("a", { [prop]: val1 }, spec, 0);
          const r2 = makeRule("b", { [prop]: val2 }, spec, 1);
          const result = resolver.resolve([r1, r2], new Map());
          expect(result.get(prop)).toBe(val2);
        },
      ),
      { numRuns: 100 },
    );
  });
});
