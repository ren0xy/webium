import * as esbuild from "esbuild";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const outfile = "../../build/webium-bootstrap.js";

// css-tree uses `createRequire(import.meta.url)` to load JSON at runtime.
// esbuild can't trace dynamic require() through createRequire, so the calls
// survive into the bundle as bare `import "module"` + runtime require().
// PuerTS/V8 can't handle ESM imports. Fix: resolve the JSON at build time
// and inject it via a shim that returns the pre-loaded data.
const cssTreeDir = path.join(__dirname, "node_modules", "css-tree");
const mdnDataDir = path.join(__dirname, "node_modules", "mdn-data");

const jsonLookup = {
  "../data/patch.json": path.join(cssTreeDir, "data", "patch.json"),
  "mdn-data/css/at-rules.json": path.join(mdnDataDir, "css", "at-rules.json"),
  "mdn-data/css/properties.json": path.join(mdnDataDir, "css", "properties.json"),
  "mdn-data/css/syntaxes.json": path.join(mdnDataDir, "css", "syntaxes.json"),
  "../package.json": path.join(cssTreeDir, "package.json"),
};

// Plugin: replace Node's "module" built-in with a shim whose createRequire()
// returns a lookup function that resolves the known JSON files at build time.
const nodeModuleShimPlugin = {
  name: "node-module-shim",
  setup(build) {
    build.onResolve({ filter: /^module$/ }, () => ({
      path: "module-shim",
      namespace: "module-shim",
    }));
    build.onLoad({ filter: /.*/, namespace: "module-shim" }, async () => {
      // Build a lookup map from specifier → JSON content (read from disk)
      const entries = [];
      for (const [spec, filePath] of Object.entries(jsonLookup)) {
        const json = await readFile(filePath, "utf-8");
        entries.push(`  ${JSON.stringify(spec)}: ${json.trim()}`);
      }
      const contents = `
const __data = {\n${entries.join(",\n")}\n};
export function createRequire() {
  return function(specifier) {
    if (__data[specifier] !== undefined) return __data[specifier];
    throw new Error("module-shim: unknown specifier: " + specifier);
  };
}
`;
      return { contents, loader: "js" };
    });
  },
};

// Step 1: Build as ESM (required because yoga-layout uses top-level await for WASM init)
await esbuild.build({
  entryPoints: ["src/bootstrap.ts"],
  bundle: true,
  format: "esm",
  platform: "neutral",
  outfile,
  banner: {
    js: [
      "// Webium bootstrap bundle — auto-generated, do not edit",
      // Polyfill atob/btoa for PuerTS V8 which lacks browser globals.
      // Required by the 'entities' library (used by htmlparser2) for base64 decode.
      "if(typeof globalThis.atob==='undefined'){",
      "  globalThis.atob=function(s){var e='ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=',o='';for(var i=0,l=s.length;i<l;){var a=e.indexOf(s[i++]),b=e.indexOf(s[i++]),c=e.indexOf(s[i++]),d=e.indexOf(s[i++]);o+=String.fromCharCode((a<<2)|(b>>4));if(c!==64)o+=String.fromCharCode(((b&15)<<4)|(c>>2));if(d!==64)o+=String.fromCharCode(((c&3)<<6)|d);}return o;};",
      "}",
      // Polyfill TextEncoder/TextDecoder for PuerTS V8 which lacks these Web APIs.
      // Required by RenderCommandBuffer for binary serialization of text/styles.
      "if(typeof globalThis.TextEncoder==='undefined'){",
      "  globalThis.TextEncoder=function(){};",
      "  globalThis.TextEncoder.prototype.encode=function(s){var a=[];for(var i=0;i<s.length;i++){var c=s.charCodeAt(i);if(c<128){a.push(c);}else if(c<2048){a.push(192|(c>>6),128|(c&63));}else if(c<65536){a.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}else{a.push(240|(c>>18),128|((c>>12)&63),128|((c>>6)&63),128|(c&63));}}return new Uint8Array(a);};",
      "}",
      "if(typeof globalThis.TextDecoder==='undefined'){",
      "  globalThis.TextDecoder=function(){};",
      "  globalThis.TextDecoder.prototype.decode=function(b){var a=new Uint8Array(b),s='',i=0;while(i<a.length){var c=a[i];if(c<128){s+=String.fromCharCode(c);i++;}else if(c<224){s+=String.fromCharCode(((c&31)<<6)|(a[i+1]&63));i+=2;}else if(c<240){s+=String.fromCharCode(((c&15)<<12)|((a[i+1]&63)<<6)|(a[i+2]&63));i+=3;}else{var cp=((c&7)<<18)|((a[i+1]&63)<<12)|((a[i+2]&63)<<6)|(a[i+3]&63);cp-=65536;s+=String.fromCharCode(55296+(cp>>10),56320+(cp&1023));i+=4;}}return s;};",
      "}",
    ].join("\n"),
  },
  plugins: [nodeModuleShimPlugin],
});

// Step 2: Wrap in async IIFE for PuerTS eval compatibility
// - Strip ESM export statements (esbuild emits `export {}` even when there are no real exports)
// - Replace import.meta.url with a dummy (yoga-layout uses it for _scriptDir but WASM is base64-embedded)
// - Wrap in (async function() { ... })() so V8/QuickJS can evaluate it
const esm = await readFile(outfile, "utf-8");
const stripped = esm
  .replace(/^export\s*\{[^}]*\};?\s*$/gm, "")
  .replace(/\bimport\.meta\.url\b/g, '"file:///webium-bundle"');
const iife = `// Webium bootstrap bundle — auto-generated, do not edit\n(async function() {\n${stripped}\n})();\n`;
await writeFile(outfile, iife, "utf-8");

// Build pipeline:
//   1. `npm run build:bundle` in packages/core  → builds build/webium-bootstrap.js
//   2. Copy build/webium-bootstrap.js → Resources/webium-bootstrap.txt (renamed to .txt for Unity TextAsset)
//      In the consuming Unity project: Assets/Webium/Resources/webium-bootstrap.txt
//      Or use `npm run build:bundle:copy` to do both steps at once (copies to ../../Resources/)
