# Implementation Plan: Repository Initialization

## Overview

Bootstrap the Webium repository from a bare git repo into a fully structured UPM package skeleton. All tasks produce static files — no runtime logic. The final phase creates dedicated spec directory stubs for each of the 9 logical segments identified in the design.

## Tasks

- [ ] 1. Mandatory — Core Implementation
  - [x] 1.1 UPM package manifest and metadata files
    - [x] 1.1.1 Create `package.json` at the repository root with UPM manifest fields: name `com.webium.core`, version `0.1.0`, displayName `Webium`, unity `2021.3`, author from LICENSE
      - _Requirements: 1.1, 1.2_
    - [x] 1.1.2 Create `README.md` at the repository root with project name, one-line description, and sections: Installation, Usage, License
      - _Requirements: 5.1_
    - [x] 1.1.3 Create `CHANGELOG.md` at the repository root in Keep a Changelog format with an `[Unreleased]` section
      - _Requirements: 5.2_

  - [x] 1.2 Git ignore configuration
    - [x] 1.2.1 Create `.gitignore` at the repository root with OS exclusions (`.DS_Store`, `Thumbs.db`), IDE exclusions (`.idea/`, `.vs/`, `.vscode/`, `*.csproj`, `*.sln`), Unity exclusions (`Library/`, `Temp/`, `Logs/`, `obj/`, `Build/`, `Builds/`), compiled artifact exclusions (`*.dll`, `*.pdb`, `*.mdb`) with negation patterns for `Plugins/` directory
      - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 1.3 Runtime directory structure and assembly definition
    - [x] 1.3.1 Create `Runtime/webium.runtime.asmdef` with assembly name `webium.runtime`, root namespace `Webium`, and standard UPM asmdef fields
      - _Requirements: 3.1, 3.3_
    - [x] 1.3.2 Create placeholder stub `Runtime/Core/VirtualNode.cs` with namespace `Webium.Core` and empty internal class `VirtualNode`
      - _Requirements: 2.2, 6.1, 6.3_
    - [x] 1.3.3 Create placeholder stub `Runtime/Components/ComponentRenderer.cs` with namespace `Webium.Components` and empty internal class `ComponentRenderer`
      - _Requirements: 2.2, 6.1, 6.3_
    - [x] 1.3.4 Create placeholder stub `Runtime/API/DocumentAPI.cs` with namespace `Webium.API` and empty internal class `DocumentAPI`
      - _Requirements: 2.2, 6.1, 6.3_
    - [x] 1.3.5 Create placeholder stub `Runtime/Bridge/PuertsBridge.cs` with namespace `Webium.Bridge` and empty internal class `PuertsBridge`
      - _Requirements: 2.2, 6.1, 6.3_

  - [x] 1.4 Editor directory structure and assembly definition
    - [x] 1.4.1 Create `Editor/webium.editor.asmdef` with assembly name `webium.editor`, root namespace `Webium.Editor`, reference to `webium.runtime`, and `includePlatforms: ["Editor"]`
      - _Requirements: 3.2, 3.3_
    - [x] 1.4.2 Create placeholder stub `Editor/WebiumInspector.cs` with namespace `Webium.Editor` and empty internal class `WebiumInspector`
      - _Requirements: 6.1, 6.3_

  - [x] 1.5 Plugins, Resources, and Samples directories
    - [x] 1.5.1 Create `Plugins/Yoga/.gitkeep` to establish the Yoga plugin directory
      - _Requirements: 2.3_
    - [x] 1.5.2 Create `Resources~/js/.gitkeep` to establish the JS shims directory
      - _Requirements: 2.4_
    - [x] 1.5.3 Create `Samples~/HelloWorld/.gitkeep` and `Samples~/ReactApp/.gitkeep` to establish sample directories
      - _Requirements: 2.5_

  - [x] 1.6 Checkpoint — verify scaffold completeness
    - Ensure all directories and files from the design document exist. Verify `package.json` and `.asmdef` files are valid JSON. Verify `.cs` stubs follow the namespace + empty class template. Ask the user if questions arise.

  - [ ] 1.7 Create segment spec directory stubs
    - [ ] 1.7.1 Create `.kiro/specs/001-core-foundation/requirements.md` stub — scope: VirtualDOM, VirtualNode, shared interfaces and base types. Reference VISION.md Architecture and v0.1 milestone. Note: this is the base spec all others depend on, no dependencies.
      - _Requirements: 7.1, 7.2, 8.1, 8.2, 8.3, 8.4_
    - [ ] 1.7.2 Create `.kiro/specs/002-layout-engine/requirements.md` stub — scope: Yoga integration, flexbox computation, RectTransform sync. Reference VISION.md Layout section and v0.1 milestone. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.3 Create `.kiro/specs/003-component-renderers/requirements.md` stub — scope: DivRenderer, ImageRenderer, TextRenderer, mapping virtual nodes to Unity UI components. Reference VISION.md CSS→Unity Mapping and v0.1/v0.2 milestones. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.4 Create `.kiro/specs/004-browser-api/requirements.md` stub — scope: DocumentAPI, WindowAPI, ElementAPI, JS-facing DOM/window APIs. Reference VISION.md Required Browser API Surface and v0.1–v0.4 milestones. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.5 Create `.kiro/specs/005-puerts-bridge/requirements.md` stub — scope: JS↔C# interop layer, mutation batching, PuerTS bindings. Reference VISION.md Architecture (Two-sided design) and Hard Problems (interop overhead). Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.6 Create `.kiro/specs/006-event-system/requirements.md` stub — scope: addEventListener, removeEventListener, dispatchEvent, bubbling, capture, stopPropagation, preventDefault. Reference VISION.md Required Browser API Surface (Events) and v0.3 milestone. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.7 Create `.kiro/specs/007-css-engine/requirements.md` stub — scope: css-tree integration, CSS parsing, specificity, cascade, style resolution, computed styles, pseudo-states. Reference VISION.md CSS Parsing section and v0.3 milestone. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.8 Create `.kiro/specs/008-modding-runtime/requirements.md` stub — scope: sandboxed JS execution contexts, hot-reload, mod manifest format, addon loader. Reference VISION.md v0.5 milestone. Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_
    - [ ] 1.7.9 Create `.kiro/specs/009-editor-tooling/requirements.md` stub — scope: WebiumInspector, editor utilities, debugging aids. Reference VISION.md Repository Structure (Editor/). Depends on 001-core-foundation.
      - _Requirements: 7.1, 7.3, 8.1, 8.2, 8.4_

  - [ ] 1.8 Final checkpoint — all files created and verified
    - Ensure all 9 segment spec directories exist with `requirements.md` stubs. Verify naming convention matches `^[0-9]{3}-[a-z0-9-]+$`. Ask the user if questions arise.

- [ ]* 2. Optional — Verification Tests / Stretch Goals
  - [ ]* 2.1 Scaffold verification tests
    - [ ]* 2.1.1 Property test: all `.cs` stub files in `Runtime/` and `Editor/` match the placeholder template (namespace + empty internal class)
      - **Property 1: Placeholder stub structure consistency**
      - **Validates: Requirements 6.3**
    - [ ]* 2.1.2 Property test: all segment spec directories under `.kiro/specs/` (excluding `000-repo-init`) match the naming pattern `^[0-9]{3}-[a-z0-9-]+$`
      - **Property 2: Spec directory naming convention**
      - **Validates: Requirements 8.2**
    - [ ]* 2.1.3 Property test: all segment spec directories contain a `requirements.md` with segment scope summary and VISION.md reference
      - **Property 3: Spec stub completeness**
      - **Validates: Requirements 8.4**
  - [ ]* 2.2 JSON validation tests
    - [ ]* 2.2.1 Unit test: `package.json` is valid JSON with required UPM fields (name, version, displayName, unity)
      - _Requirements: 1.1, 1.2_
    - [ ]* 2.2.2 Unit test: `webium.runtime.asmdef` and `webium.editor.asmdef` are valid JSON with correct assembly names and no circular references
      - _Requirements: 3.1, 3.2, 3.3_
  - [ ]* 2.3 Gitignore coverage tests
    - [ ]* 2.3.1 Unit test: `.gitignore` contains patterns for OS files, IDE metadata, Unity generated files, and compiled artifacts with Plugins exception
      - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

## Notes

- Tasks marked with `*` are optional verification tests — the scaffold itself is the primary deliverable.
- All tasks produce static files. No runtime C# logic is implemented in this spec.
- The 9 segment spec stubs are planning artifacts. Actual implementation of each segment happens in its own spec.
- Core Foundation (001) must be implemented before any other segment spec.
- All non-Core segments (002–009) are independent of each other.
