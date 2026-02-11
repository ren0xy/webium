using System;
using System.Linq;
using FsCheck;
using NUnit.Framework;
using Webium.JSRuntime;

namespace Webium.Tests.JSRuntime
{
    /// <summary>
    /// Property-based tests for argument serialization.
    /// Feature: js-runtime-service, Property 5: Argument serialization produces valid JSON
    /// </summary>
    [TestFixture]
    public class SerializeArgsTests
    {
        /// <summary>
        /// Generates a random argument that is null, a string (including special chars), or an int.
        /// </summary>
        private static Gen<object> ArgGen()
        {
            var nullGen = Gen.Constant((object)null);

            var stringGen = Arb.Generate<string>()
                .Select(s => (object)(s ?? ""));

            // Include strings with special characters: quotes, backslashes, newlines, tabs
            var specialStringGen = Gen.Elements(
                "hello",
                "with \"quotes\"",
                "back\\slash",
                "new\nline",
                "tab\there",
                "mixed\"and\\special",
                "",
                "unicode: \u00e9\u00e0\u00fc",
                "null",
                "true",
                "123"
            ).Select(s => (object)s);

            var intGen = Arb.Generate<int>().Select(i => (object)i);

            return Gen.OneOf(nullGen, stringGen, specialStringGen, intGen);
        }

        /// <summary>
        /// Custom Arbitrary for object arrays containing nulls, strings, and ints.
        /// </summary>
        public static Arbitrary<object[]> ArgsArbitrary()
        {
            var gen = Gen.Sized(size =>
                Gen.ArrayOf(Math.Min(size, 20), ArgGen()));
            return Arb.From(gen);
        }

        /// <summary>
        /// Property 5: Argument serialization produces valid JSON
        /// For any array of arguments containing nulls, strings, and numeric types,
        /// SerializeArgs shall produce a syntactically valid JSON array string where:
        /// nulls map to null, strings map to escaped JSON strings, and other types
        /// map to their ToString() representation. A null or empty input array shall produce "[]".
        /// **Validates: Requirements 11.1, 11.2, 11.3**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 100, Arbitrary = new[] { typeof(SerializeArgsTests) })]
        public FsCheck.Property SerializeArgs_ProducesValidJson(object[] args)
        {
            var result = ArgSerializer.SerializeArgs(args);

            // Must be parseable as a JSON array
            bool isValidJson;
            object[] parsed;
            try
            {
                parsed = System.Text.Json.JsonSerializer.Deserialize<object[]>(result);
                isValidJson = parsed != null;
            }
            catch
            {
                isValidJson = false;
                parsed = null;
            }

            // Verify element count matches
            bool countMatches = isValidJson && parsed.Length == args.Length;

            // Verify each element maps correctly
            bool elementsMatch = true;
            if (countMatches)
            {
                for (int i = 0; i < args.Length; i++)
                {
                    var arg = args[i];
                    var parsedElement = parsed[i];

                    if (arg == null)
                    {
                        // null → JSON null
                        if (parsedElement != null)
                        {
                            elementsMatch = false;
                            break;
                        }
                    }
                    else if (arg is string s)
                    {
                        // string → escaped JSON string, parsed back should equal original
                        if (parsedElement is System.Text.Json.JsonElement je
                            && je.ValueKind == System.Text.Json.JsonValueKind.String)
                        {
                            if (je.GetString() != s)
                            {
                                elementsMatch = false;
                                break;
                            }
                        }
                        else
                        {
                            elementsMatch = false;
                            break;
                        }
                    }
                    else
                    {
                        // int/other → ToString() representation in JSON
                        if (parsedElement is System.Text.Json.JsonElement je2
                            && je2.ValueKind == System.Text.Json.JsonValueKind.Number)
                        {
                            if (je2.GetRawText() != arg.ToString())
                            {
                                elementsMatch = false;
                                break;
                            }
                        }
                        else
                        {
                            elementsMatch = false;
                            break;
                        }
                    }
                }
            }

            return (isValidJson && countMatches && elementsMatch)
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 5: Argument serialization produces valid JSON");
        }

        /// <summary>
        /// Null input produces "[]".
        /// **Validates: Requirements 11.3**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 1)]
        public FsCheck.Property SerializeArgs_NullInput_ProducesEmptyArray()
        {
            var result = ArgSerializer.SerializeArgs(null);
            return (result == "[]")
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 5: null input → []");
        }

        /// <summary>
        /// Empty input produces "[]".
        /// **Validates: Requirements 11.3**
        /// </summary>
        [FsCheck.NUnit.Property(MaxTest = 1)]
        public FsCheck.Property SerializeArgs_EmptyInput_ProducesEmptyArray()
        {
            var result = ArgSerializer.SerializeArgs(new object[0]);
            return (result == "[]")
                .ToProperty()
                .Label("Feature: js-runtime-service, Property 5: empty input → []");
        }
    }
}
