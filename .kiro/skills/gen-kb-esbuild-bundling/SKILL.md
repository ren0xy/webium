---
name: gen-kb-esbuild-bundling
description: Knowledge about esbuild bundling quirks, format limitations, and workarounds for PuerTS/V8 targets.
---

### esbuild IIFE format incompatible with top-level await — use ESM + post-process wrapper
esbuild hard-refuses `format: "iife"` when the bundle contains top-level `await`. The `supported: { "top-level-await": true }` flag does not override this. Workaround: build as ESM, then post-process to strip `export {}` and wrap in a synchronous `(function() { ... })();` IIFE (if all async code has been eliminated via plugins).

### Emscripten WASM loaders can be made synchronous via `instantiateWasm` hook
Emscripten-generated loaders (like yoga-layout's `yoga-wasm-base64-esm.js`) check `if(h.instantiateWasm)` before falling back to async `WebAssembly.instantiate`. Pass `{instantiateWasm: fn}` to the factory to use synchronous `new WebAssembly.Module(bytes)` + `new WebAssembly.Instance(mod, imports)`. Also patch the factory's `return loadYoga.ready` to `return loadYoga` so the caller gets the module object directly (not a Promise). Pre-decode the base64 WASM bytes before the factory runs and store on `globalThis.__yogaWasmBytes`.

### esbuild `external: ["module"]` leaks ESM imports into PuerTS-incompatible bundles
When css-tree uses `createRequire(import.meta.url)` to load JSON at runtime, externalizing `"module"` preserves bare `import` statements in the bundle that PuerTS/V8 can't evaluate. Fix: use an esbuild plugin that intercepts `import "module"` and returns a shim with `createRequire()` backed by a pre-loaded JSON lookup map built at bundle time.

### `import.meta.url` must be replaced in PuerTS bundles
yoga-layout's WASM loader references `import.meta.url` for `_scriptDir`. In PuerTS/V8 eval context, `import.meta` doesn't exist. Post-process the bundle with `.replace(/\bimport\.meta\.url\b/g, '"file:///webium-bundle"')`.
