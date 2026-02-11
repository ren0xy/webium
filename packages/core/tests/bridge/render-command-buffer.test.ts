import { describe, it, expect } from "vitest";
import fc from "fast-check";
import {
  RenderOp,
  RenderCommandBuffer,
  type RenderCommand,
} from "../../src/bridge/render-command.js";
import {
  deserializeTypedArray,
  deserializeJSON,
} from "../../src/bridge/render-command-deserializer.js";
import { NodeTag } from "../../src/dom/types.js";

describe("RenderCommandBuffer", () => {
  it("starts empty", () => {
    const buf = new RenderCommandBuffer();
    expect(buf.length).toBe(0);
    expect(buf.commands).toHaveLength(0);
  });

  it("push adds commands", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.Create, nodeId: 1, tag: NodeTag.Div, parentId: 0, siblingIndex: 0 });
    expect(buf.length).toBe(1);
  });

  it("clear empties the buffer", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.Destroy, nodeId: 1 });
    buf.clear();
    expect(buf.length).toBe(0);
  });

  it("toJSON produces valid JSON", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.UpdateText, nodeId: 5, text: "hello" });
    const json = buf.toJSON();
    const parsed = JSON.parse(json);
    expect(parsed).toHaveLength(1);
    expect(parsed[0].text).toBe("hello");
  });

  it("typed array round-trip for Create command", () => {
    const buf = new RenderCommandBuffer();
    const cmd: RenderCommand = {
      op: RenderOp.Create,
      nodeId: 42,
      tag: NodeTag.Div,
      parentId: 1,
      siblingIndex: 3,
    };
    buf.push(cmd);
    const result = deserializeTypedArray(buf.toTypedArray());
    expect(result).toHaveLength(1);
    expect(result[0].op).toBe(RenderOp.Create);
    expect(result[0].nodeId).toBe(42);
    expect(result[0].tag).toBe(NodeTag.Div);
    expect(result[0].parentId).toBe(1);
    expect(result[0].siblingIndex).toBe(3);
  });

  it("typed array round-trip for UpdateLayout command", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.UpdateLayout, nodeId: 7, x: 10.5, y: 20.5, width: 100, height: 50 });
    const result = deserializeTypedArray(buf.toTypedArray());
    expect(result[0].x).toBeCloseTo(10.5, 1);
    expect(result[0].y).toBeCloseTo(20.5, 1);
    expect(result[0].width).toBeCloseTo(100, 1);
    expect(result[0].height).toBeCloseTo(50, 1);
  });

  it("typed array round-trip for UpdateStyle command", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.UpdateStyle, nodeId: 3, styles: { color: "red", margin: "10px" } });
    const result = deserializeTypedArray(buf.toTypedArray());
    expect(result[0].styles).toEqual({ color: "red", margin: "10px" });
  });

  it("typed array round-trip for UpdateText command", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.UpdateText, nodeId: 9, text: "hello world" });
    const result = deserializeTypedArray(buf.toTypedArray());
    expect(result[0].text).toBe("hello world");
  });

  it("typed array round-trip for multiple commands", () => {
    const buf = new RenderCommandBuffer();
    buf.push({ op: RenderOp.Create, nodeId: 1, tag: NodeTag.Div, parentId: 0, siblingIndex: 0 });
    buf.push({ op: RenderOp.UpdateText, nodeId: 2, text: "hi" });
    buf.push({ op: RenderOp.Destroy, nodeId: 3 });
    const result = deserializeTypedArray(buf.toTypedArray());
    expect(result).toHaveLength(3);
    expect(result[0].op).toBe(RenderOp.Create);
    expect(result[1].op).toBe(RenderOp.UpdateText);
    expect(result[2].op).toBe(RenderOp.Destroy);
  });
});

// Feature: js-core-migration, Property 18: RenderCommandBuffer serialization round-trip
describe("Property 18: RenderCommandBuffer serialization round-trip", () => {
  const arbOp = fc.constantFrom(
    RenderOp.Create, RenderOp.Destroy, RenderOp.UpdateLayout,
    RenderOp.UpdateStyle, RenderOp.UpdateText, RenderOp.Reparent,
  );
  const arbTag = fc.constantFrom(
    NodeTag.Div, NodeTag.Span, NodeTag.P, NodeTag.Img, NodeTag.Text, NodeTag.Style,
  );

  // Use simple ASCII strings to avoid encoding edge cases in styles
  const arbStyleKey = fc.constantFrom("color", "margin", "padding", "display", "width");
  const arbStyleVal = fc.constantFrom("red", "0", "10px", "flex", "auto");
  const arbStyles = fc.dictionary(arbStyleKey, arbStyleVal, { minKeys: 1, maxKeys: 3 });
  const arbText = fc.string({ minLength: 0, maxLength: 50 }).filter(s => /^[\x20-\x7e]*$/.test(s));

  const arbCommand: fc.Arbitrary<RenderCommand> = arbOp.chain((op) => {
    switch (op) {
      case RenderOp.Create:
        return fc.tuple(fc.nat({ max: 10000 }), arbTag, fc.nat({ max: 10000 }), fc.nat({ max: 100 }))
          .map(([nodeId, tag, parentId, siblingIndex]) => ({
            op, nodeId, tag, parentId, siblingIndex,
          }));
      case RenderOp.Destroy:
        return fc.nat({ max: 10000 }).map((nodeId) => ({ op, nodeId }));
      case RenderOp.UpdateLayout:
        return fc.tuple(
          fc.nat({ max: 10000 }),
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: -1000, max: 1000, noNaN: true }),
          fc.float({ min: 0, max: 2000, noNaN: true }),
          fc.float({ min: 0, max: 2000, noNaN: true }),
        ).map(([nodeId, x, y, width, height]) => ({ op, nodeId, x, y, width, height }));
      case RenderOp.UpdateStyle:
        return fc.tuple(fc.nat({ max: 10000 }), arbStyles)
          .map(([nodeId, styles]) => ({ op, nodeId, styles }));
      case RenderOp.UpdateText:
        return fc.tuple(fc.nat({ max: 10000 }), arbText)
          .map(([nodeId, text]) => ({ op, nodeId, text }));
      case RenderOp.Reparent:
        return fc.tuple(fc.nat({ max: 10000 }), fc.nat({ max: 10000 }), fc.nat({ max: 100 }))
          .map(([nodeId, parentId, siblingIndex]) => ({ op, nodeId, parentId, siblingIndex }));
      default:
        return fc.constant({ op, nodeId: 0 });
    }
  });

  it("typed array serialization round-trips correctly", () => {
    fc.assert(
      fc.property(
        fc.array(arbCommand, { minLength: 0, maxLength: 10 }),
        (commands) => {
          const buf = new RenderCommandBuffer();
          for (const cmd of commands) buf.push(cmd);

          const result = deserializeTypedArray(buf.toTypedArray());
          expect(result).toHaveLength(commands.length);

          for (let i = 0; i < commands.length; i++) {
            expect(result[i].op).toBe(commands[i].op);
            expect(result[i].nodeId).toBe(commands[i].nodeId);
            if (commands[i].tag !== undefined) expect(result[i].tag).toBe(commands[i].tag);
            if (commands[i].parentId !== undefined) expect(result[i].parentId).toBe(commands[i].parentId);
            if (commands[i].siblingIndex !== undefined) expect(result[i].siblingIndex).toBe(commands[i].siblingIndex);
            if (commands[i].x !== undefined) {
              expect(result[i].x).toBeCloseTo(commands[i].x!, 1);
              expect(result[i].y).toBeCloseTo(commands[i].y!, 1);
              expect(result[i].width).toBeCloseTo(commands[i].width!, 1);
              expect(result[i].height).toBeCloseTo(commands[i].height!, 1);
            }
            if (commands[i].styles !== undefined) expect(result[i].styles).toEqual(commands[i].styles);
            if (commands[i].text !== undefined) expect(result[i].text).toBe(commands[i].text);
          }
        },
      ),
      { numRuns: 100 },
    );
  });

  it("JSON serialization round-trips correctly", () => {
    fc.assert(
      fc.property(
        fc.array(arbCommand, { minLength: 0, maxLength: 10 }),
        (commands) => {
          const buf = new RenderCommandBuffer();
          for (const cmd of commands) buf.push(cmd);

          const result = deserializeJSON(buf.toJSON());
          expect(result).toHaveLength(commands.length);

          for (let i = 0; i < commands.length; i++) {
            expect(result[i].op).toBe(commands[i].op);
            expect(result[i].nodeId).toBe(commands[i].nodeId);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
