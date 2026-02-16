import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { camelToKebab, kebabToCamel } from "../../src/api/helpers.js";

/**
 * Property 15: camelCase ↔ kebab-case round-trip
 *
 * For any kebab-case CSS property name (lowercase letters and hyphens,
 * not starting or ending with a hyphen), converting to camelCase via
 * kebabToCamel and back to kebab-case via camelToKebab should produce
 * the original string.
 *
 * **Validates: Requirements 6.1**
 */
describe("Feature: browser-api-surface, Property 15: camelCase ↔ kebab-case round-trip", () => {
  // Generator for valid kebab-case CSS property names:
  // One or more segments of lowercase letters, joined by single hyphens.
  // e.g. "background-color", "font-size", "color"
  const arbKebabCaseProp = fc
    .array(fc.stringMatching(/^[a-z]{1,8}$/), { minLength: 1, maxLength: 5 })
    .map((segments) => segments.join("-"));

  it("kebabToCamel then camelToKebab is identity", () => {
    fc.assert(
      fc.property(arbKebabCaseProp, (kebab) => {
        const camel = kebabToCamel(kebab);
        const roundTripped = camelToKebab(camel);
        expect(roundTripped).toBe(kebab);
      }),
      { numRuns: 200 },
    );
  });
});
