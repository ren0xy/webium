/**
 * Ported from C# Webium.Core/NodeTag.cs
 */
export enum NodeTag {
  Div = 0,
  Span = 1,
  P = 2,
  Img = 3,
  Text = 4,
  Style = 5,
  Unknown = 6,
}

/**
 * Ported from C# Webium.Core/DirtyFlags.cs
 * Bit flags indicating which aspects of a node have changed.
 */
export enum DirtyFlags {
  None = 0,
  Tree = 1 << 0,
  Style = 1 << 1,
  Attributes = 1 << 2,
  Text = 1 << 3,
  All = Tree | Style | Attributes | Text,
}

/**
 * Ported from C# Webium.Core/PseudoStates.cs
 * Bit flags for pseudo-state tracking on virtual nodes.
 */
export enum PseudoStates {
  None = 0,
  Hover = 1 << 0,
  Focus = 1 << 1,
}
