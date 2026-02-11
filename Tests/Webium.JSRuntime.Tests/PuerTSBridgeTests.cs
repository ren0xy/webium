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
            var bridge = new PuerTSBridge();
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
            var bridge = new PuerTSBridge();

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
    }
}
