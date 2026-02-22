using FsCheck;
using NUnit.Framework;
using PropertyAttribute = FsCheck.NUnit.PropertyAttribute;
using Webium.Core;
using Webium.Editor;
using Webium.Tests.Editor.Generators;

namespace Webium.Tests.Editor.Properties
{
    [TestFixture]
    public class NodeDetailDrawerProperties
    {
        private class FakeBackingObject
        {
            public string Name { get; }
            public FakeBackingObject(string name) { Name = name; }
            public override string ToString() => Name;
        }

        [Property(MaxTest = 100)]
        public Property RenderHandle_NullHandle_DisplaysNull()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                node =>
                {
                    node.RenderHandle = null;
                    var result = NodeDetailFormatter.FormatRenderHandle(node);
                    return (result == "null")
                        .Label($"Null RenderHandle should format as 'null' (got '{result}')");
                });
        }

        [Property(MaxTest = 100)]
        public Property RenderHandle_NonNullHandle_DisplaysTypeAndName()
        {
            return Prop.ForAll(
                EditorGenerators.NodeSnapshotGen().ToArbitrary(),
                Arb.Generate<NonEmptyString>().ToArbitrary(),
                (node, objectName) =>
                {
                    var name = objectName.Get;
                    var backing = new FakeBackingObject(name);
                    node.RenderHandle = backing;
                    var result = NodeDetailFormatter.FormatRenderHandle(node);
                    var typeName = nameof(FakeBackingObject);
                    var expectedFormat = $"{typeName} \"{name}\"";

                    return result.Contains(typeName)
                        .Label($"Result should contain type name '{typeName}' (got '{result}')")
                        .And(() => result.Contains(name))
                        .Label($"Result should contain object name '{name}'")
                        .And(() => result == expectedFormat)
                        .Label($"Result should be '{expectedFormat}' (got '{result}')");
                });
        }

        [Property(MaxTest = 1)]
        public Property RenderHandle_NullNode_DisplaysNull()
        {
            return Prop.ForAll(
                Gen.Constant(0).ToArbitrary(),
                _ =>
                {
                    var result = NodeDetailFormatter.FormatRenderHandle(null);
                    return (result == "null")
                        .Label($"Null node should format as 'null' (got '{result}')");
                });
        }
    }
}
