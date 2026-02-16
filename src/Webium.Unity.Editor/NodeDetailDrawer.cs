using UnityEditor;
using UnityEngine;
using Webium.Core;

namespace Webium.Editor
{
    public class NodeDetailDrawer
    {
        private Vector2 _scrollPosition;

        public void Draw(NodeSnapshot node)
        {
            if (node == null)
            {
                EditorGUILayout.LabelField("No node selected.");
                return;
            }

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);

            DrawIdentity(node);
            DrawAttributes(node);
            DrawRenderHandle(node);

            EditorGUILayout.EndScrollView();
        }

        private void DrawIdentity(NodeSnapshot node)
        {
            EditorGUILayout.LabelField("Identity", EditorStyles.boldLabel);
            EditorGUI.indentLevel++;
            EditorGUILayout.LabelField("Id", node.Id.ToString());
            EditorGUILayout.LabelField("Tag", node.Tag.ToString());
            EditorGUILayout.LabelField("Children", node.Children.Count.ToString());
            EditorGUILayout.LabelField("TextContent", node.TextContent ?? "(null)");
            EditorGUI.indentLevel--;
            EditorGUILayout.Space();
        }

        private void DrawAttributes(NodeSnapshot node)
        {
            EditorGUILayout.LabelField("Attributes", EditorStyles.boldLabel);
            EditorGUI.indentLevel++;
            if (node.Attributes.Count == 0)
            {
                EditorGUILayout.LabelField("(none)");
            }
            else
            {
                foreach (var kvp in node.Attributes)
                    EditorGUILayout.LabelField(kvp.Key, kvp.Value);
            }
            EditorGUI.indentLevel--;
            EditorGUILayout.Space();
        }

        private void DrawRenderHandle(NodeSnapshot node)
        {
            EditorGUILayout.LabelField("Render Handle", EditorStyles.boldLabel);
            EditorGUI.indentLevel++;
            EditorGUILayout.LabelField("Status", FormatRenderHandle(node));

            var go = node.RenderHandle as GameObject;
            EditorGUI.BeginDisabledGroup(go == null);
            var buttonContent = go != null
                ? new GUIContent("Ping in Hierarchy")
                : new GUIContent("Ping in Hierarchy", "No backing GameObject — node may not be rendered yet.");
            if (GUILayout.Button(buttonContent))
            {
                EditorGUIUtility.PingObject(go);
                Selection.activeGameObject = go;
            }
            EditorGUI.EndDisabledGroup();

            EditorGUI.indentLevel--;
        }

        /// <summary>
        /// Formats the RenderHandle status for display.
        /// Delegates to <see cref="NodeDetailFormatter.FormatRenderHandle"/> for testability.
        /// The Unity-specific GameObject branch is handled here; all other types
        /// fall through to the pure formatter.
        /// </summary>
        public static string FormatRenderHandle(NodeSnapshot node)
        {
            if (node == null || node.RenderHandle == null)
                return NodeDetailFormatter.FormatRenderHandle(node);

            if (node.RenderHandle is GameObject go)
                return $"GameObject \"{go.name}\"";

            return NodeDetailFormatter.FormatRenderHandle(node);
        }
    }
}
