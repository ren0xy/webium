using NUnit.Framework;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers
{
    /// <summary>
    /// Unit tests for CSSUnitParser.
    /// Requirements: 6.2, 6.3, 6.4
    /// </summary>
    [TestFixture]
    public class CSSUnitParserTests
    {
        // ── Unitless values (Req 6.2) ──

        [TestCase("16", 16f)]
        [TestCase("0", 0f)]
        [TestCase("3.5", 3.5f)]
        public void ParsePx_Unitless_TreatedAsPx(string input, float expected)
        {
            Assert.AreEqual(expected, CSSUnitParser.ParsePx(input), 0.01f);
        }

        // ── Whitespace trimming (Req 6.4) ──

        [TestCase("  16px  ", 16f)]
        [TestCase(" 24 ", 24f)]
        [TestCase("\t10px\t", 10f)]
        public void ParsePx_WhitespaceTrimmed(string input, float expected)
        {
            Assert.AreEqual(expected, CSSUnitParser.ParsePx(input), 0.01f);
        }

        // ── Invalid inputs (Req 6.3) ──

        [Test]
        public void ParsePx_Null_ReturnsZero()
        {
            Assert.AreEqual(0f, CSSUnitParser.ParsePx(null));
        }

        [Test]
        public void ParsePx_Empty_ReturnsZero()
        {
            Assert.AreEqual(0f, CSSUnitParser.ParsePx(""));
        }

        [Test]
        public void ParsePx_InvalidUnit_ReturnsZero()
        {
            Assert.AreEqual(0f, CSSUnitParser.ParsePx("16em"));
            Assert.AreEqual(0f, CSSUnitParser.ParsePx("abc"));
            Assert.AreEqual(0f, CSSUnitParser.ParsePx("px"));
        }
    }
}
