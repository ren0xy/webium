# Requirements Document: Modding Runtime

## Introduction

The Modding Runtime segment covers the sandboxed JavaScript execution environment that enables runtime UI modding in Unity games. This includes isolated JS contexts per addon (so mods can't interfere with each other), a mod manifest format that declares metadata and entry points, an addon loader that reads HTML/CSS/JS bundles from disk at runtime, hot-reload support for loading and unloading mods without restarting the game, and a game-defined API surface that exposes safe data (inventory, player info, etc.) to mod scripts.

## Status

This spec has not been started. It depends on `001-core-foundation` being implemented first.

## References

- [VISION.md](../../../VISION.md) — v0.5 Modding Runtime milestone, Goals (runtime UI modding), Target Audience (modders, game studios)
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
