import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";
import { ReconciliationEngine } from "../../src/reconciliation/reconciliation-engine.js";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { ComputedStyleResolver } from "../../src/css/computed-style-resolver.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { NodeTag, DirtyFlags } from "../../src/dom/types.js";
import { RenderOp } from "../../src/bridge/render-command.js";

function setup() {
  const dom = new VirtualDOM();
  const styleResolver = new ComputedStyleResolver();
  const styleSheetManager = new StyleSheetManager();
  const logger = { logWarning: vi.fn(), logException: vi.fn() };
  const engine = new ReconciliationEngine(
    dom, styleResolver, styleSheetManager, null, logger,
  );
  return { dom, styleResolver, styleSheetManager, engine, logger };
}

describe("ReconciliationEngine", () => {
  it("returns empty buffer when dirty queue is empty", () => {
    const { engine } = setup();
    const buf = engine.tick();
    expect(buf.length).toBe(0);
  });

  it("clears dirty flags on processed nodes", () => {
    const { dom, engine } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    // Node should be dirty after appendChild
    expect(node.dirty).not.toBe(DirtyFlags.None);

    engine.tick();
    expect(node.dirty).toBe(DirtyFlags.None);
  });

  it("emits Create command for newly created nodes", () => {
    const { dom, engine } = setup();
    const node = dom.createElement(NodeTag.Div);
    engine.markCreated(node.id);
    dom.appendChild(dom.root, node);

    const buf = engine.tick();
    const createCmd = buf.commands.find(
      (c) => c.op === RenderOp.Create && c.nodeId === node.id,
    );
    expect(createCmd).toBeDefined();
    expect(createCmd!.tag).toBe(NodeTag.Div);
  });

  it("emits UpdateText command when text changes", () => {
    const { dom, engine } = setup();
    const node = dom.createTextNode("hello");
    dom.appendChild(dom.root, node);
    engine.tick(); // Process initial

    node.textContent = "world";
    node.markDirty(DirtyFlags.Text);
    dom.dirtyQueue.enqueue(node);

    const buf = engine.tick();
    const textCmd = buf.commands.find(
      (c) => c.op === RenderOp.UpdateText && c.nodeId === node.id,
    );
    expect(textCmd).toBeDefined();
    expect(textCmd!.text).toBe("world");
  });

  it("emits UpdateStyle command when style changes", () => {
    const { dom, engine } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    engine.tick(); // Process initial

    node.markDirty(DirtyFlags.Style);
    dom.dirtyQueue.enqueue(node);

    const buf = engine.tick();
    // Should have style commands since computed style was resolved
    const styleCmd = buf.commands.find(
      (c) => c.op === RenderOp.UpdateStyle && c.nodeId === node.id,
    );
    // Style commands are emitted when computed style differs from previous
    expect(styleCmd).toBeDefined();
  });

  it("catches and logs errors during style resolution", () => {
    const dom = new VirtualDOM();
    const badResolver = {
      resolveTree: () => { throw new Error("style error"); },
      resolveNode: () => new Map(),
    };
    const styleSheetManager = new StyleSheetManager();
    const logger = { logWarning: vi.fn(), logException: vi.fn() };
    const engine = new ReconciliationEngine(
      dom, badResolver, styleSheetManager, null, logger,
    );

    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);

    engine.tick();
    expect(logger.logException).toHaveBeenCalled();
  });

  it("returns empty buffer on second tick with no new changes", () => {
    const { dom, engine } = setup();
    const node = dom.createElement(NodeTag.Div);
    dom.appendChild(dom.root, node);
    engine.tick();

    const buf2 = engine.tick();
    expect(buf2.length).toBe(0);
  });
});

// Feature: js-core-migration, Property 24: Reconciliation tick produces buffer and clears dirty flags
describe("Property 24: Reconciliation tick produces buffer and clears dirty flags", () => {
  it("tick produces non-empty buffer for dirty nodes and clears flags", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 5 }),
        (nodeCount) => {
          const { dom, engine } = setup();
          const nodes = [];

          for (let i = 0; i < nodeCount; i++) {
            const node = dom.createElement(NodeTag.Div);
            engine.markCreated(node.id);
            dom.appendChild(dom.root, node);
            nodes.push(node);
          }

          // All nodes should be dirty
          for (const n of nodes) {
            expect(n.dirty).not.toBe(DirtyFlags.None);
          }

          const buf = engine.tick();
          expect(buf.length).toBeGreaterThan(0);

          // All dirty flags should be cleared
          for (const n of nodes) {
            expect(n.dirty).toBe(DirtyFlags.None);
          }
        },
      ),
      { numRuns: 50 },
    );
  });
});

// Feature: js-core-migration, Property 19: DOM mutations produce correct render commands
describe("Property 19: DOM mutations produce correct render commands", () => {
  it("createElement + appendChild produces Create command", () => {
    fc.assert(
      fc.property(
        fc.constantFrom(NodeTag.Div, NodeTag.Span, NodeTag.P, NodeTag.Img),
        (tag) => {
          const { dom, engine } = setup();
          const node = dom.createElement(tag);
          engine.markCreated(node.id);
          dom.appendChild(dom.root, node);

          const buf = engine.tick();
          const createCmd = buf.commands.find(
            (c) => c.op === RenderOp.Create && c.nodeId === node.id,
          );
          expect(createCmd).toBeDefined();
          expect(createCmd!.tag).toBe(tag);
        },
      ),
      { numRuns: 50 },
    );
  });

  it("text content change produces UpdateText command", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 1, maxLength: 20 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (text1, text2) => {
          fc.pre(text1 !== text2);
          const { dom, engine } = setup();
          const node = dom.createTextNode(text1);
          dom.appendChild(dom.root, node);
          engine.tick(); // Process initial

          node.textContent = text2;
          node.markDirty(DirtyFlags.Text);
          dom.dirtyQueue.enqueue(node);

          const buf = engine.tick();
          const textCmd = buf.commands.find(
            (c) => c.op === RenderOp.UpdateText && c.nodeId === node.id,
          );
          expect(textCmd).toBeDefined();
          expect(textCmd!.text).toBe(text2);
        },
      ),
      { numRuns: 50 },
    );
  });
});
