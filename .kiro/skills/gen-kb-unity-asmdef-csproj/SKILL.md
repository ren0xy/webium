---
name: gen-kb-unity-asmdef-csproj
description: Knowledge about Unity asmdef/csproj interplay, DLL meta files, InternalsVisibleTo, and dotnet build integration within Unity projects.
---

### Unity DLL .meta files need PluginImporter section
A minimal `.meta` file (just `fileFormatVersion` + `guid`) is not enough for Unity to recognize a DLL as a plugin. The `.meta` must include a `PluginImporter` section with `isExplicitlyReferenced: 1` and `platformData` entries.

### Prefer asmdefs over precompiled DLLs for pure C# projects
If a C# project targets netstandard2.1 with zero NuGet dependencies, create an asmdef with `noEngineReferences: true` instead of precompiling to DLL. This eliminates the Plugins folder, DLL build/copy steps, and fragile PluginImporter .meta files.

### InternalsVisibleTo must match asmdef name, not csproj assembly name
When converting from csproj to asmdef compilation, `InternalsVisibleTo` attributes must reference the asmdef `name` field (e.g., `"webium.jsruntime"`) not the csproj assembly name (e.g., `"Webium.JSRuntime"`). Unity names compiled assemblies after the asmdef name.

### Delete bin.meta and obj.meta to prevent Unity scanning dotnet build artifacts
If a folder inside a UPM package has a `.meta` file, Unity will scan it. `bin/` and `obj/` folders from `dotnet build` contain .NET assemblies that conflict with Unity's compilation. Delete `bin.meta` and `obj.meta` files, and ensure `bin/` and `obj/` are in `.gitignore`.

### dotnet build obj/ folder causes duplicate attribute errors when inside Unity asmdef tree
When a `.csproj` lives inside an asmdef folder, `dotnet build` generates `obj/<config>/<tfm>/<AssemblyName>.AssemblyInfo.cs` with assembly attributes that conflict with Unity's own auto-generated attributes. Delete `bin/` and `obj/` before opening Unity, or configure `<BaseOutputPath>` to output outside the asmdef folder tree.

### Precompiled DLLs mask stale source code — asmdef compilation exposes it
When switching from precompiled DLLs to asmdef-based compilation, expect a cascade of stale code errors. The old DLL contained types that no longer exist in source. Files that compiled against the DLL will fail against source. Check all assemblies.

### PackageInfo is ambiguous between UnityEditor.PackageManager and UnityEditor
`using UnityEditor.PackageManager;` imports `PackageInfo` which conflicts with the deprecated `UnityEditor.PackageInfo`. Always fully qualify as `UnityEditor.PackageManager.PackageInfo.FindForAssembly(...)` to avoid CS0104.

### Use Directory.Build.props to redirect dotnet build output to bin~/obj~
Unity ignores folders ending with `~`. Place a `Directory.Build.props` that sets `BaseOutputPath` to `bin~`, `BaseIntermediateOutputPath` to `obj~`, and `MSBuildProjectExtensionsPath` to match. This must be in `Directory.Build.props` (not csproj) because `BaseIntermediateOutputPath` must be set before `Microsoft.Common.props` is imported.

### Directory.Build.props needed in every folder tree with csproj files
The `src/Directory.Build.props` that redirects `bin`/`obj` to `bin~`/`obj~` only applies to projects under `src/`. Any other folder tree with `.csproj` files (e.g., `Tests/`) needs its own copy. Also remove any tracked `bin.meta`/`obj.meta` files via `git rm --cached`.
