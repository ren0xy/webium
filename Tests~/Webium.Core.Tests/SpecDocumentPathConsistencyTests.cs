using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using NUnit.Framework;

namespace Webium.Tests.Core
{
    /// <summary>
    /// Feature: dotnet-restructure, Property 4: Spec document path consistency
    ///
    /// For any spec document in .kiro/specs/001-* through .kiro/specs/010-*/,
    /// the document should contain zero occurrences of old-style path patterns
    /// (Runtime/Core/, Runtime/Layout/, Runtime/JSRuntime/, Runtime/CSS/,
    /// Runtime/API/, Runtime/Modding/, Tests/EditMode/).
    ///
    /// Validates: Requirements 9.1–9.11
    /// </summary>
    [TestFixture]
    public class SpecDocumentPathConsistencyTests
    {
        private static readonly string[] OldPathPatterns = new[]
        {
            "Runtime/Core/",
            "Runtime/Layout/",
            "Runtime/JSRuntime/",
            "Runtime/CSS/",
            "Runtime/API/",
            "Runtime/Modding/",
            "Tests/EditMode/"
        };

        private static string FindRepoRoot()
        {
            var dir = TestContext.CurrentContext.TestDirectory;
            while (dir != null)
            {
                if (File.Exists(Path.Combine(dir, "Webium.sln")))
                    return dir;
                dir = Directory.GetParent(dir)?.FullName;
            }

            throw new InvalidOperationException(
                "Could not find repository root (Webium.sln) from test directory.");
        }

        private static IEnumerable<TestCaseData> AllSpecDocuments()
        {
            var repoRoot = FindRepoRoot();
            var specsDir = Path.Combine(repoRoot, ".kiro", "specs");

            for (int i = 1; i <= 10; i++)
            {
                var prefix = i.ToString("D3");
                var matchingDirs = Directory.GetDirectories(specsDir, $"{prefix}-*");

                foreach (var specDir in matchingDirs)
                {
                    var mdFiles = Directory.GetFiles(specDir, "*.md");
                    var specName = Path.GetFileName(specDir);

                    foreach (var mdFile in mdFiles)
                    {
                        var fileName = Path.GetFileName(mdFile);
                        yield return new TestCaseData(mdFile)
                            .SetName($"NoOldPaths_{specName}_{Path.GetFileNameWithoutExtension(fileName)}");
                    }
                }
            }
        }

        /// <summary>
        /// Property 4: For any spec document in .kiro/specs/001-* through
        /// .kiro/specs/010-*/, the document should contain zero occurrences
        /// of old-style path patterns.
        ///
        /// **Validates: Requirements 9.1–9.11**
        /// </summary>
        [TestCaseSource(nameof(AllSpecDocuments))]
        public void SpecDocumentContainsNoOldPathPatterns(string mdFilePath)
        {
            var content = File.ReadAllText(mdFilePath);
            var repoRoot = FindRepoRoot();
            var relativePath = mdFilePath.Substring(repoRoot.Length + 1).Replace('\\', '/');

            var violations = new List<string>();

            foreach (var pattern in OldPathPatterns)
            {
                var index = 0;
                while ((index = content.IndexOf(pattern, index, StringComparison.Ordinal)) >= 0)
                {
                    // Find the line number for context
                    var lineNumber = content.Substring(0, index).Count(c => c == '\n') + 1;
                    violations.Add($"  Line {lineNumber}: found '{pattern}'");
                    index += pattern.Length;
                }
            }

            Assert.That(violations, Is.Empty,
                $"File '{relativePath}' contains old-style path patterns:\n" +
                string.Join("\n", violations));
        }
    }
}
