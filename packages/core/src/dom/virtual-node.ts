import { NodeTag, DirtyFlags, PseudoStates } from "./types.js";
import { EventListenerStore } from "../events/event-listener-store.js";
import type { EventCallback } from "../events/types.js";

/**
 * A node in the virtual DOM tree.
 *
 * Contains id, tag, parent/children relationships, attributes, inline styles,
 * text content, pseudo states, computed style, dirty flags, pool membership,
 * and lazily-initialized event listeners.
 *
 * @see Requirements 1.1
 */
export class VirtualNode {
  id: number = 0;
  tag: NodeTag = NodeTag.Unknown;
  parent: VirtualNode | null = null;
  children: VirtualNode[] = [];
  attributes: Map<string, string> = new Map();
  inlineStyles: Map<string, string> = new Map();
  textContent: string | null = null;
  pseudoStates: PseudoStates = PseudoStates.None;
  computedStyle: Map<string, string> | null = null;
  dirty: DirtyFlags = DirtyFlags.None;
  inPool: boolean = false;

  private _eventListeners: EventListenerStore | null = null;

  /** Lazily creates the EventListenerStore on first access. */
  get eventListeners(): EventListenerStore {
    if (!this._eventListeners) {
      this._eventListeners = new EventListenerStore();
    }
    return this._eventListeners;
  }

  /** Bitwise-OR the given flags into the node's dirty flags. */
  markDirty(flags: DirtyFlags): void {
    this.dirty |= flags;
  }

  /** Reset all fields to default values (used by NodePool on return). */
  reset(): void {
    this.id = 0;
    this.tag = NodeTag.Unknown;
    this.parent = null;
    this.children.length = 0;
    this.dirty = DirtyFlags.None;
    this.attributes.clear();
    this.inlineStyles.clear();
    this.textContent = null;
    this.pseudoStates = PseudoStates.None;
    this.computedStyle = null;
    this.inPool = false;
    this._eventListeners?.clear();
    this._eventListeners = null;
  }

  addEventListener(
    type: string,
    listener: EventCallback,
    useCapture: boolean = false,
  ): void {
    this.eventListeners.add(type, listener, useCapture);
  }

  removeEventListener(
    type: string,
    listener: EventCallback,
    useCapture: boolean = false,
  ): void {
    this.eventListeners.remove(type, listener, useCapture);
  }
}
