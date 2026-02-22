using NUnit.Framework;
using UnityEngine;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for CSSColorParser.
    /// Requirements: 5.3, 5.5
    /// </summary>
    [TestFixture]
    public class CSSColorParserTests
    {
        // ── Named color lookup (Req 5.3) ──

        [TestCase("white", 1f, 1f, 1f, 1f)]
        [TestCase("black", 0f, 0f, 0f, 1f)]
        [TestCase("red", 1f, 0f, 0f, 1f)]
        [TestCase("green", 0f, 1f, 0f, 1f)]
        [TestCase("blue", 0f, 0f, 1f, 1f)]
        [TestCase("yellow", 1f, 0.9216f, 0.0157f, 1f)]
        [TestCase("cyan", 0f, 1f, 1f, 1f)]
        [TestCase("magenta", 1f, 0f, 1f, 1f)]
        public void Parse_NamedColor_ReturnsExpected(string name, float r, float g, float b, float a)
        {
            var color = CSSColorParser.Parse(name);
            Assert.AreEqual(r, color.r, 0.02f, $"R mismatch for {name}");
            Assert.AreEqual(g, color.g, 0.02f, $"G mismatch for {name}");
            Assert.AreEqual(b, color.b, 0.02f, $"B mismatch for {name}");
            Assert.AreEqual(a, color.a, 0.02f, $"A mismatch for {name}");
        }

        [Test]
        public void Parse_Transparent_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("transparent"));
        }

        [Test]
        public void Parse_GrayAndGrey_AreSame()
        {
            Assert.AreEqual(CSSColorParser.Parse("gray"), CSSColorParser.Parse("grey"));
        }

        [Test]
        public void Parse_NamedColor_CaseInsensitive()
        {
            Assert.AreEqual(CSSColorParser.Parse("red"), CSSColorParser.Parse("RED"));
            Assert.AreEqual(CSSColorParser.Parse("blue"), CSSColorParser.Parse("Blue"));
        }

        // ── Invalid / edge-case inputs (Req 5.5) ──

        [Test]
        public void Parse_Null_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse(null));
        }

        [Test]
        public void Parse_Empty_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse(""));
        }

        [Test]
        public void Parse_Whitespace_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("   "));
        }

        [Test]
        public void Parse_MalformedHex_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("#ZZZ"));
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("#GGHHII"));
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("#12345")); // wrong length
        }

        [Test]
        public void Parse_UnrecognizedString_ReturnsClear()
        {
            Assert.AreEqual(Color.clear, CSSColorParser.Parse("notacolor"));
        }
    }
}
