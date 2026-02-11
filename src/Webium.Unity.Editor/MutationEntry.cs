namespace Webium.Editor
{
    public enum MutationEntryType : byte
    {
        CreateElement,
        CreateTextNode,
        AppendChild,
        RemoveChild,
        InsertBefore,
        SetAttribute,
        StyleChange
    }

    public struct MutationEntry
    {
        public int FrameNumber;
        public float Timestamp;
        public MutationEntryType Type;
        public int TargetNodeId;
        public string TargetTag;
        public string Detail;
    }
}
