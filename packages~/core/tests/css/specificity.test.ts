import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  SpecificityCalculator,
  compareSpecificity,
  addSpecificity,
  ZERO_SPECIFICITY,
  type Specificity,
} from "../../src/css/specificity.js";

describe("SpecificityCalculator", () => {
  const calc = new SpecificityCalculator();

  describe("empty / whitespace selectors", () => {
    it("returns (0,0,0) for empty string", () => {
      expect(calc.calculate("")).toEqual({ a: 0, b: 0, c: 0 });
    });

    it("returns (0,0,0) for whitespace-only string", () => {
      expect(calc.calculate("   ")).toEqual({ a: 0, b: 0, c: 0 });
    });
  });

  describe("single simple selectors", () => {
    it("type selector: div → (0,0,1)", () => {
      expect(calc.calculate("div")).toEqual({ a: 0, b: 0, c: 1 });
    });

    it("class selector: .foo → (0,1,0)", () => {
      expect(calc.calculate(".foo")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("id selector: #bar → (1,0,0)", () => {
      expect(calc.calculate("#bar")).toEqual({ a: 1, b: 0, c: 0 });
    });

    it("attribute selector: [type] → (0,1,0)", () => {
      expect(calc.calculate("[type]")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("attribute selector with value: [type='text'] → (0,1,0)", () => {
      expect(calc.calculate("[type='text']")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("pseudo-class: :hover → (0,1,0)", () => {
      expect(calc.calculate(":hover")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("pseudo-class: :focus → (0,1,0)", () => {
      expect(calc.calculate(":focus")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("universal selector: * → (0,0,0)", () => {
      expect(calc.calculate("*")).toEqual({ a: 0, b: 0, c: 0 });
    });

    it("pseudo-element: ::before → (0,0,0) (ignored)", () => {
      expect(calc.calculate("::before")).toEqual({ a: 0, b: 0, c: 0 });
    });

    it("pseudo-element: ::after → (0,0,0) (ignored)", () => {
      expect(calc.calculate("::after")).toEqual({ a: 0, b: 0, c: 0 });
    });
  });

  describe("compound selectors", () => {
    it("div.foo → (0,1,1)", () => {
      expect(calc.calculate("div.foo")).toEqual({ a: 0, b: 1, c: 1 });
    });

    it("div.foo#bar → (1,1,1)", () => {
      expect(calc.calculate("div.foo#bar")).toEqual({ a: 1, b: 1, c: 1 });
    });

    it("div.foo.bar → (0,2,1)", () => {
      expect(calc.calculate("div.foo.bar")).toEqual({ a: 0, b: 2, c: 1 });
    });

    it("div#id.class:hover → (1,2,1)", () => {
      expect(calc.calculate("div#id.class:hover")).toEqual({ a: 1, b: 2, c: 1 });
    });

    it("div[type].class → (0,2,1)", () => {
      expect(calc.calculate("div[type].class")).toEqual({ a: 0, b: 2, c: 1 });
    });

    it("*.foo → (0,1,0)", () => {
      expect(calc.calculate("*.foo")).toEqual({ a: 0, b: 1, c: 0 });
    });
  });

  describe("complex selectors with combinators", () => {
    it("descendant: div .foo → (0,1,1)", () => {
      expect(calc.calculate("div .foo")).toEqual({ a: 0, b: 1, c: 1 });
    });

    it("child: div > .foo → (0,1,1)", () => {
      expect(calc.calculate("div > .foo")).toEqual({ a: 0, b: 1, c: 1 });
    });

    it("adjacent sibling: div + .foo → (0,1,1)", () => {
      expect(calc.calculate("div + .foo")).toEqual({ a: 0, b: 1, c: 1 });
    });

    it("general sibling: div ~ .foo → (0,1,1)", () => {
      expect(calc.calculate("div ~ .foo")).toEqual({ a: 0, b: 1, c: 1 });
    });

    it("div > .foo + #bar → (1,1,1)", () => {
      expect(calc.calculate("div > .foo + #bar")).toEqual({ a: 1, b: 1, c: 1 });
    });

    it("body div.container > ul li.active → (0,2,4)", () => {
      expect(calc.calculate("body div.container > ul li.active")).toEqual({
        a: 0,
        b: 2,
        c: 4,
      });
    });

    it("#main .sidebar > div.widget:hover → (1,3,1)", () => {
      expect(calc.calculate("#main .sidebar > div.widget:hover")).toEqual({
        a: 1,
        b: 3,
        c: 1,
      });
    });
  });

  describe("comma-separated selector lists", () => {
    it("returns highest specificity: div, #foo → (1,0,0)", () => {
      expect(calc.calculate("div, #foo")).toEqual({ a: 1, b: 0, c: 0 });
    });

    it("returns highest specificity: .a, .b.c → (0,2,0)", () => {
      expect(calc.calculate(".a, .b.c")).toEqual({ a: 0, b: 2, c: 0 });
    });

    it("returns highest specificity: div, span, .foo → (0,1,0)", () => {
      expect(calc.calculate("div, span, .foo")).toEqual({ a: 0, b: 1, c: 0 });
    });
  });

  describe("functional pseudo-classes", () => {
    it(":nth-child(2n+1) → (0,1,0)", () => {
      expect(calc.calculate(":nth-child(2n+1)")).toEqual({ a: 0, b: 1, c: 0 });
    });

    it("li:nth-child(odd) → (0,1,1)", () => {
      expect(calc.calculate("li:nth-child(odd)")).toEqual({ a: 0, b: 1, c: 1 });
    });
  });

  describe("attribute selectors with special chars", () => {
    it("[data-value='hello world'] → (0,1,0)", () => {
      expect(calc.calculate("[data-value='hello world']")).toEqual({
        a: 0,
        b: 1,
        c: 0,
      });
    });

    it("div[class~='active'][id] → (0,2,1)", () => {
      expect(calc.calculate("div[class~='active'][id]")).toEqual({
        a: 0,
        b: 2,
        c: 1,
      });
    });
  });
});

describe("Specificity helpers", () => {
  describe("compareSpecificity", () => {
    it("returns 0 for equal specificities", () => {
      expect(compareSpecificity({ a: 1, b: 2, c: 3 }, { a: 1, b: 2, c: 3 })).toBe(0);
    });

    it("compares a first", () => {
      expect(compareSpecificity({ a: 2, b: 0, c: 0 }, { a: 1, b: 9, c: 9 })).toBeGreaterThan(0);
    });

    it("compares b second", () => {
      expect(compareSpecificity({ a: 0, b: 2, c: 0 }, { a: 0, b: 1, c: 9 })).toBeGreaterThan(0);
    });

    it("compares c last", () => {
      expect(compareSpecificity({ a: 0, b: 0, c: 2 }, { a: 0, b: 0, c: 1 })).toBeGreaterThan(0);
    });

    it("returns negative when left < right", () => {
      expect(compareSpecificity({ a: 0, b: 0, c: 1 }, { a: 1, b: 0, c: 0 })).toBeLessThan(0);
    });
  });

  describe("addSpecificity", () => {
    it("adds components", () => {
      expect(addSpecificity({ a: 1, b: 2, c: 3 }, { a: 4, b: 5, c: 6 })).toEqual({
        a: 5,
        b: 7,
        c: 9,
      });
    });
  });

  describe("ZERO_SPECIFICITY", () => {
    it("is (0,0,0)", () => {
      expect(ZERO_SPECIFICITY).toEqual({ a: 0, b: 0, c: 0 });
    });
  });
});


// Feature: js-core-migration, Property 10: Specificity calculation
describe("Property 10: Specificity calculation", () => {
  const calc = new SpecificityCalculator();

  // Generators for individual simple selector types
  const arbIdSelector = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/).map((s) => `#${s}`);
  const arbClassSelector = fc.stringMatching(/^[a-z][a-z0-9]{0,5}$/).map((s) => `.${s}`);
  const arbTypeSelector = fc.constantFrom("div", "span", "p", "img");
  const arbAttrSelector = fc
    .stringMatching(/^[a-z][a-z0-9]{0,5}$/)
    .map((s) => `[${s}]`);
  const arbPseudoClassSelector = fc.constantFrom(":hover", ":focus");

  // Generator for a compound selector built from known simple selectors
  // Returns { selector, expectedA, expectedB, expectedC }
  const arbCompoundSelector = fc
    .record({
      ids: fc.array(arbIdSelector, { minLength: 0, maxLength: 2 }),
      classes: fc.array(arbClassSelector, { minLength: 0, maxLength: 3 }),
      attrs: fc.array(arbAttrSelector, { minLength: 0, maxLength: 2 }),
      pseudos: fc.array(arbPseudoClassSelector, { minLength: 0, maxLength: 2 }),
      type: fc.option(arbTypeSelector, { nil: undefined }),
    })
    .filter(
      (r) =>
        r.ids.length + r.classes.length + r.attrs.length + r.pseudos.length > 0 ||
        r.type !== undefined,
    )
    .map((r) => {
      // Build compound: type first (if any), then ids, classes, attrs, pseudos
      let selector = r.type ?? "";
      selector += r.ids.join("");
      selector += r.classes.join("");
      selector += r.attrs.join("");
      selector += r.pseudos.join("");

      const expectedA = r.ids.length;
      const expectedB = r.classes.length + r.attrs.length + r.pseudos.length;
      const expectedC = r.type !== undefined ? 1 : 0;

      return { selector, expectedA, expectedB, expectedC };
    });

  // Generator for a full selector with combinators
  const arbCombinator = fc.constantFrom(" ", " > ", " + ", " ~ ");

  const arbFullSelector = fc
    .array(arbCompoundSelector, { minLength: 1, maxLength: 4 })
    .chain((compounds) => {
      if (compounds.length === 1) {
        return fc.constant({
          selector: compounds[0].selector,
          expectedA: compounds[0].expectedA,
          expectedB: compounds[0].expectedB,
          expectedC: compounds[0].expectedC,
        });
      }
      // Generate combinators between compounds
      return fc
        .array(arbCombinator, {
          minLength: compounds.length - 1,
          maxLength: compounds.length - 1,
        })
        .map((combinators) => {
          let selector = compounds[0].selector;
          let totalA = compounds[0].expectedA;
          let totalB = compounds[0].expectedB;
          let totalC = compounds[0].expectedC;

          for (let i = 1; i < compounds.length; i++) {
            selector += combinators[i - 1] + compounds[i].selector;
            totalA += compounds[i].expectedA;
            totalB += compounds[i].expectedB;
            totalC += compounds[i].expectedC;
          }

          return {
            selector,
            expectedA: totalA,
            expectedB: totalB,
            expectedC: totalC,
          };
        });
    });

  /**
   * Validates: Requirements 3.3
   *
   * For any CSS selector string composed of id, class, type, attribute,
   * and pseudo-class selectors, the SpecificityCalculator produces an
   * (a, b, c) tuple where:
   *   a = count of id selectors
   *   b = count of class + attribute + pseudo-class selectors
   *   c = count of type selectors
   */
  it("specificity tuple matches expected counts for generated selectors", () => {
    fc.assert(
      fc.property(arbFullSelector, ({ selector, expectedA, expectedB, expectedC }) => {
        const result = calc.calculate(selector);
        expect(result.a).toBe(expectedA);
        expect(result.b).toBe(expectedB);
        expect(result.c).toBe(expectedC);
      }),
      { numRuns: 100 },
    );
  });
});
