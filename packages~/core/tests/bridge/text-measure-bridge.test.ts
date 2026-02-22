import { describe, it, expect, afterEach } from "vitest";
import { initTextMeasureBridge, measureText } from "../../src/bridge/text-measure-bridge.js";

describe("text-measure-bridge", () => {
  afterEach(() => {
    // Clean up any mock on globalThis and reset bridge to heuristic mode
    delete (globalThis as any).__webium_measureText;
    initTextMeasureBridge(); // resets _native to null
  });

  describe("fallback heuristic (no native binding)", () => {
    it("returns text.length * fontSize * 0.6 width and fontSize * 1.2 height", () => {
      initTextMeasureBridge();

      const result = measureText("Hello", "sans-serif", 16, "normal", "normal");
      expect(result.width).toBe(5 * 16 * 0.6);   // 48
      expect(result.height).toBe(16 * 1.2);        // 19.2
    });
  });

  describe("native binding delegation", () => {
    it("delegates to globalThis.__webium_measureText when registered", () => {
      // Mock matches the single-JSON-arg protocol used by the real C# binding
      const mockMeasure = (argsJson: string): string => {
        const args = JSON.parse(argsJson);
        // Return mock values regardless of input
        return JSON.stringify({ width: 123.4, height: 56.7 });
      };

      (globalThis as any).__webium_measureText = mockMeasure;
      initTextMeasureBridge();

      const result = measureText("anything", "Arial", 20, "bold", "italic");
      expect(result.width).toBe(123.4);
      expect(result.height).toBe(56.7);
    });
  });

  describe("empty text", () => {
    it("returns { width: 0, height: 0 } via the heuristic path", () => {
      initTextMeasureBridge();

      const result = measureText("", "sans-serif", 16, "normal", "normal");
      expect(result.width).toBe(0);
      expect(result.height).toBe(16 * 1.2); // 19.2
    });
  });
});
