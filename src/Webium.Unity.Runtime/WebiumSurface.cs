using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Single drop-in MonoBehaviour that bootstraps the entire Webium runtime.
    /// Creates the Canvas, wires the executor, input forwarder, reconciliation
    /// loop, and JS bridge. Add this one component to a scene to get Webium running.
    /// </summary>
    [AddComponentMenu("Webium/Webium Surface")]
    public class WebiumSurface : MonoBehaviour
    {
        [SerializeField] private Vector2 _referenceResolution = new(1920, 1080);

        private IJSRuntime _runtime;
        private IJSBridge _bridge;
        private UnityRenderCommandExecutor _executor;
        private ReconciliationLoopBehaviour _loop;
        private UnityInputEventForwarder _forwarder;

        /// <summary>The JS runtime instance used by this surface.</summary>
        public IJSRuntime Runtime => _runtime;

        /// <summary>The JS bridge used for C#↔JS communication.</summary>
        public IJSBridge Bridge => _bridge;

        /// <summary>The render command executor that manages Unity GameObjects.</summary>
        public UnityRenderCommandExecutor Executor => _executor;

        private void Awake()
        {
            // 1. Create Canvas with CanvasScaler and GraphicRaycaster
            var canvasGo = new GameObject("WebiumCanvas");
            canvasGo.transform.SetParent(transform, false);
            var canvas = canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = _referenceResolution;
            canvasGo.AddComponent<GraphicRaycaster>();

            // 2. Root container (anchors 0,0 to 1,1 — fills canvas)
            var rootGo = new GameObject("WebiumRoot");
            rootGo.transform.SetParent(canvasGo.transform, false);
            var rootRT = rootGo.AddComponent<RectTransform>();
            rootRT.anchorMin = Vector2.zero;
            rootRT.anchorMax = Vector2.one;
            rootRT.sizeDelta = Vector2.zero;
            rootRT.anchoredPosition = Vector2.zero;

            // 3. Executor (constructor takes only rootTransform after Task 4.2 refactor)
            _executor = new UnityRenderCommandExecutor(rootGo.transform);

            // 4. JS Runtime + Bridge (platform-conditional)
#if UNITY_WEBGL
            _runtime = new BrowserRuntime();
#else
            _runtime = new UnityPuerTSRuntime();
#endif
            _bridge = CreateBridge(_runtime);

            // 5. Input forwarder + receiver
            // NodeObjects is backed by Dictionary<int, GameObject> internally
            var nodeObjectsDict = (Dictionary<int, GameObject>)_executor.NodeObjects;
            _forwarder = new UnityInputEventForwarder(_bridge, nodeObjectsDict);
            var receiver = canvasGo.AddComponent<WebiumInputReceiver>();
            receiver.Initialize(_forwarder);

            // 6. Reconciliation loop (starts disabled — bootstrapper enables after first tick)
            _loop = gameObject.AddComponent<ReconciliationLoopBehaviour>();
            _loop.Initialize(_bridge, _executor);
            _loop.enabled = false;
        }

        /// <summary>
        /// Enables the reconciliation loop. Called by WebiumBootstrapper
        /// after the JS runtime is initialized and the first tick completes.
        /// </summary>
        public void EnableLoop()
        {
            _loop.enabled = true;
        }

        private static IJSBridge CreateBridge(IJSRuntime runtime)
        {
#if UNITY_WEBGL
            return new BrowserBridge();
#else
            return new PuerTSBridge(runtime);
#endif
        }
    }
}
