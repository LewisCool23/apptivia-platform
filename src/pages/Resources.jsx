import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  BookOpen, Search, ChevronDown, ChevronRight,
  Megaphone, MessageCircle, ClipboardCheck, Lightbulb,
  ArrowLeftRight, DollarSign, Shield, GraduationCap,
  BarChart3, Clock, Users, Building2, CheckCircle,
  Plus, Edit3, Trash2, X,
} from 'lucide-react';
import DashboardLayout from '../DashboardLayout';
import { FRAMEWORK_PLAYBOOKS, CATEGORY_META } from '../constants/frameworkPlaybooks';
import { backendFetch } from '../utils/backendFetch';
import { useAuth } from '../AuthContext';
import { ROLES } from '../constants/roles';

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
  const { profile } = useAuth();
  const canManage = profile?.role === ROLES.ADMIN || profile?.role === ROLES.MANAGER;

  const [category, setCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orgPlaybooks, setOrgPlaybooks] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingPlaybook, setEditingPlaybook] = useState(null);
  const [pbForm, setPbForm] = useState({ name: '', category: 'prospecting', framework: '', tagline: '', sections: [{ title: '', items: [''] }] });

  const loadOrgPlaybooks = useCallback(async () => {
    try {
      const data = await backendFetch('/api/playbooks', undefined, 'GET');
      setOrgPlaybooks(data || []);
    } catch { /* non-fatal */ }
  }, []);

  useEffect(() => { loadOrgPlaybooks(); }, [loadOrgPlaybooks]);

  const handleSavePlaybook = async () => {
    const cleanSections = pbForm.sections.filter(s => s.title.trim()).map(s => ({
      title: s.title.trim(),
      items: (s.items || []).filter(i => i.trim()),
    }));
    const payload = { ...pbForm, sections: cleanSections };

    try {
      if (editingPlaybook) {
        await backendFetch(`/api/playbooks/${editingPlaybook}`, payload, 'PUT');
      } else {
        await backendFetch('/api/playbooks', payload);
      }
      setShowAddModal(false);
      setEditingPlaybook(null);
      setPbForm({ name: '', category: 'prospecting', framework: '', tagline: '', sections: [{ title: '', items: [''] }] });
      loadOrgPlaybooks();
    } catch { /* non-fatal */ }
  };

  const handleDeletePlaybook = async (id) => {
    if (!confirm('Delete this playbook?')) return;
    try {
      await backendFetch(`/api/playbooks/${id}`, undefined, 'DELETE');
      loadOrgPlaybooks();
    } catch { /* non-fatal */ }
  };

  const openEditModal = (pb) => {
    setEditingPlaybook(pb.id);
    setPbForm({ name: pb.name, category: pb.category, framework: pb.framework || '', tagline: pb.tagline || '', sections: pb.sections?.length ? pb.sections : [{ title: '', items: [''] }] });
    setShowAddModal(true);
  };

  const filtered = useMemo(() => {
    const result = FRAMEWORK_PLAYBOOKS.filter(pb => {
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
    // Group by category when showing "All" — sort so same-category items are together
    if (category === 'all') {
      result.sort((a, b) => a.category.localeCompare(b.category) || a.name.localeCompare(b.name));
    }
    return result;
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

        {/* Your Playbooks */}
        {orgPlaybooks.length > 0 || canManage ? (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <h2 className="text-sm font-bold text-apptivia-ink">Your Playbooks</h2>
              {canManage && (
                <button
                  onClick={() => { setEditingPlaybook(null); setPbForm({ name: '', category: 'prospecting', framework: '', tagline: '', sections: [{ title: '', items: [''] }] }); setShowAddModal(true); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-apptivia-ink text-white rounded-lg text-xs font-semibold hover:bg-apptivia-coral-tone-600 transition-colors"
                >
                  <Plus size={12} /> Add Playbook
                </button>
              )}
            </div>
            {orgPlaybooks.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
                {orgPlaybooks.filter(pb => category === 'all' || pb.category === category).map(pb => {
                  const catMeta = CATEGORY_META[pb.category] || { label: pb.category, color: 'bg-gray-100 text-gray-600' };
                  return (
                    <div key={pb.id} className="bg-white rounded-xl border border-apptivia-coral/20 shadow-sm p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-apptivia-ink">{pb.name}</h3>
                            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${catMeta.color}`}>{catMeta.label}</span>
                            {pb.framework && <span className="text-[10px] text-apptivia-carbon-400 bg-apptivia-paper px-2 py-0.5 rounded">{pb.framework}</span>}
                          </div>
                          {pb.tagline && <p className="text-xs text-apptivia-carbon-500 mt-1">{pb.tagline}</p>}
                        </div>
                        {canManage && (
                          <div className="flex items-center gap-1">
                            <button onClick={() => openEditModal(pb)} className="p-1 text-apptivia-carbon-400 hover:text-apptivia-ink"><Edit3 size={12} /></button>
                            <button onClick={() => handleDeletePlaybook(pb.id)} className="p-1 text-apptivia-carbon-400 hover:text-red-500"><Trash2 size={12} /></button>
                          </div>
                        )}
                      </div>
                      {pb.sections?.length > 0 && (
                        <div className="mt-3 space-y-2">
                          {pb.sections.map((sec, i) => (
                            <div key={i}>
                              <span className="text-[10px] font-semibold text-apptivia-carbon-500 uppercase">{sec.title}</span>
                              <ul className="mt-0.5 space-y-0.5">
                                {(sec.items || []).map((item, j) => (
                                  <li key={j} className="text-xs text-apptivia-carbon-600 flex items-start gap-1.5">
                                    <CheckCircle size={9} className="text-apptivia-coral mt-0.5 flex-shrink-0" /> {item}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-white rounded-lg border border-dashed border-apptivia-carbon-200 p-6 text-center text-xs text-apptivia-carbon-400 mb-6">
                No custom playbooks yet. Add your team's frameworks and methodologies.
              </div>
            )}
          </div>
        ) : null}

        {/* Add/Edit Playbook Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
                <h3 className="text-sm font-bold text-apptivia-ink">{editingPlaybook ? 'Edit Playbook' : 'Add Playbook'}</h3>
                <button onClick={() => setShowAddModal(false)} className="text-apptivia-carbon-400 hover:text-apptivia-ink"><X size={16} /></button>
              </div>
              <div className="p-5 space-y-4">
                <div>
                  <label className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Name</label>
                  <input type="text" value={pbForm.name} onChange={e => setPbForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border border-apptivia-carbon-200 rounded-lg text-sm focus:ring-2 focus:ring-apptivia-coral/30 outline-none" placeholder="e.g. MEDDPICC for Enterprise" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Category</label>
                    <select value={pbForm.category} onChange={e => setPbForm(p => ({ ...p, category: e.target.value }))}
                      className="w-full px-3 py-2 border border-apptivia-carbon-200 rounded-lg text-sm focus:ring-2 focus:ring-apptivia-coral/30 outline-none">
                      {CATEGORIES.filter(c => c.key !== 'all').map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Framework (optional)</label>
                    <input type="text" value={pbForm.framework} onChange={e => setPbForm(p => ({ ...p, framework: e.target.value }))}
                      className="w-full px-3 py-2 border border-apptivia-carbon-200 rounded-lg text-sm focus:ring-2 focus:ring-apptivia-coral/30 outline-none" placeholder="e.g. SPIN, Challenger" />
                  </div>
                </div>
                <div>
                  <label className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Tagline</label>
                  <input type="text" value={pbForm.tagline} onChange={e => setPbForm(p => ({ ...p, tagline: e.target.value }))}
                    className="w-full px-3 py-2 border border-apptivia-carbon-200 rounded-lg text-sm focus:ring-2 focus:ring-apptivia-coral/30 outline-none" placeholder="One-line description" />
                </div>
                <div>
                  <label className="text-xs font-semibold text-apptivia-carbon-600 block mb-1">Sections</label>
                  {pbForm.sections.map((sec, si) => (
                    <div key={si} className="mb-3 p-3 bg-apptivia-paper rounded-lg border border-apptivia-carbon-100">
                      <input type="text" value={sec.title} onChange={e => {
                        const s = [...pbForm.sections]; s[si] = { ...s[si], title: e.target.value }; setPbForm(p => ({ ...p, sections: s }));
                      }} className="w-full px-2 py-1.5 border border-apptivia-carbon-200 rounded text-xs font-semibold mb-2 outline-none" placeholder="Section title" />
                      {(sec.items || []).map((item, ii) => (
                        <div key={ii} className="flex items-center gap-1 mb-1">
                          <input type="text" value={item} onChange={e => {
                            const s = [...pbForm.sections]; const items = [...(s[si].items || [])]; items[ii] = e.target.value; s[si] = { ...s[si], items }; setPbForm(p => ({ ...p, sections: s }));
                          }} className="flex-1 px-2 py-1 border border-apptivia-carbon-100 rounded text-xs outline-none" placeholder="Bullet point" />
                          <button onClick={() => {
                            const s = [...pbForm.sections]; const items = [...(s[si].items || [])]; items.splice(ii, 1); s[si] = { ...s[si], items }; setPbForm(p => ({ ...p, sections: s }));
                          }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                        </div>
                      ))}
                      <button onClick={() => {
                        const s = [...pbForm.sections]; s[si] = { ...s[si], items: [...(s[si].items || []), ''] }; setPbForm(p => ({ ...p, sections: s }));
                      }} className="text-[10px] text-apptivia-coral font-medium mt-1">+ Add bullet</button>
                    </div>
                  ))}
                  <button onClick={() => setPbForm(p => ({ ...p, sections: [...p.sections, { title: '', items: [''] }] }))}
                    className="text-xs text-apptivia-coral font-medium">+ Add section</button>
                </div>
              </div>
              <div className="px-5 py-3 border-t border-apptivia-carbon-100 flex justify-end gap-2">
                <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-xs text-apptivia-carbon-600 hover:bg-apptivia-carbon-50 rounded-lg">Cancel</button>
                <button onClick={handleSavePlaybook} disabled={!pbForm.name.trim()}
                  className="px-4 py-2 text-xs font-semibold bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50">
                  {editingPlaybook ? 'Update' : 'Create'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Apptivia Playbooks */}
        <h2 className="text-sm font-bold text-apptivia-ink mb-3">Apptivia Playbooks</h2>
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
