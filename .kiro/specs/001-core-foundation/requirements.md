# Requirements Document: Core Foundation

## Introduction

Core Foundation covers the shared base layer of Webium: the VirtualDOM tree, VirtualNode data structure, shared interfaces, and base types that all other segments depend on. This includes `createElement`, `appendChild`, `removeChild`, the per-frame dirty-node reconciliation loop, and the foundational C# object model that maps virtual nodes to Unity GameObjects.

This is the first segment to implement. All other segments (Layout Engine, Component Renderers, Browser API, PuerTS Bridge, Event System, CSS Engine, Modding Runtime, Editor Tooling) depend on Core Foundation being in place.

## Status

This spec has not been started. It has no dependencies on other segments — this is the base spec.

## References

- [VISION.md](../../../VISION.md) — Architecture (Two-sided design, VirtualDOM, VirtualNode), v0.1 Proof of Concept milestone
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
