import { describe, it, expect } from "vitest";
import { VirtualNode } from "../../src/dom/virtual-node.js";
import { NodeTag, DirtyFlags, PseudoStates } from "../../src/dom/types.js";

describe("VirtualNode", () => {
  it("has correct default field values", () => {
    const node = new VirtualNode();
    expect(node.id).toBe(0);
    expect(node.tag).toBe(NodeTag.Unknown);
    expect(node.parent).toBeNull();
    expect(node.children).toEqual([]);
    expect(node.attributes.size).toBe(0);
    expect(node.inlineStyles.size).toBe(0);
    expect(node.textContent).toBeNull();
    expect(node.pseudoStates).toBe(PseudoStates.None);
    expect(node.computedStyle).toBeNull();
    expect(node.dirty).toBe(DirtyFlags.None);
    expect(node.inPool).toBe(false);
  });

  describe("markDirty", () => {
    it("sets a single flag", () => {
      const node = new VirtualNode();
      node.markDirty(DirtyFlags.Tree);
      expect(node.dirty).toBe(DirtyFlags.Tree);
    });

    it("accumulates multiple flags via bitwise OR", () => {
      const node = new VirtualNode();
      node.markDirty(DirtyFlags.Tree);
      node.markDirty(DirtyFlags.Style);
      expect(node.dirty).toBe(DirtyFlags.Tree | DirtyFlags.Style);
    });

    it("is idempotent for the same flag", () => {
      const node = new VirtualNode();
      node.markDirty(DirtyFlags.Text);
      node.markDirty(DirtyFlags.Text);
      expect(node.dirty).toBe(DirtyFlags.Text);
    });

    it("supports DirtyFlags.All", () => {
      const node = new VirtualNode();
      node.markDirty(DirtyFlags.All);
      expect(node.dirty & DirtyFlags.Tree).toBeTruthy();
      expect(node.dirty & DirtyFlags.Style).toBeTruthy();
      expect(node.dirty & DirtyFlags.Attributes).toBeTruthy();
      expect(node.dirty & DirtyFlags.Text).toBeTruthy();
    });
  });

  describe("reset", () => {
    it("resets all fields to defaults", () => {
      const node = new VirtualNode();
      // Mutate every field
      node.id = 42;
      node.tag = NodeTag.Div;
      node.parent = new VirtualNode();
      node.children.push(new VirtualNode());
      node.attributes.set("class", "foo");
      node.inlineStyles.set("color", "red");
      node.textContent = "hello";
      node.pseudoStates = PseudoStates.Hover | PseudoStates.Focus;
      node.computedStyle = new Map([["color", "red"]]);
      node.dirty = DirtyFlags.All;
      node.inPool = true;
      // Access eventListeners to force lazy init, then add a listener
      node.addEventListener("click", () => {});

      node.reset();

      expect(node.id).toBe(0);
      expect(node.tag).toBe(NodeTag.Unknown);
      expect(node.parent).toBeNull();
      expect(node.children).toHaveLength(0);
      expect(node.attributes.size).toBe(0);
      expect(node.inlineStyles.size).toBe(0);
      expect(node.textContent).toBeNull();
      expect(node.pseudoStates).toBe(PseudoStates.None);
      expect(node.computedStyle).toBeNull();
      expect(node.dirty).toBe(DirtyFlags.None);
      expect(node.inPool).toBe(false);
    });

    it("clears event listeners and nullifies the store", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb);
      expect(node.eventListeners.getListeners("click")).toHaveLength(1);

      node.reset();

      // After reset, accessing eventListeners creates a fresh store
      expect(node.eventListeners.getListeners("click")).toHaveLength(0);
    });

    it("is safe to call when eventListeners were never accessed", () => {
      const node = new VirtualNode();
      // Should not throw even though _eventListeners is null
      expect(() => node.reset()).not.toThrow();
    });
  });

  describe("eventListeners (lazy initialization)", () => {
    it("creates EventListenerStore on first access", () => {
      const node = new VirtualNode();
      const store = node.eventListeners;
      expect(store).toBeDefined();
      // Same instance on subsequent access
      expect(node.eventListeners).toBe(store);
    });
  });

  describe("addEventListener / removeEventListener", () => {
    it("adds and retrieves a listener", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb);
      const listeners = node.eventListeners.getListeners("click");
      expect(listeners).toHaveLength(1);
      expect(listeners[0].listener).toBe(cb);
      expect(listeners[0].useCapture).toBe(false);
    });

    it("defaults useCapture to false", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb);
      expect(node.eventListeners.getListeners("click")[0].useCapture).toBe(false);
    });

    it("respects useCapture = true", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb, true);
      expect(node.eventListeners.getListeners("click")[0].useCapture).toBe(true);
    });

    it("removes a listener", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb);
      node.removeEventListener("click", cb);
      expect(node.eventListeners.getListeners("click")).toHaveLength(0);
    });

    it("removing a non-existent listener is a no-op", () => {
      const node = new VirtualNode();
      expect(() => node.removeEventListener("click", () => {})).not.toThrow();
    });

    it("duplicate add is a no-op", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb);
      node.addEventListener("click", cb);
      expect(node.eventListeners.getListeners("click")).toHaveLength(1);
    });

    it("same callback with different useCapture are separate entries", () => {
      const node = new VirtualNode();
      const cb = () => {};
      node.addEventListener("click", cb, false);
      node.addEventListener("click", cb, true);
      expect(node.eventListeners.getListeners("click")).toHaveLength(2);
    });
  });
});
