# Requirements Document: PuerTS Bridge

## Introduction

The PuerTS Bridge segment covers the JS↔C# interop layer that connects JavaScript code running in PuerTS to the C# VirtualDOM. This includes the binding registration mechanism, mutation batching to minimize per-property interop calls, the marshalling of JS DOM operations into C# VirtualNode mutations, and the dirty-flag system that queues changes for the per-frame reconciliation loop.

## Status

This spec has not been started. It depends on `001-core-foundation` being implemented first.

## References

- [VISION.md](../../../VISION.md) — Architecture (Two-sided design), Hard Problems (PuerTS ↔ C# interop overhead, batch mutations)
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
