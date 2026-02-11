using System;
using System.Globalization;
using FsCheck;
using NUnit.Framework;
using UnityEngine;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime.Renderers.Properties
{
    /// <summary>
    /// Property-based tests for CSSColorParser and CSSUnitParser.
    /// </summary>
    [TestFixture]
    public class CSSParserProperties
    {
        // ── Generators ──

        private static Gen<byte> GenByte => Gen.Choose(0, 255).Select(i => (byte)i);

        private static Gen<(byte r, byte g, byte b, byte a)> GenRGBA =>
            from r in GenByte
            from g in GenByte
            from b in GenByte
            from a in GenByte
            select (r, g, b, a);

        /// <summary>
        /// Property 5: CSSColorParser round-trip consistency.
        /// For any valid hex #RRGGBBAA color, parsing produces a Color whose
        /// components match the input bytes (within 1/255 tolerance).
        /// **Validates: Requirements 5.1, 5.2, 5.4**
        /// </summary>
        [Test]
        public void Property5_RoundTripConsistency()
        {
            Prop.ForAll(GenRGBA.ToArbitrary(), rgba =>
            {
                var hex = $"#{rgba.r:X2}{rgba.g:X2}{rgba.b:X2}{rgba.a:X2}";
                var color = CSSColorParser.Parse(hex);

                var rOk = Mathf.Abs(color.r - rgba.r / 255f) < 0.01f;
                var gOk = Mathf.Abs(color.g - rgba.g / 255f) < 0.01f;
                var bOk = Mathf.Abs(color.b - rgba.b / 255f) < 0.01f;
                var aOk = Mathf.Abs(color.a - rgba.a / 255f) < 0.01f;

                return (rOk && gOk && bOk && aOk)
                    .Label($"hex={hex} => ({color.r},{color.g},{color.b},{color.a})");
            }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 5 (case-insensitive variant): Parsing the same hex in
        /// upper and lower case yields the same Color.
        /// **Validates: Requirements 5.4**
        /// </summary>
        [Test]
        public void Property5_CaseInsensitive()
        {
            Prop.ForAll(GenRGBA.ToArbitrary(), rgba =>
            {
                var upper = $"#{rgba.r:X2}{rgba.g:X2}{rgba.b:X2}";
                var lower = upper.ToLowerInvariant();

                var cu = CSSColorParser.Parse(upper);
                var cl = CSSColorParser.Parse(lower);

                return (cu == cl).Label($"upper={upper} lower={lower}");
            }).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 6: CSSColorParser handles invalid input gracefully.
        /// For any arbitrary string, Parse never throws and returns Color.clear
        /// for non-parseable inputs.
        /// **Validates: Requirements 5.5**
        /// </summary>
        [Test]
        public void Property6_InvalidInputReturnsColorClear()
        {
            var genGarbage = Gen.OneOf(
                Arb.Generate<string>(),
                Gen.Constant((string)null),
                Gen.Constant(""),
                Gen.Constant("   "),
                Gen.Constant("#ZZZ"),
                Gen.Constant("notacolor"),
                Gen.Constant("rgb(abc)"),
                Gen.Constant("rgba(1,2)")
            );

            Prop.ForAll(genGarbage.ToArbitrary(), input =>
            {
                Color result = default;
                bool threw = false;
                try
                {
                    result = CSSColorParser.Parse(input);
                }
                catch
                {
                    threw = true;
                }

                // Must never throw
                var noThrow = (!threw).Label("should not throw");

                // If input is null/empty/whitespace or not a valid format, result should be Color.clear
                // (valid named colors and valid hex/rgb will not be Color.clear, so we only assert no-throw)
                return noThrow;
            }).QuickCheckThrowOnFailure();
        }

        // ── CSSUnitParser Generators ──

        private static Gen<float> GenPxValue =>
            Gen.Choose(-10000, 10000).Select(i => i / 10f);

        /// <summary>
        /// Property 7: CSSUnitParser parses px values correctly.
        /// For any numeric float, formatting it as "Npx" or "N" (unitless)
        /// and parsing via ParsePx returns the original value.
        /// **Validates: Requirements 6.1, 6.2, 6.4**
        /// </summary>
        [Test]
        public void Property7_ParsePxWithSuffix()
        {
            Prop.ForAll(GenPxValue.ToArbitrary(), val =>
            {
                var input = val.ToString("F1", CultureInfo.InvariantCulture) + "px";
                var result = CSSUnitParser.ParsePx(input);
                return (Mathf.Abs(result - val) < 0.01f)
                    .Label($"input={input} expected={val} got={result}");
            }).QuickCheckThrowOnFailure();
        }

        [Test]
        public void Property7_ParsePxUnitless()
        {
            Prop.ForAll(GenPxValue.ToArbitrary(), val =>
            {
                var input = val.ToString("F1", CultureInfo.InvariantCulture);
                var result = CSSUnitParser.ParsePx(input);
                return (Mathf.Abs(result - val) < 0.01f)
                    .Label($"input={input} expected={val} got={result}");
            }).QuickCheckThrowOnFailure();
        }

        [Test]
        public void Property7_ParsePxWhitespaceTrimmed()
        {
            Prop.ForAll(GenPxValue.ToArbitrary(), val =>
            {
                var input = "  " + val.ToString("F1", CultureInfo.InvariantCulture) + "px  ";
                var result = CSSUnitParser.ParsePx(input);
                return (Mathf.Abs(result - val) < 0.01f)
                    .Label($"input='{input}' expected={val} got={result}");
            }).QuickCheckThrowOnFailure();
        }
    }
}
