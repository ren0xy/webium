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
        public NodeSnapshot Draw(NodeSnapshot root, SearchFilter filter)
        {
            if (root == null) return null;

            NodeSnapshot selected = null;
            DrawNode(root, 0, filter, ref selected);
            return selected;
        }

        private void DrawNode(NodeSnapshot node, int depth, SearchFilter filter, ref NodeSnapshot selected)
        {
            if (node == null) return;

            if (filter != null && filter.IsActive && !filter.MatchesOrHasMatchingDescendant(node))
                return;

            bool hasChildren = node.Children.Count > 0;
            bool isExpanded = _expandedNodes.Contains(node.Id);
            bool isSelected = node.Id == _selectedNodeId;

            string label = FormatNodeLabel(node);

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
                GUILayout.Space(14f);
            }

            GUIStyle style = isSelected ? EditorStyles.boldLabel : EditorStyles.label;
            if (GUILayout.Button(label, style))
            {
                _selectedNodeId = node.Id;
            }

            EditorGUILayout.EndHorizontal();

            if (isSelected)
                selected = node;

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
        public static string FormatNodeLabel(NodeSnapshot node) => DOMTreeFormatter.FormatNodeLabel(node);
    }
}
