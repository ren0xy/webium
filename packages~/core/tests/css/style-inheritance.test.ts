import { describe, it, expect } from "vitest";
import {
  StyleInheritance,
  INHERITABLE_PROPERTIES,
  INITIAL_VALUES,
} from "../../src/css/style-inheritance.js";

describe("StyleInheritance", () => {
  const inheritance = new StyleInheritance();

  describe("keyword resolution", () => {
    it("resolves 'inherit' to parent value when parent exists", () => {
      const cascaded = new Map([["color", "inherit"]]);
      const parent = new Map([["color", "red"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("color")).toBe("red");
    });

    it("resolves 'inherit' to initial value when no parent", () => {
      const cascaded = new Map([["color", "inherit"]]);
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("color")).toBe("black");
    });

    it("resolves 'inherit' for non-inheritable property from parent", () => {
      const cascaded = new Map([["display", "inherit"]]);
      const parent = new Map([["display", "flex"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("display")).toBe("flex");
    });

    it("resolves 'inherit' for non-inheritable property to initial when no parent", () => {
      const cascaded = new Map([["display", "inherit"]]);
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("display")).toBe("inline");
    });

    it("resolves 'initial' to the initial value", () => {
      const cascaded = new Map([["color", "initial"]]);
      const parent = new Map([["color", "red"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("color")).toBe("black");
    });

    it("resolves 'initial' for non-inheritable property", () => {
      const cascaded = new Map([["display", "initial"]]);
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("display")).toBe("inline");
    });
  });

  describe("inheritable property inheritance", () => {
    it("inherits unset inheritable properties from parent", () => {
      const cascaded = new Map<string, string>();
      const parent = new Map([["color", "blue"], ["font-size", "16px"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("color")).toBe("blue");
      expect(result.get("font-size")).toBe("16px");
    });

    it("uses initial value for inheritable properties when no parent", () => {
      const cascaded = new Map<string, string>();
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("color")).toBe("black");
      expect(result.get("font-size")).toBe("16px");
      expect(result.get("font-family")).toBe("serif");
    });

    it("does not override explicit cascaded values with parent values", () => {
      const cascaded = new Map([["color", "green"]]);
      const parent = new Map([["color", "red"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("color")).toBe("green");
    });
  });

  describe("non-inheritable property defaults", () => {
    it("uses initial value for unset non-inheritable properties", () => {
      const cascaded = new Map<string, string>();
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("display")).toBe("inline");
      expect(result.get("margin-top")).toBe("0");
      expect(result.get("background-color")).toBe("transparent");
      expect(result.get("position")).toBe("static");
    });

    it("does not inherit non-inheritable properties from parent", () => {
      const cascaded = new Map<string, string>();
      const parent = new Map([["display", "flex"], ["position", "absolute"]]);
      const result = inheritance.applyInheritance(cascaded, parent);
      // Non-inheritable: should use initial, not parent
      expect(result.get("display")).toBe("inline");
      expect(result.get("position")).toBe("static");
    });
  });

  describe("complete computed style", () => {
    it("returns all known properties in the computed style", () => {
      const result = inheritance.applyInheritance(new Map(), null);
      for (const prop of INITIAL_VALUES.keys()) {
        expect(result.has(prop)).toBe(true);
      }
    });

    it("preserves unknown cascaded properties as-is", () => {
      const cascaded = new Map([["custom-prop", "42"]]);
      const result = inheritance.applyInheritance(cascaded, null);
      expect(result.get("custom-prop")).toBe("42");
    });

    it("handles mixed scenario: explicit, inherit, initial, and unset", () => {
      const cascaded = new Map([
        ["color", "red"],           // explicit
        ["font-size", "inherit"],   // inherit from parent
        ["display", "initial"],     // initial value
        // visibility: unset inheritable → inherit from parent
        // margin: unset non-inheritable → initial
      ]);
      const parent = new Map([
        ["color", "blue"],
        ["font-size", "20px"],
        ["visibility", "hidden"],
        ["margin", "10px"],
      ]);
      const result = inheritance.applyInheritance(cascaded, parent);
      expect(result.get("color")).toBe("red");
      expect(result.get("font-size")).toBe("20px");
      expect(result.get("display")).toBe("inline");
      expect(result.get("visibility")).toBe("hidden");
      expect(result.get("margin-top")).toBe("0"); // non-inheritable, uses initial
    });
  });

  describe("INHERITABLE_PROPERTIES set", () => {
    it("contains exactly the expected properties", () => {
      const expected = [
        "color", "font-size", "font-family", "font-weight", "font-style",
        "line-height", "text-align", "visibility", "cursor", "direction",
        "letter-spacing", "word-spacing", "white-space",
      ];
      expect(INHERITABLE_PROPERTIES.size).toBe(expected.length);
      for (const prop of expected) {
        expect(INHERITABLE_PROPERTIES.has(prop)).toBe(true);
      }
    });
  });

  describe("INITIAL_VALUES map", () => {
    it("has initial values for all inheritable properties", () => {
      for (const prop of INHERITABLE_PROPERTIES) {
        expect(INITIAL_VALUES.has(prop)).toBe(true);
      }
    });
  });
});

import fc from "fast-check";

// Feature: js-core-migration, Property 12: Style inheritance
describe("Property 12: Style inheritance", () => {
  const inheritance = new StyleInheritance();

  const arbInheritableProp = fc.constantFrom(...INHERITABLE_PROPERTIES);

  const NON_INHERITABLE = [...INITIAL_VALUES.keys()].filter(
    (p) => !INHERITABLE_PROPERTIES.has(p),
  );
  const arbNonInheritableProp = fc.constantFrom(...NON_INHERITABLE);

  const arbCssValue = fc.constantFrom(
    "red", "blue", "16px", "bold", "italic", "center", "hidden", "pointer",
    "rtl", "2px", "pre", "normal",
  );

  it("unset inheritable properties inherit from parent", () => {
    fc.assert(
      fc.property(
        arbInheritableProp,
        arbCssValue,
        (prop, parentValue) => {
          const cascaded = new Map<string, string>();
          const parent = new Map<string, string>([[prop, parentValue]]);
          const result = inheritance.applyInheritance(cascaded, parent);
          expect(result.get(prop)).toBe(parentValue);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("unset inheritable properties use initial value when no parent", () => {
    fc.assert(
      fc.property(arbInheritableProp, (prop) => {
        const cascaded = new Map<string, string>();
        const result = inheritance.applyInheritance(cascaded, null);
        expect(result.get(prop)).toBe(INITIAL_VALUES.get(prop));
      }),
      { numRuns: 100 },
    );
  });

  it("unset non-inheritable properties always use initial value", () => {
    fc.assert(
      fc.property(
        arbNonInheritableProp,
        arbCssValue,
        (prop, parentValue) => {
          const cascaded = new Map<string, string>();
          const parent = new Map<string, string>([[prop, parentValue]]);
          const result = inheritance.applyInheritance(cascaded, parent);
          expect(result.get(prop)).toBe(INITIAL_VALUES.get(prop));
        },
      ),
      { numRuns: 100 },
    );
  });

  it("'inherit' keyword resolves to parent value or initial", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INITIAL_VALUES.keys()),
        arbCssValue,
        fc.boolean(),
        (prop, parentValue, hasParent) => {
          const cascaded = new Map<string, string>([[prop, "inherit"]]);
          const parent = hasParent ? new Map<string, string>([[prop, parentValue]]) : null;
          const result = inheritance.applyInheritance(cascaded, parent);
          if (hasParent) {
            expect(result.get(prop)).toBe(parentValue);
          } else {
            expect(result.get(prop)).toBe(INITIAL_VALUES.get(prop));
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("'initial' keyword always resolves to initial value", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...INITIAL_VALUES.keys()),
        arbCssValue,
        (prop, parentValue) => {
          const cascaded = new Map<string, string>([[prop, "initial"]]);
          const parent = new Map<string, string>([[prop, parentValue]]);
          const result = inheritance.applyInheritance(cascaded, parent);
          expect(result.get(prop)).toBe(INITIAL_VALUES.get(prop));
        },
      ),
      { numRuns: 100 },
    );
  });
});
