/**
 * Per-node store mapping event types to listener entries.
 * Supports duplicate detection: same callback + same useCapture = no-op on add.
 *
 * This is a minimal implementation. Task 3.1 will add property tests
 * and validate the full contract.
 */
import type { EventCallback, EventListenerEntry } from "./types.js";

export class EventListenerStore {
  private _listeners: Map<string, EventListenerEntry[]> = new Map();

  add(type: string, listener: EventCallback, useCapture: boolean): void {
    let entries = this._listeners.get(type);
    if (!entries) {
      entries = [];
      this._listeners.set(type, entries);
    }
    // Duplicate detection: same callback + same useCapture → no-op
    const duplicate = entries.some(
      (e) => e.listener === listener && e.useCapture === useCapture,
    );
    if (!duplicate) {
      entries.push({ listener, useCapture });
    }
  }

  remove(type: string, listener: EventCallback, useCapture: boolean): void {
    const entries = this._listeners.get(type);
    if (!entries) return;
    const idx = entries.findIndex(
      (e) => e.listener === listener && e.useCapture === useCapture,
    );
    if (idx !== -1) {
      entries.splice(idx, 1);
      if (entries.length === 0) {
        this._listeners.delete(type);
      }
    }
  }

  getListeners(type: string): ReadonlyArray<EventListenerEntry> {
    return this._listeners.get(type) ?? [];
  }

  clear(): void {
    this._listeners.clear();
  }
}
