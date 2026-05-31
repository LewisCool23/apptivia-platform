import React, { useState, useEffect, useCallback } from 'react';
import { X, ClipboardList, Check, RefreshCw, Search, Users, Building2 } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import { supabase } from '../supabaseClient';
import toast from 'react-hot-toast';

export default function CreateTaskModal({ isOpen, onClose, contact, dealId, accountId, organizationId, onTaskCreated }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [priority, setPriority] = useState('medium');
  const [creating, setCreating] = useState(false);

  // Contact/account search (when not pre-filled)
  const [contactSearch, setContactSearch] = useState('');
  const [contactResults, setContactResults] = useState([]);
  const [selectedContact, setSelectedContact] = useState(null);
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);

  // Use prop values when provided
  const effectiveContact = contact || selectedContact;
  const effectiveAccountId = accountId || selectedAccount?.id;

  // Contact search (debounced)
  useEffect(() => {
    if (contact || !contactSearch.trim() || contactSearch.length < 2) {
      setContactResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('engage_prospects')
        .select('id, first_name, last_name, full_name, email, company_name')
        .or(`full_name.ilike.%${contactSearch}%,email.ilike.%${contactSearch}%`)
        .limit(5);
      setContactResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [contactSearch, contact]);

  // Account search (debounced)
  useEffect(() => {
    if (accountId || !accountSearch.trim() || accountSearch.length < 2) {
      setAccountResults([]);
      return;
    }
    const t = setTimeout(async () => {
      const { data } = await supabase.from('engage_accounts')
        .select('id, account_name, domain')
        .ilike('account_name', `%${accountSearch}%`)
        .limit(5);
      setAccountResults(data || []);
    }, 300);
    return () => clearTimeout(t);
  }, [accountSearch, accountId]);

  const handleCreate = async () => {
    if (!title.trim()) return;
    setCreating(true);
    try {
      const body = {
        title: title.trim(),
        description: description.trim() || undefined,
        due_date: dueDate || undefined,
        priority,
        prospect_id: effectiveContact?.id || undefined,
        deal_id: dealId || undefined,
        account_id: effectiveAccountId || undefined,
      };
      const data = await backendFetch('/api/tasks', body);
      if (data?.error) {
        toast.error(data.error);
      } else {
        toast.success('Task created');
        onTaskCreated?.();
        resetAndClose();
      }
    } catch {
      toast.error('Failed to create task');
    } finally {
      setCreating(false);
    }
  };

  const resetAndClose = () => {
    setTitle('');
    setDescription('');
    setDueDate('');
    setPriority('medium');
    setContactSearch('');
    setContactResults([]);
    setSelectedContact(null);
    setAccountSearch('');
    setAccountResults([]);
    setSelectedAccount(null);
    onClose();
  };

  if (!isOpen) return null;

  const contactName = effectiveContact
    ? [effectiveContact.first_name, effectiveContact.last_name].filter(Boolean).join(' ') || effectiveContact.name || effectiveContact.full_name || ''
    : '';

  return (
    <div className="fixed inset-0 bg-black/40 z-[60] flex items-center justify-center p-4" onClick={resetAndClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
              <ClipboardList size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-apptivia-ink">Create Task</h3>
              {contactName && (
                <p className="text-[10px] text-apptivia-carbon-400">For {contactName}</p>
              )}
            </div>
          </div>
          <button onClick={resetAndClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="px-5 py-4 space-y-3">
          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Follow up with proposal"
              className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
          </div>

          <div>
            <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional details..."
              rows={2}
              className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral resize-none"
            />
          </div>

          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
              />
            </div>
            <div className="flex-1">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </select>
            </div>
          </div>

          {/* Link to Contact — only show search when no contact prop */}
          {!contact && (
            <div className="relative">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Link to Contact</label>
              {selectedContact ? (
                <div className="flex items-center justify-between border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-apptivia-paper/50">
                  <div className="flex items-center gap-2 text-xs">
                    <Users size={12} className="text-apptivia-carbon-400" />
                    <span className="text-apptivia-carbon-700">{selectedContact.full_name || `${selectedContact.first_name || ''} ${selectedContact.last_name || ''}`.trim()}</span>
                    {selectedContact.company_name && <span className="text-apptivia-carbon-400">at {selectedContact.company_name}</span>}
                  </div>
                  <button onClick={() => { setSelectedContact(null); setContactSearch(''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                    <input
                      type="text"
                      value={contactSearch}
                      onChange={e => setContactSearch(e.target.value)}
                      placeholder="Search by name or email..."
                      className="w-full text-xs border border-apptivia-carbon-200 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
                    />
                  </div>
                  {contactResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                      {contactResults.map(c => (
                        <button key={c.id} onClick={() => { setSelectedContact(c); setContactSearch(''); setContactResults([]); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-apptivia-paper flex items-center gap-2">
                          <Users size={10} className="text-apptivia-carbon-400 flex-shrink-0" />
                          <span className="text-apptivia-carbon-700">{c.full_name || `${c.first_name || ''} ${c.last_name || ''}`.trim()}</span>
                          {c.email && <span className="text-apptivia-carbon-400 truncate">{c.email}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Link to Account — only show search when no accountId prop */}
          {!accountId && (
            <div className="relative">
              <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1">Link to Account</label>
              {selectedAccount ? (
                <div className="flex items-center justify-between border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-apptivia-paper/50">
                  <div className="flex items-center gap-2 text-xs">
                    <Building2 size={12} className="text-apptivia-carbon-400" />
                    <span className="text-apptivia-carbon-700">{selectedAccount.account_name}</span>
                    {selectedAccount.domain && <span className="text-apptivia-carbon-400">{selectedAccount.domain}</span>}
                  </div>
                  <button onClick={() => { setSelectedAccount(null); setAccountSearch(''); }} className="text-apptivia-carbon-400 hover:text-red-500"><X size={12} /></button>
                </div>
              ) : (
                <>
                  <div className="relative">
                    <Search size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
                    <input
                      type="text"
                      value={accountSearch}
                      onChange={e => setAccountSearch(e.target.value)}
                      placeholder="Search by account name..."
                      className="w-full text-xs border border-apptivia-carbon-200 rounded-lg pl-8 pr-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
                    />
                  </div>
                  {accountResults.length > 0 && (
                    <div className="absolute left-0 right-0 top-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg z-10 max-h-32 overflow-y-auto">
                      {accountResults.map(a => (
                        <button key={a.id} onClick={() => { setSelectedAccount(a); setAccountSearch(''); setAccountResults([]); }}
                          className="w-full text-left px-3 py-2 text-xs hover:bg-apptivia-paper flex items-center gap-2">
                          <Building2 size={10} className="text-apptivia-carbon-400 flex-shrink-0" />
                          <span className="text-apptivia-carbon-700">{a.account_name}</span>
                          {a.domain && <span className="text-apptivia-carbon-400">{a.domain}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || !title.trim()}
            className="w-full px-4 py-2.5 bg-apptivia-coral text-white rounded-lg text-xs font-semibold hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {creating ? (
              <><RefreshCw size={12} className="animate-spin" /> Creating...</>
            ) : (
              <><Check size={12} /> Create Task</>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
