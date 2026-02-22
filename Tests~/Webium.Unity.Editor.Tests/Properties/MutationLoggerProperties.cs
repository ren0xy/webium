using System;
using System.Linq;
using FsCheck;
using NUnit.Framework;
using PropertyAttribute = FsCheck.NUnit.PropertyAttribute;
using Webium.Editor;
using Webium.Tests.Editor.Generators;

namespace Webium.Tests.Editor.Properties
{
    /// <summary>
    /// Property-based tests for MutationLogger (Properties 4, 5, 6, 7).
    /// </summary>
    [TestFixture]
    public class MutationLoggerProperties
    {
        /// <summary>
        /// Property 4: Mutation logging completeness.
        /// For any MutationEntry logged via MutationLogger.Log(), the entry should appear
        /// in MutationLogger.Entries with all required fields populated: FrameNumber >= 0,
        /// Timestamp >= 0, a valid Type, TargetNodeId >= 0, and non-null TargetTag.
        /// **Validates: Requirements 5.1, 5.2**
        /// </summary>
        [Property(MaxTest = 100)]
        public Property MutationLogging_Completeness()
        {
            return Prop.ForAll(
                EditorGenerators.MutationEntryGen().ToArbitrary(),
                entry =>
                {
                    var logger = new MutationLogger();
                    logger.Log(entry);

                    var logged = logger.Entries.Last();

                    return (logged.FrameNumber >= 0)
                        .Label($"FrameNumber >= 0 (was {logged.FrameNumber})")
                        .And(() => logged.Timestamp >= 0)
                        .Label($"Timestamp >= 0 (was {logged.Timestamp})")
                        .And(() => Enum.IsDefined(typeof(MutationEntryType), logged.Type))
                        .Label($"Type is valid enum value (was {logged.Type})")
                        .And(() => logged.TargetNodeId >= 0)
                        .Label($"TargetNodeId >= 0 (was {logged.TargetNodeId})")
                        .And(() => logged.TargetTag != null)
                        .Label($"TargetTag is non-null")
                        .And(() => logged.FrameNumber == entry.FrameNumber)
                        .Label("FrameNumber preserved")
                        .And(() => logged.Timestamp == entry.Timestamp)
                        .Label("Timestamp preserved")
                        .And(() => logged.Type == entry.Type)
                        .Label("Type preserved")
                        .And(() => logged.TargetNodeId == entry.TargetNodeId)
                        .Label("TargetNodeId preserved")
                        .And(() => logged.TargetTag == entry.TargetTag)
                        .Label("TargetTag preserved");
                });
        }

        /// <summary>
        /// Property 5: Log clear empties all entries.
        /// For any MutationLogger with one or more entries, calling Clear()
        /// should result in Entries.Count == 0.
        /// **Validates: Requirements 5.4**
        /// </summary>
        [Property(MaxTest = 100)]
        public Property LogClear_EmptiesAllEntries()
        {
            return Prop.ForAll(
                EditorGenerators.MutationEntryListGen(1, 50).ToArbitrary(),
                entries =>
                {
                    var logger = new MutationLogger();
                    foreach (var entry in entries)
                        logger.Log(entry);

                    // Precondition: logger has entries
                    var countBefore = logger.Entries.Count;

                    logger.Clear();

                    return (countBefore > 0)
                        .Label($"Logger had entries before clear (count={countBefore})")
                        .And(() => logger.Entries.Count == 0)
                        .Label($"Entries.Count == 0 after Clear() (was {logger.Entries.Count})");
                });
        }

        /// <summary>
        /// Property 6: Log cap enforcement (invariant).
        /// For any sequence of MutationEntry values logged to a MutationLogger with MaxEntries = N,
        /// Entries.Count should never exceed N. When the cap is exceeded, the oldest entries should
        /// be discarded first (FIFO eviction).
        /// **Validates: Requirements 5.5**
        /// </summary>
        [Property(MaxTest = 100)]
        public Property LogCap_Enforcement()
        {
            return Prop.ForAll(
                Gen.Choose(1, 50).ToArbitrary(),
                EditorGenerators.MutationEntryListGen(1, 100).ToArbitrary(),
                (maxEntries, entries) =>
                {
                    var logger = new MutationLogger(maxEntries);

                    // Log all entries and verify the count invariant after each insertion
                    bool invariantHeld = true;
                    for (int i = 0; i < entries.Count; i++)
                    {
                        logger.Log(entries[i]);
                        if (logger.Entries.Count > maxEntries)
                        {
                            invariantHeld = false;
                            break;
                        }
                    }

                    // After logging all entries, verify FIFO eviction:
                    // The entries in the logger should be the last min(count, maxEntries) from the input
                    int expectedCount = Math.Min(entries.Count, maxEntries);
                    var expectedEntries = entries.Skip(entries.Count - expectedCount).ToList();

                    bool fifoCorrect = logger.Entries.Count == expectedCount;
                    if (fifoCorrect)
                    {
                        for (int i = 0; i < expectedCount; i++)
                        {
                            if (logger.Entries[i].FrameNumber != expectedEntries[i].FrameNumber ||
                                logger.Entries[i].TargetNodeId != expectedEntries[i].TargetNodeId ||
                                logger.Entries[i].Type != expectedEntries[i].Type)
                            {
                                fifoCorrect = false;
                                break;
                            }
                        }
                    }

                    return invariantHeld
                        .Label($"Entries.Count never exceeded MaxEntries={maxEntries} (logged {entries.Count} entries)")
                        .And(() => logger.Entries.Count <= maxEntries)
                        .Label($"Final count {logger.Entries.Count} <= MaxEntries {maxEntries}")
                        .And(() => fifoCorrect)
                        .Label($"FIFO eviction: expected last {expectedCount} entries from input sequence");
                });
        }

        /// <summary>
        /// Property 7: Log type filtering.
        /// For any MutationLogger containing entries of mixed MutationEntryType values
        /// and any single type filter T, GetFiltered(T) should return only entries where
        /// entry.Type == T, and the count of filtered entries should be less than or equal
        /// to the total entry count.
        /// **Validates: Requirements 5.6**
        /// </summary>
        [Property(MaxTest = 100)]
        public Property LogTypeFiltering()
        {
            return Prop.ForAll(
                EditorGenerators.MutationEntryListGen(1, 50).ToArbitrary(),
                EditorGenerators.MutationEntryTypeGen().ToArbitrary(),
                (entries, filterType) =>
                {
                    var logger = new MutationLogger();
                    foreach (var entry in entries)
                        logger.Log(entry);

                    var filtered = logger.GetFiltered(filterType).ToList();
                    var totalCount = logger.Entries.Count;

                    // All filtered entries must have the requested type
                    bool allMatchType = filtered.All(e => e.Type == filterType);

                    // Filtered count must be <= total count
                    bool countInvariant = filtered.Count <= totalCount;

                    // Filtered count must equal the number of entries with that type
                    int expectedCount = logger.Entries.Count(e => e.Type == filterType);
                    bool countCorrect = filtered.Count == expectedCount;

                    return allMatchType
                        .Label($"All filtered entries have Type == {filterType}")
                        .And(() => countInvariant)
                        .Label($"Filtered count ({filtered.Count}) <= total count ({totalCount})")
                        .And(() => countCorrect)
                        .Label($"Filtered count ({filtered.Count}) == expected count ({expectedCount})");
                });
        }


    }
}
