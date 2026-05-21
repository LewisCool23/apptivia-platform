import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, Phone, Delete, Clock, Search, ArrowUpRight, ArrowDownLeft, User } from 'lucide-react';
import { supabase } from '../supabaseClient';

const KEYS = [
  ['1', '2', '3'],
  ['4', '5', '6'],
  ['7', '8', '9'],
  ['*', '0', '#'],
];

function timeAgo(ts) {
  const diff = Date.now() - new Date(ts).getTime();
  const mins = Math.floor(diff / 60000);
  const hours = Math.floor(mins / 60);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (mins > 0) return `${mins}m ago`;
  return 'just now';
}

function formatDuration(minutes) {
  if (!minutes || minutes <= 0) return null;
  if (minutes >= 60) return `${Math.floor(minutes / 60)}h${minutes % 60 ? `${minutes % 60}m` : ''}`;
  return `${minutes}m`;
}

export default function EngageDialpadPanel({ onCall, isDeviceReady, onClose, userId }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [selectedProspectId, setSelectedProspectId] = useState(null);
  const [activeTab, setActiveTab] = useState('dialpad');

  // Contact search state
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const searchTimeoutRef = useRef(null);
  const dropdownRef = useRef(null);

  // Call history state
  const [recentCalls, setRecentCalls] = useState([]);
  const [callHistory, setCallHistory] = useState([]);

  // ── Fetch recent calls (dialpad tab — last 5) ──────────────────
  useEffect(() => {
    if (!userId) return;
    supabase
      .from('engage_call_logs')
      .select('id, contact_name, duration_minutes, call_direction, created_at, notes, prospect_id, engage_prospects(phone, full_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(5)
      .then(({ data }) => setRecentCalls(data || []));
  }, [userId]);

  // ── Fetch call history (history tab — last 20) ─────────────────
  useEffect(() => {
    if (activeTab !== 'history' || !userId) return;
    supabase
      .from('engage_call_logs')
      .select('id, contact_name, duration_minutes, call_direction, created_at, notes, prospect_id, engage_prospects(phone, full_name)')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)
      .then(({ data }) => setCallHistory(data || []));
  }, [activeTab, userId]);

  // ── Debounced contact search ───────────────────────────────────
  const searchContacts = useCallback(async (query) => {
    if (query.length < 2) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }
    setIsSearching(true);
    try {
      const { data } = await supabase
        .from('engage_prospects')
        .select('id, full_name, first_name, last_name, email, phone, company_name')
        .or(`full_name.ilike.%${query}%,first_name.ilike.%${query}%,last_name.ilike.%${query}%`)
        .limit(5);
      setSearchResults(data || []);
      setShowDropdown((data || []).length > 0);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  const handleSearchChange = (e) => {
    const val = e.target.value;
    setSearchQuery(val);
    setName(val);
    setSelectedProspectId(null);

    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => searchContacts(val), 300);
  };

  const selectContact = (contact) => {
    const displayName = contact.full_name?.trim() || `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
    setName(displayName);
    setSearchQuery(displayName);
    setSelectedProspectId(contact.id);
    if (contact.phone) {
      setNumber(contact.phone);
    }
    setShowDropdown(false);
    setSearchResults([]);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    };
  }, []);

  const handleKey = (key) => setNumber(prev => prev + key);
  const handleBackspace = () => setNumber(prev => prev.slice(0, -1));

  const handleCall = () => {
    if (!number || !isDeviceReady) return;
    const digits = number.replace(/\D/g, '');
    const e164 = number.startsWith('+') ? number : `+1${digits}`;
    const payload = { name: name.trim() || 'Direct Dial', phone: e164 };
    if (selectedProspectId) payload.prospect_id = selectedProspectId;
    onCall(payload);
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCall();
  };

  const handleRedial = (call) => {
    const phone = call.engage_prospects?.phone || '';
    setNumber(phone);
    setName(call.contact_name || '');
    setSearchQuery(call.contact_name || '');
    setSelectedProspectId(call.prospect_id || null);
    if (activeTab === 'history') setActiveTab('dialpad');
  };

  // ── Direction icon helper ──────────────────────────────────────
  const DirectionIcon = ({ direction }) => {
    if (direction === 'inbound') {
      return <ArrowDownLeft size={10} className="text-blue-500 flex-shrink-0" />;
    }
    return <ArrowUpRight size={10} className="text-emerald-500 flex-shrink-0" />;
  };

  // ── Call list item (shared between recent & history) ───────────
  const CallListItem = ({ call, showNotes = false }) => {
    const phone = call.engage_prospects?.phone || '';
    const duration = formatDuration(call.duration_minutes);

    return (
      <button
        onClick={() => handleRedial(call)}
        className="w-full flex items-center gap-2 px-2.5 py-2 rounded-lg hover:bg-apptivia-paper transition-colors text-left group"
      >
        <DirectionIcon direction={call.call_direction} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-xs font-medium text-apptivia-carbon-700 truncate">
              {call.contact_name || 'Unknown'}
            </span>
            {duration && (
              <span className="text-[9px] font-medium bg-apptivia-carbon-100 text-apptivia-carbon-500 px-1.5 py-0.5 rounded-full flex-shrink-0">
                {duration}
              </span>
            )}
          </div>
          {phone && (
            <span className="text-[10px] text-apptivia-carbon-400 block truncate">{phone}</span>
          )}
          {showNotes && call.notes && call.notes !== 'Outbound call via Apptivia Engage' && (
            <span className="text-[10px] text-apptivia-carbon-400 block truncate italic mt-0.5">{call.notes}</span>
          )}
        </div>
        <span className="text-[9px] text-apptivia-carbon-400 flex-shrink-0 ml-1 opacity-70 group-hover:opacity-100 transition-opacity">
          {timeAgo(call.created_at)}
        </span>
      </button>
    );
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-apptivia-carbon-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-emerald-500" />
          <h3 className="font-semibold text-apptivia-ink text-sm">Dialpad</h3>
        </div>
        <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      {/* Tab Toggle */}
      <div className="flex items-center gap-1 bg-apptivia-paper rounded-lg p-0.5 mx-5 mt-3">
        <button
          onClick={() => setActiveTab('dialpad')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
            activeTab === 'dialpad'
              ? 'bg-apptivia-ink text-white'
              : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
          }`}
        >
          Dialpad
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 px-3 py-1.5 rounded-md text-[10px] font-medium transition-colors ${
            activeTab === 'history'
              ? 'bg-apptivia-ink text-white'
              : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
          }`}
        >
          Call History
        </button>
      </div>

      {/* ── Dialpad Tab ──────────────────────────────────────────── */}
      {activeTab === 'dialpad' && (
        <div className="flex-1 flex flex-col items-center px-5 pt-4 pb-6 gap-3 overflow-y-auto">
          {/* Contact search */}
          <div className="w-full relative" ref={dropdownRef}>
            <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1 block">
              Contact
            </label>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search contacts or type a name..."
                value={searchQuery}
                onChange={handleSearchChange}
                onFocus={() => { if (searchResults.length > 0) setShowDropdown(true); }}
                className="w-full text-xs border border-apptivia-carbon-200 rounded-lg pl-7 pr-3 py-2 focus:outline-none focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral text-apptivia-carbon-700 placeholder-gray-400"
              />
              {isSearching && (
                <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
                  <div className="w-3 h-3 border border-apptivia-carbon-300 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Search dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg overflow-hidden">
                {searchResults.map((contact) => {
                  const displayName = contact.full_name?.trim() || `${contact.first_name || ''} ${contact.last_name || ''}`.trim();
                  return (
                    <button
                      key={contact.id}
                      onClick={() => selectContact(contact)}
                      className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-apptivia-paper transition-colors text-left border-b border-apptivia-carbon-50 last:border-b-0"
                    >
                      <div className="w-6 h-6 rounded-full bg-apptivia-carbon-100 flex items-center justify-center flex-shrink-0">
                        <User size={11} className="text-apptivia-carbon-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-xs font-medium text-apptivia-carbon-700 block truncate">
                          {displayName || 'Unknown'}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-apptivia-carbon-400">
                          {contact.company_name && <span className="truncate">{contact.company_name}</span>}
                          {contact.phone && (
                            <>
                              {contact.company_name && <span>&middot;</span>}
                              <span className="flex-shrink-0">{contact.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Phone number */}
          <div className="w-full">
            <label className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1 block">
              Phone Number
            </label>
            <div className="flex items-center gap-2 w-full">
              <input
                type="tel"
                placeholder="+1 (555) 000-0000"
                value={number}
                onChange={e => setNumber(e.target.value)}
                onKeyDown={handleKeyDown}
                className="flex-1 text-center text-xl font-mono border border-apptivia-carbon-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral text-apptivia-ink placeholder-gray-300"
              />
              {number && (
                <button
                  onClick={handleBackspace}
                  className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors p-1 rounded-lg hover:bg-apptivia-carbon-100"
                >
                  <Delete size={16} />
                </button>
              )}
            </div>
          </div>

          {/* Keypad */}
          <div className="w-full grid grid-cols-3 gap-2.5">
            {KEYS.flat().map((key) => (
              <button
                key={key}
                onClick={() => handleKey(key)}
                className="h-12 rounded-lg bg-apptivia-paper hover:bg-apptivia-carbon-100 active:bg-apptivia-carbon-200 text-apptivia-ink font-semibold text-lg transition-colors border border-apptivia-carbon-100"
              >
                {key}
              </button>
            ))}
          </div>

          {/* Call button */}
          <button
            onClick={handleCall}
            disabled={!number || !isDeviceReady}
            className="w-16 h-16 rounded-full bg-emerald-500 hover:bg-emerald-600 active:bg-emerald-700 disabled:bg-apptivia-carbon-200 disabled:cursor-not-allowed text-white flex items-center justify-center shadow-lg transition-colors mt-1"
            title={isDeviceReady ? 'Call' : 'Dialer initializing...'}
          >
            <Phone size={22} />
          </button>

          {!isDeviceReady && (
            <p className="text-[10px] text-apptivia-carbon-400 text-center -mt-2">Dialer initializing...</p>
          )}

          {/* Recent Calls (last 5) */}
          {recentCalls.length > 0 && (
            <div className="w-full border-t border-apptivia-carbon-100 pt-3 mt-1">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Clock size={11} className="text-apptivia-carbon-400" />
                <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">Recent Calls</span>
              </div>
              <div className="space-y-0.5">
                {recentCalls.map((call) => (
                  <CallListItem key={call.id} call={call} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Call History Tab ──────────────────────────────────────── */}
      {activeTab === 'history' && (
        <div className="flex-1 overflow-y-auto px-5 pt-4 pb-6">
          {callHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-10 h-10 rounded-full bg-apptivia-carbon-100 flex items-center justify-center mb-3">
                <Clock size={16} className="text-apptivia-carbon-400" />
              </div>
              <p className="text-xs text-apptivia-carbon-500 font-medium">No call history yet</p>
              <p className="text-[10px] text-apptivia-carbon-400 mt-1">Your recent calls will appear here</p>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-1.5 mb-2">
                <Clock size={11} className="text-apptivia-carbon-400" />
                <span className="text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider">
                  Last {callHistory.length} Calls
                </span>
              </div>
              <div className="space-y-0.5">
                {callHistory.map((call) => (
                  <CallListItem key={call.id} call={call} showNotes />
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
