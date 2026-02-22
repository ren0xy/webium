import Yoga, { type Node as YogaNode, type MeasureFunction, MeasureMode, Edge, FlexDirection, Align, Justify, PositionType, Wrap, Display, Overflow } from "yoga-layout";
import type { VirtualNode } from "../dom/virtual-node.js";
import { NodeTag } from "../dom/types.js";
import { measureText } from "../bridge/text-measure-bridge.js";

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
  collapseMargins(root: VirtualNode): void;
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
  "border-top-width": (n, v) => { const d = parseDimension(v); if (typeof d === "number") n.setBorder(Edge.Top, d); },
  "border-right-width": (n, v) => { const d = parseDimension(v); if (typeof d === "number") n.setBorder(Edge.Right, d); },
  "border-bottom-width": (n, v) => { const d = parseDimension(v); if (typeof d === "number") n.setBorder(Edge.Bottom, d); },
  "border-left-width": (n, v) => { const d = parseDimension(v); if (typeof d === "number") n.setBorder(Edge.Left, d); },
};

/** Tags that are inline-level by default in HTML and should not stretch. */
const INLINE_TAGS: ReadonlySet<NodeTag> = new Set([
  NodeTag.Button,
  NodeTag.Span,
  NodeTag.A,
  NodeTag.Img,
  NodeTag.Input,
]);

/** UA default font-sizes for heading elements (matches browser defaults). */
const HEADING_FONT_SIZES: ReadonlyMap<NodeTag, number> = new Map([
  [NodeTag.H1, 32],
  [NodeTag.H2, 24],
  [NodeTag.H3, 18.72],
  [NodeTag.H4, 16],
  [NodeTag.H5, 13.28],
  [NodeTag.H6, 10.72],
]);

export class YogaLayoutEngine implements ILayoutEngine {
  private readonly _yogaNodes = new Map<number, YogaNode>();
  private readonly _virtualNodes = new Map<number, VirtualNode>();

  createYogaNode(virtualNode: VirtualNode): void {
    if (this._yogaNodes.has(virtualNode.id)) return;
    const yogaNode = Yoga.Node.create();
    this._yogaNodes.set(virtualNode.id, yogaNode);
    this._virtualNodes.set(virtualNode.id, virtualNode);

    // Text leaf nodes need a measure function so Yoga knows their size
    if (virtualNode.tag === NodeTag.Text) {
      yogaNode.setMeasureFunc(this._createTextMeasureFunc(virtualNode));
    }
  }

  destroyYogaNode(virtualNode: VirtualNode): void {
    const yogaNode = this._yogaNodes.get(virtualNode.id);
    if (!yogaNode) return;
    yogaNode.free();
    this._yogaNodes.delete(virtualNode.id);
    this._virtualNodes.delete(virtualNode.id);
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

    // Apply UA defaults after computed styles — overrides initial values only
    this._applyUADefaults(yogaNode, virtualNode.tag, virtualNode.computedStyle);
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

  /**
   * Performs CSS 2.1 §8.3.1 vertical margin collapsing by adjusting Yoga node margins.
   * Walks the tree depth-first (pre-order). For each node with children:
   * 1. Collapses adjacent block-level sibling margins (MCR-1)
   * 2. Collapses parent-first-child top margins (MCR-2)
   * 3. Collapses parent-last-child bottom margins (MCR-3)
   * Then recurses into each child.
   */
  collapseMargins(root: VirtualNode): void {
      this._collapseMarginsRecursive(root);
    }

    private _collapseMarginsRecursive(root: VirtualNode): void {
      const children = root.children;
      if (children.length === 0) return;
      // The synthetic root (tag=Div, id=0) and the <html> element are both
      // document-level roots that must not collapse margins with their children.
      // In CSS the root element never collapses with its children.
      const isDocumentRoot = root.tag === NodeTag.Html;

      // --- Adjacent sibling collapsing (MCR-1) ---
      for (let i = 0; i < children.length - 1; i++) {
        const prev = children[i];
        const next = children[i + 1];
        if (
          this._isBlockLevel(prev) &&
          this._isBlockLevel(next) &&
          !this._establishesBFC(prev) &&
          !this._establishesBFC(next)
        ) {
          const prevYoga = this._yogaNodes.get(prev.id);
          const nextYoga = this._yogaNodes.get(next.id);
          if (prevYoga && nextYoga) {
            const prevBottom = prevYoga.getMargin(Edge.Bottom).value;
            const nextTop = nextYoga.getMargin(Edge.Top).value;
            // Yoga returns NaN for unset margins — treat as 0
            const pb = isNaN(prevBottom) ? 0 : prevBottom;
            const nt = isNaN(nextTop) ? 0 : nextTop;
            const collapsed = Math.max(pb, nt);
            prevYoga.setMargin(Edge.Bottom, collapsed);
            nextYoga.setMargin(Edge.Top, 0);
          }
        }
      }

      // --- Parent-first-child top margin collapsing (MCR-2) ---
      // Skip for document root — the root element never collapses with children
      if (!isDocumentRoot && this._isBlockLevel(root) && !this._hasTopSeparator(root) && !this._establishesBFC(root)) {
        const firstBlock = children.find((c) => this._isBlockLevel(c));
        if (firstBlock) {
          const parentYoga = this._yogaNodes.get(root.id);
          const childYoga = this._yogaNodes.get(firstBlock.id);
          if (parentYoga && childYoga) {
            const parentTop = parentYoga.getMargin(Edge.Top).value;
            const childTop = childYoga.getMargin(Edge.Top).value;
            const pt = isNaN(parentTop) ? 0 : parentTop;
            const ct = isNaN(childTop) ? 0 : childTop;
            const collapsed = Math.max(pt, ct);
            parentYoga.setMargin(Edge.Top, collapsed);
            childYoga.setMargin(Edge.Top, 0);
          }
        }
      }

      // --- Parent-last-child bottom margin collapsing (MCR-3) ---
      // Skip for document root — the root element never collapses with children
      if (!isDocumentRoot && this._isBlockLevel(root) && !this._hasBottomSeparator(root) && !this._establishesBFC(root)) {
        let lastBlock: VirtualNode | undefined;
        for (let i = children.length - 1; i >= 0; i--) {
          if (this._isBlockLevel(children[i])) {
            lastBlock = children[i];
            break;
          }
        }
        if (lastBlock) {
          const parentYoga = this._yogaNodes.get(root.id);
          const childYoga = this._yogaNodes.get(lastBlock.id);
          if (parentYoga && childYoga) {
            const parentBottom = parentYoga.getMargin(Edge.Bottom).value;
            const childBottom = childYoga.getMargin(Edge.Bottom).value;
            const pbt = isNaN(parentBottom) ? 0 : parentBottom;
            const cbt = isNaN(childBottom) ? 0 : childBottom;
            const collapsed = Math.max(pbt, cbt);
            parentYoga.setMargin(Edge.Bottom, collapsed);
            childYoga.setMargin(Edge.Bottom, 0);
          }
        }
      }

      // --- Recurse into each child ---
      for (const child of children) {
        this._collapseMarginsRecursive(child);
      }
    }



  /**
   * Applies user-agent default layout properties based on HTML tag type.
   * These are low-priority defaults — only applied when the computed style
   * doesn't explicitly set the property (i.e., it has the CSS initial value).
   *
   * - html/body: height 100% so they fill the viewport (like browsers)
   * - Inline-level elements (button, span, a, img): align-self flex-start
   *   to prevent Yoga's default stretch behavior
   */
  private _applyUADefaults(
    yogaNode: YogaNode,
    tag: NodeTag,
    computedStyle: ReadonlyMap<string, string>,
  ): void {
    // html should fill the viewport by default
    if (tag === NodeTag.Html) {
      const h = computedStyle.get("height");
      if (!h || h === "auto") {
        yogaNode.setHeight("100%");
      }
      const w = computedStyle.get("width");
      if (!w || w === "auto") {
        yogaNode.setWidth("100%");
      }
    }

    // body fills viewport height; width stretches naturally via flexbox
    // (setting width:100% would ignore margins and cause overflow)
    if (tag === NodeTag.Body) {
      const h = computedStyle.get("height");
      if (!h || h === "auto") {
        yogaNode.setHeight("100%");
      }
    }

    // Inline-level elements should not stretch to fill parent width
    if (INLINE_TAGS.has(tag)) {
      const alignSelf = computedStyle.get("align-self");
      if (!alignSelf || alignSelf === "auto") {
        yogaNode.setAlignSelf(Align.FlexStart);
      }
    }

    // <p> elements have UA default margin of 1em (top and bottom) in browsers.
    // Apply only when computed margin is the initial value "0" (no explicit CSS).
    if (tag === NodeTag.P) {
      if (computedStyle.get("margin-top") === "0") {
        yogaNode.setMargin(Edge.Top, 16);
      }
      if (computedStyle.get("margin-bottom") === "0") {
        yogaNode.setMargin(Edge.Bottom, 16);
      }
    }
  }

  /**
   * Creates a Yoga MeasureFunction for a text leaf node.
   * Estimates text dimensions using a character-width heuristic.
   * Text nodes inherit font-size from their parent's computedStyle.
   */
  private _createTextMeasureFunc(vnode: VirtualNode): MeasureFunction {
      return (
        width: number,
        widthMode: MeasureMode,
        _height: number,
        _heightMode: MeasureMode,
      ) => {
        const text = vnode.textContent ?? "";
        if (text.length === 0) return { width: 0, height: 0 };

        const style = vnode.computedStyle ?? vnode.parent?.computedStyle;
        const fontFamily = style?.get("font-family") ?? "sans-serif";
        const fontSize = this._getInheritedFontSize(vnode);
        const fontWeight = style?.get("font-weight") ?? "normal";
        const fontStyle = style?.get("font-style") ?? "normal";

        const measured = measureText(text, fontFamily, fontSize, fontWeight, fontStyle);

        // Respect width constraint for wrapping
        if (widthMode !== MeasureMode.Undefined && measured.width > width) {
          const lines = Math.ceil(measured.width / width);
          return { width: width, height: lines * measured.height };
        }

        return measured;
      };
    }


  /** Walk up the tree to find the nearest font-size in computedStyle. */
  private _getInheritedFontSize(vnode: VirtualNode): number {
    let node: VirtualNode | null = vnode.parent;
    while (node) {
      // Headings have UA default font-sizes (like browsers)
      const headingSize = HEADING_FONT_SIZES.get(node.tag);
      if (headingSize !== undefined) {
        // Only override the UA default if CSS explicitly sets a non-initial font-size
        const fs = node.computedStyle?.get("font-size");
        if (fs && fs !== "medium") {
          const num = parseFontSize(fs);
          if (num > 0) return num;
        }
        return headingSize;
      }

      const fs = node.computedStyle?.get("font-size");
      if (fs) {
        const num = parseFontSize(fs);
        if (num > 0) return num;
      }
      node = node.parent;
    }
    return 16; // default browser font-size
  }

  /**
   * Returns true if the node is block-level based on its computed `display` property.
   * Block-level values: block, list-item, table.
   * Defaults to "block" when display is absent (most HTML elements are block-level).
   */
  private _isBlockLevel(node: VirtualNode): boolean {
    const display = node.computedStyle?.get("display") ?? "block";
    return display === "block" || display === "list-item" || display === "table";
  }

  /**
   * Returns true if this node establishes a new block formatting context (BFC).
   * BFC-establishing conditions: display: inline-block, overflow other than visible,
   * float other than none, position: absolute/fixed.
   */
  private _establishesBFC(node: VirtualNode): boolean {
    const style = node.computedStyle;
    if (!style) return false;
    const display = style.get("display") ?? "";
    if (display === "inline-block") return true;
    const overflow = style.get("overflow") ?? "visible";
    if (overflow !== "visible") return true;
    const float = style.get("float") ?? "none";
    if (float !== "none") return true;
    const position = style.get("position") ?? "static";
    if (position === "absolute" || position === "fixed") return true;
    return false;
  }

  /**
   * Returns true if the parent has top border or padding separating it from its first child.
   */
  private _hasTopSeparator(parentNode: VirtualNode): boolean {
    const style = parentNode.computedStyle;
    if (!style) return false;
    const borderTop = parseFloat(style.get("border-top-width") ?? "0") || 0;
    const paddingTop = parseFloat(style.get("padding-top") ?? "0") || 0;
    return borderTop > 0 || paddingTop > 0;
  }

  /**
   * Returns true if the parent has bottom border or padding separating it from its last child.
   */
  private _hasBottomSeparator(parentNode: VirtualNode): boolean {
    const style = parentNode.computedStyle;
    if (!style) return false;
    const borderBottom = parseFloat(style.get("border-bottom-width") ?? "0") || 0;
    const paddingBottom = parseFloat(style.get("padding-bottom") ?? "0") || 0;
    return borderBottom > 0 || paddingBottom > 0;
  }


}

/** CSS font-size keyword → pixel mapping. */
const FONT_SIZE_KEYWORDS: Record<string, number> = {
  "xx-small": 9, "x-small": 10, "small": 13, "medium": 16,
  "large": 18, "x-large": 24, "xx-large": 32,
};

/** Parse a CSS font-size value to a pixel number. Handles px, keywords, and bare numbers. */
function parseFontSize(value: string): number {
  const kw = FONT_SIZE_KEYWORDS[value];
  if (kw !== undefined) return kw;
  const num = parseFloat(value);
  return isNaN(num) ? 0 : num;
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
