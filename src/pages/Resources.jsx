import React, { useState, useMemo } from 'react';
import {
  BookOpen, Search, ChevronDown, ChevronRight,
  Megaphone, MessageCircle, ClipboardCheck, Lightbulb,
  ArrowLeftRight, DollarSign, Shield, GraduationCap,
  BarChart3, Clock, Users, Building2, CheckCircle,
} from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { FRAMEWORK_PLAYBOOKS, CATEGORY_META } from '../constants/frameworkPlaybooks';

const ICON_MAP = {
  Megaphone, Search, ClipboardCheck, MessageCircle, Lightbulb,
  ArrowLeftRight, DollarSign, Shield, GraduationCap, BarChart3,
  Clock, Users, Building2, CheckCircle,
};

const CATEGORIES = [
  { key: 'all', label: 'All' },
  { key: 'prospecting', label: 'Prospecting' },
  { key: 'discovery', label: 'Discovery' },
  { key: 'qualification', label: 'Qualification' },
  { key: 'methodology', label: 'Methodology' },
  { key: 'negotiation', label: 'Negotiation' },
  { key: 'coaching', label: 'Coaching' },
  { key: 'analytics', label: 'Analytics' },
];

function PlaybookCard({ playbook }) {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[playbook.icon] || BookOpen;
  const catMeta = CATEGORY_META[playbook.category] || { label: playbook.category, color: 'bg-gray-100 text-gray-600' };

  return (
    <div className="bg-white rounded-xl border border-apptivia-carbon-100 shadow-sm hover:shadow-md transition-shadow">
      {/* Card Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-start gap-4"
      >
        <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-apptivia-paper flex items-center justify-center mt-0.5">
          <Icon size={20} className="text-apptivia-coral" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-semibold text-apptivia-ink">{playbook.name}</h3>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${catMeta.color}`}>
              {catMeta.label}
            </span>
          </div>
          <p className="text-xs text-apptivia-carbon-500 mt-1">{playbook.tagline}</p>
          <div className="mt-2 px-3 py-1.5 bg-apptivia-paper rounded-md inline-block">
            <p className="text-xs font-medium text-apptivia-carbon-700">{playbook.coreFramework}</p>
          </div>
        </div>
        <div className="flex-shrink-0 mt-1">
          {expanded
            ? <ChevronDown size={16} className="text-apptivia-carbon-400" />
            : <ChevronRight size={16} className="text-apptivia-carbon-400" />
          }
        </div>
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="px-5 pb-5 border-t border-apptivia-carbon-50">
          {playbook.sections.map((section, i) => (
            <div key={i} className="mt-4">
              <h4 className="text-xs font-semibold text-apptivia-ink uppercase tracking-wide mb-2">
                {section.title}
              </h4>
              <ul className="space-y-2">
                {section.items.map((item, j) => (
                  <li key={j} className="flex gap-2 text-xs text-apptivia-carbon-600 leading-relaxed">
                    <span className="flex-shrink-0 w-1.5 h-1.5 rounded-full bg-apptivia-coral mt-1.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function Resources() {
  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  const filtered = useMemo(() => {
    return FRAMEWORK_PLAYBOOKS.filter(pb => {
      if (category !== 'all' && pb.category !== category) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        const inName = pb.name.toLowerCase().includes(q);
        const inTagline = pb.tagline.toLowerCase().includes(q);
        const inCore = pb.coreFramework.toLowerCase().includes(q);
        const inSections = pb.sections.some(s =>
          s.title.toLowerCase().includes(q) ||
          s.items.some(item => item.toLowerCase().includes(q))
        );
        if (!inName && !inTagline && !inCore && !inSections) return false;
      }
      return true;
    });
  }, [category, searchQuery]);

  return (
    <DashboardLayout>
      <div className="min-h-screen bg-apptivia-paper p-4 md:p-6 max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <BookOpen size={22} className="text-apptivia-coral" />
            <h1 className="text-lg font-bold text-apptivia-ink">Sales Playbooks & Frameworks</h1>
          </div>
          <p className="text-sm text-apptivia-carbon-500">
            14 battle-tested frameworks that power Aaron's coaching. Templates, scripts, and checklists your team can use immediately.
          </p>
        </div>

        {/* Search + Category Filters */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 mb-5">
          <div className="relative flex-1 w-full sm:max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Search playbooks..."
              className="w-full pl-9 pr-3 py-2 text-xs border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none"
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.map(cat => (
              <button
                key={cat.key}
                onClick={() => setCategory(cat.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-full transition-colors ${
                  category === cat.key
                    ? 'bg-apptivia-ink text-white'
                    : 'bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-carbon-50'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </div>

        {/* Playbook Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filtered.map(pb => (
            <PlaybookCard key={pb.key} playbook={pb} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-sm text-apptivia-carbon-400">
            No playbooks match your search.
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
