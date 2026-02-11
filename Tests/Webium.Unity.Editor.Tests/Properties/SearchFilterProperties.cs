using System;
using System.Collections.Generic;
using System.Linq;
using FsCheck;
using NUnit.Framework;
using PropertyAttribute = FsCheck.NUnit.PropertyAttribute;
using Webium.Core;
using Webium.Editor;
using Webium.Tests.Editor.Generators;

namespace Webium.Tests.Editor.Properties
{
    [TestFixture]
    public class SearchFilterProperties
    {
        [Property(MaxTest = 100)]
        public Property SearchMatching_EmptyOrNullQuery_MatchesAll()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                Gen.Elements((string)null, "").ToArbitrary(),
                (node, query) =>
                {
                    var filter = new SearchFilter { Query = query };
                    return filter.Matches(node)
                        .Label($"Empty/null query should match all nodes (query={query ?? "null"}, node Id={node.Id}, Tag={node.Tag})");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchMatching_NumericIdQuery_MatchesById()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                node =>
                {
                    var filter = new SearchFilter { Query = node.Id.ToString() };
                    return filter.Matches(node)
                        .Label($"Numeric query matching node Id should return true (Id={node.Id})");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchMatching_TagSubstring_MatchesCaseInsensitive()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                node =>
                {
                    string tagName = node.Tag.ToString();
                    var filter = new SearchFilter { Query = tagName.ToUpperInvariant() };
                    bool matchesUpper = filter.Matches(node);
                    filter.Query = tagName.ToLowerInvariant();
                    bool matchesLower = filter.Matches(node);
                    string substring = tagName.Substring(0, Math.Max(1, tagName.Length / 2));
                    filter.Query = substring;
                    bool matchesSubstring = filter.Matches(node);

                    return matchesUpper
                        .Label($"Tag uppercase query should match (Tag={tagName})")
                        .And(() => matchesLower)
                        .Label($"Tag lowercase query should match")
                        .And(() => matchesSubstring)
                        .Label($"Tag substring query should match");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchMatching_AttributeValue_MatchesCaseInsensitive()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen()
                    .Where(n => n.Attributes.Count > 0)
                    .ToArbitrary(),
                node =>
                {
                    var attrValue = node.Attributes.Values.First();
                    var filter = new SearchFilter { Query = attrValue.ToUpperInvariant() };
                    bool matchesUpper = filter.Matches(node);
                    filter.Query = attrValue.ToLowerInvariant();
                    bool matchesLower = filter.Matches(node);

                    return matchesUpper
                        .Label($"Attribute value uppercase query should match (value={attrValue})")
                        .And(() => matchesLower)
                        .Label($"Attribute value lowercase query should match");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchMatching_NonMatchingQuery_ReturnsFalse()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                node =>
                {
                    string query = "ZZZZXYZNONMATCH99999";
                    var filter = new SearchFilter { Query = query };
                    bool matches = filter.Matches(node);

                    string tagName = node.Tag.ToString();
                    bool idMatch = int.TryParse(query, out int id) && node.Id == id;
                    bool tagMatch = tagName.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
                    bool attrMatch = node.Attributes.Values.Any(v =>
                        v != null && v.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);
                    bool expectedMatch = idMatch || tagMatch || attrMatch;

                    return (matches == expectedMatch)
                        .Label($"Non-matching query should return false");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchMatching_OracleAgreement()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                EditorGenerators.SearchQueryGen().ToArbitrary(),
                (node, query) =>
                {
                    var filter = new SearchFilter { Query = query };
                    bool actual = filter.Matches(node);

                    bool expected;
                    if (string.IsNullOrEmpty(query))
                    {
                        expected = true;
                    }
                    else
                    {
                        bool idMatch = int.TryParse(query, out int id) && node.Id == id;
                        string tagName = node.Tag.ToString();
                        bool tagMatch = tagName.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0;
                        bool attrMatch = node.Attributes.Values.Any(v =>
                            v != null && v.IndexOf(query, StringComparison.OrdinalIgnoreCase) >= 0);
                        expected = idMatch || tagMatch || attrMatch;
                    }

                    return (actual == expected)
                        .Label($"SearchFilter.Matches should agree with oracle (query={query ?? "null"})");
                });
        }

        [Property(MaxTest = 100)]
        public Property SearchAncestorChainPreservation()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotTreeGen().ToArbitrary(),
                EditorGenerators.NonEmptySearchQueryGen().ToArbitrary(),
                (tree, query) =>
                {
                    var (root, allNodes) = tree;
                    var filter = new SearchFilter { Query = query };

                    var matchingNodes = new HashSet<int>();
                    foreach (var node in allNodes)
                    {
                        if (filter.Matches(node))
                            matchingNodes.Add(node.Id);
                    }

                    // Actual visible set: nodes where MatchesOrHasMatchingDescendant is true
                    var actualVisible = new HashSet<int>();
                    foreach (var node in allNodes)
                    {
                        if (filter.MatchesOrHasMatchingDescendant(node))
                            actualVisible.Add(node.Id);
                    }

                    // All matching nodes should be visible
                    bool allMatchingVisible = matchingNodes.All(id => actualVisible.Contains(id));

                    return allMatchingVisible
                        .Label($"All matching nodes should be visible (query={query})");
                });
        }
    }
}
