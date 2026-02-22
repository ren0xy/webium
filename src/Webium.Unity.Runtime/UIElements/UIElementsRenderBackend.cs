using System;
using UnityEngine;
using UnityEngine.UIElements;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// UIElements (UI Toolkit) implementation of <see cref="IWebiumRenderBackend"/>.
    /// Creates a UIDocument with runtime PanelSettings and a root VisualElement
    /// that fills the screen, then wires up the executor, input forwarder, and layout bridge.
    /// </summary>
    public class UIElementsRenderBackend : IWebiumRenderBackend
    {
        private readonly GameObject _documentGo;
        private readonly PanelSettings _panelSettings;
        private readonly bool _ownsPanelSettings;
        private readonly UIElementsRenderCommandExecutor _executor;
        private readonly UIElementsInputEventForwarder _inputForwarder;
        private readonly UIElementsLayoutBridge _layoutBridge;
        private readonly UIElementsTextMeasurer _textMeasurer;

        public IRenderCommandExecutor Executor => _executor;
        public IInputEventForwarder InputForwarder => _inputForwarder;
        public ILayoutReadbackNew LayoutBridge => _layoutBridge;
        public ITextMeasurer TextMeasurer => _textMeasurer;

        /// <summary>
        /// Creates the full UIElements surface hierarchy under <paramref name="host"/>.
        /// </summary>
        /// <param name="host">Parent transform (typically the WebiumSurface transform).</param>
        /// <param name="referenceResolution">PanelSettings reference resolution for ScaleWithScreenSize.</param>
        /// <param name="bridge">JS bridge for input forwarding.</param>
        public UIElementsRenderBackend(Transform host, Vector2 referenceResolution, IJSBridge bridge, PanelSettings existingPanelSettings = null)
        {
            // 1. Create child GameObject with UIDocument
            _documentGo = new GameObject("WebiumUIDocument");
            _documentGo.transform.SetParent(host, false);
            var uiDocument = _documentGo.AddComponent<UIDocument>();

            // 2. Use provided PanelSettings or create one at runtime
            if (existingPanelSettings != null)
            {
                _panelSettings = existingPanelSettings;
                _ownsPanelSettings = false;
            }
            else
            {
                _panelSettings = ScriptableObject.CreateInstance<PanelSettings>();
                _panelSettings.scaleMode = PanelScaleMode.ScaleWithScreenSize;
                _panelSettings.referenceResolution = new Vector2Int((int)referenceResolution.x, (int)referenceResolution.y);
                _ownsPanelSettings = true;
            }
            uiDocument.panelSettings = _panelSettings;

            // 3. Create root VisualElement filling the screen
            var root = new VisualElement();
            root.name = "WebiumRoot";
            root.style.position = Position.Absolute;
            root.style.left = 0;
            root.style.top = 0;
            root.style.right = 0;
            root.style.bottom = 0;
            uiDocument.rootVisualElement.Add(root);

            // 4. Guard against Inspector-triggered visual tree rebuilds detaching our root
            var guard = _documentGo.AddComponent<UIDocumentRootGuard>();
            guard.Initialize(uiDocument, root);

            // 5. Executor
            _executor = new UIElementsRenderCommandExecutor(root);

            // 6. Input forwarder
            _inputForwarder = new UIElementsInputEventForwarder(bridge, _executor.NodeElements, root);

            // 7. Layout bridge
            _layoutBridge = new UIElementsLayoutBridge(_executor.NodeElements);

            // 8. Text measurer
            _textMeasurer = new UIElementsTextMeasurer();
        }

        public void Dispose()
        {
            _inputForwarder?.Dispose();

            if (_documentGo != null)
                UnityEngine.Object.Destroy(_documentGo);

            if (_ownsPanelSettings && _panelSettings != null)
                UnityEngine.Object.Destroy(_panelSettings);
        }
    }

    /// <summary>
    /// Monitors the UIDocument's rootVisualElement and re-attaches the Webium root
    /// if Unity's Inspector or other editor operations rebuild the visual tree.
    /// </summary>
    internal class UIDocumentRootGuard : MonoBehaviour
    {
        private UIDocument _uiDocument;
        private VisualElement _webiumRoot;

        public void Initialize(UIDocument uiDocument, VisualElement webiumRoot)
        {
            _uiDocument = uiDocument;
            _webiumRoot = webiumRoot;
        }

        private void LateUpdate()
        {
            if (_uiDocument == null || _webiumRoot == null) return;

            var docRoot = _uiDocument.rootVisualElement;
            if (docRoot == null) return;

            // If our root got detached (panel is null) or is no longer a child, re-add it
            if (_webiumRoot.panel == null || _webiumRoot.parent != docRoot)
            {
                docRoot.Add(_webiumRoot);
            }
        }
    }
}
