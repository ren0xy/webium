# Requirements Document: CSS Engine

## Introduction

The CSS Engine segment covers CSS parsing and style resolution for Webium. This includes integrating css-tree (a JS-based CSS parser running inside PuerTS), implementing specificity calculation, the cascade algorithm, style inheritance, computed style resolution, and pseudo-state handling (hover, focus). The CSS engine parses `<style>` tags and inline styles, resolves which rules apply to which nodes, and passes computed values to the C# side for rendering.

## Status

This spec has not been started. It depends on `001-core-foundation` being implemented first.

## References

- [VISION.md](../../../VISION.md) — CSS Parsing section, Hard Problems (CSS cascade/specificity/inheritance), v0.3 Full Event Model & Styles milestone
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
