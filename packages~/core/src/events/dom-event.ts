import { EventPhase } from "./types.js";
import type { DOMEvent as IDOMEvent, IVirtualNode } from "./types.js";

/**
 * Concrete DOMEvent implementation.
 * Ported from C# DOMEvent.cs
 *
 * @see Requirements 5.1
 */
export class DOMEventImpl implements IDOMEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly timeStamp: number;
  target: IVirtualNode | null = null;
  currentTarget: IVirtualNode | null = null;
  eventPhase: EventPhase = EventPhase.None;
  isPropagationStopped = false;
  isImmediatePropagationStopped = false;
  defaultPrevented = false;

  constructor(type: string, bubbles = false, cancelable = false) {
    this.type = type;
    this.bubbles = bubbles;
    this.cancelable = cancelable;
    this.timeStamp = typeof performance !== "undefined" ? performance.now() : Date.now();
  }

  stopPropagation(): void {
    this.isPropagationStopped = true;
  }

  stopImmediatePropagation(): void {
    this.isPropagationStopped = true;
    this.isImmediatePropagationStopped = true;
  }

  preventDefault(): void {
    if (this.cancelable) this.defaultPrevented = true;
  }
}

/**
 * Pointer event — extends DOMEvent with pointer-specific fields.
 * Ported from C# PointerEvent.cs
 */
export class PointerEvent extends DOMEventImpl {
  readonly clientX: number;
  readonly clientY: number;
  readonly button: number;
  readonly pointerId: number;

  constructor(
    type: string,
    clientX: number,
    clientY: number,
    button: number,
    pointerId: number,
  ) {
    super(type, PointerEvent._isBubbling(type), PointerEvent._isCancelable(type));
    this.clientX = clientX;
    this.clientY = clientY;
    this.button = button;
    this.pointerId = pointerId;
  }

  private static _isBubbling(type: string): boolean {
    return type === "click" || type === "pointerdown" ||
           type === "pointerup" || type === "pointermove";
  }

  private static _isCancelable(type: string): boolean {
    return type === "click" || type === "pointerdown" ||
           type === "pointerup" || type === "pointermove";
  }
}

/**
 * Focus event — extends DOMEvent with relatedTarget.
 * Ported from C# FocusEvent.cs
 */
export class FocusEvent extends DOMEventImpl {
  readonly relatedTarget: IVirtualNode | null;

  constructor(type: string, relatedTarget: IVirtualNode | null = null) {
    super(type, FocusEvent._isBubbling(type), false);
    this.relatedTarget = relatedTarget;
  }

  private static _isBubbling(type: string): boolean {
    return type === "focusin" || type === "focusout";
  }
}
