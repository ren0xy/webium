using UnityEngine;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// Single drop-in MonoBehaviour that bootstraps the entire Webium runtime.
    /// Delegates backend-specific concerns (Canvas/UIDocument, executor, input,
    /// layout) to the selected <see cref="IWebiumRenderBackend"/>.
    /// Add this one component to a scene to get Webium running.
    /// </summary>
    [AddComponentMenu("Webium/Webium Surface")]
    public class WebiumSurface : MonoBehaviour
    {
        [SerializeField] private Vector2 _referenceResolution = new(1920, 1080);

        /// <summary>The reference resolution used by the CanvasScaler.</summary>
        public Vector2 ReferenceResolution => _referenceResolution;
        [SerializeField] private WebiumSurfaceConfig _config;

        private IJSRuntime _runtime;
        private IJSBridge _bridge;
        private ReconciliationLoopBehaviour _loop;
        private IWebiumRenderBackend _backend;

        /// <summary>The JS runtime instance used by this surface.</summary>
        public IJSRuntime Runtime => _runtime;

        /// <summary>The JS bridge used for C#↔JS communication.</summary>
        public IJSBridge Bridge => _bridge;

        /// <summary>The render command executor provided by the active backend.</summary>
        public IRenderCommandExecutor Executor => _backend.Executor;

        /// <summary>The text measurer provided by the active backend.</summary>
        public ITextMeasurer TextMeasurer => _backend.TextMeasurer;

        private void Awake()
        {
            // 1. JS Runtime + Bridge (platform-conditional) — must be created before backend
#if UNITY_WEBGL
            _runtime = new BrowserRuntime();
#else
            _runtime = new UnityPuerTSRuntime();
#endif
            _bridge = CreateBridge(_runtime);

            // 2. Instantiate backend based on config (defaults to UGUI if no config assigned)
            var backendType = _config?.backendType ?? RenderBackendType.UGUI;
            _backend = backendType switch
            {
                RenderBackendType.UIElements => new UIElementsRenderBackend(transform, _referenceResolution, _bridge, _config?.uiElementsPanelSettings),
                _ => new UGUIRenderBackend(transform, _referenceResolution, _bridge),
            };

            // 3. Reconciliation loop (starts disabled — bootstrapper enables after first tick)
            _loop = gameObject.AddComponent<ReconciliationLoopBehaviour>();
            _loop.Initialize(_bridge, _backend.Executor);
            _loop.enabled = false;
        }

        private void OnDestroy()
        {
            _backend?.Dispose();
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
