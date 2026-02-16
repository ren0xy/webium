import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { InputEventHandler } from "../../src/bridge/input-event.js";
import { createHandleInputEvent } from "../../src/bridge/handle-input-event.js";
import type { DOMEvent } from "../../src/events/types.js";

/**
 * Property 1: handleInputEvent full chain — JSON to listener invocation
 *
 * For any valid InputEvent object (with a type from the supported set and a
 * targetNodeId matching an existing node that has a listener for that event
 * type), serializing the event to JSON, passing it to handleInputEvent, should
 * result in the listener on the target node being invoked with a DOMEvent whose
 * type matches the original event type and whose target is the correct node.
 *
 * **Validates: Requirements 1.1, 1.3**
 */
describe("Feature: event-round-trip, Property 1: handleInputEvent full chain", () => {
  // Supported event types as defined in the spec
  const arbSupportedEventType = fc.constantFrom(
    "click", "pointerdown", "pointerup", "pointermove", "focus", "blur",
  );

  // Generator for optional pointer fields
  const arbPointerFields = fc.record({
    clientX: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true }), { nil: undefined }),
    clientY: fc.option(fc.double({ min: -1000, max: 1000, noNaN: true }), { nil: undefined }),
    button: fc.option(fc.integer({ min: 0, max: 4 }), { nil: undefined }),
    pointerId: fc.option(fc.integer({ min: 0, max: 100 }), { nil: undefined }),
  });

  // Number of child nodes to create in the DOM (1-5)
  const arbChildCount = fc.integer({ min: 1, max: 5 });

  it("JSON-serialized InputEvent dispatches to the correct listener with matching type and target", () => {
    fc.assert(
      fc.property(
        arbSupportedEventType,
        arbPointerFields,
        arbChildCount,
        (eventType, pointerFields, childCount) => {
          // 1. Build a VirtualDOM with child nodes
          const dom = new VirtualDOM();
          const nodes = [];
          for (let i = 0; i < childCount; i++) {
            const node = dom.createElement(NodeTag.Div);
            dom.appendChild(dom.root, node);
            nodes.push(node);
          }

          // 2. Pick a random target node (use last node — deterministic per run)
          const targetIndex = childCount - 1;
          const targetNode = nodes[targetIndex];

          // 3. Set up dispatcher and handler
          const dispatcher = new EventDispatcher();
          const handler = new InputEventHandler(dom, dispatcher);
          const handleInputEvent = createHandleInputEvent(handler);

          // 4. Attach a spy listener on the target node for the event type
          const receivedEvents: DOMEvent[] = [];
          const listener = (evt: DOMEvent) => { receivedEvents.push(evt); };
          targetNode.addEventListener(eventType, listener);

          // 5. Build the InputEvent and serialize to JSON
          const inputEvent: Record<string, unknown> = {
            type: eventType,
            targetNodeId: targetNode.id,
          };
          if (pointerFields.clientX !== undefined) inputEvent.clientX = pointerFields.clientX;
          if (pointerFields.clientY !== undefined) inputEvent.clientY = pointerFields.clientY;
          if (pointerFields.button !== undefined) inputEvent.button = pointerFields.button;
          if (pointerFields.pointerId !== undefined) inputEvent.pointerId = pointerFields.pointerId;

          const json = JSON.stringify(inputEvent);

          // 6. Pass through handleInputEvent
          handleInputEvent(json);

          // 7. Verify listener was invoked exactly once
          expect(receivedEvents).toHaveLength(1);

          // 8. Verify the DOMEvent has the correct type
          expect(receivedEvents[0].type).toBe(eventType);

          // 9. Verify the DOMEvent target is the correct node
          expect(receivedEvents[0].target).toBe(targetNode);
        },
      ),
      { numRuns: 100 },
    );
  });
});
