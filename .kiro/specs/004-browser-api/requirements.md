# Requirements Document: Browser API Surface

## Introduction

The Browser API Surface segment covers the JS-facing DOM and window APIs that make Webium look like a real browser to JavaScript code. This includes DocumentAPI (createElement, createTextNode, getElementById, querySelector), WindowAPI (requestAnimationFrame, setTimeout, setInterval, getComputedStyle, innerWidth/Height), and ElementAPI (setAttribute, getAttribute, classList, style, id, className). These APIs are exposed to PuerTS so that standard JS libraries like react-dom can operate unmodified.

## Status

This spec has not been started. It depends on `001-core-foundation` being implemented first.

## References

- [VISION.md](../../../VISION.md) — Required Browser API Surface table, v0.1 through v0.4 milestones
- [000-repo-init](../000-repo-init/) — Repository structure and segment breakdown
