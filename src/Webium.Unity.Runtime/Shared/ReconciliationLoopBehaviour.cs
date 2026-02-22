using System;
using UnityEngine;
using Webium.Core;
using Webium.JSRuntime;

namespace Webium.Unity
{
    /// <summary>
    /// MonoBehaviour that drives the JS→C# render loop each frame.
    /// Calls <see cref="IJSBridge.CallTick"/> and feeds the resulting
    /// command buffer to <see cref="IRenderCommandExecutor.Execute"/>.
    /// </summary>
    public class ReconciliationLoopBehaviour : MonoBehaviour
    {
        private IJSBridge _bridge;
        private IRenderCommandExecutor _executor;

        public void Initialize(IJSBridge bridge, IRenderCommandExecutor executor)
        {
            _bridge = bridge;
            _executor = executor;
        }

        private void Update()
        {
            if (_bridge == null || _executor == null) return;

            var buffer = _bridge.CallTick();
            if (buffer != null && buffer.Length > 0)
            {
                _executor.Execute(buffer);
            }
        }
    }
}
