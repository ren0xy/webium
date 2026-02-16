import { describe, it, expect, vi } from "vitest";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { InputEventHandler } from "../../src/bridge/input-event.js";
import { createHandleInputEvent } from "../../src/bridge/handle-input-event.js";
import type { ILogger } from "../../src/events/event-dispatcher.js";
import type { DOMEvent } from "../../src/events/types.js";

function createTestDeps(logger?: ILogger) {
  const dom = new VirtualDOM();
  const dispatcher = new EventDispatcher(logger);
  const handler = new InputEventHandler(dom, dispatcher, logger);
  const handleInputEvent = createHandleInputEvent(handler, logger);
  return { dom, dispatcher, handler, handleInputEvent };
}

describe("handleInputEvent", () => {
  describe("valid JSON for each event type", () => {
    const pointerTypes = ["click", "pointerdown", "pointerup", "pointermove"] as const;
    const focusTypes = ["focus", "blur"] as const;

    for (const type of pointerTypes) {
      it(`dispatches "${type}" to the target node listener`, () => {
        const { dom, handleInputEvent } = createTestDeps();
        const node = dom.createElement(NodeTag.Div);
        dom.appendChild(dom.root, node);

        const received: DOMEvent[] = [];
        node.addEventListener(type, (e) => received.push(e));

        handleInputEvent(JSON.stringify({
          type,
          targetNodeId: node.id,
          clientX: 10,
          clientY: 20,
          button: 0,
          pointerId: 1,
        }));

        expect(received).toHaveLength(1);
        expect(received[0].type).toBe(type);
        expect(received[0].target).toBe(node);
      });
    }

    for (const type of focusTypes) {
      it(`dispatches "${type}" to the target node listener`, () => {
        const { dom, handleInputEvent } = createTestDeps();
        const node = dom.createElement(NodeTag.Div);
        dom.appendChild(dom.root, node);

        const received: DOMEvent[] = [];
        node.addEventListener(type, (e) => received.push(e));

        handleInputEvent(JSON.stringify({
          type,
          targetNodeId: node.id,
        }));

        expect(received).toHaveLength(1);
        expect(received[0].type).toBe(type);
        expect(received[0].target).toBe(node);
      });
    }
  });

  describe("malformed JSON", () => {
    it("logs warning and does not throw", () => {
      const logger: ILogger = {
        logWarning: vi.fn(),
        logException: vi.fn(),
      };
      const { handleInputEvent } = createTestDeps(logger);

      expect(() => handleInputEvent("not valid json{{{")).not.toThrow();
      expect(logger.logWarning).toHaveBeenCalledOnce();
      expect((logger.logWarning as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
        "Failed to parse InputEvent JSON",
      );
    });
  });

  describe("unknown targetNodeId", () => {
    it("logs warning when node is not found", () => {
      const logger: ILogger = {
        logWarning: vi.fn(),
        logException: vi.fn(),
      };
      const { handleInputEvent } = createTestDeps(logger);

      handleInputEvent(JSON.stringify({
        type: "click",
        targetNodeId: 9999,
      }));

      expect(logger.logWarning).toHaveBeenCalledOnce();
      expect((logger.logWarning as ReturnType<typeof vi.fn>).mock.calls[0][0]).toContain(
        "unknown nodeId",
      );
    });
  });
});
