using System.Linq;
using FsCheck;
using NUnit.Framework;
using Webium.JSRuntime;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Property-based tests for MutationBatch data structure.
    /// Feature: js-runtime-service, Property 2: MutationBatch round-trip
    /// </summary>
    [TestFixture]
    public class MutationBatchTests
    {
        /// <summary>
        /// Custom Arbitrary for Mutation structs covering all five MutationOp values.
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
        /// Property 2: MutationBatch round-trip
        /// For any sequence of Mutation structs (with any combination of MutationOp values),
        /// adding them to a MutationBatch and reading back via Mutations shall return the
        /// same mutations in the same order with identical field values.
        /// **Validates: Requirements 3.2**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100, Arbitrary = new[] { typeof(MutationBatchTests) })]
        public FsCheck.Property RoundTrip_AddAndReadBack_PreservesOrderAndValues(Mutation[] mutations)
        {
            var batch = new MutationBatch();

            foreach (var m in mutations)
            {
                batch.Add(m);
            }

            return (batch.Count == mutations.Length &&
                    batch.Mutations.Count == mutations.Length &&
                    mutations.Select((m, i) =>
                        batch.Mutations[i].Op == m.Op &&
                        batch.Mutations[i].NodeId == m.NodeId &&
                        batch.Mutations[i].Key == m.Key &&
                        batch.Mutations[i].Value == m.Value
                    ).All(x => x))
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 2: MutationBatch round-trip");
        }
    }
}
