using System.Collections.Generic;

namespace Webium.JSRuntime
{
    /// <summary>
    /// DOM operation type for a single mutation.
    /// </summary>
    public enum MutationOp : byte
    {
        Create,
        Remove,
        SetAttribute,
        SetStyle,
        SetText
    }

    /// <summary>
    /// A single DOM mutation entry.
    /// </summary>
    public struct Mutation
    {
        public MutationOp Op;
        public int NodeId;
        public string Key;   // attribute/style name (null for Create/Remove/SetText)
        public string Value;  // attribute/style value, text content, or tag name for Create
    }

    /// <summary>
    /// Represents a batch of DOM mutations received from the JS side.
    /// Engine-agnostic: no Unity or PuerTS references.
    /// </summary>
    public class MutationBatch
    {
        private readonly List<Mutation> _mutations = new List<Mutation>();

        public int Count => _mutations.Count;
        public IReadOnlyList<Mutation> Mutations => _mutations;

        public void Add(Mutation mutation) => _mutations.Add(mutation);
        public void Clear() => _mutations.Clear();
    }
}
