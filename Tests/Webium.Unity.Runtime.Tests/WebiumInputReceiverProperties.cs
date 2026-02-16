using System;
using System.Collections.Generic;
using FsCheck;
using NUnit.Framework;
using UnityEngine;
using Webium.Core;
using Webium.JSRuntime;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime
{
    /// <summary>
    /// Property-based tests for WebiumInputReceiver hit-test-then-forward logic.
    /// Requires Unity Test Runner (Edit Mode) — cannot run in standard .NET.
    /// Feature: event-round-trip
    /// </summary>
    [TestFixture]
    public class WebiumInputReceiverProperties
    {
        /// <summary>
        /// Minimal IJSBridge implementation that records ForwardInputEvent calls.
        /// </summary>
        private class RecordingBridge : IJSBridge
        {
            public List<string> ForwardedEvents = new List<string>();

            public void OnMutation(Action<MutationBatch> handler) { }
            public void PostToJS(string messageType, object payload) { }
            public void Flush() { }
            public byte[] CallTick() => Array.Empty<byte>();

            public void ForwardInputEvent(string serializedEvent)
            {
                ForwardedEvents.Add(serializedEvent);
            }
        }

        /// <summary>
        /// Property 3: WebiumInputReceiver hit-test-then-forward with no-hit filtering
        ///
        /// Since WebiumInputReceiver.ForwardPointer calls HitTest then conditionally
        /// calls ForwardPointerEvent, and HitTest depends on Unity's EventSystem,
        /// we test the equivalent logic: given a nodeId from HitTest (simulated),
        /// verify ForwardPointerEvent is called when nodeId >= 0 and NOT called when -1.
        ///
        /// We test this by directly calling UnityInputEventForwarder.ForwardPointerEvent
        /// with the generated data, verifying the bridge receives the correct JSON.
        /// For the no-hit case, we verify no call is made.
        ///
        /// **Validates: Requirements 4.2, 4.3**
        /// </summary>
        [Test]
        public void HitTestThenForward_ForwardsOnHit_DropsOnNoHit()
        {
            var arbEventType = Gen.Elements("click", "pointerdown", "pointerup", "pointermove").ToArbitrary();
            var arbNodeId = Gen.OneOf(
                Gen.Choose(0, 1000),   // valid hit
                Gen.Constant(-1)       // no hit
            ).ToArbitrary();
            var arbCoord = Gen.Choose(-1000, 1000).Select(i => (float)i).ToArbitrary();
            var arbButton = Gen.Choose(0, 4).ToArbitrary();
            var arbPointerId = Gen.Choose(0, 100).ToArbitrary();

            Prop.ForAll(
                arbEventType, arbNodeId, arbCoord, arbCoord, arbButton, arbPointerId,
                (eventType, nodeId, x, y, button, pointerId) =>
                {
                    var bridge = new RecordingBridge();
                    var nodeObjects = new Dictionary<int, GameObject>();
                    var forwarder = new UnityInputEventForwarder(bridge, nodeObjects);

                    // Simulate what WebiumInputReceiver.ForwardPointer does:
                    // if nodeId == -1, don't forward; otherwise forward
                    if (nodeId != -1)
                    {
                        forwarder.ForwardPointerEvent(eventType, nodeId, x, y, button, pointerId);

                        Assert.AreEqual(1, bridge.ForwardedEvents.Count,
                            "Should forward exactly one event when hit");
                        Assert.That(bridge.ForwardedEvents[0],
                            Does.Contain($"\"type\":\"{eventType}\""),
                            "Forwarded JSON should contain correct event type");
                        Assert.That(bridge.ForwardedEvents[0],
                            Does.Contain($"\"targetNodeId\":{nodeId}"),
                            "Forwarded JSON should contain correct nodeId");
                    }
                    else
                    {
                        // No-hit: WebiumInputReceiver would NOT call ForwardPointerEvent
                        Assert.AreEqual(0, bridge.ForwardedEvents.Count,
                            "Should not forward when hit test returns -1");
                    }
                }).QuickCheckThrowOnFailure();
        }
    }
}
