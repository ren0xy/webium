import type { StyleSheetManager } from "./stylesheet-manager.js";
import type { VirtualDOM } from "../dom/virtual-dom.js";
import type { VirtualNode } from "../dom/virtual-node.js";
import { NodeTag } from "../dom/types.js";

/**
 * Callback that the host environment implements to supply file contents.
 * Returns the file contents as a string, or null if the file is not found.
 */
export type FileProvider = (path: string) => string | null;

/**
 * Resolve an href relative to a base directory path.
 *
 * - If href starts with "/", return it as-is (absolute path).
 * - Otherwise, join basePath + href.
 * - Normalize away leading "./" and double slashes.
 */
function resolvePath(basePath: string, href: string): string {
  if (href.startsWith("/")) {
    return href;
  }

  // Strip leading "./" from href
  const cleanHref = href.startsWith("./") ? href.slice(2) : href;

  // Ensure basePath ends with "/" if non-empty
  let base = basePath;
  if (base.length > 0 && !base.endsWith("/")) {
    base += "/";
  }

  const joined = base + cleanHref;

  // Normalize double slashes
  return joined.replace(/\/\/+/g, "/");
}

/**
 * Loads external CSS files referenced by <link> tags and feeds them
 * into the StyleSheetManager pipeline.
 *
 * @see Requirements 1.1, 1.2, 1.3
 */
export class CSSLoader {
  constructor(
    private readonly stylesheetManager: StyleSheetManager,
    private readonly fileProvider: FileProvider,
    private readonly dom: VirtualDOM,
    private readonly basePath: string,
  ) {}

  /**
   * Load external CSS files for the given <link> nodes.
   * Each node's href attribute is resolved relative to basePath,
   * fetched via FileProvider, and fed into StyleSheetManager.
   */
  loadLinks(links: VirtualNode[]): void {
    for (const link of links) {
      const href = link.attributes.get("href");
      if (href === undefined) {
        continue;
      }

      const resolvedPath = resolvePath(this.basePath, href);
      const cssText = this.fileProvider(resolvedPath);

      if (cssText === null) {
        console.warn(`CSS file not found: ${resolvedPath}`);
        continue;
      }

      const styleNode = this.dom.createElement(NodeTag.Style);
      styleNode.textContent = cssText;
      this.stylesheetManager.addStyleSheet(styleNode);
    }
  }
}
