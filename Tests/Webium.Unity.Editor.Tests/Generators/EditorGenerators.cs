using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck;
using Webium.Core;
using Webium.Editor;

namespace Webium.Tests.Editor.Generators
{
    /// <summary>
    /// FsCheck generators for editor tooling property-based tests.
    /// Uses NodeSnapshot (lightweight DTO) instead of VirtualNode/VirtualDOM.
    /// </summary>
    public static class EditorGenerators
    {
        public static readonly string[] TagNames = { "div", "span", "p", "img" };
        public static readonly string[] AttrNames = { "class", "id", "type", "name", "data-id", "role" };
        public static readonly string[] AttrValues = { "card", "header", "main", "active", "hidden", "button", "nav" };
        public static readonly string[] StyleProperties = { "color", "font-size", "display", "margin", "padding", "width" };
        public static readonly string[] StyleValues = { "red", "blue", "16px", "block", "none", "auto", "0", "100%" };

        public static Gen<NodeTag> ElementTagGen() =>
            Gen.Elements(NodeTag.Div, NodeTag.Span, NodeTag.P, NodeTag.Img);

        public static Gen<NodeTag> AnyTagGen() =>
            Gen.Elements(NodeTag.Div, NodeTag.Span, NodeTag.P, NodeTag.Img, NodeTag.Text);

        public static Gen<Dictionary<string, string>> AttributesGen() =>
            Gen.Choose(0, 3).SelectMany(count =>
                Gen.ListOf(count,
                    Gen.Elements(AttrNames).SelectMany(k =>
                        Gen.Elements(AttrValues), (k, v) => new KeyValuePair<string, string>(k, v)))
                .Select(pairs =>
                {
                    var dict = new Dictionary<string, string>();
                    foreach (var kvp in pairs)
                        dict[kvp.Key] = kvp.Value;
                    return dict;
                }));

        public static Gen<string> TextContentGen() =>
            Gen.Frequency(
                Tuple.Create(3, Gen.Constant((string)null)),
                Tuple.Create(3, Gen.Elements("Hello", "World", "Click me", "Short")),
                Tuple.Create(2, Gen.Constant("This is a longer text that exceeds twenty characters easily")),
                Tuple.Create(2, Arb.Generate<NonEmptyString>().Select(s => s.Get))
            );

        private static int _nextId = 1;

        /// <summary>
        /// Generates a standalone NodeSnapshot with random Id, Tag, Attributes, and TextContent.
        /// </summary>
        public static Gen<NodeSnapshot> NodeSnapshotGen() =>
            AnyTagGen().SelectMany(tag =>
                AttributesGen().SelectMany(attrs =>
                    TextContentGen().Select(text =>
                    {
                        var node = new NodeSnapshot
                        {
                            Id = System.Threading.Interlocked.Increment(ref _nextId),
                            Tag = tag,
                            TextContent = tag == NodeTag.Text ? (text ?? "") : text,
                            Attributes = attrs
                        };
                        return node;
                    })));

        /// <summary>
        /// Generates a NodeSnapshot element (non-Text) with random properties.
        /// </summary>
        public static Gen<NodeSnapshot> ElementSnapshotGen() =>
            ElementTagGen().SelectMany(tag =>
                AttributesGen().Select(attrs =>
                    new NodeSnapshot
                    {
                        Id = System.Threading.Interlocked.Increment(ref _nextId),
                        Tag = tag,
                        Attributes = attrs
                    }));

        /// <summary>
        /// Generates a NodeSnapshot text node with random TextContent.
        /// </summary>
        public static Gen<NodeSnapshot> TextSnapshotGen() =>
            TextContentGen().Select(text =>
                new NodeSnapshot
                {
                    Id = System.Threading.Interlocked.Increment(ref _nextId),
                    Tag = NodeTag.Text,
                    TextContent = text ?? ""
                });

        /// <summary>
        /// Generates a small NodeSnapshot tree with depth ≤ 4 and breadth ≤ 5.
        /// Returns (root, allNodes).
        /// </summary>
        public static Gen<(NodeSnapshot root, List<NodeSnapshot> allNodes)> NodeSnapshotTreeGen() =>
            Gen.Choose(2, 10).SelectMany(nodeCount =>
                Gen.ListOf(nodeCount, ElementTagGen()).SelectMany(tags =>
                    Gen.ListOf(nodeCount, AttributesGen()).Select(attrsList =>
                    {
                        var root = new NodeSnapshot
                        {
                            Id = System.Threading.Interlocked.Increment(ref _nextId),
                            Tag = NodeTag.Div
                        };
                        var allNodes = new List<NodeSnapshot> { root };

                        for (int i = 0; i < nodeCount; i++)
                        {
                            var node = new NodeSnapshot
                            {
                                Id = System.Threading.Interlocked.Increment(ref _nextId),
                                Tag = tags[i],
                                Attributes = attrsList[i]
                            };

                            NodeSnapshot parent = null;
                            for (int attempt = 0; attempt < 5; attempt++)
                            {
                                var candidate = allNodes[i % allNodes.Count];
                                int depth = GetDepth(candidate, root);
                                if (depth < 4 && candidate.Children.Count < 5)
                                {
                                    parent = candidate;
                                    break;
                                }
                            }
                            if (parent == null) parent = root;

                            parent.Children.Add(node);
                            allNodes.Add(node);
                        }

                        return (root, allNodes);
                    })));

        private static int GetDepth(NodeSnapshot node, NodeSnapshot root)
        {
            // Simple BFS depth calculation
            return GetDepthRecursive(root, node, 0);
        }

        private static int GetDepthRecursive(NodeSnapshot current, NodeSnapshot target, int depth)
        {
            if (current == target) return depth;
            foreach (var child in current.Children)
            {
                int result = GetDepthRecursive(child, target, depth + 1);
                if (result >= 0) return result;
            }
            return -1;
        }

        // ── MutationEntry generator ──

        public static Gen<MutationEntryType> MutationEntryTypeGen() =>
            Gen.Elements(
                MutationEntryType.CreateElement,
                MutationEntryType.CreateTextNode,
                MutationEntryType.AppendChild,
                MutationEntryType.RemoveChild,
                MutationEntryType.InsertBefore,
                MutationEntryType.SetAttribute,
                MutationEntryType.StyleChange);

        public static Gen<MutationEntry> MutationEntryGen() =>
            MutationEntryTypeGen().SelectMany(type =>
                Gen.Choose(0, 10000).SelectMany(frame =>
                    Gen.Choose(0, 100000).SelectMany(tsRaw =>
                        Gen.Choose(0, 999).SelectMany(nodeId =>
                            Gen.Elements(TagNames).SelectMany(tag =>
                                Gen.Elements("parent=#0", "class=active", "color=red", "display=none", "id=main")
                                .Select(detail =>
                                    new MutationEntry
                                    {
                                        FrameNumber = frame,
                                        Timestamp = tsRaw / 100f,
                                        Type = type,
                                        TargetNodeId = nodeId,
                                        TargetTag = tag,
                                        Detail = detail
                                    }))))));

        public static Gen<List<MutationEntry>> MutationEntryListGen(int minCount, int maxCount) =>
            Gen.Choose(minCount, maxCount).SelectMany(count =>
                Gen.ListOf(count, MutationEntryGen())
                   .Select(entries => entries.ToList()));

        // ── Search query generator ──

        public static Gen<string> SearchQueryGen() =>
            Gen.Frequency(
                Tuple.Create(2, Gen.Choose(0, 100).Select(id => id.ToString())),
                Tuple.Create(2, Gen.Elements("div", "Div", "DIV", "span", "Span", "img", "p", "text")),
                Tuple.Create(2, Gen.Elements(AttrValues)),
                Tuple.Create(1, Arb.Generate<NonEmptyString>().Select(s => s.Get)),
                Tuple.Create(1, Gen.Constant("")),
                Tuple.Create(1, Gen.Constant((string)null))
            );

        public static Gen<string> NonEmptySearchQueryGen() =>
            Gen.Frequency(
                Tuple.Create(2, Gen.Choose(0, 100).Select(id => id.ToString())),
                Tuple.Create(3, Gen.Elements("div", "Div", "DIV", "span", "Span", "img", "p")),
                Tuple.Create(2, Gen.Elements(AttrValues)),
                Tuple.Create(1, Arb.Generate<NonEmptyString>().Select(s => s.Get))
            );
    }
}
