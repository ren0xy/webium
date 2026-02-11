import type { VirtualNode } from "../dom/virtual-node.js";
import type { DOMEvent, EventListenerEntry } from "./types.js";
import { EventPhase } from "./types.js";

/**
 * Logger interface for the event system.
 */
export interface ILogger {
  logWarning(message: string): void;
  logException(error: unknown): void;
}

/**
 * Dispatches events through capture → target → bubble phases.
 * Ported from C# EventDispatcher.cs
 *
 * @see Requirements 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7
 */
export interface IEventDispatcher {
  dispatchEvent(target: VirtualNode, event: DOMEvent): boolean;
}

export class EventDispatcher implements IEventDispatcher {
  private readonly _logger: ILogger | null;

  constructor(logger?: ILogger | null) {
    this._logger = logger ?? null;
  }

  dispatchEvent(target: VirtualNode, evt: DOMEvent): boolean {
    if (!target) throw new Error("target is required");
    if (!evt) throw new Error("event is required");

    evt.target = target;

    // Build propagation path: root → ... → target's parent (excludes target)
    const path = this._buildPath(target);

    // Capture phase
    evt.eventPhase = EventPhase.Capturing;
    for (let i = 0; i < path.length; i++) {
      evt.currentTarget = path[i];
      this._invokeListeners(path[i], evt, true, false);
      if (evt.isPropagationStopped) {
        this._cleanup(evt);
        return !evt.defaultPrevented;
      }
    }

    // Target phase — invoke all listeners (capture + bubble)
    evt.eventPhase = EventPhase.AtTarget;
    evt.currentTarget = target;
    this._invokeListeners(target, evt, false, false);
    if (evt.isPropagationStopped) {
      this._cleanup(evt);
      return !evt.defaultPrevented;
    }

    // Bubble phase (only if event bubbles)
    if (evt.bubbles) {
      evt.eventPhase = EventPhase.Bubbling;
      for (let i = path.length - 1; i >= 0; i--) {
        evt.currentTarget = path[i];
        this._invokeListeners(path[i], evt, false, true);
        if (evt.isPropagationStopped) break;
      }
    }

    this._cleanup(evt);
    return !evt.defaultPrevented;
  }

  private _buildPath(target: VirtualNode): VirtualNode[] {
    const path: VirtualNode[] = [];
    let node = target.parent;
    while (node !== null) {
      path.push(node);
      node = node.parent;
    }
    path.reverse(); // root-first order
    return path;
  }

  private _invokeListeners(
    node: VirtualNode,
    evt: DOMEvent,
    captureOnly: boolean,
    bubbleOnly: boolean,
  ): void {
    const listeners: ReadonlyArray<EventListenerEntry> =
      node.eventListeners.getListeners(evt.type);

    // Snapshot the listeners array to avoid issues if listeners are
    // added/removed during dispatch
    const snapshot = [...listeners];

    for (const entry of snapshot) {
      if (captureOnly && !entry.useCapture) continue;
      if (bubbleOnly && entry.useCapture) continue;

      try {
        entry.listener(evt);
      } catch (ex) {
        this._logger?.logException(ex);
      }

      if (evt.isImmediatePropagationStopped) return;
    }
  }

  private _cleanup(evt: DOMEvent): void {
    evt.currentTarget = null;
    evt.eventPhase = EventPhase.None;
  }
}
