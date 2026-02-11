import { describe, it, expect } from "vitest";
import fc from "fast-check";
import { EventListenerStore } from "../../src/events/event-listener-store.js";
import type { EventCallback } from "../../src/events/types.js";

describe("EventListenerStore", () => {
  describe("add", () => {
    it("adds a listener for a new event type", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      const listeners = store.getListeners("click");
      expect(listeners).toHaveLength(1);
      expect(listeners[0].listener).toBe(cb);
      expect(listeners[0].useCapture).toBe(false);
    });

    it("adds multiple listeners for the same event type", () => {
      const store = new EventListenerStore();
      const cb1: EventCallback = () => {};
      const cb2: EventCallback = () => {};
      store.add("click", cb1, false);
      store.add("click", cb2, false);
      expect(store.getListeners("click")).toHaveLength(2);
    });

    it("adds listeners for different event types independently", () => {
      const store = new EventListenerStore();
      const cb1: EventCallback = () => {};
      const cb2: EventCallback = () => {};
      store.add("click", cb1, false);
      store.add("mousedown", cb2, false);
      expect(store.getListeners("click")).toHaveLength(1);
      expect(store.getListeners("mousedown")).toHaveLength(1);
    });

    it("treats same callback with different useCapture as separate entries", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.add("click", cb, true);
      const listeners = store.getListeners("click");
      expect(listeners).toHaveLength(2);
      expect(listeners[0].useCapture).toBe(false);
      expect(listeners[1].useCapture).toBe(true);
    });

    it("is a no-op when adding duplicate (same callback + same useCapture)", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.add("click", cb, false);
      expect(store.getListeners("click")).toHaveLength(1);
    });

    it("is a no-op for duplicate capture listeners", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, true);
      store.add("click", cb, true);
      expect(store.getListeners("click")).toHaveLength(1);
    });

    it("allows different callbacks with same useCapture", () => {
      const store = new EventListenerStore();
      const cb1: EventCallback = () => {};
      const cb2: EventCallback = () => {};
      store.add("click", cb1, true);
      store.add("click", cb2, true);
      expect(store.getListeners("click")).toHaveLength(2);
    });
  });

  describe("remove", () => {
    it("removes an existing listener", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.remove("click", cb, false);
      expect(store.getListeners("click")).toHaveLength(0);
    });

    it("is a no-op when removing from a non-existent event type", () => {
      const store = new EventListenerStore();
      expect(() => store.remove("click", () => {}, false)).not.toThrow();
    });

    it("is a no-op when removing a non-existent listener", () => {
      const store = new EventListenerStore();
      const cb1: EventCallback = () => {};
      const cb2: EventCallback = () => {};
      store.add("click", cb1, false);
      store.remove("click", cb2, false);
      expect(store.getListeners("click")).toHaveLength(1);
    });

    it("only removes the matching useCapture variant", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.add("click", cb, true);
      store.remove("click", cb, false);
      const listeners = store.getListeners("click");
      expect(listeners).toHaveLength(1);
      expect(listeners[0].useCapture).toBe(true);
    });

    it("does not affect other event types", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.add("mousedown", cb, false);
      store.remove("click", cb, false);
      expect(store.getListeners("click")).toHaveLength(0);
      expect(store.getListeners("mousedown")).toHaveLength(1);
    });
  });

  describe("getListeners", () => {
    it("returns empty array for unknown event type", () => {
      const store = new EventListenerStore();
      expect(store.getListeners("click")).toEqual([]);
    });

    it("returns listeners in insertion order", () => {
      const store = new EventListenerStore();
      const cb1: EventCallback = () => {};
      const cb2: EventCallback = () => {};
      const cb3: EventCallback = () => {};
      store.add("click", cb1, false);
      store.add("click", cb2, true);
      store.add("click", cb3, false);
      const listeners = store.getListeners("click");
      expect(listeners[0].listener).toBe(cb1);
      expect(listeners[1].listener).toBe(cb2);
      expect(listeners[2].listener).toBe(cb3);
    });
  });

  describe("clear", () => {
    it("removes all listeners for all event types", () => {
      const store = new EventListenerStore();
      store.add("click", () => {}, false);
      store.add("mousedown", () => {}, false);
      store.add("keyup", () => {}, true);
      store.clear();
      expect(store.getListeners("click")).toHaveLength(0);
      expect(store.getListeners("mousedown")).toHaveLength(0);
      expect(store.getListeners("keyup")).toHaveLength(0);
    });

    it("is safe to call on an empty store", () => {
      const store = new EventListenerStore();
      expect(() => store.clear()).not.toThrow();
    });

    it("allows adding listeners again after clear", () => {
      const store = new EventListenerStore();
      const cb: EventCallback = () => {};
      store.add("click", cb, false);
      store.clear();
      store.add("click", cb, false);
      expect(store.getListeners("click")).toHaveLength(1);
    });
  });
});


// Feature: js-core-migration, Property 17: EventListenerStore duplicate detection (idempotence)
describe("Property 17: EventListenerStore duplicate detection (idempotence)", () => {
  // **Validates: Requirements 5.8**

  const arbEventType = fc.string({ minLength: 1, maxLength: 12 }).filter(
    (s) => s.trim().length > 0,
  );

  it("adding the same listener multiple times results in getListeners returning it exactly once", () => {
    fc.assert(
      fc.property(
        arbEventType,
        fc.boolean(),
        fc.integer({ min: 2, max: 10 }),
        (eventType, useCapture, addCount) => {
          const store = new EventListenerStore();
          const cb: EventCallback = () => {};

          for (let i = 0; i < addCount; i++) {
            store.add(eventType, cb, useCapture);
          }

          const listeners = store.getListeners(eventType);
          expect(listeners).toHaveLength(1);
          expect(listeners[0].listener).toBe(cb);
          expect(listeners[0].useCapture).toBe(useCapture);
        },
      ),
      { numRuns: 100 },
    );
  });

  it("duplicate detection is per callback identity and useCapture combination", () => {
    fc.assert(
      fc.property(
        arbEventType,
        fc.integer({ min: 1, max: 5 }),
        fc.integer({ min: 1, max: 5 }),
        (eventType, repeatCount, addCount) => {
          const store = new EventListenerStore();
          // Create distinct callbacks
          const callbacks: EventCallback[] = [];
          for (let i = 0; i < addCount; i++) {
            callbacks.push(() => {});
          }

          // Add each callback multiple times with both capture variants
          for (let r = 0; r < repeatCount; r++) {
            for (const cb of callbacks) {
              store.add(eventType, cb, false);
              store.add(eventType, cb, true);
            }
          }

          const listeners = store.getListeners(eventType);
          // Each callback appears at most twice: once for capture, once for bubble
          expect(listeners).toHaveLength(addCount * 2);

          // Verify each callback+useCapture pair appears exactly once
          for (const cb of callbacks) {
            const matchesBubble = listeners.filter(
              (e) => e.listener === cb && e.useCapture === false,
            );
            const matchesCapture = listeners.filter(
              (e) => e.listener === cb && e.useCapture === true,
            );
            expect(matchesBubble).toHaveLength(1);
            expect(matchesCapture).toHaveLength(1);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
