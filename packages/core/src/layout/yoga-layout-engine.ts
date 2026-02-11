import Yoga, { type Node as YogaNode, Edge, FlexDirection, Align, Justify, PositionType, Wrap, Display, Overflow } from "yoga-layout";
import type { VirtualNode } from "../dom/virtual-node.js";

/**
 * Layout result for a single node.
 */
export interface LayoutResult {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Wraps yoga-layout WASM bindings. Maintains a Yoga node tree
 * mirroring the VirtualDOM tree structure.
 *
 * @see Requirements 4.1, 4.2, 4.3, 4.4
 */
export interface ILayoutEngine {
  createYogaNode(virtualNode: VirtualNode): void;
  destroyYogaNode(virtualNode: VirtualNode): void;
  syncStyles(virtualNode: VirtualNode): void;
  appendChild(parent: VirtualNode, child: VirtualNode): void;
  removeChild(parent: VirtualNode, child: VirtualNode): void;
  insertChild(parent: VirtualNode, child: VirtualNode, index: number): void;
  computeLayout(rootNode: VirtualNode, width?: number, height?: number): void;
  getLayout(virtualNode: VirtualNode): LayoutResult | null;
}

/** Map of CSS property names to yoga style setters */
const STYLE_SETTERS: Record<string, (yogaNode: YogaNode, value: string) => void> = {
  "width": (n, v) => n.setWidth(parseDimension(v)),
  "height": (n, v) => n.setHeight(parseDimension(v)),
  "min-width": (n, v) => n.setMinWidth(parseDimension(v)),
  "min-height": (n, v) => n.setMinHeight(parseDimension(v)),
  "max-width": (n, v) => n.setMaxWidth(parseDimension(v)),
  "max-height": (n, v) => n.setMaxHeight(parseDimension(v)),
  "flex-grow": (n, v) => n.setFlexGrow(parseFloat(v) || 0),
  "flex-shrink": (n, v) => n.setFlexShrink(parseFloat(v) || 0),
  "flex-basis": (n, v) => n.setFlexBasis(parseDimension(v)),
  "flex-direction": (n, v) => n.setFlexDirection(parseFlexDirection(v)),
  "justify-content": (n, v) => n.setJustifyContent(parseJustify(v)),
  "align-items": (n, v) => n.setAlignItems(parseAlign(v)),
  "align-self": (n, v) => n.setAlignSelf(parseAlign(v)),
  "align-content": (n, v) => n.setAlignContent(parseAlign(v)),
  "flex-wrap": (n, v) => n.setFlexWrap(parseWrap(v)),
  "position": (n, v) => n.setPositionType(parsePositionType(v)),
  "display": (n, v) => n.setDisplay(parseDisplay(v)),
  "overflow": (n, v) => n.setOverflow(parseOverflow(v)),
  "margin-top": (n, v) => n.setMargin(Edge.Top, parseDimension(v)),
  "margin-right": (n, v) => n.setMargin(Edge.Right, parseDimension(v)),
  "margin-bottom": (n, v) => n.setMargin(Edge.Bottom, parseDimension(v)),
  "margin-left": (n, v) => n.setMargin(Edge.Left, parseDimension(v)),
  "padding-top": (n, v) => n.setPadding(Edge.Top, parseDimension(v)),
  "padding-right": (n, v) => n.setPadding(Edge.Right, parseDimension(v)),
  "padding-bottom": (n, v) => n.setPadding(Edge.Bottom, parseDimension(v)),
  "padding-left": (n, v) => n.setPadding(Edge.Left, parseDimension(v)),
};

export class YogaLayoutEngine implements ILayoutEngine {
  private readonly _yogaNodes = new Map<number, YogaNode>();

  createYogaNode(virtualNode: VirtualNode): void {
    if (this._yogaNodes.has(virtualNode.id)) return;
    const yogaNode = Yoga.Node.create();
    this._yogaNodes.set(virtualNode.id, yogaNode);
  }

  destroyYogaNode(virtualNode: VirtualNode): void {
    const yogaNode = this._yogaNodes.get(virtualNode.id);
    if (!yogaNode) return;
    yogaNode.free();
    this._yogaNodes.delete(virtualNode.id);
  }

  syncStyles(virtualNode: VirtualNode): void {
    const yogaNode = this._yogaNodes.get(virtualNode.id);
    if (!yogaNode || !virtualNode.computedStyle) return;

    for (const [prop, value] of virtualNode.computedStyle) {
      const setter = STYLE_SETTERS[prop];
      if (setter) {
        try {
          setter(yogaNode, value);
        } catch {
          // Skip unsupported values silently
        }
      }
    }
  }

  appendChild(parent: VirtualNode, child: VirtualNode): void {
    const parentYoga = this._yogaNodes.get(parent.id);
    const childYoga = this._yogaNodes.get(child.id);
    if (!parentYoga || !childYoga) return;
    parentYoga.insertChild(childYoga, parentYoga.getChildCount());
  }

  removeChild(parent: VirtualNode, child: VirtualNode): void {
    const parentYoga = this._yogaNodes.get(parent.id);
    const childYoga = this._yogaNodes.get(child.id);
    if (!parentYoga || !childYoga) return;
    parentYoga.removeChild(childYoga);
  }

  insertChild(parent: VirtualNode, child: VirtualNode, index: number): void {
    const parentYoga = this._yogaNodes.get(parent.id);
    const childYoga = this._yogaNodes.get(child.id);
    if (!parentYoga || !childYoga) return;
    parentYoga.insertChild(childYoga, index);
  }

  computeLayout(rootNode: VirtualNode, width?: number, height?: number): void {
    const yogaRoot = this._yogaNodes.get(rootNode.id);
    if (!yogaRoot) return;
    yogaRoot.calculateLayout(width ?? "auto", height ?? "auto");
  }

  getLayout(virtualNode: VirtualNode): LayoutResult | null {
    const yogaNode = this._yogaNodes.get(virtualNode.id);
    if (!yogaNode) return null;
    const layout = yogaNode.getComputedLayout();
    return {
      x: layout.left,
      y: layout.top,
      width: layout.width,
      height: layout.height,
    };
  }
}

function parseDimension(value: string): number | "auto" | `${number}%` | undefined {
  if (value === "auto") return "auto";
  if (value.endsWith("%")) return value as `${number}%`;
  const num = parseFloat(value);
  return isNaN(num) ? undefined : num;
}

function parseFlexDirection(value: string): FlexDirection {
  switch (value) {
    case "row": return FlexDirection.Row;
    case "row-reverse": return FlexDirection.RowReverse;
    case "column-reverse": return FlexDirection.ColumnReverse;
    default: return FlexDirection.Column;
  }
}

function parseJustify(value: string): Justify {
  switch (value) {
    case "flex-start": return Justify.FlexStart;
    case "center": return Justify.Center;
    case "flex-end": return Justify.FlexEnd;
    case "space-between": return Justify.SpaceBetween;
    case "space-around": return Justify.SpaceAround;
    case "space-evenly": return Justify.SpaceEvenly;
    default: return Justify.FlexStart;
  }
}

function parseAlign(value: string): Align {
  switch (value) {
    case "flex-start": return Align.FlexStart;
    case "center": return Align.Center;
    case "flex-end": return Align.FlexEnd;
    case "stretch": return Align.Stretch;
    case "baseline": return Align.Baseline;
    case "space-between": return Align.SpaceBetween;
    case "space-around": return Align.SpaceAround;
    default: return Align.Auto;
  }
}

function parseWrap(value: string): Wrap {
  switch (value) {
    case "wrap": return Wrap.Wrap;
    case "wrap-reverse": return Wrap.WrapReverse;
    default: return Wrap.NoWrap;
  }
}

function parsePositionType(value: string): PositionType {
  switch (value) {
    case "absolute": return PositionType.Absolute;
    default: return PositionType.Relative;
  }
}

function parseDisplay(value: string): Display {
  switch (value) {
    case "none": return Display.None;
    default: return Display.Flex;
  }
}

function parseOverflow(value: string): Overflow {
  switch (value) {
    case "hidden": return Overflow.Hidden;
    case "scroll": return Overflow.Scroll;
    default: return Overflow.Visible;
  }
}
