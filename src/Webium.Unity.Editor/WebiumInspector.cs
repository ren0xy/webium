using UnityEditor;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Editor
{
    /// <summary>
    /// Custom EditorWindow that visualises the live DOM snapshot tree, node properties,
    /// and mutation log during Play Mode.
    /// TODO: Wire a snapshot provider once IJSBridge exposes GetSnapshot().
    /// </summary>
    public class WebiumInspector : EditorWindow
    {
        [MenuItem("Window/Webium/Inspector")]
        public static void ShowWindow()
        {
            GetWindow<WebiumInspector>("Webium Inspector");
        }

        private NodeSnapshot _rootSnapshot;
        private DOMTreeDrawer _treeDrawer;
        private NodeDetailDrawer _detailDrawer;
        private MutationLogDrawer _mutationLogDrawer;
        private MutationLogger _mutationLogger;
        private SearchFilter _searchFilter;
        private NodeSnapshot _selectedNode;
        private DOMSnapshotDiffer _snapshotDiffer;

        private bool _showMutationLog;
        private float _treeWidth = 300f;
        private Vector2 _treeScroll;

        private void OnEnable()
        {
            _treeDrawer = new DOMTreeDrawer();
            _detailDrawer = new NodeDetailDrawer();
            _mutationLogDrawer = new MutationLogDrawer();
            _mutationLogger = new MutationLogger();
            _searchFilter = new SearchFilter();
            _snapshotDiffer = new DOMSnapshotDiffer();

            EditorApplication.playModeStateChanged += OnPlayModeChanged;
        }

        private void OnDisable()
        {
            EditorApplication.playModeStateChanged -= OnPlayModeChanged;
            _rootSnapshot = null;
            _selectedNode = null;
        }

        private void OnPlayModeChanged(PlayModeStateChange state)
        {
            switch (state)
            {
                case PlayModeStateChange.EnteredPlayMode:
                    _snapshotDiffer.Reset();
                    break;
                case PlayModeStateChange.ExitingPlayMode:
                    _rootSnapshot = null;
                    _selectedNode = null;
                    _snapshotDiffer.Reset();
                    break;
            }
        }

        private void Update()
        {
            if (!EditorApplication.isPlaying || _rootSnapshot == null)
                return;

            var mutations = _snapshotDiffer.DiffAndUpdate(
                _rootSnapshot,
                Time.frameCount,
                Time.realtimeSinceStartup);

            foreach (var entry in mutations)
                _mutationLogger.Log(entry);

            Repaint();
        }

        private void OnGUI()
        {
            if (!EditorApplication.isPlaying || _rootSnapshot == null)
            {
                EditorGUILayout.HelpBox(
                    "No active Webium DOM snapshot found. Enter Play Mode with a Webium surface.",
                    MessageType.Info);
                return;
            }

            DrawToolbar();

            if (_showMutationLog)
            {
                _mutationLogDrawer.Draw(_mutationLogger);
            }
            else
            {
                DrawSplitView();
            }
        }

        private void DrawToolbar()
        {
            EditorGUILayout.BeginHorizontal(EditorStyles.toolbar);

            _searchFilter.Query = EditorGUILayout.TextField(
                _searchFilter.Query ?? "", EditorStyles.toolbarSearchField, GUILayout.MinWidth(120));

            GUILayout.FlexibleSpace();

            bool treeTab = !_showMutationLog;
            if (GUILayout.Toggle(treeTab, "DOM Tree", EditorStyles.toolbarButton) && !treeTab)
                _showMutationLog = false;

            bool logTab = _showMutationLog;
            if (GUILayout.Toggle(logTab, "Mutations", EditorStyles.toolbarButton) && !logTab)
                _showMutationLog = true;

            EditorGUILayout.EndHorizontal();
        }

        private void DrawSplitView()
        {
            EditorGUILayout.BeginHorizontal();

            EditorGUILayout.BeginVertical(GUILayout.Width(_treeWidth));
            _treeScroll = EditorGUILayout.BeginScrollView(_treeScroll);
            var selected = _treeDrawer.Draw(_rootSnapshot, _searchFilter);
            if (selected != null)
                _selectedNode = selected;
            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();

            EditorGUILayout.BeginVertical();
            _detailDrawer.Draw(_selectedNode);
            EditorGUILayout.EndVertical();

            EditorGUILayout.EndHorizontal();
        }
    }
}
