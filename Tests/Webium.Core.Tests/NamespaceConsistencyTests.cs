using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.RegularExpressions;
using System.Xml.Linq;
using NUnit.Framework;

namespace Webium.Tests.Core
{
    /// <summary>
    /// Feature: dotnet-restructure, Property 1: Namespace consistency
    ///
    /// For any .cs source file in src/, the namespace declaration should match
    /// the RootNamespace in the project's .csproj (or rootNamespace in .asmdef
    /// for Unity projects).
    ///
    /// Validates: Requirements 1.10, 2.8
    /// </summary>
    [TestFixture]
    public class NamespaceConsistencyTests
    {
        private static readonly Regex NamespaceRegex = new Regex(
            @"^\s*namespace\s+([\w.]+)",
            RegexOptions.Multiline);

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

        /// <summary>
        /// Reads the RootNamespace from a .csproj file.
        /// </summary>
        private static string GetRootNamespaceFromCsproj(string csprojPath)
        {
            var doc = XDocument.Load(csprojPath);
            var ns = doc.Descendants("RootNamespace").FirstOrDefault();
            return ns?.Value;
        }

        /// <summary>
        /// Reads the rootNamespace from a Unity .asmdef file (JSON).
        /// </summary>
        private static string GetRootNamespaceFromAsmdef(string asmdefPath)
        {
            var json = File.ReadAllText(asmdefPath);
            var match = Regex.Match(json, @"""rootNamespace""\s*:\s*""([^""]+)""");
            return match.Success ? match.Groups[1].Value : null;
        }

        /// <summary>
        /// Extracts the first namespace declaration from a C# source file.
        /// Returns null if no namespace is declared.
        /// </summary>
        private static string ExtractNamespace(string filePath)
        {
            var content = File.ReadAllText(filePath);
            var match = NamespaceRegex.Match(content);
            return match.Success ? match.Groups[1].Value : null;
        }

        /// <summary>
        /// Discovers all project directories under src/ and yields test cases
        /// as (projectDir, rootNamespace, csFilePath) tuples.
        /// </summary>
        private static IEnumerable<TestCaseData> AllSourceFilesWithExpectedNamespace()
        {
            var repoRoot = FindRepoRoot();
            var srcDir = Path.Combine(repoRoot, "src");

            foreach (var projectDir in Directory.GetDirectories(srcDir))
            {
                string rootNamespace = null;
                string projectConfigFile = null;

                // Try .csproj first
                var csprojFiles = Directory.GetFiles(projectDir, "*.csproj");
                if (csprojFiles.Length > 0)
                {
                    projectConfigFile = csprojFiles[0];
                    rootNamespace = GetRootNamespaceFromCsproj(projectConfigFile);
                }
                else
                {
                    // Try .asmdef (Unity projects)
                    var asmdefFiles = Directory.GetFiles(projectDir, "*.asmdef");
                    if (asmdefFiles.Length > 0)
                    {
                        projectConfigFile = asmdefFiles[0];
                        rootNamespace = GetRootNamespaceFromAsmdef(projectConfigFile);
                    }
                }

                if (rootNamespace == null)
                    continue;

                var projectName = Path.GetFileName(projectDir);

                // Enumerate all .cs files in the project (recursively)
                var csFiles = Directory.GetFiles(projectDir, "*.cs", SearchOption.AllDirectories)
                    .Where(f => !f.Contains(Path.Combine("bin", "")) &&
                                !f.Contains(Path.Combine("obj", "")))
                    .ToList();

                foreach (var csFile in csFiles)
                {
                    var relativePath = csFile.Substring(repoRoot.Length + 1)
                        .Replace('\\', '/');

                    yield return new TestCaseData(csFile, rootNamespace, relativePath)
                        .SetName($"Namespace_{projectName}_{Path.GetFileNameWithoutExtension(csFile)}");
                }
            }
        }

        /// <summary>
        /// Property 1: For any .cs source file in src/, the namespace declaration
        /// should start with or equal the RootNamespace defined in the project's
        /// .csproj or .asmdef file.
        ///
        /// Files without a namespace declaration (e.g., AssemblyInfo.cs) are
        /// considered valid — they use global scope intentionally.
        ///
        /// **Validates: Requirements 1.10, 2.8**
        /// </summary>
        [TestCaseSource(nameof(AllSourceFilesWithExpectedNamespace))]
        public void NamespaceMatchesRootNamespace(
            string csFilePath,
            string expectedRootNamespace,
            string relativePath)
        {
            var actualNamespace = ExtractNamespace(csFilePath);

            if (actualNamespace == null)
            {
                // Files without namespace declarations (e.g., AssemblyInfo.cs)
                // are valid — they intentionally use global scope.
                Assert.Pass($"{relativePath} has no namespace declaration (global scope).");
                return;
            }

            Assert.That(
                actualNamespace,
                Does.StartWith(expectedRootNamespace),
                $"File '{relativePath}' has namespace '{actualNamespace}' " +
                $"which does not start with expected root namespace '{expectedRootNamespace}'.");
        }
    }
}
