using System.Collections.Generic;
using System.Linq;

namespace Webium.Editor
{
    public class MutationLogger
    {
        private readonly List<MutationEntry> _entries = new List<MutationEntry>();
        private readonly int _maxEntries;

        public MutationLogger(int maxEntries = 1000)
        {
            _maxEntries = maxEntries;
        }

        public IReadOnlyList<MutationEntry> Entries => _entries;

        public int MaxEntries => _maxEntries;

        public void Log(MutationEntry entry)
        {
            if (_entries.Count >= _maxEntries)
            {
                _entries.RemoveAt(0);
            }
            _entries.Add(entry);
        }

        public void Clear()
        {
            _entries.Clear();
        }

        public IEnumerable<MutationEntry> GetFiltered(MutationEntryType? typeFilter)
        {
            if (typeFilter == null)
                return _entries;

            return _entries.Where(e => e.Type == typeFilter.Value);
        }
    }
}
