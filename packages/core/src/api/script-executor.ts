import type { VirtualNode } from "../dom/virtual-node.js";
import type { FileProvider } from "../css/css-loader.js";

/**
 * Callback that evaluates a JS string in the runtime with given scope bindings.
 * The scope object contains `document`, `console`, and any other globals.
 */
export type RuntimeEvaluator = (
  code: string,
  scope: Record<string, unknown>,
) => void;

/**
 * Resolve a path relative to a base directory.
 *
 * - If path starts with "/", return it as-is (absolute).
 * - Otherwise, join basePath + path, normalizing "./" and double slashes.
 */
function resolvePath(basePath: string, filePath: string): string {
  if (filePath.startsWith("/")) {
    return filePath;
  }

  const cleanPath = filePath.startsWith("./") ? filePath.slice(2) : filePath;

  let base = basePath;
  if (base.length > 0 && !base.endsWith("/")) {
    base += "/";
  }

  const joined = base + cleanPath;
  return joined.replace(/\/\/+/g, "/");
}

/**
 * Executes `<script>` elements in document order.
 *
 * - Inline scripts: evaluate textContent.
 * - External scripts (src attribute): load via FileProvider, then evaluate.
 * - All scripts receive the provided scope (typically `document` and `console`).
 *
 * @see Requirements 10.1, 10.2, 10.3, 10.4
 */
export class ScriptExecutor {
  constructor(
    private readonly fileProvider: FileProvider,
    private readonly evaluate: RuntimeEvaluator,
    private readonly basePath: string,
  ) {}

  executeScripts(
    scripts: VirtualNode[],
    scope: Record<string, unknown>,
  ): void {
    for (const script of scripts) {
      try {
        const src = script.attributes.get("src");

        let code: string | null = null;

        if (src !== undefined) {
          const resolvedPath = resolvePath(this.basePath, src);
          code = this.fileProvider(resolvedPath);

          if (code === null) {
            console.warn(`Script file not found: ${resolvedPath}`);
            continue;
          }
        } else {
          code = script.textContent;
        }

        if (code !== null) {
          this.evaluate(code, scope);
        }
      } catch (error) {
        console.error("Script execution error:", error);
      }
    }
  }
}
