import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';

export default function AaronMemoryPanel({ isOpen, onClose }) {
  const [memory, setMemory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    backendFetch('/api/aaron/memory')
      .then((data) => { setMemory(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [isOpen]);

  async function handleClear() {
    if (!confirm("Clear Aaron's memory? Aaron will start fresh with no prior context about you.")) return;
    setClearing(true);
    await backendFetch('/api/aaron/memory', { method: 'DELETE' });
    setMemory(null);
    setClearing(false);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="font-semibold text-gray-900">Aaron&apos;s Memory</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
        </div>
        <div className="p-4 space-y-4">
          {loading && <p className="text-sm text-gray-500">Loading memory...</p>}
          {!loading && !memory && (
            <p className="text-sm text-gray-500">
              Aaron hasn&apos;t built a memory profile for you yet. It builds after your first few conversations.
            </p>
          )}
          {!loading && memory && (
            <>
              <p className="text-xs text-gray-400">
                Last updated: {memory.last_updated
                  ? new Date(memory.last_updated).toLocaleDateString()
                  : 'Unknown'} &middot; {memory.message_count || 0} messages
              </p>
              {memory.summary && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Summary</p>
                  <p className="text-sm text-gray-700">{memory.summary}</p>
                </div>
              )}
              {memory.goals?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Goals</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {memory.goals.map((g, i) => <li key={i} className="flex gap-1.5"><span className="text-gray-400">&middot;</span>{g}</li>)}
                  </ul>
                </div>
              )}
              {memory.challenges?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Known challenges</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {memory.challenges.map((c, i) => <li key={i} className="flex gap-1.5"><span className="text-gray-400">&middot;</span>{c}</li>)}
                  </ul>
                </div>
              )}
              {memory.strengths?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Strengths</p>
                  <ul className="text-sm text-gray-700 space-y-0.5">
                    {memory.strengths.map((s, i) => <li key={i} className="flex gap-1.5"><span className="text-gray-400">&middot;</span>{s}</li>)}
                  </ul>
                </div>
              )}
              {memory.last_topics?.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Recent topics</p>
                  <div className="flex flex-wrap gap-1.5">
                    {memory.last_topics.map((t, i) => (
                      <span key={i} className="px-2 py-0.5 bg-indigo-50 text-indigo-700 text-xs rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {memory.preferences?.coaching_style && (
                <div>
                  <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Coaching style</p>
                  <p className="text-sm text-gray-700 capitalize">{memory.preferences.coaching_style}</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <button
                  onClick={handleClear}
                  disabled={clearing}
                  className="text-sm text-red-600 hover:text-red-700 font-medium disabled:opacity-50"
                >
                  {clearing ? 'Clearing...' : "Clear Aaron's memory"}
                </button>
                <p className="text-xs text-gray-400 mt-1">
                  Aaron will start fresh. Your conversation history is not affected.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
