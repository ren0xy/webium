import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag, DirtyFlags } from "../../src/dom/types.js";
import { EventDispatcher } from "../../src/events/event-dispatcher.js";
import { InputEventHandler } from "../../src/bridge/input-event.js";
import { createHandleInputEvent } from "../../src/bridge/handle-input-event.js";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { RenderOp } from "../../src/bridge/render-command.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import type { IComputedStyleResolver } from "../../src/css/computed-style-resolver.js";

/**
 * Property 4: End-to-end event → mutation → render commands
 *
 * For any InputEvent targeting a node whose listener mutates the DOM
 * (e.g., sets textContent), calling handleInputEvent followed by
 * reconciliationEngine.tick() should produce a RenderCommandBuffer
 * containing the corresponding render command (e.g., UpdateText)
 * for the mutated node.
 *
 * **Validates: Requirements 5.1**
 */
describe("Feature: event-round-trip, Property 4: End-to-end event to render commands", () => {
  const arbEventType = fc.constantFrom("click", "pointerdown", "pointerup", "pointermove");
  const arbNewText = fc.string({ minLength: 1, maxLength: 20 });
  const arbChildCount = fc.integer({ min: 1, max: 5 });

  const stubStyleResolver: IComputedStyleResolver = {
    resolveTree: () => {},
    resolveNode: () => new Map(),
  };

  it("handleInputEvent → listener mutates textContent → tick() → UpdateText render command", () => {
    fc.assert(
      fc.property(arbEventType, arbNewText, arbChildCount, (eventType, newText, childCount) => {
        // 1. Set up VirtualDOM with child nodes
        const dom = new VirtualDOM();
        const nodes = [];
        for (let i = 0; i < childCount; i++) {
          const node = dom.createElement(NodeTag.Div);
          dom.appendChild(dom.root, node);
          nodes.push(node);
        }
        const targetNode = nodes[childCount - 1];

        // 2. Set up event system
        const dispatcher = new EventDispatcher();
        const handler = new InputEventHandler(dom, dispatcher);
        const handleInputEvent = createHandleInputEvent(handler);

        // 3. Set up reconciliation engine with stubs
        const stylesheetManager = new StyleSheetManager();
        const reconciliation = new ReconciliationEngine(
          dom, stubStyleResolver, stylesheetManager, null, null,
        );

        // 4. Drain initial dirty nodes from createElement/appendChild
        reconciliation.tick();

        // 5. Attach listener that mutates textContent and marks dirty
        targetNode.addEventListener(eventType, () => {
          targetNode.textContent = newText;
          targetNode.markDirty(DirtyFlags.Text);
          dom.dirtyQueue.enqueue(targetNode);
        });

        // 6. Fire the event via JSON bridge
        const json = JSON.stringify({
          type: eventType,
          targetNodeId: targetNode.id,
          clientX: 0,
          clientY: 0,
          button: 0,
          pointerId: 0,
        });
        handleInputEvent(json);

        // 7. Tick to produce render commands
        const buffer = reconciliation.tick();

        // 8. Verify UpdateText command exists for the target node
        const updateTextCmd = buffer.commands.find(
          (c) => c.op === RenderOp.UpdateText && c.nodeId === targetNode.id,
        );
        expect(updateTextCmd).toBeDefined();
        expect(updateTextCmd!.text).toBe(newText);
      }),
      { numRuns: 100 },
    );
  });
});
