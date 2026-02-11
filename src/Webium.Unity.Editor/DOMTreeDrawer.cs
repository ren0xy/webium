using System.Collections.Generic;
using UnityEditor;
using UnityEngine;
using Webium.Core;

namespace Webium.Editor
{
    public class DOMTreeDrawer
    {
        private readonly HashSet<int> _expandedNodes = new HashSet<int>();
        private int _selectedNodeId = -1;

        /// <summary>
        /// Draws the DOM tree starting from root, filtered by the given SearchFilter.
        /// Returns the currently selected node, or null if none.
        /// </summary>
        public VirtualNode Draw(VirtualNode root, SearchFilter filter)
        {
            if (root == null) return null;

            VirtualNode selected = null;
            DrawNode(root, 0, filter, ref selected);
            return selected;
        }

        private void DrawNode(VirtualNode node, int depth, SearchFilter filter, ref VirtualNode selected)
        {
            if (node == null) return;

            // When filter is active, skip nodes that don't match and have no matching descendants
            if (filter != null && filter.IsActive && !filter.MatchesOrHasMatchingDescendant(node))
                return;

            bool hasChildren = node.Children.Count > 0;
            bool isExpanded = _expandedNodes.Contains(node.Id);
            bool isSelected = node.Id == _selectedNodeId;

            string label = FormatNodeLabel(node);

            // Dirty flag visual indicator
            bool isDirty = node.Dirty != DirtyFlags.None;
            Color prevColor = GUI.contentColor;
            if (isDirty)
                GUI.contentColor = new Color(1f, 0.6f, 0.2f); // orange tint for dirty nodes

            EditorGUILayout.BeginHorizontal();
            GUILayout.Space(depth * 16f);

            if (hasChildren)
            {
                bool newExpanded = EditorGUILayout.Foldout(isExpanded, "", false);
                if (newExpanded != isExpanded)
                {
                    if (newExpanded) _expandedNodes.Add(node.Id);
                    else _expandedNodes.Remove(node.Id);
                    isExpanded = newExpanded;
                }
            }
            else
            {
                GUILayout.Space(14f); // indent to align with foldout arrow
            }

            GUIStyle style = isSelected ? EditorStyles.boldLabel : EditorStyles.label;
            if (GUILayout.Button(label, style))
            {
                _selectedNodeId = node.Id;
            }

            EditorGUILayout.EndHorizontal();

            if (isDirty)
                GUI.contentColor = prevColor;

            if (isSelected)
                selected = node;

            // Draw children if expanded
            if (hasChildren && isExpanded)
            {
                foreach (var child in node.Children)
                {
                    DrawNode(child, depth + 1, filter, ref selected);
                }
            }
        }

        /// <summary>
        /// Formats a node label for display in the tree.
        /// Delegates to <see cref="DOMTreeFormatter.FormatNodeLabel"/> for testability.
        /// </summary>
        public static string FormatNodeLabel(VirtualNode node) => DOMTreeFormatter.FormatNodeLabel(node);
    }
}
