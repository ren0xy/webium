import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { NodeTag, DirtyFlags, PseudoStates } from "../../src/dom/types";

describe("NodeTag", () => {
  it("has correct ordinal values matching C# enum", () => {
    expect(NodeTag.Div).toBe(0);
    expect(NodeTag.Span).toBe(1);
    expect(NodeTag.P).toBe(2);
    expect(NodeTag.Img).toBe(3);
    expect(NodeTag.Text).toBe(4);
    expect(NodeTag.Style).toBe(5);
    expect(NodeTag.Unknown).toBe(6);
  });

  /**
   * Property 3: TypeScript enum value stability
   * Validates: Requirements 1.1, 1.2, 3.1
   */
  it("all 24 enum values match the canonical table", () => {
    const canonicalTable: [string, number][] = [
      ["Div", 0],
      ["Span", 1],
      ["P", 2],
      ["Img", 3],
      ["Text", 4],
      ["Style", 5],
      ["Unknown", 6],
      ["Button", 7],
      ["Input", 8],
      ["A", 9],
      ["Ul", 10],
      ["Ol", 11],
      ["Li", 12],
      ["H1", 13],
      ["H2", 14],
      ["H3", 15],
      ["H4", 16],
      ["H5", 17],
      ["H6", 18],
      ["Script", 19],
      ["Link", 20],
      ["Body", 21],
      ["Head", 22],
      ["Html", 23],
    ];

    // Verify each (name, value) pair
    for (const [name, value] of canonicalTable) {
      expect(NodeTag[name as keyof typeof NodeTag]).toBe(value);
    }

    // Verify the enum has exactly 24 members (no extras, no missing)
    const memberCount = Object.keys(NodeTag).filter((k) => isNaN(Number(k))).length;
    expect(memberCount).toBe(24);
  });

  /**
   * Property 1: uint8 range invariant
   * Validates: Requirements 1.3
   *
   * For every NodeTag member, its numeric value is in [0, 255].
   */
  it("Property 1: all NodeTag values are within uint8 range [0, 255]", () => {
    const allNodeTagValues = Object.keys(NodeTag)
      .filter((k) => isNaN(Number(k)))
      .map((k) => NodeTag[k as keyof typeof NodeTag]);

    fc.assert(
      fc.property(fc.constantFrom(...allNodeTagValues), (tag: NodeTag) => {
        expect(tag).toBeGreaterThanOrEqual(0);
        expect(tag).toBeLessThanOrEqual(255);
      }),
      { numRuns: 100 },
    );
  });
});

describe("DirtyFlags", () => {
  it("has correct bit flag values", () => {
    expect(DirtyFlags.None).toBe(0);
    expect(DirtyFlags.Tree).toBe(1);
    expect(DirtyFlags.Style).toBe(2);
    expect(DirtyFlags.Attributes).toBe(4);
    expect(DirtyFlags.Text).toBe(8);
    expect(DirtyFlags.All).toBe(0b1111);
  });

  it("All is the combination of all individual flags", () => {
    expect(DirtyFlags.All).toBe(
      DirtyFlags.Tree | DirtyFlags.Style | DirtyFlags.Attributes | DirtyFlags.Text,
    );
  });

  it("supports bitwise OR to combine flags", () => {
    const combined = DirtyFlags.Tree | DirtyFlags.Style;
    expect(combined & DirtyFlags.Tree).toBeTruthy();
    expect(combined & DirtyFlags.Style).toBeTruthy();
    expect(combined & DirtyFlags.Attributes).toBeFalsy();
  });
});

describe("PseudoStates", () => {
  it("has correct bit flag values", () => {
    expect(PseudoStates.None).toBe(0);
    expect(PseudoStates.Hover).toBe(1);
    expect(PseudoStates.Focus).toBe(2);
  });

  it("supports bitwise OR to combine states", () => {
    const combined = PseudoStates.Hover | PseudoStates.Focus;
    expect(combined & PseudoStates.Hover).toBeTruthy();
    expect(combined & PseudoStates.Focus).toBeTruthy();
  });
});
