import { describe, it, expect } from "vitest";
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
 * Integration test: full round-trip from click event to UpdateText render command.
 *
 * Validates: Requirements 5.1, 5.2
 */
describe("End-to-end integration: click → listener → textContent → tick → UpdateText", () => {
  const stubStyleResolver: IComputedStyleResolver = {
    resolveTree: () => {},
    resolveNode: () => new Map(),
  };

  it("click event on a button node produces an UpdateText render command after tick", () => {
    // 1. Create a VirtualDOM with a button node
    const dom = new VirtualDOM();
    const buttonNode = dom.createElement(NodeTag.Button);
    dom.appendChild(dom.root, buttonNode);

    // 2. Wire up EventDispatcher, InputEventHandler, createHandleInputEvent, ReconciliationEngine
    const dispatcher = new EventDispatcher();
    const handler = new InputEventHandler(dom, dispatcher);
    const handleInputEvent = createHandleInputEvent(handler);
    const stylesheetManager = new StyleSheetManager();
    const reconciliation = new ReconciliationEngine(
      dom, stubStyleResolver, stylesheetManager, null, null,
    );

    // 3. Drain initial dirty nodes from createElement/appendChild
    reconciliation.tick();

    // 4. Attach a click listener that sets textContent = "clicked"
    buttonNode.addEventListener("click", () => {
      buttonNode.textContent = "clicked";
      buttonNode.markDirty(DirtyFlags.Text);
      dom.dirtyQueue.enqueue(buttonNode);
    });

    // 5. Simulate a click event via handleInputEvent
    handleInputEvent(JSON.stringify({
      type: "click",
      targetNodeId: buttonNode.id,
      clientX: 100,
      clientY: 200,
      button: 0,
      pointerId: 1,
    }));

    // 6. Tick to produce render commands
    const buffer = reconciliation.tick();

    // 7. Verify the RenderCommandBuffer contains an UpdateText command
    const updateTextCmd = buffer.commands.find(
      (c) => c.op === RenderOp.UpdateText && c.nodeId === buttonNode.id,
    );
    expect(updateTextCmd).toBeDefined();
    expect(updateTextCmd!.text).toBe("clicked");
  });
});
