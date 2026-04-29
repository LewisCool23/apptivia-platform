import React, { useState, useEffect } from 'react';
import { X, Phone, Delete, Clock } from 'lucide-react';
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

export default function EngageDialpadPanel({ onCall, isDeviceReady, onClose, userId }) {
  const [number, setNumber] = useState('');
  const [name, setName] = useState('');
  const [recentCalls, setRecentCalls] = useState([]);

  useEffect(() => {
    let q = supabase.from('engage_call_logs')
      .select('id, contact_name, phone_number, created_at, duration_minutes')
      .order('created_at', { ascending: false })
      .limit(5);
    if (userId) q = q.eq('user_id', userId);
    q.then(({ data }) => setRecentCalls(data || []));
  }, [userId]);

  const handleKey = (key) => setNumber(prev => prev + key);
  const handleBackspace = () => setNumber(prev => prev.slice(0, -1));

  const handleCall = () => {
    if (!number || !isDeviceReady) return;
    const digits = number.replace(/\D/g, '');
    const e164 = number.startsWith('+') ? number : `+1${digits}`;
    onCall({ name: name.trim() || 'Direct Dial', phone: e164 });
    onClose();
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCall();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Phone size={14} className="text-emerald-500" />
          <h3 className="font-semibold text-gray-900 text-sm">Dialpad</h3>
        </div>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="flex-1 flex flex-col items-center px-5 pt-5 pb-6 gap-4">
        {/* Label input */}
        <input
          type="text"
          placeholder="Contact name (optional)"
          value={name}
          onChange={e => setName(e.target.value)}
          className="w-full text-center text-xs border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-1 focus:ring-emerald-300 text-gray-700 placeholder-gray-400"
        />

        {/* Number display */}
        <div className="flex items-center gap-2 w-full">
          <input
            type="tel"
            placeholder="+1 (555) 000-0000"
            value={number}
            onChange={e => setNumber(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 text-center text-xl font-mono border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-emerald-300 text-gray-900 placeholder-gray-300"
          />
          {number && (
            <button
              onClick={handleBackspace}
              className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-lg hover:bg-apptivia-carbon-100"
            >
              <Delete size={16} />
            </button>
          )}
        </div>

        {/* Keypad */}
        <div className="w-full grid grid-cols-3 gap-2.5">
          {KEYS.flat().map((key) => (
            <button
              key={key}
              onClick={() => handleKey(key)}
              className="h-12 rounded-xl bg-apptivia-paper hover:bg-apptivia-carbon-100 active:bg-apptivia-carbon-200 text-gray-800 font-semibold text-lg transition-colors border border-gray-100"
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
          <p className="text-[10px] text-gray-400 text-center -mt-2">Dialer initializing...</p>
        )}

        {/* Recent Calls */}
        {recentCalls.length > 0 && (
          <div className="w-full border-t border-gray-100 pt-3 mt-1">
            <div className="flex items-center gap-1.5 mb-2">
              <Clock size={11} className="text-gray-400" />
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">Recent Calls</span>
            </div>
            <div className="space-y-1">
              {recentCalls.map((call) => (
                <button
                  key={call.id}
                  onClick={() => { setNumber(call.phone_number || ''); setName(call.contact_name || ''); }}
                  className="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-apptivia-paper transition-colors text-left"
                >
                  <div className="min-w-0">
                    <span className="text-xs font-medium text-gray-700 block truncate">{call.contact_name || 'Unknown'}</span>
                    <span className="text-[10px] text-gray-400">{call.phone_number}</span>
                  </div>
                  <span className="text-[9px] text-gray-400 flex-shrink-0 ml-2">{timeAgo(call.created_at)}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
