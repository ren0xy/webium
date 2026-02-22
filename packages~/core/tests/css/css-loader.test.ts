import { describe, it, expect, vi } from "vitest";
import fc from "fast-check";

import { CSSLoader } from "../../src/css/css-loader.js";
import { StyleSheetManager } from "../../src/css/stylesheet-manager.js";
import { VirtualDOM } from "../../src/dom/virtual-dom.js";
import { NodeTag } from "../../src/dom/types.js";
import type { VirtualNode } from "../../src/dom/virtual-node.js";
import type { FileProvider } from "../../src/css/css-loader.js";

/**
 * Create fresh CSSLoader dependencies for each test.
 * Follows the createParserDeps() helper pattern from spec 002.
 */
function createLoaderDeps(
  basePath: string,
  fileProvider: FileProvider,
) {
  const dom = new VirtualDOM();
  const stylesheetManager = new StyleSheetManager();
  const loader = new CSSLoader(stylesheetManager, fileProvider, dom, basePath);
  return { loader, stylesheetManager, fileProvider, dom };
}

/** Create a link VirtualNode with the given href attribute. */
function makeLinkNode(dom: VirtualDOM, href: string): VirtualNode {
  const node = dom.createElement(NodeTag.Link);
  node.attributes.set("href", href);
  return node;
}

// ─── Generators ───────────────────────────────────────────────────────────────

/** Generate a path segment: 1-8 alphanumeric chars */
const arbSegment = fc.stringMatching(/^[a-z][a-z0-9]{0,7}$/);

/** Generate a basePath: 0-3 segments joined by "/", optionally with trailing slash */
const arbBasePath = fc
  .tuple(
    fc.array(arbSegment, { minLength: 0, maxLength: 3 }),
    fc.boolean(), // trailing slash
  )
  .map(([segments, trailingSlash]) => {
    const path = segments.join("/");
    if (path.length === 0) return "";
    return trailingSlash ? path + "/" : path;
  });

/** Generate a relative href: optional "./" prefix + 1-2 segments + ".css" */
const arbRelativeHref = fc
  .tuple(
    fc.boolean(), // leading "./"
    fc.array(arbSegment, { minLength: 1, maxLength: 2 }),
  )
  .map(([dotSlash, segments]) => {
    const prefix = dotSlash ? "./" : "";
    return prefix + segments.join("/") + ".css";
  });

/** Generate an absolute href: "/" + 1-2 segments + ".css" */
const arbAbsoluteHref = fc
  .array(arbSegment, { minLength: 1, maxLength: 2 })
  .map((segments) => "/" + segments.join("/") + ".css");

/** Generate either a relative or absolute href */
const arbHref = fc.oneof(
  { weight: 3, arbitrary: arbRelativeHref },
  { weight: 1, arbitrary: arbAbsoluteHref },
);

// ─── Property 1: Path resolution and FileProvider invocation ──────────────────

/**
 * Feature: css-file-loading, Property 1: Path resolution and FileProvider invocation
 *
 * **Validates: Requirements 1.4, 2.2, 4.1, 4.2, 4.3**
 */
describe("Property 1: Path resolution and FileProvider invocation", () => {
  /**
   * Compute the expected resolved path using the same rules as the design:
   * - Absolute hrefs (starting with "/") are passed as-is
   * - Relative hrefs are joined with basePath
   * - Leading "./" on href is stripped
   * - basePath gets a trailing "/" if non-empty and missing one
   * - Double slashes are collapsed
   */
  function expectedResolvePath(basePath: string, href: string): string {
    if (href.startsWith("/")) {
      return href;
    }
    const cleanHref = href.startsWith("./") ? href.slice(2) : href;
    let base = basePath;
    if (base.length > 0 && !base.endsWith("/")) {
      base += "/";
    }
    const joined = base + cleanHref;
    return joined.replace(/\/\/+/g, "/");
  }

  it("calls FileProvider exactly once per link node with the correctly resolved path", () => {
    fc.assert(
      fc.property(
        arbBasePath,
        fc.array(arbHref, { minLength: 1, maxLength: 10 }),
        (basePath, hrefs) => {
          const calls: string[] = [];
          const fileProvider: FileProvider = (path) => {
            calls.push(path);
            return "/* dummy css */";
          };
          const { loader, dom } = createLoaderDeps(basePath, fileProvider);

          const links = hrefs.map((href) => makeLinkNode(dom, href));
          loader.loadLinks(links);

          // FileProvider called exactly once per link
          expect(calls.length).toBe(hrefs.length);

          // Each call uses the correctly resolved path
          for (let i = 0; i < hrefs.length; i++) {
            const expected = expectedResolvePath(basePath, hrefs[i]);
            expect(calls[i]).toBe(expected);
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("resolved paths never contain double slashes or literal './' segments", () => {
    fc.assert(
      fc.property(
        arbBasePath,
        fc.array(arbHref, { minLength: 1, maxLength: 10 }),
        (basePath, hrefs) => {
          const calls: string[] = [];
          const fileProvider: FileProvider = (path) => {
            calls.push(path);
            return "/* css */";
          };
          const { loader, dom } = createLoaderDeps(basePath, fileProvider);

          const links = hrefs.map((href) => makeLinkNode(dom, href));
          loader.loadLinks(links);

          for (const resolvedPath of calls) {
            expect(resolvedPath).not.toContain("//");
            expect(resolvedPath).not.toContain("./");
          }
        },
      ),
      { numRuns: 200 },
    );
  });

  it("absolute hrefs are passed as-is regardless of basePath", () => {
    fc.assert(
      fc.property(
        arbBasePath,
        fc.array(arbAbsoluteHref, { minLength: 1, maxLength: 5 }),
        (basePath, hrefs) => {
          const calls: string[] = [];
          const fileProvider: FileProvider = (path) => {
            calls.push(path);
            return "/* css */";
          };
          const { loader, dom } = createLoaderDeps(basePath, fileProvider);

          const links = hrefs.map((href) => makeLinkNode(dom, href));
          loader.loadLinks(links);

          for (let i = 0; i < hrefs.length; i++) {
            // Absolute hrefs should be unchanged
            expect(calls[i]).toBe(hrefs[i]);
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 2: Stylesheet creation and source-order preservation ────────────

/**
 * Feature: css-file-loading, Property 2: Stylesheet creation and source-order preservation
 *
 * **Validates: Requirements 1.5, 1.6**
 */
describe("Property 2: Stylesheet creation and source-order preservation", () => {
  /** Generate a simple CSS rule string */
  const arbCSS = fc
    .tuple(
      fc.constantFrom("div", "span", "p", ".foo", "#bar"),
      fc.constantFrom("color", "margin", "padding"),
      fc.constantFrom("red", "0", "10px"),
    )
    .map(([sel, prop, val]) => `${sel} { ${prop}: ${val}; }`);

  /** Generate a list of unique href + CSS text pairs */
  const arbLinkEntries = fc
    .array(
      fc.tuple(arbSegment, arbCSS),
      { minLength: 1, maxLength: 10 },
    )
    .map((entries) => {
      // Deduplicate by href segment to avoid collisions in the FileProvider map
      const seen = new Set<string>();
      const result: Array<{ href: string; css: string }> = [];
      for (const [seg, css] of entries) {
        if (!seen.has(seg)) {
          seen.add(seg);
          result.push({ href: seg + ".css", css });
        }
      }
      return result;
    })
    .filter((entries) => entries.length > 0);

  it("calls addStyleSheet once per link in input order with correct style nodes", () => {
    fc.assert(
      fc.property(arbLinkEntries, (entries) => {
        // Build a FileProvider that maps resolved paths to CSS text
        const cssMap = new Map<string, string>();
        for (const { href, css } of entries) {
          cssMap.set(href, css);
        }
        const fileProvider: FileProvider = (path) => cssMap.get(path) ?? null;

        const { loader, stylesheetManager, dom } = createLoaderDeps("", fileProvider);
        const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

        const links = entries.map(({ href }) => makeLinkNode(dom, href));
        loader.loadLinks(links);

        // addStyleSheet called exactly once per link
        expect(addSpy.mock.calls.length).toBe(entries.length);

        // Verify each call in order
        for (let i = 0; i < entries.length; i++) {
          const styleNode = addSpy.mock.calls[i][0] as VirtualNode;

          // Style node has correct tag
          expect(styleNode.tag).toBe(NodeTag.Style);

          // Style node textContent matches the CSS from FileProvider
          expect(styleNode.textContent).toBe(entries[i].css);
        }

        addSpy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });

  it("preserves source order even with varied basePaths", () => {
    fc.assert(
      fc.property(
        arbBasePath,
        arbLinkEntries,
        (basePath, entries) => {
          // Build FileProvider using resolved paths
          const cssMap = new Map<string, string>();
          for (const { href, css } of entries) {
            // Replicate path resolution to build the map with resolved keys
            let resolvedPath: string;
            if (href.startsWith("/")) {
              resolvedPath = href;
            } else {
              let base = basePath;
              if (base.length > 0 && !base.endsWith("/")) {
                base += "/";
              }
              resolvedPath = (base + href).replace(/\/\/+/g, "/");
            }
            cssMap.set(resolvedPath, css);
          }
          const fileProvider: FileProvider = (path) => cssMap.get(path) ?? null;

          const { loader, stylesheetManager, dom } = createLoaderDeps(basePath, fileProvider);
          const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

          const links = entries.map(({ href }) => makeLinkNode(dom, href));
          loader.loadLinks(links);

          // Same number of calls as entries
          expect(addSpy.mock.calls.length).toBe(entries.length);

          // Order matches input order
          for (let i = 0; i < entries.length; i++) {
            const styleNode = addSpy.mock.calls[i][0] as VirtualNode;
            expect(styleNode.tag).toBe(NodeTag.Style);
            expect(styleNode.textContent).toBe(entries[i].css);
          }

          addSpy.mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Property 3: Graceful handling of missing files ───────────────────────────

/**
 * Feature: css-file-loading, Property 3: Graceful handling of missing files
 *
 * **Validates: Requirements 3.1, 3.2**
 */
describe("Property 3: Graceful handling of missing files", () => {
  /** Generate a simple CSS rule string */
  const arbCSS = fc
    .tuple(
      fc.constantFrom("div", "span", "p", ".foo", "#bar"),
      fc.constantFrom("color", "margin", "padding"),
      fc.constantFrom("red", "0", "10px"),
    )
    .map(([sel, prop, val]) => `${sel} { ${prop}: ${val}; }`);

  /** Generate a list of unique link entries, each randomly marked as found or missing */
  const arbMixedLinkEntries = fc
    .array(
      fc.tuple(
        arbSegment,   // href segment
        arbCSS,       // CSS text (used only if found)
        fc.boolean(), // true = found, false = missing
      ),
      { minLength: 1, maxLength: 10 },
    )
    .map((entries) => {
      const seen = new Set<string>();
      const result: Array<{ href: string; css: string; found: boolean }> = [];
      for (const [seg, css, found] of entries) {
        if (!seen.has(seg)) {
          seen.add(seg);
          result.push({ href: seg + ".css", css, found });
        }
      }
      return result;
    })
    .filter((entries) => entries.length > 0);

  it("logs a warning for each missing file and still calls addStyleSheet for found files", () => {
    fc.assert(
      fc.property(arbMixedLinkEntries, (entries) => {
        // Build a FileProvider that returns CSS for found entries and null for missing
        const cssMap = new Map<string, string>();
        for (const { href, css, found } of entries) {
          if (found) {
            cssMap.set(href, css);
          }
        }
        const fileProvider: FileProvider = (path) => cssMap.get(path) ?? null;

        const { loader, stylesheetManager, dom } = createLoaderDeps("", fileProvider);
        const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");
        const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

        const links = entries.map(({ href }) => makeLinkNode(dom, href));

        // (c) no exception thrown — the test completing proves this
        loader.loadLinks(links);

        const foundEntries = entries.filter((e) => e.found);
        const missingEntries = entries.filter((e) => !e.found);

        // (a) console.warn called exactly once per missing file
        expect(warnSpy.mock.calls.length).toBe(missingEntries.length);
        for (let i = 0; i < missingEntries.length; i++) {
          const warnMsg = warnSpy.mock.calls[i][0] as string;
          // Warning includes the resolved path (which equals href for empty basePath)
          expect(warnMsg).toContain(missingEntries[i].href);
        }

        // (b) addStyleSheet called exactly once per found file
        expect(addSpy.mock.calls.length).toBe(foundEntries.length);

        addSpy.mockRestore();
        warnSpy.mockRestore();
      }),
      { numRuns: 200 },
    );
  });

  it("warnings include the resolved path with basePath applied", () => {
    fc.assert(
      fc.property(
        arbBasePath,
        arbMixedLinkEntries,
        (basePath, entries) => {
          // Build FileProvider using resolved paths
          const cssMap = new Map<string, string>();
          for (const { href, css, found } of entries) {
            if (found) {
              let resolvedPath: string;
              if (href.startsWith("/")) {
                resolvedPath = href;
              } else {
                let base = basePath;
                if (base.length > 0 && !base.endsWith("/")) {
                  base += "/";
                }
                resolvedPath = (base + href).replace(/\/\/+/g, "/");
              }
              cssMap.set(resolvedPath, css);
            }
          }
          const fileProvider: FileProvider = (path) => cssMap.get(path) ?? null;

          const { loader, stylesheetManager, dom } = createLoaderDeps(basePath, fileProvider);
          const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");
          const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

          const links = entries.map(({ href }) => makeLinkNode(dom, href));
          loader.loadLinks(links);

          // Each warning should contain the resolved path (not just the raw href)
          const missingEntries = entries.filter((e) => !e.found);
          expect(warnSpy.mock.calls.length).toBe(missingEntries.length);

          for (let i = 0; i < missingEntries.length; i++) {
            const warnMsg = warnSpy.mock.calls[i][0] as string;
            // Compute expected resolved path
            const href = missingEntries[i].href;
            let expectedPath: string;
            if (href.startsWith("/")) {
              expectedPath = href;
            } else {
              let base = basePath;
              if (base.length > 0 && !base.endsWith("/")) {
                base += "/";
              }
              expectedPath = (base + href).replace(/\/\/+/g, "/");
            }
            expect(warnMsg).toContain(expectedPath);
          }

          addSpy.mockRestore();
          warnSpy.mockRestore();
        },
      ),
      { numRuns: 100 },
    );
  });
});


// ─── Unit Tests ───────────────────────────────────────────────────────────────

describe("CSSLoader unit tests", () => {
  it("loads a single <link> with a relative href", () => {
    const fileProvider: FileProvider = (path) =>
      path === "ui/style.css" ? "body { color: red; }" : null;
    const { loader, stylesheetManager, dom } = createLoaderDeps("ui/", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

    const link = makeLinkNode(dom, "style.css");
    loader.loadLinks([link]);

    expect(addSpy).toHaveBeenCalledTimes(1);
    const styleNode = addSpy.mock.calls[0][0] as VirtualNode;
    expect(styleNode.tag).toBe(NodeTag.Style);
    expect(styleNode.textContent).toBe("body { color: red; }");

    addSpy.mockRestore();
  });

  it("loads a <link> with an absolute href without prepending basePath", () => {
    const fileProvider: FileProvider = (path) =>
      path === "/style.css" ? "h1 { font-size: 2em; }" : null;
    const { loader, stylesheetManager, dom } = createLoaderDeps("ui/", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

    const link = makeLinkNode(dom, "/style.css");
    loader.loadLinks([link]);

    expect(addSpy).toHaveBeenCalledTimes(1);
    const styleNode = addSpy.mock.calls[0][0] as VirtualNode;
    expect(styleNode.textContent).toBe("h1 { font-size: 2em; }");

    addSpy.mockRestore();
  });

  it("strips leading './' from href before resolving", () => {
    const calls: string[] = [];
    const fileProvider: FileProvider = (path) => {
      calls.push(path);
      return "p { margin: 0; }";
    };
    const { loader, dom } = createLoaderDeps("assets/", fileProvider);

    const link = makeLinkNode(dom, "./style.css");
    loader.loadLinks([link]);

    expect(calls).toEqual(["assets/style.css"]);
  });

  it("preserves source order when loading multiple links", () => {
    const cssFiles: Record<string, string> = {
      "a.css": ".a { color: red; }",
      "b.css": ".b { color: green; }",
      "c.css": ".c { color: blue; }",
    };
    const fileProvider: FileProvider = (path) => cssFiles[path] ?? null;
    const { loader, stylesheetManager, dom } = createLoaderDeps("", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

    const links = ["a.css", "b.css", "c.css"].map((href) => makeLinkNode(dom, href));
    loader.loadLinks(links);

    expect(addSpy).toHaveBeenCalledTimes(3);
    expect((addSpy.mock.calls[0][0] as VirtualNode).textContent).toBe(".a { color: red; }");
    expect((addSpy.mock.calls[1][0] as VirtualNode).textContent).toBe(".b { color: green; }");
    expect((addSpy.mock.calls[2][0] as VirtualNode).textContent).toBe(".c { color: blue; }");

    addSpy.mockRestore();
  });

  it("logs a warning and skips addStyleSheet when FileProvider returns null", () => {
    const fileProvider: FileProvider = () => null;
    const { loader, stylesheetManager, dom } = createLoaderDeps("ui/", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const link = makeLinkNode(dom, "missing.css");
    loader.loadLinks([link]);

    expect(addSpy).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy.mock.calls[0][0]).toBe("CSS file not found: ui/missing.css");

    addSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("handles a mix of found and missing files — partial loading", () => {
    const cssFiles: Record<string, string> = {
      "found.css": ".found { display: block; }",
    };
    const fileProvider: FileProvider = (path) => cssFiles[path] ?? null;
    const { loader, stylesheetManager, dom } = createLoaderDeps("", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const links = [
      makeLinkNode(dom, "found.css"),
      makeLinkNode(dom, "missing.css"),
      makeLinkNode(dom, "also-missing.css"),
    ];
    loader.loadLinks(links);

    expect(addSpy).toHaveBeenCalledTimes(1);
    expect((addSpy.mock.calls[0][0] as VirtualNode).textContent).toBe(".found { display: block; }");
    expect(warnSpy).toHaveBeenCalledTimes(2);

    addSpy.mockRestore();
    warnSpy.mockRestore();
  });

  it("skips a link node without an href attribute", () => {
    const fileProvider: FileProvider = () => "/* should not be called */";
    const { loader, stylesheetManager, dom } = createLoaderDeps("", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

    // Create a link node without setting href
    const node = dom.createElement(NodeTag.Link);
    loader.loadLinks([node]);

    expect(addSpy).not.toHaveBeenCalled();

    addSpy.mockRestore();
  });

  it("makes no calls when given an empty links array", () => {
    const calls: string[] = [];
    const fileProvider: FileProvider = (path) => {
      calls.push(path);
      return "/* css */";
    };
    const { loader, stylesheetManager } = createLoaderDeps("ui/", fileProvider);
    const addSpy = vi.spyOn(stylesheetManager, "addStyleSheet");

    loader.loadLinks([]);

    expect(calls).toHaveLength(0);
    expect(addSpy).not.toHaveBeenCalled();

    addSpy.mockRestore();
  });

  it("produces the same resolved path with and without trailing slash on basePath", () => {
    const callsWithSlash: string[] = [];
    const callsWithoutSlash: string[] = [];

    const fpWithSlash: FileProvider = (path) => { callsWithSlash.push(path); return "/* css */"; };
    const fpWithoutSlash: FileProvider = (path) => { callsWithoutSlash.push(path); return "/* css */"; };

    const depsWithSlash = createLoaderDeps("ui/", fpWithSlash);
    const depsWithoutSlash = createLoaderDeps("ui", fpWithoutSlash);

    const linkWithSlash = makeLinkNode(depsWithSlash.dom, "style.css");
    const linkWithoutSlash = makeLinkNode(depsWithoutSlash.dom, "style.css");

    depsWithSlash.loader.loadLinks([linkWithSlash]);
    depsWithoutSlash.loader.loadLinks([linkWithoutSlash]);

    expect(callsWithSlash).toEqual(["ui/style.css"]);
    expect(callsWithoutSlash).toEqual(["ui/style.css"]);
  });
});
