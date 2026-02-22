---
name: gen-kb-puerts-runtime
description: Knowledge about PuerTS V8 runtime limitations, missing APIs, polyfills, and C#/JS marshalling quirks.
---

### PuerTS V8 does not pump microtask queue — all WASM init must be synchronous
PuerTS V8 never pumps the microtask queue between `Evaluate()` calls. `await` (even on a synchronously-resolved Promise) creates a microtask that never runs, so async IIFE wrappers never complete before C# calls `CallFunction()`. Dynamic `import()` also silently fails (promise never resolves/rejects). Fix: eliminate all async code from the bundle — use synchronous `new WebAssembly.Module()` + `new WebAssembly.Instance()` for WASM init via Emscripten's `instantiateWasm` hook, and wrap in a synchronous `(function(){...})()` IIFE.

### PuerTS V8 lacks `atob`/`btoa` — polyfill needed for `entities` library
PuerTS V8 doesn't provide browser globals like `atob`/`btoa`. The `entities` library (used by htmlparser2) calls `atob()` at module init to decode base64 entity tables. Fix: inject an `atob` polyfill via esbuild's `banner` option so it's available before any module code runs.

### PuerTS `Eval<object>` returns `Puerts.ArrayBuffer` for JS typed arrays
PuerTS marshals JS `Uint8Array` and `ArrayBuffer` as `Puerts.ArrayBuffer` on the C# side, not `byte[]`. `Eval<byte[]>` returns null. The correct approach: `Eval<object>`, check `result is Puerts.ArrayBuffer ab`, then read `ab.Bytes` to get the `byte[]`.

### PuerTS V8 lacks TextEncoder/TextDecoder — polyfill needed for binary serialization
PuerTS V8 doesn't provide `TextEncoder` or `TextDecoder` (Web APIs). Fix: inject UTF-8 polyfills via esbuild's `banner` option alongside the existing `atob` polyfill.
