import React, { useState, useRef, useEffect } from 'react';
import { BookOpen, ChevronDown, Sparkles, Search, X } from 'lucide-react';
import { usePromptLibrary } from '../hooks/usePromptLibrary';

/**
 * PromptTemplateSelector — Dropdown for choosing a prompt template
 * ────────────────────────────────────────────────────────────────
 * Usage:
 *   <PromptTemplateSelector
 *     category="outreach"          // filter by category
 *     aiModel="claude"             // optional: filter by model
 *     value={selectedTemplateId}   // controlled value
 *     onChange={(template) => ...}  // callback with full template object
 *     placeholder="Select prompt template..."
 *   />
 */

const CATEGORY_COLORS = {
  research:       'bg-blue-50 text-blue-600',
  outreach:       'bg-emerald-50 text-emerald-600',
  analysis:       'bg-purple-50 text-purple-600',
  follow_up:      'bg-amber-50 text-amber-600',
  deliverability: 'bg-red-50 text-red-600',
  general:        'bg-gray-50 text-gray-600',
};

const MODEL_ICONS = {
  chatgpt: '🟢',
  claude:  '🟠',
  any:     '⚪',
};

export default function PromptTemplateSelector({
  category,
  aiModel,
  value,
  onChange,
  placeholder = 'Select a prompt template...',
  showNone = true,
  className = '',
  organizationId,
}) {
  const { templates, loading } = usePromptLibrary({
    organizationId,
    category: category || 'all',
    aiModel: aiModel || 'all',
    activeOnly: true,
  });

  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef(null);

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const selected = value ? templates.find(t => t.id === value) : null;

  const filtered = search
    ? templates.filter(t =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description?.toLowerCase().includes(search.toLowerCase()) ||
        t.tags?.some(tag => tag.includes(search.toLowerCase()))
      )
    : templates;

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className={`w-full flex items-center justify-between gap-2 px-3 py-2 text-xs border rounded-lg bg-white transition-all ${
          open ? 'border-violet-300 ring-2 ring-violet-100' : 'border-gray-200 hover:border-gray-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <BookOpen size={12} className="text-violet-400 flex-shrink-0" />
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-gray-700 truncate">{selected.name}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.general}`}>
                {selected.category}
              </span>
              <span className="text-[9px] flex-shrink-0">{MODEL_ICONS[selected.ai_model] || '⚪'}</span>
            </span>
          ) : (
            <span className="text-gray-400">{loading ? 'Loading...' : placeholder}</span>
          )}
        </div>
        <ChevronDown size={12} className={`text-gray-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] bg-white rounded-xl border border-gray-200 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-gray-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-300" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="w-full text-xs pl-8 pr-6 py-1.5 border border-gray-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-violet-200"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-300 hover:text-gray-500">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {showNone && (
              <button
                className={`w-full text-left px-3 py-2 text-xs hover:bg-gray-50 transition-colors ${
                  !value ? 'bg-violet-50 text-violet-700 font-medium' : 'text-gray-500'
                }`}
                onClick={() => { onChange?.(null); setOpen(false); setSearch(''); }}
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={11} className="text-gray-300" />
                  <span>Default (built-in prompt)</span>
                </span>
              </button>
            )}

            {filtered.map(t => (
              <button
                key={t.id}
                className={`w-full text-left px-3 py-2.5 hover:bg-violet-50/50 transition-colors ${
                  t.id === value ? 'bg-violet-50' : ''
                }`}
                onClick={() => { onChange?.(t); setOpen(false); setSearch(''); }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">{MODEL_ICONS[t.ai_model] || '⚪'}</span>
                  <span className={`text-xs font-medium ${t.id === value ? 'text-violet-700' : 'text-gray-700'}`}>{t.name}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.general}`}>
                    {t.category}
                  </span>
                  {t.channel && (
                    <span className="text-[9px] bg-cyan-50 text-cyan-600 px-1 py-0.5 rounded capitalize">{t.channel}</span>
                  )}
                </div>
                {t.description && (
                  <p className="text-[10px] text-gray-400 mt-0.5 ml-5 truncate">{t.description}</p>
                )}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-gray-400">
                No prompts found{search ? ` for "${search}"` : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
