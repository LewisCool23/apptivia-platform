import React, { useState, useEffect, useMemo } from 'react';
import { X, Eye, Mail, Phone, ExternalLink, Search, ChevronUp, ChevronDown, Users, MessageCircle, Clock, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useModalBehavior } from '../hooks/useModalBehavior';

const SORT_FIELDS = ['full_name', 'title', 'company_name', 'email'];

const STATUS_BADGES = {
  new: 'bg-sky-50 text-sky-700',
  contacted: 'bg-amber-50 text-amber-700',
  replied: 'bg-emerald-50 text-emerald-700',
  qualified: 'bg-apptivia-coral-tone-50 text-apptivia-coral',
};

const formatResearchAge = (date) => {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date).getTime()) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return '1d ago';
  return `${days}d ago`;
};

export default function SavedContactsModal({ isOpen, onClose, organizationId, onCallContact, onResearchContact, onDraftOutreach, onViewBrief, onAskAaron }) {
  useModalBehavior(isOpen, onClose);
  const [contacts, setContacts] = useState([]);
  const [accounts, setAccounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState('full_name');
  const [sortAsc, setSortAsc] = useState(true);
  const [addingToBc, setAddingToBc] = useState(null);

  // Fetch contacts + accounts
  useEffect(() => {
    if (!isOpen || !organizationId) return;
    setLoading(true);

    Promise.all([
      supabase
        .from('engage_prospects')
        .select('id, first_name, last_name, full_name, email, phone, linkedin_url, title, company_name, status, fit_score, last_researched_at, created_at')
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false })
        .limit(500),
      supabase
        .from('engage_accounts')
        .select('id, account_name, domain, buying_committee')
        .eq('organization_id', organizationId),
    ]).then(([contactsRes, accountsRes]) => {
      setContacts(contactsRes.data || []);
      const acctMap = {};
      (accountsRes.data || []).forEach(a => {
        acctMap[a.account_name?.toLowerCase()] = a;
        if (a.domain) acctMap[a.domain.toLowerCase()] = a;
      });
      setAccounts(acctMap);
      setLoading(false);
    });
  }, [isOpen, organizationId]);

  // Filter + sort
  const displayed = useMemo(() => {
    let result = contacts;
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(c =>
        c.full_name?.toLowerCase().includes(q) ||
        c.first_name?.toLowerCase().includes(q) ||
        c.last_name?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q) ||
        c.company_name?.toLowerCase().includes(q) ||
        c.title?.toLowerCase().includes(q)
      );
    }
    return [...result].sort((a, b) => {
      const av = (a[sortField] || '').toLowerCase();
      const bv = (b[sortField] || '').toLowerCase();
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
  }, [contacts, search, sortField, sortAsc]);

  const handleSort = (field) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  const handleAddToBuyingCommittee = async (contact) => {
    const key = contact.company_name?.toLowerCase();
    const account = accounts[key];
    if (!account) return;

    setAddingToBc(contact.id);
    try {
      const existingBc = Array.isArray(account.buying_committee) ? account.buying_committee : [];
      const alreadyAdded = existingBc.some(m => m.prospect_id === contact.id);
      if (alreadyAdded) {
        setAddingToBc(null);
        return;
      }

      const newMember = {
        prospect_id: contact.id,
        name: contact.full_name || `${contact.first_name || ''} ${contact.last_name || ''}`.trim(),
        title: contact.title || '',
        role: 'member',
        influence_level: 'medium',
      };

      const { error } = await supabase
        .from('engage_accounts')
        .update({ buying_committee: [...existingBc, newMember] })
        .eq('id', account.id);

      if (!error) {
        // Update local state
        setAccounts(prev => ({
          ...prev,
          [key]: { ...account, buying_committee: [...existingBc, newMember] },
        }));
      }
    } catch (err) {
      console.error('Failed to add to buying committee:', err);
    } finally {
      setAddingToBc(null);
    }
  };

  const SortIcon = ({ field }) => {
    if (sortField !== field) return null;
    return sortAsc ? <ChevronUp size={10} /> : <ChevronDown size={10} />;
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div
        className="bg-apptivia-paper rounded-xl shadow-2xl w-full max-w-7xl max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-apptivia-coral to-apptivia-coral/80 px-8 py-5 flex items-center justify-between flex-shrink-0 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white/20 rounded-lg flex items-center justify-center">
              <UserPlus size={18} className="text-white" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Saved Contacts</h2>
              <p className="text-white/70 text-xs">{contacts.length} contacts saved</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onAskAaron && (
              <button
                onClick={() => onAskAaron('Help me prioritize outreach to my saved contacts')}
                className="inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
              >
                <MessageCircle size={12} /> Ask Aaron
              </button>
            )}
            <button onClick={onClose} className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
              <X size={18} className="text-white" />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="px-8 py-4 border-b border-apptivia-carbon-100">
          <div className="relative max-w-sm">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
            <input
              type="text"
              placeholder="Search by name, email, company, title..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
            />
          </div>
        </div>

        {/* Table */}
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-sm text-apptivia-carbon-400">Loading contacts...</div>
          ) : displayed.length === 0 ? (
            <div className="flex items-center justify-center h-40 text-sm text-apptivia-carbon-400">
              {search ? 'No contacts match your search' : 'No saved contacts yet'}
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-apptivia-paper sticky top-0 z-10">
                <tr className="text-left text-xs text-apptivia-carbon-500 font-medium">
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('full_name')}>
                    <span className="inline-flex items-center gap-1">Name <SortIcon field="full_name" /></span>
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('title')}>
                    <span className="inline-flex items-center gap-1">Title <SortIcon field="title" /></span>
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('company_name')}>
                    <span className="inline-flex items-center gap-1">Company <SortIcon field="company_name" /></span>
                  </th>
                  <th className="px-6 py-3 cursor-pointer select-none" onClick={() => handleSort('email')}>
                    <span className="inline-flex items-center gap-1">Email <SortIcon field="email" /></span>
                  </th>
                  <th className="px-6 py-3">Phone</th>
                  <th className="px-6 py-3 text-center">Fit</th>
                  <th className="px-6 py-3 text-center">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-apptivia-carbon-100/50">
                {displayed.map(contact => {
                  const name = contact.full_name?.trim() || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
                  const accountKey = contact.company_name?.toLowerCase();
                  const matchedAccount = accountKey ? accounts[accountKey] : null;
                  const isInBc = matchedAccount?.buying_committee?.some(m => m.prospect_id === contact.id);
                  const phoneDisplay = typeof contact.phone === 'string' && contact.phone !== 'true' ? contact.phone : '—';
                  const researchAge = formatResearchAge(contact.last_researched_at);
                  const statusBadge = contact.status && STATUS_BADGES[contact.status];

                  return (
                    <tr key={contact.id} className="hover:bg-apptivia-paper/50 transition-colors">
                      <td className="px-6 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium text-apptivia-ink">{name}</span>
                          {statusBadge && contact.status !== 'new' && (
                            <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${statusBadge}`}>
                              {contact.status}
                            </span>
                          )}
                        </div>
                        {researchAge && (
                          <span className="text-[10px] text-apptivia-carbon-400 flex items-center gap-0.5 mt-0.5">
                            <Clock size={8} /> Researched {researchAge}
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-sm text-apptivia-carbon-600">{contact.title || '—'}</td>
                      <td className="px-6 py-3 text-sm text-apptivia-carbon-600">{contact.company_name || '—'}</td>
                      <td className="px-6 py-3 text-sm text-apptivia-carbon-500">{contact.email || '—'}</td>
                      <td className="px-6 py-3 text-sm text-apptivia-carbon-500">{phoneDisplay}</td>
                      <td className="px-6 py-3 text-center">
                        {contact.fit_score != null ? (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            contact.fit_score >= 70 ? 'bg-emerald-50 text-emerald-700' :
                            contact.fit_score >= 40 ? 'bg-amber-50 text-amber-700' :
                            'bg-red-50 text-red-600'
                          }`}>
                            {contact.fit_score}
                          </span>
                        ) : (
                          <span className="text-sm text-apptivia-carbon-300">—</span>
                        )}
                      </td>
                      <td className="px-6 py-3">
                        <div className="flex items-center justify-center gap-0">
                          <div className="w-8 flex items-center justify-center">
                            {contact.email && onDraftOutreach ? (
                              <button
                                onClick={() => onDraftOutreach(contact)}
                                className="text-apptivia-coral hover:text-apptivia-coral/70 transition-colors"
                                title={`Email ${contact.email}`}
                              >
                                <Mail size={14} />
                              </button>
                            ) : <span className="w-[14px]" />}
                          </div>
                          <div className="w-8 flex items-center justify-center">
                            {(onViewBrief || onResearchContact) ? (
                              <button
                                onClick={() => (onViewBrief || onResearchContact)(contact)}
                                className="text-apptivia-ink hover:text-apptivia-coral transition-colors"
                                title="View Brief"
                              >
                                <Eye size={14} />
                              </button>
                            ) : <span className="w-[14px]" />}
                          </div>
                          <div className="w-8 flex items-center justify-center">
                            {phoneDisplay !== '—' && onCallContact ? (
                              <button
                                onClick={() => onCallContact({ name, phone: contact.phone, company_name: contact.company_name })}
                                className="text-emerald-500 hover:text-emerald-700 transition-colors"
                                title={`Call: ${phoneDisplay}`}
                              >
                                <Phone size={14} />
                              </button>
                            ) : (
                              <span className="text-apptivia-carbon-300 cursor-default" title="Phone Number Not Available">
                                <Phone size={14} />
                              </span>
                            )}
                          </div>
                          <div className="w-8 flex items-center justify-center">
                            {contact.linkedin_url ? (
                              <a
                                href={contact.linkedin_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-700 transition-colors"
                                title="LinkedIn Profile"
                              >
                                <ExternalLink size={14} />
                              </a>
                            ) : <span className="w-[14px]" />}
                          </div>
                          <div className="w-16 flex items-center justify-center">
                            {matchedAccount && !isInBc ? (
                              <button
                                onClick={() => handleAddToBuyingCommittee(contact)}
                                disabled={addingToBc === contact.id}
                                className="inline-flex items-center gap-1 text-[10px] font-medium px-2 py-0.5 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 transition-colors disabled:opacity-50"
                                title="Add to Buying Committee"
                              >
                                <Users size={10} />
                                {addingToBc === contact.id ? '...' : 'BC'}
                              </button>
                            ) : isInBc ? (
                              <span className="text-[10px] text-teal-600 font-medium px-2 py-0.5 rounded bg-teal-50">In BC</span>
                            ) : null}
                          </div>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
