/**
 * Event system types — forward declarations for use by VirtualNode
 * before the full event system is implemented.
 */

/** Callback type for event listeners. */
export type EventCallback = (event: DOMEvent) => void;

/** Minimal DOMEvent interface for forward reference. */
export interface DOMEvent {
  readonly type: string;
  readonly bubbles: boolean;
  readonly cancelable: boolean;
  readonly timeStamp: number;
  target: IVirtualNode | null;
  currentTarget: IVirtualNode | null;
  eventPhase: EventPhase;
  isPropagationStopped: boolean;
  isImmediatePropagationStopped: boolean;
  defaultPrevented: boolean;
  stopPropagation(): void;
  stopImmediatePropagation(): void;
  preventDefault(): void;
}

export enum EventPhase {
  None = 0,
  Capturing = 1,
  AtTarget = 2,
  Bubbling = 3,
}

/** Forward reference — avoids circular dependency with VirtualNode. */
export interface IVirtualNode {
  id: number;
  tag: number;
  parent: IVirtualNode | null;
  children: IVirtualNode[];
}

/** Entry stored per listener in EventListenerStore. */
export interface EventListenerEntry {
  listener: EventCallback;
  useCapture: boolean;
}
