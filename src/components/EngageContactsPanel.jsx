import React, { useState, useEffect } from 'react';
import { Phone, Mail, ExternalLink, Search, X, UserPlus } from 'lucide-react';
import { supabase } from '../supabaseClient';
import Tooltip from './shared/Tooltip';

export default function EngageContactsPanel({ organizationId, onCallContact, onClose, refreshKey }) {
  const [contacts, setContacts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  useEffect(() => {
    if (!organizationId) return;
    setLoading(true);
    supabase
      .from('engage_prospects')
      .select('id, first_name, last_name, full_name, email, phone, linkedin_url, title, company_name, last_called_at')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false })
      .limit(300)
      .then(({ data, error }) => {
        if (error) console.error('Error loading contacts:', error);
        setContacts(data || []);
        setLoading(false);
      })
      .catch((err) => {
        console.error('Error loading contacts:', err);
        setLoading(false);
      });
  }, [organizationId, refreshKey]);

  const filtered = contacts.filter(c => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.full_name?.toLowerCase().includes(q) ||
      c.first_name?.toLowerCase().includes(q) ||
      c.last_name?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.company_name?.toLowerCase().includes(q) ||
      c.title?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-apptivia-carbon-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <UserPlus size={14} className="text-apptivia-coral" />
          <h3 className="font-semibold text-apptivia-ink text-sm">Saved Contacts</h3>
          <span className="text-[10px] bg-apptivia-carbon-100 text-apptivia-carbon-500 px-1.5 py-0.5 rounded-full">{contacts.length}</span>
        </div>
        <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Search */}
      <div className="px-3 py-2 border-b border-apptivia-carbon-100 flex-shrink-0">
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
          <input
            type="text"
            placeholder="Search contacts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-7 pr-3 py-1.5 text-xs border border-apptivia-carbon-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-apptivia-coral-tone-300"
          />
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-xs text-apptivia-carbon-400">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 gap-1">
            <UserPlus size={20} className="text-apptivia-carbon-300" />
            <p className="text-xs text-apptivia-carbon-400">
              {search ? 'No contacts match your search' : 'No saved contacts yet'}
            </p>
            {!search && (
              <p className="text-[10px] text-apptivia-carbon-400 text-center px-4">
                Save contacts from the Discover or Signal Prospecting tabs
              </p>
            )}
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {filtered.map(contact => {
              const name = contact.full_name?.trim() || `${contact.first_name || ''} ${contact.last_name || ''}`.trim() || 'Unknown';
              const initial = name[0]?.toUpperCase() || '?';
              return (
                <div key={contact.id} className="px-4 py-3 hover:bg-apptivia-paper/50 transition-colors group">
                  <div className="flex items-start gap-2.5">
                    <div className="w-7 h-7 rounded-full bg-apptivia-ink flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0 mt-0.5">
                      {initial}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-apptivia-ink truncate">{name}</p>
                      {(contact.title || contact.company_name) && (
                        <p className="text-[10px] text-apptivia-carbon-500 truncate">
                          {[contact.title, contact.company_name].filter(Boolean).join(' · ')}
                        </p>
                      )}
                      <div className="flex items-center gap-2.5 mt-1.5">
                        {contact.phone && onCallContact && (
                          <Tooltip text={`Call: ${contact.phone}`}>
                            <button
                              onClick={() => onCallContact({ name, phone: contact.phone, company_name: contact.company_name })}
                              className="text-emerald-500 hover:text-emerald-700 transition-colors"
                            >
                              <Phone size={11} />
                            </button>
                          </Tooltip>
                        )}
                        {contact.email && (
                          <Tooltip text={contact.email} position="right">
                            <button
                              onClick={() => navigator.clipboard.writeText(contact.email)}
                              className="text-apptivia-coral hover:text-apptivia-coral transition-colors"
                            >
                              <Mail size={11} />
                            </button>
                          </Tooltip>
                        )}
                        {contact.linkedin_url && (
                          <Tooltip text="LinkedIn Profile">
                            <a
                              href={contact.linkedin_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-apptivia-coral hover:text-apptivia-coral transition-colors"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
