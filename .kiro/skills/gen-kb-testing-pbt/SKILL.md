---
name: gen-kb-testing-pbt
description: Knowledge about property-based testing with fast-check (JS) and FsCheck (C#), including generator patterns and API quirks.
---

### fast-check v4 missing APIs — use `fc.stringMatching` as workaround
`fc.stringOf(charArb)`, `fc.fullUnicode()`, and `fc.fullUnicodeString()` are not available in fast-check v4.5.3. To generate strings from a constrained character set or broad Unicode range, use `fc.stringMatching(/^[charset]{min,max}$/)` or `fc.stringMatching(/^[\s\S]{0,N}$/)`.

### htmlparser2 follows HTML spec implicit tag closing rules
When writing property-based tests for HTML tree structure, only `div` and `span` allow truly arbitrary nesting. Tags like `li`, `p`, `h1`-`h6`, `button`, and `a` have implicit closing behavior in htmlparser2. Restrict PBT generators to `div`/`span` for nesting tests.

### PBT generators with Map keys must ensure uniqueness across generated items
When building a `Map<string, T>` from PBT-generated data, duplicate keys cause silent overwrites. Prefix keys with the array index to guarantee uniqueness regardless of generator output.

### `fc.letrec` for recursive HTML fragment generation in PBTs
Use `fc.letrec` with a `depthIdentifier` to generate recursive HTML structures for innerHTML round-trip tests. Define `tree`, `text`, and `element` ties where `element` wraps children in `<div>` or `<span>` tags.

### `fc.RecordValue` requires 2 type arguments in fast-check v4
`fc.RecordValue<typeof arb>` fails with "Generic type 'RecordValue' requires 2 type argument(s)" in fast-check v4. Use an explicit union type for the generated record shape instead.

### FsCheck `Prop.ForAll` accepts at most 6 arbitraries
FsCheck 2.x `Prop.ForAll` overloads max out at 6 type parameters. When a property test needs more inputs, combine multiple generators into a single `Arbitrary<T>` using LINQ query syntax and call `gen.ToArbitrary()`.

### E2E property tests need to drain initial dirty nodes before assertions
When testing end-to-end flows involving reconciliation engines, newly created nodes start dirty. Call `tick()` once and clear the output buffer before the actual test to avoid initial creation commands polluting assertions about event-driven mutations.
