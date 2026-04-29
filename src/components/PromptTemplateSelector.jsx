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
  research:       'bg-apptivia-coral-tone-50 text-apptivia-coral',
  outreach:       'bg-emerald-50 text-emerald-600',
  analysis:       'bg-apptivia-carbon-100 text-apptivia-ink',
  follow_up:      'bg-amber-50 text-amber-600',
  deliverability: 'bg-red-50 text-red-600',
  general:        'bg-apptivia-paper text-apptivia-carbon-600',
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
          open ? 'border-apptivia-carbon-300 ring-2 ring-apptivia-coral-tone-100' : 'border-apptivia-carbon-200 hover:border-apptivia-carbon-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 truncate">
          <BookOpen size={12} className="text-apptivia-ink flex-shrink-0" />
          {selected ? (
            <span className="flex items-center gap-1.5 truncate">
              <span className="font-medium text-apptivia-carbon-700 truncate">{selected.name}</span>
              <span className={`text-[9px] px-1 py-0.5 rounded font-medium flex-shrink-0 ${CATEGORY_COLORS[selected.category] || CATEGORY_COLORS.general}`}>
                {selected.category}
              </span>
              <span className="text-[9px] flex-shrink-0">{MODEL_ICONS[selected.ai_model] || '⚪'}</span>
            </span>
          ) : (
            <span className="text-apptivia-carbon-400">{loading ? 'Loading...' : placeholder}</span>
          )}
        </div>
        <ChevronDown size={12} className={`text-apptivia-carbon-400 transition-transform flex-shrink-0 ${open ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-full min-w-[300px] bg-white rounded-lg border border-apptivia-carbon-200 shadow-lg overflow-hidden">
          {/* Search */}
          <div className="px-3 py-2 border-b border-apptivia-carbon-100">
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-300" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search prompts..."
                className="w-full text-xs pl-8 pr-6 py-1.5 border border-apptivia-carbon-100 rounded-lg focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-100"
                autoFocus
              />
              {search && (
                <button onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-300 hover:text-apptivia-carbon-500">
                  <X size={10} />
                </button>
              )}
            </div>
          </div>

          {/* Options */}
          <div className="max-h-60 overflow-y-auto">
            {showNone && (
              <button
                className={`w-full text-left px-3 py-2 text-xs hover:bg-apptivia-paper transition-colors ${
                  !value ? 'bg-apptivia-carbon-100 text-apptivia-ink font-medium' : 'text-apptivia-carbon-500'
                }`}
                onClick={() => { onChange?.(null); setOpen(false); setSearch(''); }}
              >
                <span className="flex items-center gap-2">
                  <Sparkles size={11} className="text-apptivia-carbon-300" />
                  <span>Default (built-in prompt)</span>
                </span>
              </button>
            )}

            {filtered.map(t => (
              <button
                key={t.id}
                className={`w-full text-left px-3 py-2.5 hover:bg-apptivia-carbon-100/50 transition-colors ${
                  t.id === value ? 'bg-apptivia-carbon-100' : ''
                }`}
                onClick={() => { onChange?.(t); setOpen(false); setSearch(''); }}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[10px]">{MODEL_ICONS[t.ai_model] || '⚪'}</span>
                  <span className={`text-xs font-medium ${t.id === value ? 'text-apptivia-ink' : 'text-apptivia-carbon-700'}`}>{t.name}</span>
                  <span className={`text-[9px] px-1 py-0.5 rounded font-medium ${CATEGORY_COLORS[t.category] || CATEGORY_COLORS.general}`}>
                    {t.category}
                  </span>
                  {t.channel && (
                    <span className="text-[9px] bg-cyan-50 text-cyan-600 px-1 py-0.5 rounded capitalize">{t.channel}</span>
                  )}
                </div>
                {t.description && (
                  <p className="text-[10px] text-apptivia-carbon-400 mt-0.5 ml-5 truncate">{t.description}</p>
                )}
              </button>
            ))}

            {filtered.length === 0 && (
              <div className="px-3 py-4 text-center text-[11px] text-apptivia-carbon-400">
                No prompts found{search ? ` for "${search}"` : ''}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
