using UnityEditor;
using UnityEngine;
using Webium.Unity;

namespace Webium.Editor
{
    /// <summary>
    /// Custom inspector for <see cref="WebiumBootstrapper"/> that adds a
    /// "Dump Snapshot" button during Play Mode. Outputs the current
    /// visual tree in browser-snapshot-compatible format.
    /// Supports both UIElements and UGUI backends.
    /// </summary>
    [CustomEditor(typeof(WebiumBootstrapper))]
    public class WebiumBootstrapperEditor : UnityEditor.Editor
    {
        public override void OnInspectorGUI()
        {
            DrawDefaultInspector();

            if (!EditorApplication.isPlaying)
            {
                EditorGUILayout.HelpBox("Enter Play Mode to dump a visual tree snapshot.", MessageType.Info);
                return;
            }

            EditorGUILayout.Space(8);

            if (GUILayout.Button("Dump Snapshot to Console", GUILayout.Height(30)))
                DumpSnapshot(logOnly: true);

            if (GUILayout.Button("Dump Snapshot to File", GUILayout.Height(30)))
                DumpSnapshot(logOnly: false);
        }

        private void DumpSnapshot(bool logOnly)
        {
            var bootstrapper = (WebiumBootstrapper)target;
            var surface = bootstrapper.GetComponent<WebiumSurface>();
            if (surface == null)
            {
                Debug.LogError("[Webium] No WebiumSurface found on this GameObject.");
                return;
            }

            string snapshot;
            if (surface.Executor is UIElementsRenderCommandExecutor uiExecutor)
            {
                snapshot = UIElementsSnapshotDumper.Dump(uiExecutor);
            }
            else if (surface.Executor is UGUIRenderCommandExecutor uguiExecutor)
            {
                snapshot = UGUISnapshotDumper.Dump(uguiExecutor);
            }
            else
            {
                Debug.LogError("[Webium] Unsupported executor type for snapshot dump.");
                return;
            }

            if (logOnly)
            {
                Debug.Log($"[Webium:Snapshot]\n{snapshot}");
                return;
            }

            // Save next to the example folder
            var path = EditorUtility.SaveFilePanel(
                "Save Webium Snapshot",
                Application.dataPath,
                "unity_snapshot.json",
                "json");

            if (string.IsNullOrEmpty(path)) return;

            System.IO.File.WriteAllText(path, snapshot, System.Text.Encoding.UTF8);
            Debug.Log($"[Webium] Snapshot saved to {path}");
        }
    }
}
