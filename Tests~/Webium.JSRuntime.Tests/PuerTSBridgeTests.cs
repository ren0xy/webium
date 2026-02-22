using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using FsCheck;
using FsCheck.NUnit;
using NUnit.Framework;
using Webium.JSRuntime;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Property-based tests for PuerTSBridge.
    /// Feature: js-runtime-service, Property 3: Bridge mutation dispatch
    /// </summary>
    [TestFixture]
    public class PuerTSBridgeTests
    {
        private class StubJSRuntime : IJSRuntime
        {
            public bool IsReady => true;
            public object Evaluate(string script) => null;
            public object CallFunction(string name, params object[] args) => null;
            public T CallFunction<T>(string name, params object[] args) => default;
            public void RegisterBinding(string name, Delegate callback) { }
            public void Dispose() { }
        }

        /// <summary>
        /// Configurable IJSRuntime stub that returns a preset value from CallFunction.
        /// Used by Property 3 (CallTick delegation) for spec 007.
        /// </summary>
        private class ConfigurableJSRuntime : IJSRuntime
        {
            public object CallFunctionReturnValue { get; set; }
            public string LastCalledFunctionName { get; private set; }
            public bool IsReady => true;
            public object Evaluate(string script) => null;
            public object CallFunction(string name, params object[] args)
            {
                LastCalledFunctionName = name;
                return CallFunctionReturnValue;
            }
            public T CallFunction<T>(string name, params object[] args)
            {
                LastCalledFunctionName = name;
                if (CallFunctionReturnValue is T typed) return typed;
                return default;
            }
            public void RegisterBinding(string name, Delegate callback) { }
            public void Dispose() { }
        }

        /// <summary>
        /// Recording IJSRuntime that captures CallFunction invocations for verification.
        /// Used by Property 2 (ForwardInputEvent delegation).
        /// </summary>
        private class RecordingJSRuntime : IJSRuntime
        {
            public List<(string name, object[] args)> Calls = new List<(string, object[])>();
            public bool IsReady => true;
            public object Evaluate(string script) => null;
            public object CallFunction(string name, params object[] args)
            {
                Calls.Add((name, args));
                return null;
            }
            public T CallFunction<T>(string name, params object[] args)
            {
                Calls.Add((name, args));
                return default;
            }
            public void RegisterBinding(string name, Delegate callback) { }
            public void Dispose() { }
        }
        /// <summary>
        /// Custom Arbitrary for Mutation structs covering all five MutationOp values.
        /// Reuses the same generation strategy as MutationBatchTests.
        /// </summary>
        public static Arbitrary<Mutation> MutationArbitrary()
        {
            var gen = from op in Gen.Elements(
                          MutationOp.Create,
                          MutationOp.Remove,
                          MutationOp.SetAttribute,
                          MutationOp.SetStyle,
                          MutationOp.SetText)
                      from nodeId in Arb.Generate<int>()
                      from key in Arb.Generate<string>()
                      from value in Arb.Generate<string>()
                      select new Mutation
                      {
                          Op = op,
                          NodeId = nodeId,
                          Key = key,
                          Value = value
                      };

            return Arb.From(gen);
        }

        /// <summary>
        /// Property 3: Bridge mutation dispatch
        /// For any MutationBatch, registering a handler via OnMutation and then
        /// dispatching that batch via the internal ReceiveMutations method shall
        /// invoke the handler exactly once with the same batch instance.
        /// **Validates: Requirements 5.3**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100, Arbitrary = new[] { typeof(PuerTSBridgeTests) })]
        public FsCheck.Property ReceiveMutations_InvokesHandler_WithSameBatch(Mutation[] mutations)
        {
            var bridge = new PuerTSBridge(new StubJSRuntime());
            var batch = new MutationBatch();
            foreach (var m in mutations)
            {
                batch.Add(m);
            }

            MutationBatch receivedBatch = null;
            int invokeCount = 0;

            bridge.OnMutation(b =>
            {
                receivedBatch = b;
                invokeCount++;
            });

            bridge.ReceiveMutations(batch);

            return (invokeCount == 1 && ReferenceEquals(receivedBatch, batch))
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 3: Bridge mutation dispatch");
        }

        /// <summary>
        /// Helper to read the private _outboundQueue count via reflection.
        /// </summary>
        private static int GetOutboundQueueCount(PuerTSBridge bridge)
        {
            var field = typeof(PuerTSBridge).GetField(
                "_outboundQueue",
                BindingFlags.NonPublic | BindingFlags.Instance);
            var queue = (List<(string, object)>)field.GetValue(bridge);
            return queue.Count;
        }

        /// <summary>
        /// Property 4: Bridge flush clears queue
        /// For any sequence of PostToJS calls on a PuerTSBridge, calling Flush()
        /// shall clear the outbound queue such that a subsequent Flush() is a no-op
        /// (performs no interop). Flushing an empty queue (zero PostToJS calls) shall
        /// also be a no-op.
        /// **Validates: Requirements 5.4, 5.5, 5.6**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100, Arbitrary = new[] { typeof(PuerTSBridgeTests) })]
        public FsCheck.Property Flush_ClearsQueue_AndSecondFlushIsNoOp(NonNull<string>[] messageTypes)
        {
            var bridge = new PuerTSBridge(new StubJSRuntime());

            // Post all messages to the bridge with generated message types
            foreach (var msgType in messageTypes)
            {
                bridge.PostToJS(msgType.Get, msgType.Get);
            }

            // Verify messages were queued
            var queueCountBeforeFlush = GetOutboundQueueCount(bridge);
            var queuedCorrectly = queueCountBeforeFlush == messageTypes.Length;

            // First Flush: should clear the queue
            bridge.Flush();
            var queueCountAfterFirstFlush = GetOutboundQueueCount(bridge);
            var clearedAfterFlush = queueCountAfterFirstFlush == 0;

            // Second Flush: should be a no-op (queue already empty)
            bridge.Flush();
            var queueCountAfterSecondFlush = GetOutboundQueueCount(bridge);
            var secondFlushIsNoOp = queueCountAfterSecondFlush == 0;

            return (queuedCorrectly && clearedAfterFlush && secondFlushIsNoOp)
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 4: Bridge flush clears queue");
        }

        /// <summary>
        /// Property 2: PuerTSBridge.ForwardInputEvent delegates to IJSRuntime.CallFunction
        /// For any string s, calling PuerTSBridge.ForwardInputEvent(s) should invoke
        /// IJSRuntime.CallFunction("handleInputEvent", s) exactly once with the exact same string argument.
        /// **Validates: Requirements 2.1**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100)]
        public FsCheck.Property ForwardInputEvent_DelegatesToCallFunction(NonNull<string> serializedEvent)
        {
            var runtime = new RecordingJSRuntime();
            var bridge = new PuerTSBridge(runtime);

            bridge.ForwardInputEvent(serializedEvent.Get);

            return (runtime.Calls.Count == 1
                && runtime.Calls[0].name == "handleInputEvent"
                && runtime.Calls[0].args.Length == 1
                && (string)runtime.Calls[0].args[0] == serializedEvent.Get)
                .ToProperty()
                .Label("Feature: event-round-trip, Property 2: PuerTSBridge.ForwardInputEvent delegation");
        }

        /// <summary>
        /// Property 3: CallTick delegates to runtime and returns result
        /// For any byte[] value returned by IJSRuntime.CallFunction("tick"),
        /// PuerTSBridge.CallTick() should return that same byte[].
        /// **Validates: Requirements 3.1, 3.2, 3.3**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100)]
        public FsCheck.Property CallTick_ReturnsSameByteArray_AsRuntime(byte[] expected)
        {
            var runtime = new ConfigurableJSRuntime { CallFunctionReturnValue = expected };
            var bridge = new PuerTSBridge(runtime);

            var result = bridge.CallTick();

            var calledTick = runtime.LastCalledFunctionName == "tick";
            var arraysEqual = result.SequenceEqual(expected);

            return (calledTick && arraysEqual)
                .ToProperty()
                .Label("Feature: 007-hello-world-integration, Property 3: CallTick delegates to runtime and returns result");
        }

        /// <summary>
        /// Property 3 (null case): When the runtime returns null, CallTick() returns an empty array.
        /// **Validates: Requirements 3.1, 3.2, 3.3**
        /// </summary>
        [Test]
        public void CallTick_ReturnsEmptyArray_WhenRuntimeReturnsNull()
        {
            var runtime = new ConfigurableJSRuntime { CallFunctionReturnValue = null };
            var bridge = new PuerTSBridge(runtime);

            var result = bridge.CallTick();

            Assert.That(runtime.LastCalledFunctionName, Is.EqualTo("tick"));
            Assert.That(result, Is.Empty);
        }
    }
}
