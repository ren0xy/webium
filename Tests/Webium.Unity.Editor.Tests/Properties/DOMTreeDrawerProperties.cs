using FsCheck;
using NUnit.Framework;
using PropertyAttribute = FsCheck.NUnit.PropertyAttribute;
using Webium.Core;
using Webium.Editor;
using Webium.Tests.Editor.Generators;

namespace Webium.Tests.Editor.Properties
{
    [TestFixture]
    public class DOMTreeDrawerProperties
    {
        [Property(MaxTest = 100)]
        public Property ElementNodeLabel_ContainsTagAndId()
        {
            return Prop.ForAll(
                EditorGenerators.ElementSnapshotGen().ToArbitrary(),
                node =>
                {
                    var label = DOMTreeFormatter.FormatNodeLabel(node);
                    var tagName = node.Tag.ToString();
                    var idStr = node.Id.ToString();

                    return (label.Contains(tagName))
                        .Label($"Label contains tag name '{tagName}' (label was '{label}')")
                        .And(() => label.Contains(idStr))
                        .Label($"Label contains Id '{idStr}' (label was '{label}')");
                });
        }

        [Property(MaxTest = 100)]
        public Property TextNodeLabel_Truncation()
        {
            const int MaxLabelLength = 29;

            return Prop.ForAll(
                EditorGenerators.TextSnapshotGen().ToArbitrary(),
                node =>
                {
                    var label = DOMTreeFormatter.FormatNodeLabel(node);
                    var text = node.TextContent ?? string.Empty;

                    var containsPrefix = label.StartsWith("#text")
                        .Label($"Label starts with '#text' (label was '{label}')");

                    Property contentCheck;
                    if (text.Length <= 20)
                    {
                        contentCheck = label.Contains(text)
                            .Label($"Short text '{text}' appears in full in label '{label}'");
                    }
                    else
                    {
                        var first20 = text.Substring(0, 20);
                        contentCheck = (label.Contains(first20) && label.Contains("\u2026"))
                            .Label($"Long text truncated to first 20 chars + ellipsis");
                    }

                    var boundCheck = (label.Length <= MaxLabelLength)
                        .Label($"Label length {label.Length} <= {MaxLabelLength}");

                    return containsPrefix.And(contentCheck).And(boundCheck);
                });
        }
    }
}
