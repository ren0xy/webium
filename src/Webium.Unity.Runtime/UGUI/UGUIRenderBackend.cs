using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.UI;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// UGUI implementation of <see cref="IWebiumRenderBackend"/>.
    /// Wraps the existing Canvas/UGUI pipeline — code extracted from
    /// <c>WebiumSurface.Awake()</c> steps 1–5.
    /// </summary>
    public class UGUIRenderBackend : IWebiumRenderBackend
    {
        private readonly GameObject _canvasGo;
        private readonly UGUIRenderCommandExecutor _executor;
        private readonly UGUIInputEventForwarder _inputForwarder;
        private readonly UGUILayoutBridge _layoutBridge;
        private readonly UGUITextMeasurer _textMeasurer;

        public IRenderCommandExecutor Executor => _executor;
        public IInputEventForwarder InputForwarder => _inputForwarder;
        public ILayoutReadbackNew LayoutBridge => _layoutBridge;
        public ITextMeasurer TextMeasurer => _textMeasurer;

        /// <summary>
        /// Creates the full UGUI surface hierarchy under <paramref name="host"/>.
        /// </summary>
        /// <param name="host">Parent transform (typically the WebiumSurface transform).</param>
        /// <param name="referenceResolution">CanvasScaler reference resolution.</param>
        /// <param name="bridge">JS bridge for input forwarding.</param>
        public UGUIRenderBackend(Transform host, Vector2 referenceResolution, IJSBridge bridge)
        {
            // 1. Canvas + CanvasScaler + GraphicRaycaster
            _canvasGo = new GameObject("WebiumCanvas");
            _canvasGo.transform.SetParent(host, false);
            var canvas = _canvasGo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = _canvasGo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = referenceResolution;
            _canvasGo.AddComponent<GraphicRaycaster>();

            // 2. Root container (anchors 0,0 to 1,1 — fills canvas)
            var rootGo = new GameObject("WebiumRoot");
            rootGo.transform.SetParent(_canvasGo.transform, false);
            var rootRT = rootGo.AddComponent<RectTransform>();
            rootRT.anchorMin = Vector2.zero;
            rootRT.anchorMax = Vector2.one;
            rootRT.sizeDelta = Vector2.zero;
            rootRT.anchoredPosition = Vector2.zero;

            // 3. Executor
            _executor = new UGUIRenderCommandExecutor(rootGo.transform);

            // 4. Input forwarder + receiver
            var nodeObjectsDict = (Dictionary<int, GameObject>)_executor.NodeObjects;
            _inputForwarder = new UGUIInputEventForwarder(bridge, nodeObjectsDict);
            var receiver = _canvasGo.AddComponent<UGUIInputReceiver>();
            receiver.Initialize(_inputForwarder);

            // 5. Layout bridge
            var canvasRect = _canvasGo.GetComponent<RectTransform>();
            _layoutBridge = new UGUILayoutBridge(canvasRect, nodeObjectsDict);

            // 6. Text measurer
            _textMeasurer = new UGUITextMeasurer();
        }

        public void Dispose()
        {
            if (_canvasGo != null)
                UnityEngine.Object.Destroy(_canvasGo);
        }
    }
}
