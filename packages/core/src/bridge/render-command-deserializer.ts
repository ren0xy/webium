import type { RenderCommand } from "./render-command.js";
import { RenderOp } from "./render-command.js";

const FIELD_TAG = 1 << 0;
const FIELD_PARENT_ID = 1 << 1;
const FIELD_SIBLING_INDEX = 1 << 2;
const FIELD_LAYOUT = 1 << 3;
const FIELD_STYLES = 1 << 4;
const FIELD_TEXT = 1 << 5;

/**
 * Deserialize a typed array buffer back to RenderCommand[].
 * @see Requirements 6.3
 */
export function deserializeTypedArray(buffer: ArrayBuffer): RenderCommand[] {
  const view = new DataView(buffer);
  let offset = 0;

  const count = view.getUint32(offset, true);
  offset += 4;

  const commands: RenderCommand[] = [];

  for (let i = 0; i < count; i++) {
    const op: RenderOp = view.getUint8(offset);
    offset += 1;
    const nodeId = view.getInt32(offset, true);
    offset += 4;
    const mask = view.getUint8(offset);
    offset += 1;

    const cmd: RenderCommand = { op, nodeId };

    if (mask & FIELD_TAG) {
      cmd.tag = view.getUint8(offset);
      offset += 1;
    }
    if (mask & FIELD_PARENT_ID) {
      cmd.parentId = view.getInt32(offset, true);
      offset += 4;
    }
    if (mask & FIELD_SIBLING_INDEX) {
      cmd.siblingIndex = view.getInt32(offset, true);
      offset += 4;
    }
    if (mask & FIELD_LAYOUT) {
      cmd.x = view.getFloat32(offset, true);
      offset += 4;
      cmd.y = view.getFloat32(offset, true);
      offset += 4;
      cmd.width = view.getFloat32(offset, true);
      offset += 4;
      cmd.height = view.getFloat32(offset, true);
      offset += 4;
    }
    if (mask & FIELD_STYLES) {
      const len = view.getUint16(offset, true);
      offset += 2;
      const bytes = new Uint8Array(buffer, offset, len);
      const text = new TextDecoder().decode(bytes);
      offset += len;
      const styles: Record<string, string> = {};
      if (text.length > 0) {
        for (const pair of text.split("\0")) {
          const eq = pair.indexOf("=");
          if (eq >= 0) {
            styles[pair.substring(0, eq)] = pair.substring(eq + 1);
          }
        }
      }
      cmd.styles = styles;
    }
    if (mask & FIELD_TEXT) {
      const len = view.getUint16(offset, true);
      offset += 2;
      const bytes = new Uint8Array(buffer, offset, len);
      cmd.text = new TextDecoder().decode(bytes);
      offset += len;
    }

    commands.push(cmd);
  }

  return commands;
}

/**
 * Deserialize a JSON string back to RenderCommand[].
 * @see Requirements 6.4
 */
export function deserializeJSON(json: string): RenderCommand[] {
  return JSON.parse(json) as RenderCommand[];
}
