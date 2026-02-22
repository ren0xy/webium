import type { VirtualNode } from "../dom/virtual-node.js";
import type { VirtualDOM } from "../dom/virtual-dom.js";
import { EventDispatcher, type ILogger } from "../events/event-dispatcher.js";
import { DOMEventImpl, PointerEvent, FocusEvent } from "../events/dom-event.js";

/**
 * Serialized input event forwarded from the native bridge.
 * @see Requirements 7.1
 */
export interface InputEvent {
  type: string;
  targetNodeId: number;
  clientX?: number;
  clientY?: number;
  button?: number;
  pointerId?: number;
  relatedTargetId?: number;
}

/**
 * Handles incoming InputEvents by looking up the target node
 * and dispatching through the EventDispatcher.
 *
 * @see Requirements 7.2, 7.3
 */
export class InputEventHandler {
  private readonly _dom: VirtualDOM;
  private readonly _dispatcher: EventDispatcher;
  private readonly _logger: ILogger | null;

  constructor(dom: VirtualDOM, dispatcher: EventDispatcher, logger?: ILogger | null) {
    this._dom = dom;
    this._dispatcher = dispatcher;
    this._logger = logger ?? null;
  }

  handleEvent(evt: InputEvent): boolean {
    const target = this._dom.getNodeById(evt.targetNodeId);
    if (!target) {
      this._logger?.logWarning(
        `InputEvent "${evt.type}" targets unknown nodeId ${evt.targetNodeId}, ignoring.`,
      );
      return true;
    }

    const domEvent = this._createDOMEvent(evt, target);
    return this._dispatcher.dispatchEvent(target, domEvent);
  }

  private _createDOMEvent(evt: InputEvent, target: VirtualNode): DOMEventImpl {
    const type = evt.type;

    // Pointer events
    if (
      type === "click" || type === "pointerdown" ||
      type === "pointerup" || type === "pointermove"
    ) {
      return new PointerEvent(
        type,
        evt.clientX ?? 0,
        evt.clientY ?? 0,
        evt.button ?? 0,
        evt.pointerId ?? 0,
      );
    }

    // Focus events
    if (
      type === "focus" || type === "blur" ||
      type === "focusin" || type === "focusout"
    ) {
      let relatedTarget: VirtualNode | null = null;
      if (evt.relatedTargetId !== undefined) {
        relatedTarget = this._dom.getNodeById(evt.relatedTargetId);
      }
      return new FocusEvent(type, relatedTarget);
    }

    // Generic event
    return new DOMEventImpl(type);
  }
}
