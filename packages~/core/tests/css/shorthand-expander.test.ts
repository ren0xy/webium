import { describe, it, expect } from "vitest";
import { CSSShorthandExpander } from "../../src/css/shorthand-expander.js";

describe("CSSShorthandExpander", () => {
  const expander = new CSSShorthandExpander();

  describe("margin — 1-value expansion", () => {
    it("expands single value to all four sides", () => {
      const styles = new Map([["margin", "10px"]]);
      const result = expander.expand(styles);
      expect(result.get("margin-top")).toBe("10px");
      expect(result.get("margin-right")).toBe("10px");
      expect(result.get("margin-bottom")).toBe("10px");
      expect(result.get("margin-left")).toBe("10px");
      expect(result.has("margin")).toBe(false);
    });
  });

  describe("margin — 2-value expansion", () => {
    it("expands two values to top/bottom and left/right", () => {
      const styles = new Map([["margin", "10px 20px"]]);
      const result = expander.expand(styles);
      expect(result.get("margin-top")).toBe("10px");
      expect(result.get("margin-right")).toBe("20px");
      expect(result.get("margin-bottom")).toBe("10px");
      expect(result.get("margin-left")).toBe("20px");
      expect(result.has("margin")).toBe(false);
    });
  });

  describe("margin — 3-value expansion", () => {
    it("expands three values to top, left/right, bottom", () => {
      const styles = new Map([["margin", "10px 20px 30px"]]);
      const result = expander.expand(styles);
      expect(result.get("margin-top")).toBe("10px");
      expect(result.get("margin-right")).toBe("20px");
      expect(result.get("margin-bottom")).toBe("30px");
      expect(result.get("margin-left")).toBe("20px");
      expect(result.has("margin")).toBe(false);
    });
  });

  describe("margin — 4-value expansion", () => {
    it("expands four values to top, right, bottom, left", () => {
      const styles = new Map([["margin", "10px 20px 30px 40px"]]);
      const result = expander.expand(styles);
      expect(result.get("margin-top")).toBe("10px");
      expect(result.get("margin-right")).toBe("20px");
      expect(result.get("margin-bottom")).toBe("30px");
      expect(result.get("margin-left")).toBe("40px");
      expect(result.has("margin")).toBe(false);
    });
  });

  describe("padding — 1-value expansion", () => {
    it("expands single value to all four sides", () => {
      const styles = new Map([["padding", "5px"]]);
      const result = expander.expand(styles);
      expect(result.get("padding-top")).toBe("5px");
      expect(result.get("padding-right")).toBe("5px");
      expect(result.get("padding-bottom")).toBe("5px");
      expect(result.get("padding-left")).toBe("5px");
      expect(result.has("padding")).toBe(false);
    });
  });

  describe("padding — 2-value expansion", () => {
    it("expands two values to top/bottom and left/right", () => {
      const styles = new Map([["padding", "10px 20px"]]);
      const result = expander.expand(styles);
      expect(result.get("padding-top")).toBe("10px");
      expect(result.get("padding-right")).toBe("20px");
      expect(result.get("padding-bottom")).toBe("10px");
      expect(result.get("padding-left")).toBe("20px");
      expect(result.has("padding")).toBe(false);
    });
  });

  describe("padding — 3-value expansion", () => {
    it("expands three values to top, left/right, bottom", () => {
      const styles = new Map([["padding", "4px 8px 12px"]]);
      const result = expander.expand(styles);
      expect(result.get("padding-top")).toBe("4px");
      expect(result.get("padding-right")).toBe("8px");
      expect(result.get("padding-bottom")).toBe("12px");
      expect(result.get("padding-left")).toBe("8px");
      expect(result.has("padding")).toBe(false);
    });
  });

  describe("padding — 4-value expansion", () => {
    it("expands four values to top, right, bottom, left", () => {
      const styles = new Map([["padding", "1px 2px 3px 4px"]]);
      const result = expander.expand(styles);
      expect(result.get("padding-top")).toBe("1px");
      expect(result.get("padding-right")).toBe("2px");
      expect(result.get("padding-bottom")).toBe("3px");
      expect(result.get("padding-left")).toBe("4px");
      expect(result.has("padding")).toBe(false);
    });
  });

  describe("longhand override preservation", () => {
    it("preserves explicit margin-top when margin shorthand is also set", () => {
      const styles = new Map([
        ["margin", "10px"],
        ["margin-top", "20px"],
      ]);
      const result = expander.expand(styles);
      expect(result.get("margin-top")).toBe("20px");
      expect(result.get("margin-right")).toBe("10px");
      expect(result.get("margin-bottom")).toBe("10px");
      expect(result.get("margin-left")).toBe("10px");
      expect(result.has("margin")).toBe(false);
    });

    it("preserves explicit padding-left when padding shorthand is also set", () => {
      const styles = new Map([
        ["padding", "5px 10px"],
        ["padding-left", "99px"],
      ]);
      const result = expander.expand(styles);
      expect(result.get("padding-top")).toBe("5px");
      expect(result.get("padding-right")).toBe("10px");
      expect(result.get("padding-bottom")).toBe("5px");
      expect(result.get("padding-left")).toBe("99px");
      expect(result.has("padding")).toBe(false);
    });
  });

  describe("unknown shorthands pass through unchanged", () => {
    it("does not modify unrecognised properties", () => {
      const styles = new Map([
        ["border", "1px solid red"],
        ["color", "blue"],
      ]);
      const result = expander.expand(styles);
      expect(result.get("border")).toBe("1px solid red");
      expect(result.get("color")).toBe("blue");
    });
  });

  describe("empty / invalid values", () => {
    it("handles empty string value gracefully", () => {
      const styles = new Map([["margin", ""]]);
      const result = expander.expand(styles);
      // Empty string trims to "" which splits to [""] — 1 part, expands to all sides
      // The shorthand key should be removed regardless
      expect(result.has("margin")).toBe(false);
    });

    it("handles whitespace-only value gracefully", () => {
      const styles = new Map([["padding", "   "]]);
      const result = expander.expand(styles);
      // Whitespace trims to "" which splits to [""] — 1 part
      expect(result.has("padding")).toBe(false);
    });

    it("handles more than 4 values gracefully (no expansion)", () => {
      const styles = new Map([["margin", "1px 2px 3px 4px 5px"]]);
      const result = expander.expand(styles);
      // 5 values is not a valid shorthand — should remain unchanged
      expect(result.get("margin")).toBe("1px 2px 3px 4px 5px");
    });

    it("does not mutate the original map", () => {
      const styles = new Map([["margin", "10px"]]);
      expander.expand(styles);
      expect(styles.has("margin")).toBe(true);
      expect(styles.has("margin-top")).toBe(false);
    });
  });
});
