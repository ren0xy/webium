# Design Document: Repository Initialization

## Overview

This spec bootstraps the Webium repository from a bare git repo (containing only `VISION.md`, `LICENSE`, and `.kiro/`) into a fully structured Unity UPM package skeleton. The deliverables are:

1. A valid UPM `package.json` at the root.
2. The complete directory tree from the vision document with assembly definitions and placeholder stubs.
3. A `.gitignore` tailored for Unity UPM package development.
4. `README.md` and `CHANGELOG.md` metadata files.
5. Identification of 9 logical segments, each with a dedicated spec directory stub under `.kiro/specs/`.

No runtime logic is implemented in this spec — only the scaffold that future specs build upon.

## Architecture

The repo initialization is a pure file-generation task. There is no runtime architecture to design. The key architectural decision is the mapping from the vision document's repository structure to concrete files and directories.

```
webium/
├── .gitignore
├── .kiro/
│   ├── steering/
│   │   └── task-format.md          (existing)
│   └── specs/
│       ├── 000-repo-init/          (this spec)
│       ├── 001-core-foundation/    (stub)
│       ├── 002-layout-engine/      (stub)
│       ├── 003-component-renderers/(stub)
│       ├── 004-browser-api/        (stub)
│       ├── 005-puerts-bridge/      (stub)
│       ├── 006-event-system/       (stub)
│       ├── 007-css-engine/         (stub)
│       ├── 008-modding-runtime/    (stub)
│       └── 009-editor-tooling/     (stub)
├── package.json
├── CHANGELOG.md
├── README.md
├── LICENSE                         (existing)
├── VISION.md                       (existing)
├── Runtime/
│   ├── webium.runtime.asmdef
│   ├── Core/
│   │   └── VirtualNode.cs          (placeholder stub)
│   ├── Components/
│   │   └── ComponentRenderer.cs    (placeholder stub)
│   ├── API/
│   │   └── DocumentAPI.cs          (placeholder stub)
│   └── Bridge/
│       └── PuertsBridge.cs         (placeholder stub)
├── Editor/
│   ├── webium.editor.asmdef
│   └── WebiumInspector.cs          (placeholder stub)
├── Plugins/
│   └── Yoga/
│       └── .gitkeep
├── Resources~/
│   └── js/
│       └── .gitkeep
└── Samples~/
    ├── HelloWorld/
    │   └── .gitkeep
    └── ReactApp/
        └── .gitkeep
```

### Design Decisions

1. **`.gitkeep` for empty directories**: Git does not track empty directories. Directories that have no placeholder code files (Plugins/Yoga, Resources~/js, Samples/) use `.gitkeep` sentinel files.

2. **Tilde-suffixed directories**: `Resources~/` and `Samples~/` use Unity's tilde convention, which tells Unity to exclude them from the asset import pipeline. This is standard UPM practice.

3. **Placeholder stubs are minimal**: Each `.cs` stub contains only a namespace and an empty internal class. This ensures the assembly definitions compile without errors while adding zero implementation.

4. **Spec numbering starts at 001**: The `000` prefix is reserved for this repo-init spec. Segment specs start at `001` (Core Foundation) and go through `009` (Editor Tooling). Core Foundation is `001` because all other segments depend on it.

5. **Segment independence**: All segments except Core Foundation are independent of each other. The dependency graph is a star: Core Foundation at the center, all others depending only on it.

## Components and Interfaces

Since this is a scaffolding spec, "components" are the files being generated. No runtime interfaces are defined here — those belong to the segment specs.

### File Components

| File | Purpose | Requirements |
|------|---------|-------------|
| `package.json` | UPM manifest — declares package identity, version, Unity compatibility | 1.1, 1.2 |
| `Runtime/webium.runtime.asmdef` | Defines the runtime C# assembly | 3.1, 3.3 |
| `Editor/webium.editor.asmdef` | Defines the editor C# assembly with runtime dependency | 3.2, 3.3 |
| `.gitignore` | Excludes OS, IDE, Unity, and build artifacts | 4.1–4.5 |
| `README.md` | Project overview and quick-start documentation | 5.1 |
| `CHANGELOG.md` | Version history in Keep a Changelog format | 5.2 |
| `Runtime/Core/VirtualNode.cs` | Placeholder stub for Core namespace | 6.1–6.3 |
| `Runtime/Components/ComponentRenderer.cs` | Placeholder stub for Components namespace | 6.1–6.3 |
| `Runtime/API/DocumentAPI.cs` | Placeholder stub for API namespace | 6.1–6.3 |
| `Runtime/Bridge/PuertsBridge.cs` | Placeholder stub for Bridge namespace | 6.1–6.3 |
| `Editor/WebiumInspector.cs` | Placeholder stub for Editor namespace | 6.1–6.3 |

### Spec Directory Stubs

Each segment gets a spec directory with a `requirements.md` stub:

| Spec Directory | Segment | Depends On |
|----------------|---------|------------|
| `001-core-foundation` | VirtualDOM, VirtualNode, shared interfaces, base types | None (this is the base) |
| `002-layout-engine` | Yoga integration, flexbox, RectTransform sync | 001 |
| `003-component-renderers` | DivRenderer, ImageRenderer, TextRenderer | 001 |
| `004-browser-api` | DocumentAPI, WindowAPI, ElementAPI | 001 |
| `005-puerts-bridge` | JS↔C# interop, mutation batching | 001 |
| `006-event-system` | addEventListener, bubbling, capture, dispatch | 001 |
| `007-css-engine` | css-tree parsing, specificity, cascade, computed styles | 001 |
| `008-modding-runtime` | Sandboxed JS contexts, hot-reload, mod manifest | 001 |
| `009-editor-tooling` | WebiumInspector, editor utilities | 001 |

## Data Models

### package.json

```json
{
  "name": "com.webium.core",
  "version": "0.1.0",
  "displayName": "Webium",
  "description": "Browser-grade DOM/CSS/JS engine for Unity UI",
  "unity": "2021.3",
  "dependencies": {},
  "author": {
    "name": "Renato Rujevcic",
    "url": "https://github.com/webium/webium"
  }
}
```

### webium.runtime.asmdef

```json
{
  "name": "webium.runtime",
  "rootNamespace": "Webium",
  "references": [],
  "includePlatforms": [],
  "excludePlatforms": [],
  "allowUnsafeCode": false,
  "overrideReferences": false,
  "precompiledReferences": [],
  "autoReferenced": true,
  "defineConstraints": [],
  "versionDefines": [],
  "noEngineReferences": false
}
```

### webium.editor.asmdef

```json
{
  "name": "webium.editor",
  "rootNamespace": "Webium.Editor",
  "references": ["webium.runtime"],
  "includePlatforms": ["Editor"],
  "excludePlatforms": [],
  "allowUnsafeCode": false,
  "overrideReferences": false,
  "precompiledReferences": [],
  "autoReferenced": true,
  "defineConstraints": [],
  "versionDefines": [],
  "noEngineReferences": false
}
```

### Placeholder C# Stub Template

Each stub follows this pattern (namespace varies by directory):

```csharp
namespace Webium.<SubNamespace>
{
    /// <summary>
    /// Placeholder — implementation provided by the dedicated segment spec.
    /// </summary>
    internal class <ClassName> { }
}
```

| Directory | Namespace | Class Name |
|-----------|-----------|------------|
| `Runtime/Core/` | `Webium.Core` | `VirtualNode` |
| `Runtime/Components/` | `Webium.Components` | `ComponentRenderer` |
| `Runtime/API/` | `Webium.API` | `DocumentAPI` |
| `Runtime/Bridge/` | `Webium.Bridge` | `PuertsBridge` |
| `Editor/` | `Webium.Editor` | `WebiumInspector` |

### Segment Spec Stub Template

Each `requirements.md` stub follows this format:

```markdown
# Requirements Document: <Segment Name>

## Introduction

<One-paragraph summary of the segment scope, referencing the relevant VISION.md sections.>

## Status

This spec has not been started. It depends on `001-core-foundation` being implemented first.

## References

- [VISION.md](../../../VISION.md) — <Relevant section>
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
```

### .gitignore Content

```gitignore
# OS generated
.DS_Store
.DS_Store?
._*
.Spotlight-V100
.Trashes
ehthumbs.db
Thumbs.db
Desktop.ini

# IDE / Editors
.idea/
.vs/
.vscode/
*.csproj
*.sln
*.suo
*.user
*.userprefs
*.pidb
*.booproj
*.svd
*.pdb.meta
*.mdb.meta

# Unity generated
[Ll]ibrary/
[Tt]emp/
[Oo]bj/
[Bb]uild/
[Bb]uilds/
[Ll]ogs/
[Mm]emoryCaptures/
[Rr]ecordings/
Asset[Ss]tore[Tt]ools/
UserSettings/

# Unity meta files for special folders (not needed in UPM packages)
# Keep .meta files — they are required for UPM packages

# Compiled output
*.dll
*.pdb
*.mdb
!Plugins/**/*.dll
!Plugins/**/*.pdb

# Crash reports
sysinfo.txt
crashlytics-build.properties

# Builds
*.apk
*.aab
*.unitypackage
*.app

# Gradle (Android)
.gradle/

# Node (if using npm tools for JS shims)
node_modules/
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system — essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

This spec is primarily a scaffolding task — most acceptance criteria are concrete examples (specific files with specific content) rather than universal properties. However, three properties emerge from the template-based generation patterns:

### Property 1: Placeholder stub structure consistency

*For any* placeholder C# stub file generated by the scaffold, the file content SHALL consist of exactly a namespace declaration and a single empty internal class with a summary doc comment — nothing more.

**Validates: Requirements 6.3**

### Property 2: Spec directory naming convention

*For any* segment spec directory created under `.kiro/specs/`, the directory name SHALL match the pattern `^[0-9]{3}-[a-z0-9-]+$` (three-digit zero-padded prefix, hyphen, kebab-case name).

**Validates: Requirements 8.2**

### Property 3: Spec stub completeness

*For any* segment spec directory created under `.kiro/specs/` (excluding `000-repo-init`), the directory SHALL contain a `requirements.md` file that includes a segment scope summary and a reference to `VISION.md`.

**Validates: Requirements 8.4**

## Error Handling

This spec generates static files — there is no runtime error handling to design. The only failure modes are:

1. **File write failures**: If the filesystem is read-only or a path is invalid, file creation will fail. This is handled by the tooling (IDE/agent) and does not require application-level error handling.
2. **Invalid JSON**: The `package.json` and `.asmdef` files must be valid JSON. The design specifies exact content, so this is verified by inspection.
3. **Compilation errors in stubs**: If a placeholder stub has a syntax error, Unity will fail to compile. The stub template is minimal (namespace + empty class), making this unlikely. Verification is done by checking the generated files.

## Testing Strategy

### Unit Tests

Given that this is a file-generation spec, "unit tests" take the form of post-generation verification checks:

- Verify `package.json` parses as valid JSON with expected fields (Requirements 1.1, 1.2)
- Verify all expected directories exist (Requirements 2.1–2.5)
- Verify `.asmdef` files parse as valid JSON with correct assembly names and references (Requirements 3.1–3.3)
- Verify `.gitignore` contains required exclusion patterns and the Plugins exception (Requirements 4.1–4.5)
- Verify `README.md` contains project name and expected sections (Requirement 5.1)
- Verify `CHANGELOG.md` contains `[Unreleased]` section (Requirement 5.2)
- Verify placeholder stubs exist in all required directories (Requirement 6.1)

### Property-Based Tests

The three correctness properties can be validated as property-based tests over the generated file sets:

- **Property 1** (stub structure): Iterate all `.cs` files in `Runtime/` and `Editor/`, parse each, assert it matches the stub template pattern.
- **Property 2** (naming convention): Iterate all directories in `.kiro/specs/` (excluding `000-repo-init`), assert each name matches the regex.
- **Property 3** (stub completeness): Iterate all segment spec directories, assert each contains `requirements.md` with required content.

Since the input domain is small (5 stub files, 9 spec directories), these are effectively exhaustive checks rather than randomized property tests. A property-based testing library is not required for this spec — simple iteration-based assertions suffice.

### Testing Library

For any automated verification scripts, use a shell script or C# test runner. Since no runtime code exists yet, formal test frameworks are deferred to the segment specs that introduce actual logic.
