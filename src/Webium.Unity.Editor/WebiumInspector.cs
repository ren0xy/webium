using UnityEditor;
using UnityEngine;
using Webium.Core;
using Webium.Unity;

namespace Webium.Editor
{
    /// <summary>
    /// Custom EditorWindow that visualises the live VirtualDOM tree, node properties,
    /// computed styles, and mutation log during Play Mode.
    /// </summary>
    public class WebiumInspector : EditorWindow
    {
        [MenuItem("Window/Webium/Inspector")]
        public static void ShowWindow()
        {
            GetWindow<WebiumInspector>("Webium Inspector");
        }

        private VirtualDOM _dom;
        private DOMTreeDrawer _treeDrawer;
        private NodeDetailDrawer _detailDrawer;
        private MutationLogDrawer _mutationLogDrawer;
        private MutationLogger _mutationLogger;
        private SearchFilter _searchFilter;
        private VirtualNode _selectedNode;
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

            if (EditorApplication.isPlaying)
                AcquireDOM();
        }

        private void OnDisable()
        {
            EditorApplication.playModeStateChanged -= OnPlayModeChanged;
            ReleaseDOM();
        }

        private void OnPlayModeChanged(PlayModeStateChange state)
        {
            switch (state)
            {
                case PlayModeStateChange.EnteredPlayMode:
                    AcquireDOM();
                    break;
                case PlayModeStateChange.ExitingPlayMode:
                    ReleaseDOM();
                    break;
            }
        }

        private void AcquireDOM()
        {
            var loop = FindObjectOfType<ReconciliationLoopBehaviour>();
            _dom = loop != null ? loop.DOM : null;
            _snapshotDiffer.Reset();
        }

        private void ReleaseDOM()
        {
            _dom = null;
            _selectedNode = null;
            _snapshotDiffer.Reset();
        }

        private void Update()
        {
            if (EditorApplication.isPlaying && _dom != null)
            {
                var mutations = _snapshotDiffer.DiffAndUpdate(
                    _dom.Root,
                    Time.frameCount,
                    Time.realtimeSinceStartup);

                foreach (var entry in mutations)
                    _mutationLogger.Log(entry);

                Repaint();
            }
        }

        private void OnGUI()
        {
            if (_dom == null)
            {
                EditorGUILayout.HelpBox(
                    "No active Webium DOM found. Enter Play Mode with a Webium surface.",
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

            // Tree panel
            EditorGUILayout.BeginVertical(GUILayout.Width(_treeWidth));
            _treeScroll = EditorGUILayout.BeginScrollView(_treeScroll);
            var selected = _treeDrawer.Draw(_dom.Root, _searchFilter);
            if (selected != null)
                _selectedNode = selected;
            EditorGUILayout.EndScrollView();
            EditorGUILayout.EndVertical();

            // Detail panel
            EditorGUILayout.BeginVertical();
            _detailDrawer.Draw(_selectedNode);
            EditorGUILayout.EndVertical();

            EditorGUILayout.EndHorizontal();
        }
    }
}
