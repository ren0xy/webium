using System;
using System.Linq;
using NUnit.Framework;
using Webium.Core;

namespace Webium.Tests.Core
{
    /// <summary>
    /// Unit tests verifying that all NodeTag enum values match their expected ordinals
    /// and that the enum has exactly 24 members.
    ///
    /// Validates: Requirements 1.1, 3.1
    /// </summary>
    [TestFixture]
    public class NodeTagEnumTests
    {
        [Test]
        public void NodeTag_HasExactly24Members()
        {
            var values = Enum.GetValues(typeof(NodeTag));
            Assert.That(values.Length, Is.EqualTo(24),
                "NodeTag enum should have exactly 24 members.");
        }

        [TestCase(NodeTag.Div, 0)]
        [TestCase(NodeTag.Span, 1)]
        [TestCase(NodeTag.P, 2)]
        [TestCase(NodeTag.Img, 3)]
        [TestCase(NodeTag.Text, 4)]
        [TestCase(NodeTag.Style, 5)]
        [TestCase(NodeTag.Unknown, 6)]
        [TestCase(NodeTag.Button, 7)]
        [TestCase(NodeTag.Input, 8)]
        [TestCase(NodeTag.A, 9)]
        [TestCase(NodeTag.Ul, 10)]
        [TestCase(NodeTag.Ol, 11)]
        [TestCase(NodeTag.Li, 12)]
        [TestCase(NodeTag.H1, 13)]
        [TestCase(NodeTag.H2, 14)]
        [TestCase(NodeTag.H3, 15)]
        [TestCase(NodeTag.H4, 16)]
        [TestCase(NodeTag.H5, 17)]
        [TestCase(NodeTag.H6, 18)]
        [TestCase(NodeTag.Script, 19)]
        [TestCase(NodeTag.Link, 20)]
        [TestCase(NodeTag.Body, 21)]
        [TestCase(NodeTag.Head, 22)]
        [TestCase(NodeTag.Html, 23)]
        public void NodeTag_ValueMatchesExpectedOrdinal(NodeTag tag, int expectedValue)
        {
            Assert.That((int)tag, Is.EqualTo(expectedValue),
                $"NodeTag.{tag} should have ordinal value {expectedValue}.");
        }
    }
}
