import type { NodeTag } from "../dom/types.js";

/**
 * Render operation types.
 * @see Requirements 6.1
 */
export enum RenderOp {
  Create = 0,
  Destroy = 1,
  UpdateLayout = 2,
  UpdateStyle = 3,
  UpdateText = 4,
  Reparent = 5,
}

/**
 * A single render command describing a visual change.
 * @see Requirements 6.1
 */
export interface RenderCommand {
  op: RenderOp;
  nodeId: number;
  tag?: NodeTag;
  parentId?: number;
  siblingIndex?: number;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  styles?: Record<string, string>;
  text?: string;
}

/**
 * Field mask bits for typed array serialization.
 */
const FIELD_TAG = 1 << 0;
const FIELD_PARENT_ID = 1 << 1;
const FIELD_SIBLING_INDEX = 1 << 2;
const FIELD_LAYOUT = 1 << 3;
const FIELD_STYLES = 1 << 4;
const FIELD_TEXT = 1 << 5;

/**
 * Ordered buffer of render commands produced per reconciliation tick.
 * @see Requirements 6.1, 6.3, 6.4
 */
export interface IRenderCommandBuffer {
  readonly commands: ReadonlyArray<RenderCommand>;
  readonly length: number;
  push(cmd: RenderCommand): void;
  clear(): void;
  toTypedArray(): ArrayBuffer;
  toJSON(): string;
}

export class RenderCommandBuffer implements IRenderCommandBuffer {
  private _commands: RenderCommand[] = [];

  get commands(): ReadonlyArray<RenderCommand> {
    return this._commands;
  }

  get length(): number {
    return this._commands.length;
  }

  push(cmd: RenderCommand): void {
    this._commands.push(cmd);
  }

  clear(): void {
    this._commands.length = 0;
  }

  /**
   * Serialize to binary typed array format.
   *
   * Format:
   *   Header: 4 bytes (uint32 commandCount)
   *   Per command:
   *     [0]     op: uint8
   *     [1..4]  nodeId: int32
   *     [5]     fieldMask: uint8
   *     [6..]   optional fields based on mask
   */
  toTypedArray(): ArrayBuffer {
    // First pass: calculate total size
    let totalSize = 4; // header
    for (const cmd of this._commands) {
      totalSize += 6; // op(1) + nodeId(4) + fieldMask(1)
      const mask = this._fieldMask(cmd);
      if (mask & FIELD_TAG) totalSize += 1;
      if (mask & FIELD_PARENT_ID) totalSize += 4;
      if (mask & FIELD_SIBLING_INDEX) totalSize += 4;
      if (mask & FIELD_LAYOUT) totalSize += 16; // 4 floats
      if (mask & FIELD_STYLES) {
        const encoded = this._encodeStyles(cmd.styles!);
        totalSize += 2 + encoded.length;
      }
      if (mask & FIELD_TEXT) {
        const encoded = this._encodeText(cmd.text!);
        totalSize += 2 + encoded.length;
      }
    }

    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Header
    view.setUint32(offset, this._commands.length, true);
    offset += 4;

    // Commands
    for (const cmd of this._commands) {
      view.setUint8(offset, cmd.op);
      offset += 1;
      view.setInt32(offset, cmd.nodeId, true);
      offset += 4;
      const mask = this._fieldMask(cmd);
      view.setUint8(offset, mask);
      offset += 1;

      if (mask & FIELD_TAG) {
        view.setUint8(offset, cmd.tag!);
        offset += 1;
      }
      if (mask & FIELD_PARENT_ID) {
        view.setInt32(offset, cmd.parentId!, true);
        offset += 4;
      }
      if (mask & FIELD_SIBLING_INDEX) {
        view.setInt32(offset, cmd.siblingIndex!, true);
        offset += 4;
      }
      if (mask & FIELD_LAYOUT) {
        view.setFloat32(offset, cmd.x!, true);
        offset += 4;
        view.setFloat32(offset, cmd.y!, true);
        offset += 4;
        view.setFloat32(offset, cmd.width!, true);
        offset += 4;
        view.setFloat32(offset, cmd.height!, true);
        offset += 4;
      }
      if (mask & FIELD_STYLES) {
        const encoded = this._encodeStyles(cmd.styles!);
        view.setUint16(offset, encoded.length, true);
        offset += 2;
        new Uint8Array(buffer, offset, encoded.length).set(encoded);
        offset += encoded.length;
      }
      if (mask & FIELD_TEXT) {
        const encoded = this._encodeText(cmd.text!);
        view.setUint16(offset, encoded.length, true);
        offset += 2;
        new Uint8Array(buffer, offset, encoded.length).set(encoded);
        offset += encoded.length;
      }
    }

    return buffer;
  }

  toJSON(): string {
    return JSON.stringify(this._commands);
  }

  private _fieldMask(cmd: RenderCommand): number {
    let mask = 0;
    if (cmd.tag !== undefined) mask |= FIELD_TAG;
    if (cmd.parentId !== undefined) mask |= FIELD_PARENT_ID;
    if (cmd.siblingIndex !== undefined) mask |= FIELD_SIBLING_INDEX;
    if (cmd.x !== undefined && cmd.y !== undefined && cmd.width !== undefined && cmd.height !== undefined) {
      mask |= FIELD_LAYOUT;
    }
    if (cmd.styles !== undefined && Object.keys(cmd.styles).length > 0) mask |= FIELD_STYLES;
    if (cmd.text !== undefined) mask |= FIELD_TEXT;
    return mask;
  }

  private _encodeStyles(styles: Record<string, string>): Uint8Array {
    const pairs = Object.entries(styles).map(([k, v]) => `${k}=${v}`).join("\0");
    return new TextEncoder().encode(pairs);
  }

  private _encodeText(text: string): Uint8Array {
    return new TextEncoder().encode(text);
  }
}
