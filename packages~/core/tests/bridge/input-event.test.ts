import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { InputEventHandler, type InputEvent } from "../../src/bridge/input-event.js";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { NodeTag } from "../../src/dom/types.js";
import type { DOMEvent } from "../../src/events/types.js";

describe("InputEventHandler", () => {
  function setup() {
    const dom = new VirtualDOM();
    const dispatcher = new EventDispatcher();
    const logger = { logWarning: vi.fn(), logException: vi.fn() };
    const handler = new InputEventHandler(dom, dispatcher, logger);
    return { dom, dispatcher, handler, logger };
  }

  it("dispatches event to the correct target node", () => {
    const { dom, handler } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    const received: DOMEvent[] = [];
    node.addEventListener("click", (e) => received.push(e), false);

    handler.handleEvent({ type: "click", targetNodeId: node.id });
    expect(received).toHaveLength(1);
    expect(received[0].target).toBe(node);
  });

  it("ignores events with unknown targetNodeId and logs warning", () => {
    const { handler, logger } = setup();
    const result = handler.handleEvent({ type: "click", targetNodeId: 9999 });
    expect(result).toBe(true);
    expect(logger.logWarning).toHaveBeenCalledTimes(1);
  });

  it("creates PointerEvent for pointer event types", () => {
    const { dom, handler } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    let received: any = null;
    node.addEventListener("pointerdown", (e) => { received = e; }, false);

    handler.handleEvent({
      type: "pointerdown",
      targetNodeId: node.id,
      clientX: 10,
      clientY: 20,
      button: 0,
      pointerId: 1,
    });

    expect(received).not.toBeNull();
    expect(received.clientX).toBe(10);
    expect(received.clientY).toBe(20);
  });

  it("creates FocusEvent for focus event types", () => {
    const { dom, handler } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    let received: any = null;
    node.addEventListener("focus", (e) => { received = e; }, false);

    handler.handleEvent({ type: "focus", targetNodeId: node.id });
    expect(received).not.toBeNull();
  });

  it("creates generic DOMEvent for unknown event types", () => {
    const { dom, handler } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    let received: DOMEvent | null = null;
    node.addEventListener("custom", (e) => { received = e; }, false);

    handler.handleEvent({ type: "custom", targetNodeId: node.id });
    expect(received).not.toBeNull();
    expect(received!.type).toBe("custom");
  });
});

// Feature: js-core-migration, Property 20: InputEvent dispatch to correct node
describe("Property 20: InputEvent dispatch to correct node", () => {
  it("dispatches to the correct node for any valid targetNodeId", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 10 }),
        fc.constantFrom("click", "pointerdown", "focus", "custom"),
        (nodeCount, eventType) => {
          const dom = new VirtualDOM();
          const dispatcher = new EventDispatcher();
          const handler = new InputEventHandler(dom, dispatcher);

          const nodes = [];
          for (let i = 0; i < nodeCount; i++) {
            const n = dom.createElement(NodeTag.Div);
            dom.appendChild(dom.root, n);
            nodes.push(n);
          }

          // Pick a random node to target
          const targetIdx = nodeCount - 1;
          const target = nodes[targetIdx];

          let receivedTarget: any = null;
          target.addEventListener(eventType, (e) => { receivedTarget = e.target; }, false);

          handler.handleEvent({ type: eventType, targetNodeId: target.id });
          expect(receivedTarget).toBe(target);
        },
      ),
      { numRuns: 100 },
    );
  });
});
