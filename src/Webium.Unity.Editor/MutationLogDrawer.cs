using System;
using UnityEditor;
using UnityEngine;

namespace Webium.Editor
{
    public class MutationLogDrawer
    {
        private MutationEntryType? _typeFilter;
        private Vector2 _scrollPosition;

        private static readonly string[] _filterOptions;

        static MutationLogDrawer()
        {
            var names = Enum.GetNames(typeof(MutationEntryType));
            _filterOptions = new string[names.Length + 1];
            _filterOptions[0] = "All";
            for (int i = 0; i < names.Length; i++)
                _filterOptions[i + 1] = names[i];
        }

        public void Draw(MutationLogger logger)
        {
            if (logger == null) return;

            // Toolbar: filter dropdown + clear button
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            int currentIndex = _typeFilter.HasValue ? (int)_typeFilter.Value + 1 : 0;
            int newIndex = EditorGUILayout.Popup(currentIndex, _filterOptions, EditorStyles.toolbarPopup, GUILayout.Width(140));
            _typeFilter = newIndex == 0 ? (MutationEntryType?)null : (MutationEntryType)(newIndex - 1);

            GUILayout.FlexibleSpace();

            if (GUILayout.Button("Clear", EditorStyles.toolbarButton, GUILayout.Width(50)))
                logger.Clear();

            EditorGUILayout.EndHorizontal();

            // Scrollable entry list
            var entries = logger.GetFiltered(_typeFilter);

            _scrollPosition = EditorGUILayout.BeginScrollView(_scrollPosition);

            foreach (var entry in entries)
                EditorGUILayout.LabelField(FormatEntry(entry));

            EditorGUILayout.EndScrollView();
        }

        /// <summary>
        /// Formats a MutationEntry for display.
        /// Example: "[42 @ 1.23s] CreateElement <div> #5 — class=active"
        /// </summary>
        public static string FormatEntry(MutationEntry entry)
        {
            string detail = string.IsNullOrEmpty(entry.Detail) ? "" : $" \u2014 {entry.Detail}";
            return $"[{entry.FrameNumber} @ {entry.Timestamp:F2}s] {entry.Type} <{entry.TargetTag ?? "?"}> #{entry.TargetNodeId}{detail}";
        }
    }
}
