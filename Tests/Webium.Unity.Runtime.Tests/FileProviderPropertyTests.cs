using System;
using System.IO;
using System.Linq;
using System.Text;
using FsCheck;
using NUnit.Framework;
using Webium.Unity;

namespace Webium.Tests.Unity.Runtime
{
    /// <summary>
    /// Property-based tests for FileProvider path security.
    /// Feature: 007-hello-world-integration, Property 1: FileProvider path resolution stays within base directory
    /// </summary>
    [TestFixture]
    public class FileProviderPropertyTests
    {
        private string _tempRoot;
        private string _baseDir;
        private string _outsideDir;

        [SetUp]
        public void SetUp()
        {
            _tempRoot = Path.Combine(Path.GetTempPath(), "FPPropTests_" + Path.GetRandomFileName());
            _baseDir = Path.Combine(_tempRoot, "base");
            _outsideDir = Path.Combine(_tempRoot, "outside");
            Directory.CreateDirectory(_baseDir);
            Directory.CreateDirectory(_outsideDir);

            // Create a file inside the base directory
            File.WriteAllText(Path.Combine(_baseDir, "inside.txt"), "safe", Encoding.UTF8);

            // Create a file outside the base directory (sibling)
            File.WriteAllText(Path.Combine(_outsideDir, "secret.txt"), "leaked", Encoding.UTF8);

            // Create a file at the temp root level
            File.WriteAllText(Path.Combine(_tempRoot, "root-secret.txt"), "leaked", Encoding.UTF8);
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_tempRoot))
                Directory.Delete(_tempRoot, true);
        }

        /// <summary>
        /// Generates a relative path with ".." segments that attempts to escape the base directory.
        /// Uses LINQ query syntax to combine multiple generators into a single Arbitrary.
        /// </summary>
        private static Arbitrary<string> ArbEscapingPath()
        {
            var segments = new[] { "sub", "dir", "a", "b", "css", "js", "assets" };
            var filenames = new[] { "secret.txt", "root-secret.txt", "inside.txt", "style.css", "main.js" };
            var separators = new[] { "/", "\\" };

            var gen = from dotDotCount in Gen.Choose(1, 5)
                      from intermediateCount in Gen.Choose(0, 3)
                      from segment in Gen.Elements(segments)
                      from sep in Gen.Elements(separators)
                      from filename in Gen.Elements(filenames)
                      from leadingDotSlash in Gen.Elements(true, false)
                      select BuildEscapingPath(dotDotCount, intermediateCount, segment, sep, filename, leadingDotSlash);

            return gen.ToArbitrary();
        }

        private static string BuildEscapingPath(int dotDotCount, int intermediateCount,
            string segment, string sep, string filename, bool leadingDotSlash)
        {
            var parts = new System.Collections.Generic.List<string>();

            if (leadingDotSlash)
                parts.Add(".");

            // Add intermediate segments before ".." to make paths like "sub/../../.."
            for (int i = 0; i < intermediateCount; i++)
                parts.Add(segment);

            // Add enough ".." segments to escape the base directory
            for (int i = 0; i < dotDotCount + intermediateCount + 1; i++)
                parts.Add("..");

            parts.Add(filename);

            return string.Join(sep, parts);
        }

        /// <summary>
        /// Property 1: FileProvider path resolution stays within base directory
        ///
        /// For any relative file path (including paths with "..", "./", and mixed separators),
        /// FileProvider.ReadFile(basePath, relativePath) should either return null or resolve
        /// to a path that is a descendant of basePath. It must never access files outside
        /// the base directory.
        ///
        /// We verify this by generating paths with ".." segments that would escape the base
        /// directory and confirming ReadFile always returns null for them, even when the
        /// target file exists on disk.
        ///
        /// **Validates: Requirements 1.6, 2.1**
        /// </summary>
        [Test]
        public void ReadFile_PathResolution_StaysWithinBaseDirectory()
        {
            Prop.ForAll(
                ArbEscapingPath(),
                (relativePath) =>
                {
                    var result = FileProvider.ReadFile(_baseDir, relativePath);

                    // Compute what the resolved path would be
                    var normalized = relativePath.Replace('/', Path.DirectorySeparatorChar);
                    if (normalized.StartsWith("." + Path.DirectorySeparatorChar))
                        normalized = normalized.Substring(2);

                    var fullPath = Path.GetFullPath(Path.Combine(_baseDir, normalized));
                    var resolvedBase = Path.GetFullPath(_baseDir);

                    if (!fullPath.StartsWith(resolvedBase))
                    {
                        // Path escapes base → must be null
                        Assert.IsNull(result,
                            $"FileProvider returned non-null for escaping path '{relativePath}' " +
                            $"(resolved to '{fullPath}', base is '{resolvedBase}')");
                    }
                    // else: path stays within base, result can be null (file missing) or content — both are fine
                }
            ).QuickCheckThrowOnFailure();
        }

        /// <summary>
        /// Property 1 (variant): Paths that resolve within the base directory never
        /// return content from outside the base directory.
        ///
        /// For any safe relative path (no ".." segments), if ReadFile returns non-null,
        /// the content must match what's actually at that path inside the base directory.
        ///
        /// **Validates: Requirements 1.6, 2.1**
        /// </summary>
        [Test]
        public void ReadFile_SafePaths_OnlyReturnContentFromWithinBase()
        {
            var arbFilename = Gen.Elements("a.txt", "b.txt", "c.txt", "d.txt")
                .ToArbitrary();

            var arbContent = Arb.Default.NonEmptyString();

            Prop.ForAll(
                arbFilename, arbContent,
                (filename, content) =>
                {
                    var contentStr = content.Get;

                    // Write the file inside the base directory
                    var filePath = Path.Combine(_baseDir, filename);
                    File.WriteAllText(filePath, contentStr, Encoding.UTF8);

                    var result = FileProvider.ReadFile(_baseDir, filename);

                    // Must return the exact content we wrote
                    Assert.IsNotNull(result, $"ReadFile returned null for existing file '{filename}'");
                    Assert.AreEqual(contentStr, result,
                        $"ReadFile returned different content for '{filename}'");

                    // Cleanup for next iteration
                    File.Delete(filePath);
                }
            ).QuickCheckThrowOnFailure();
        }
    }

    /// <summary>
    /// Property-based tests for FileProvider read round-trip.
    /// Feature: 007-hello-world-integration, Property 2: FileProvider read round-trip
    /// </summary>
    [TestFixture]
    public class FileProviderReadRoundTripPropertyTests
    {
        private string _tempDir;

        [SetUp]
        public void SetUp()
        {
            _tempDir = Path.Combine(Path.GetTempPath(), "FPRoundTrip_" + Path.GetRandomFileName());
            Directory.CreateDirectory(_tempDir);
        }

        [TearDown]
        public void TearDown()
        {
            if (Directory.Exists(_tempDir))
                Directory.Delete(_tempDir, true);
        }

        /// <summary>
        /// Generates safe filenames: alphanumeric with a .txt extension.
        /// Avoids path separators and special characters that would
        /// complicate the round-trip (the property is about content fidelity,
        /// not path resolution — Property 1 covers that).
        /// </summary>
        private static Arbitrary<string> ArbSafeFilename()
        {
            var gen = from chars in Gen.ArrayOf(
                          Gen.Choose(0, 35).Select(i => i < 10 ? (char)('0' + i) : (char)('a' + i - 10))
                      )
                      where chars.Length > 0 && chars.Length <= 20
                      select new string(chars) + ".txt";

            return gen.ToArbitrary();
        }

        /// <summary>
        /// Property 2: FileProvider read round-trip
        ///
        /// For any UTF-8 string written to a file within a temporary directory,
        /// calling FileProvider.ReadFile(tempDir, filename) should return a string
        /// identical to the original.
        ///
        /// **Validates: Requirements 2.2**
        /// </summary>
        [Test]
        public void ReadFile_RoundTrip_ReturnsIdenticalContent()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            Prop.ForAll(
                ArbSafeFilename(),
                Arb.Default.NonEmptyString(),
                (filename, content) =>
                {
                    var contentStr = content.Get;
                    var filePath = Path.Combine(_tempDir, filename);

                    // Write the content as UTF-8
                    File.WriteAllText(filePath, contentStr, Encoding.UTF8);

                    // Read it back via FileProvider
                    var result = FileProvider.ReadFile(_tempDir, filename);

                    Assert.IsNotNull(result,
                        $"ReadFile returned null for existing file '{filename}'");
                    Assert.AreEqual(contentStr, result,
                        $"Round-trip failed for file '{filename}': " +
                        $"expected length {contentStr.Length}, got length {result.Length}");

                    // Cleanup for next iteration
                    File.Delete(filePath);
                }
            ).Check(config);
        }

        /// <summary>
        /// Property 2 (variant): Round-trip with Unicode content including
        /// multibyte characters (CJK, emoji, accented characters).
        ///
        /// Generates strings containing characters from various Unicode ranges
        /// to verify UTF-8 encoding fidelity.
        ///
        /// **Validates: Requirements 2.2**
        /// </summary>
        [Test]
        public void ReadFile_RoundTrip_PreservesUnicodeContent()
        {
            var config = Configuration.QuickThrowOnFailure;
            config.MaxNbOfTest = 100;

            // Mix ASCII with various Unicode ranges
            var unicodeGen = from ascii in Arb.Default.NonEmptyString().Generator
                             from suffix in Gen.Elements(
                                 "\u65E5\u672C\u8A9E\u30C6\u30B9\u30C8",  // CJK
                                 "caf\u00E9 r\u00E9sum\u00E9",             // accented Latin
                                 "\u041F\u0440\u0438\u0432\u0435\u0442 \u043C\u0438\u0440", // Cyrillic
                                 "\U0001F389\U0001F680\U0001F4BB",          // emoji
                                 "\u03B1\u03B2\u03B3\u03B4",               // Greek
                                 "\u0645\u0631\u062D\u0628\u0627",         // Arabic
                                 ""                                         // no suffix
                             )
                             select ascii.Get + suffix;

            Prop.ForAll(
                unicodeGen.ToArbitrary(),
                ArbSafeFilename(),
                (content, filename) =>
                {
                    var filePath = Path.Combine(_tempDir, filename);

                    File.WriteAllText(filePath, content, Encoding.UTF8);

                    var result = FileProvider.ReadFile(_tempDir, filename);

                    Assert.IsNotNull(result,
                        $"ReadFile returned null for existing file '{filename}'");
                    Assert.AreEqual(content, result,
                        $"Unicode round-trip failed for file '{filename}'");

                    File.Delete(filePath);
                }
            ).Check(config);
        }
    }
}
