# Unity Development Project Setup

Guide for setting up a new Unity project to develop and test Webium, mirroring the `webium-dev` project structure. The Unity project and the `webium` package live as sibling folders, linked via a local UPM path reference.

## Prerequisites

- Unity 2022.3 LTS or newer (installed via Unity Hub)
- Git, Node.js, npm, and .NET SDK on PATH

## Folder Structure

```
parent-folder/
  webium/          ← the Webium UPM package (this repo)
  your-project/    ← your Unity project (created below)
```

Both repos are siblings in the same parent directory. The Unity project references Webium via a relative `file:` path in its package manifest.

## Step 1: Create the Unity Project

Create a new Unity project via Unity Hub. Place it as a sibling to the `webium` folder. For example, if `webium` is at `~/dev/webium`, create the project at `~/dev/your-project`.

## Step 2: Link Webium as a Local UPM Package

Edit `your-project/Packages/manifest.json`. Add the Webium dependency and the OpenUPM scoped registry for PuerTS:

```json
{
  "scopedRegistries": [
    {
      "name": "OpenUPM",
      "url": "https://package.openupm.com",
      "scopes": ["com.tencent.puerts"]
    }
  ],
  "dependencies": {
    "com.webium.core": "file:../../webium",
    ...existing dependencies...
  }
}
```

The `file:../../webium` path is relative to the `Packages/` folder — it goes up two levels (out of `Packages/`, out of `your-project/`) to reach the sibling `webium` folder.

Do NOT overwrite existing dependencies or scoped registries — merge into what's already there.

## Step 3: Build the JS Bundle

Webium's TypeScript core must be bundled before Unity can use it:

```bash
cd ../webium/packages~/core
npm install
npm run build:bundle
```

This produces `webium/build~/webium-bootstrap.js`. The bundle must also be placed as a Unity TextAsset:

```bash
mkdir -p ../webium/src/Webium.Unity.Runtime/Resources
cp ../webium/build~/webium-bootstrap.js ../webium/src/Webium.Unity.Runtime/Resources/webium-bootstrap.txt
```

The `.txt` extension is required so Unity treats it as a `TextAsset`. The C# runtime loads it via `Resources.Load<TextAsset>("webium-bootstrap")`.

## Step 4: Verify Dependencies

Unity auto-resolves these from Webium's `package.json`:

- `com.tencent.puerts.core` 2.1.0 — JS runtime (V8/QuickJS) for desktop/mobile
- `com.unity.textmeshpro` 3.0.6 — text rendering
- `com.unity.ugui` 2.0.0 — UI system

Check the Unity Package Manager window to confirm all three appear.

## Step 5: Create a Test Scene

1. Create a new scene (e.g., `Assets/Scenes/WebiumTest.unity`)
2. Create an empty GameObject named "Webium"
3. Add the `WebiumSurface` component (namespace `Webium.Unity`)
4. Add the `WebiumBootstrapper` component (same namespace)
5. Set `_uiFolderPath` on WebiumBootstrapper to `examples/hello-world` (resolved relative to the Webium package root)
6. Press Play — you should see a Canvas with rendered HTML content

## Setup Script (Optional)

Create a `setup.ps1` at your project root to automate steps 3:

```powershell
$ErrorActionPreference = "Stop"
$webiumPath = Join-Path (Join-Path $PSScriptRoot "..") "webium"

if (-not (Test-Path $webiumPath)) {
    Write-Error "Webium not found at $webiumPath. Clone it as a sibling folder first."
    exit 1
}

Push-Location (Join-Path (Join-Path $webiumPath "packages") "core")
npm install
npm run build:bundle
Pop-Location

New-Item -ItemType Directory -Force -Path (Join-Path $webiumPath "src" | Join-Path -ChildPath "Webium.Unity.Runtime" | Join-Path -ChildPath "Resources")
Copy-Item (Join-Path (Join-Path $webiumPath "build") "webium-bootstrap.js") `
          (Join-Path $webiumPath "src" | Join-Path -ChildPath "Webium.Unity.Runtime" | Join-Path -ChildPath "Resources" | Join-Path -ChildPath "webium-bootstrap.txt")

Write-Host "Setup complete. Open Unity and check for compilation errors."
```

## How It Works

- Webium's `.asmdef` files are picked up automatically by Unity through the UPM local path reference — no DLL compilation needed
- `UnityPuerTSRuntime` (in `Webium.Unity.Runtime`) is the real PuerTS adapter for desktop/mobile. `PuerTSRuntime` in `Webium.JSRuntime` is a stub for the `dotnet test` pipeline only
- `WebiumSurface.Awake()` auto-selects the runtime: `BrowserRuntime` for WebGL, `UnityPuerTSRuntime` for everything else
- Layout is handled JS-side via yoga-layout WASM — no native layout DLLs needed

## Known Limitations

- WebGL builds: `BrowserRuntime` has extern declarations but no `.jslib` implementation yet — only Editor/Desktop via PuerTS works
- The esbuild bundle step must be re-run whenever `@webium/core` TypeScript source changes
- `WebiumBootstrapper._uiFolderPath` resolves relative to `Application.dataPath` or the Webium package root

## Verification Checklist

- [ ] Unity compiles with no errors
- [ ] PuerTS, TextMeshPro, and UGUI appear in Package Manager
- [ ] `webium/src/Webium.Unity.Runtime/Resources/webium-bootstrap.txt` exists and contains JS code
- [ ] Test scene has a GameObject with WebiumSurface + WebiumBootstrapper
- [ ] Pressing Play shows a Canvas with rendered HTML elements in the hierarchy
