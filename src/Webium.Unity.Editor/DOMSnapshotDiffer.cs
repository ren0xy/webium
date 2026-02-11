using System.Collections.Generic;
using System.Linq;
using Webium.Core;

namespace Webium.Editor
{
    /// <summary>
    /// Takes snapshots of the VirtualDOM tree and diffs consecutive frames
    /// to produce MutationEntry records for the MutationLogger.
    /// </summary>
    public class DOMSnapshotDiffer
    {
        private Dictionary<int, NodeSnapshot> _previous = new Dictionary<int, NodeSnapshot>();

        private struct NodeSnapshot
        {
            public int Id;
            public NodeTag Tag;
            public int? ParentId;
            public List<int> ChildIds;
            public Dictionary<string, string> Attributes;
            public Dictionary<string, string> InlineStyles;
            public string TextContent;
        }

        /// <summary>
        /// Snapshots the current DOM tree and returns a list of mutations
        /// detected since the last call.
        /// </summary>
        public List<MutationEntry> DiffAndUpdate(VirtualNode root, int frameNumber, float timestamp)
        {
            var mutations = new List<MutationEntry>();
            var current = new Dictionary<int, NodeSnapshot>();

            if (root != null)
                CollectSnapshot(root, current);

            DetectNewNodes(current, mutations, frameNumber, timestamp);
            DetectRemovedNodes(current, mutations, frameNumber, timestamp);
            DetectChanges(current, mutations, frameNumber, timestamp);

            _previous = current;
            return mutations;
        }

        /// <summary>Clears the stored snapshot so the next diff starts fresh.</summary>
        public void Reset()
        {
            _previous.Clear();
        }

        private void CollectSnapshot(VirtualNode node, Dictionary<int, NodeSnapshot> map)
        {
            var snap = new NodeSnapshot
            {
                Id = node.Id,
                Tag = node.Tag,
                ParentId = node.Parent?.Id,
                ChildIds = node.Children.Select(c => c.Id).ToList(),
                Attributes = new Dictionary<string, string>(node.Attributes),
                InlineStyles = new Dictionary<string, string>(node.InlineStyles),
                TextContent = node.TextContent
            };
            map[node.Id] = snap;

            foreach (var child in node.Children)
                CollectSnapshot(child, map);
        }

        private void DetectNewNodes(
            Dictionary<int, NodeSnapshot> current,
            List<MutationEntry> mutations,
            int frameNumber, float timestamp)
        {
            foreach (var kvp in current)
            {
                if (_previous.ContainsKey(kvp.Key))
                    continue;

                var snap = kvp.Value;
                var createType = snap.Tag == NodeTag.Text
                    ? MutationEntryType.CreateTextNode
                    : MutationEntryType.CreateElement;

                mutations.Add(new MutationEntry
                {
                    FrameNumber = frameNumber,
                    Timestamp = timestamp,
                    Type = createType,
                    TargetNodeId = snap.Id,
                    TargetTag = snap.Tag.ToString(),
                    Detail = snap.Tag == NodeTag.Text
                        ? TruncateText(snap.TextContent)
                        : null
                });

                // Also log the AppendChild if it has a parent
                if (snap.ParentId.HasValue)
                {
                    mutations.Add(new MutationEntry
                    {
                        FrameNumber = frameNumber,
                        Timestamp = timestamp,
                        Type = MutationEntryType.AppendChild,
                        TargetNodeId = snap.Id,
                        TargetTag = snap.Tag.ToString(),
                        Detail = $"parent=#{snap.ParentId.Value}"
                    });
                }
            }
        }

        private void DetectRemovedNodes(
            Dictionary<int, NodeSnapshot> current,
            List<MutationEntry> mutations,
            int frameNumber, float timestamp)
        {
            foreach (var kvp in _previous)
            {
                if (current.ContainsKey(kvp.Key))
                    continue;

                var snap = kvp.Value;
                if (snap.ParentId.HasValue)
                {
                    mutations.Add(new MutationEntry
                    {
                        FrameNumber = frameNumber,
                        Timestamp = timestamp,
                        Type = MutationEntryType.RemoveChild,
                        TargetNodeId = snap.Id,
                        TargetTag = snap.Tag.ToString(),
                        Detail = $"parent=#{snap.ParentId.Value}"
                    });
                }
            }
        }

        private void DetectChanges(
            Dictionary<int, NodeSnapshot> current,
            List<MutationEntry> mutations,
            int frameNumber, float timestamp)
        {
            foreach (var kvp in current)
            {
                if (!_previous.TryGetValue(kvp.Key, out var prev))
                    continue;

                var curr = kvp.Value;

                // Detect reparenting (InsertBefore / AppendChild)
                if (curr.ParentId != prev.ParentId)
                {
                    if (prev.ParentId.HasValue)
                    {
                        mutations.Add(new MutationEntry
                        {
                            FrameNumber = frameNumber,
                            Timestamp = timestamp,
                            Type = MutationEntryType.RemoveChild,
                            TargetNodeId = curr.Id,
                            TargetTag = curr.Tag.ToString(),
                            Detail = $"parent=#{prev.ParentId.Value}"
                        });
                    }
                    if (curr.ParentId.HasValue)
                    {
                        mutations.Add(new MutationEntry
                        {
                            FrameNumber = frameNumber,
                            Timestamp = timestamp,
                            Type = MutationEntryType.AppendChild,
                            TargetNodeId = curr.Id,
                            TargetTag = curr.Tag.ToString(),
                            Detail = $"parent=#{curr.ParentId.Value}"
                        });
                    }
                }
                else if (curr.ParentId.HasValue && prev.ParentId.HasValue)
                {
                    // Detect reordering within the same parent (InsertBefore)
                    var currParent = current.ContainsKey(curr.ParentId.Value) ? current[curr.ParentId.Value] : (NodeSnapshot?)null;
                    var prevParent = _previous.ContainsKey(prev.ParentId.Value) ? _previous[prev.ParentId.Value] : (NodeSnapshot?)null;

                    if (currParent.HasValue && prevParent.HasValue)
                    {
                        int currIndex = currParent.Value.ChildIds.IndexOf(curr.Id);
                        int prevIndex = prevParent.Value.ChildIds.IndexOf(curr.Id);
                        if (currIndex >= 0 && prevIndex >= 0 && currIndex != prevIndex)
                        {
                            mutations.Add(new MutationEntry
                            {
                                FrameNumber = frameNumber,
                                Timestamp = timestamp,
                                Type = MutationEntryType.InsertBefore,
                                TargetNodeId = curr.Id,
                                TargetTag = curr.Tag.ToString(),
                                Detail = $"parent=#{curr.ParentId.Value} index={currIndex}"
                            });
                        }
                    }
                }

                // Detect attribute changes
                DetectDictChanges(prev.Attributes, curr.Attributes, curr.Id, curr.Tag,
                    MutationEntryType.SetAttribute, mutations, frameNumber, timestamp);

                // Detect inline style changes
                DetectDictChanges(prev.InlineStyles, curr.InlineStyles, curr.Id, curr.Tag,
                    MutationEntryType.StyleChange, mutations, frameNumber, timestamp);
            }
        }

        private void DetectDictChanges(
            Dictionary<string, string> prev,
            Dictionary<string, string> curr,
            int nodeId, NodeTag tag,
            MutationEntryType type,
            List<MutationEntry> mutations,
            int frameNumber, float timestamp)
        {
            string tagStr = tag.ToString();

            // Added or changed keys
            foreach (var kvp in curr)
            {
                string prevVal;
                if (!prev.TryGetValue(kvp.Key, out prevVal) || prevVal != kvp.Value)
                {
                    mutations.Add(new MutationEntry
                    {
                        FrameNumber = frameNumber,
                        Timestamp = timestamp,
                        Type = type,
                        TargetNodeId = nodeId,
                        TargetTag = tagStr,
                        Detail = $"{kvp.Key}={kvp.Value}"
                    });
                }
            }

            // Removed keys
            foreach (var kvp in prev)
            {
                if (!curr.ContainsKey(kvp.Key))
                {
                    mutations.Add(new MutationEntry
                    {
                        FrameNumber = frameNumber,
                        Timestamp = timestamp,
                        Type = type,
                        TargetNodeId = nodeId,
                        TargetTag = tagStr,
                        Detail = $"{kvp.Key}=(removed)"
                    });
                }
            }
        }

        private static string TruncateText(string text)
        {
            if (string.IsNullOrEmpty(text)) return null;
            return text.Length <= 30 ? text : text.Substring(0, 30) + "\u2026";
        }
    }
}
