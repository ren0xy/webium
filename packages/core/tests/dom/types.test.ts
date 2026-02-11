import { describe, it, expect } from "vitest";
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
