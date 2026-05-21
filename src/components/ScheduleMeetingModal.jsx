/**
 * ScheduleMeetingModal — Create/schedule a meeting on the user's connected calendar.
 * Supports Google Meet and Microsoft Teams video conferencing links.
 */

import React, { useState, useCallback, useEffect } from 'react';
import {
  X, Calendar, Clock, MapPin, Users, Video, Plus, Trash2, Loader, CheckCircle, DollarSign, Target
} from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { supabase } from '../supabaseClient';

function toLocalDatetimeString(date) {
  const pad = n => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function ScheduleMeetingModal({ isOpen, onClose, onCreated, onMeetingCreated, calIntegrations, linkedAccountId, linkedAccountName }) {
  useModalBehavior(isOpen !== undefined ? isOpen : true, onClose);
  if (isOpen === false) return null;
  const now = new Date();
  const defaultStart = new Date(now);
  defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15, 0, 0);
  const defaultEnd = new Date(defaultStart.getTime() + 30 * 60000);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState(toLocalDatetimeString(defaultStart));
  const [endTime, setEndTime] = useState(toLocalDatetimeString(defaultEnd));
  const [location, setLocation] = useState('');
  const [attendees, setAttendees] = useState([{ email: '', name: '' }]);
  const [addVideo, setAddVideo] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [dealSearch, setDealSearch] = useState('');
  const [dealResults, setDealResults] = useState([]);
  const [selectedDeal, setSelectedDeal] = useState(null);

  const providerType = calIntegrations?.[0]?.integration_type || 'google_calendar';
  const isGoogle = providerType === 'google_calendar';
  const videoLabel = isGoogle ? 'Google Meet' : 'Microsoft Teams';

  // Debounced deal search
  useEffect(() => {
    if (dealSearch.length < 2) { setDealResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.from('engage_pipeline_deals')
          .select('id, deal_name, deal_value, stage')
          .ilike('deal_name', `%${dealSearch}%`)
          .limit(5);
        setDealResults(data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [dealSearch]);

  const addAttendee = () => setAttendees(prev => [...prev, { email: '', name: '' }]);

  const removeAttendee = (idx) => {
    setAttendees(prev => prev.filter((_, i) => i !== idx));
  };

  const updateAttendee = (idx, field, value) => {
    setAttendees(prev => prev.map((a, i) => i === idx ? { ...a, [field]: value } : a));
  };

  const handleSubmit = useCallback(async (e) => {
    e.preventDefault();
    if (!title.trim()) { setError('Meeting title is required'); return; }
    if (!startTime || !endTime) { setError('Start and end times are required'); return; }
    if (new Date(endTime) <= new Date(startTime)) { setError('End time must be after start time'); return; }

    const validAttendees = attendees.filter(a => a.email.trim());

    setSubmitting(true);
    setError('');
    try {
      const result = await backendFetch('/api/calendar/create-meeting', {
        title: title.trim(),
        description: description.trim(),
        startTime: new Date(startTime).toISOString(),
        endTime: new Date(endTime).toISOString(),
        location: location.trim() || undefined,
        attendees: validAttendees,
        addVideoConference: addVideo,
        linked_account_id: linkedAccountId || undefined,
      });

      const meetLink = result.event?.meetLink;
      // Link deal to meeting if selected
      if (selectedDeal?.id && result?.event?.id) {
        try {
          await supabase.from('engage_deal_meetings').insert({
            deal_id: selectedDeal.id,
            calendar_event_id: result.event.id,
          });
        } catch {}
      }
      setSuccess({ meetLink, provider: result.provider });
      if (onCreated) onCreated(result.event);
      if (onMeetingCreated) onMeetingCreated(result.event);
    } catch (err) {
      setError(err.message || 'Failed to create meeting');
    } finally {
      setSubmitting(false);
    }
  }, [title, description, startTime, endTime, location, attendees, addVideo, selectedDeal, onCreated, onMeetingCreated]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-apptivia-coral" />
            <h2 className="text-sm font-semibold text-apptivia-ink">Schedule Meeting</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-apptivia-paper rounded-lg transition-colors">
            <X size={16} className="text-apptivia-carbon-400" />
          </button>
        </div>

        {/* Success State */}
        {success ? (
          <div className="p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3">
              <CheckCircle size={24} className="text-emerald-600" />
            </div>
            <h3 className="text-sm font-semibold text-apptivia-ink mb-1">Meeting Scheduled</h3>
            <p className="text-xs text-apptivia-carbon-500 mb-4">
              Your meeting has been added to your {success.provider === 'google_calendar' ? 'Google' : 'Outlook'} calendar.
            </p>
            {success.meetLink && (
              <a
                href={success.meetLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-apptivia-paper rounded-lg text-xs font-medium text-apptivia-ink hover:bg-apptivia-carbon-100 transition-colors mb-4"
              >
                <Video size={14} className="text-apptivia-coral" />
                {isGoogle ? 'Google Meet Link' : 'Teams Meeting Link'}
              </a>
            )}
            <div className="flex justify-center gap-2 mt-2">
              <button
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-apptivia-ink bg-apptivia-paper rounded-lg hover:bg-apptivia-carbon-100 transition-colors"
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          /* Form */
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Title */}
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                Meeting Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="e.g., Discovery Call with Acme Corp"
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                autoFocus
              />
            </div>

            {/* Date/Time */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                  <Clock size={10} className="inline mr-1" />Start
                </label>
                <input
                  type="datetime-local"
                  value={startTime}
                  onChange={e => {
                    setStartTime(e.target.value);
                    // Auto-set end to 30 min after start
                    const s = new Date(e.target.value);
                    if (!isNaN(s.getTime())) {
                      setEndTime(toLocalDatetimeString(new Date(s.getTime() + 30 * 60000)));
                    }
                  }}
                  className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                  <Clock size={10} className="inline mr-1" />End
                </label>
                <input
                  type="datetime-local"
                  value={endTime}
                  onChange={e => setEndTime(e.target.value)}
                  className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                />
              </div>
            </div>

            {/* Location */}
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                <MapPin size={10} className="inline mr-1" />Location
              </label>
              <input
                type="text"
                value={location}
                onChange={e => setLocation(e.target.value)}
                placeholder="Conference room, address, or leave blank"
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
              />
            </div>

            {/* Video Conference Toggle */}
            <div className="flex items-center justify-between bg-apptivia-paper rounded-lg px-3 py-2.5">
              <div className="flex items-center gap-2">
                <Video size={14} className="text-apptivia-coral" />
                <span className="text-xs font-medium text-apptivia-ink">Add {videoLabel} link</span>
              </div>
              <button
                type="button"
                onClick={() => setAddVideo(!addVideo)}
                className={`relative w-9 h-5 rounded-full transition-colors ${addVideo ? 'bg-apptivia-coral' : 'bg-apptivia-carbon-300'}`}
              >
                <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${addVideo ? 'translate-x-4' : ''}`} />
              </button>
            </div>

            {/* Attendees */}
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                <Users size={10} className="inline mr-1" />Attendees
              </label>
              <div className="space-y-2">
                {attendees.map((att, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type="email"
                      value={att.email}
                      onChange={e => updateAttendee(idx, 'email', e.target.value)}
                      placeholder="Email address"
                      className="flex-1 border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                    />
                    <input
                      type="text"
                      value={att.name}
                      onChange={e => updateAttendee(idx, 'name', e.target.value)}
                      placeholder="Name (optional)"
                      className="w-32 border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
                    />
                    {attendees.length > 1 && (
                      <button type="button" onClick={() => removeAttendee(idx)} className="p-1.5 hover:bg-red-50 rounded-lg transition-colors">
                        <Trash2 size={12} className="text-red-400" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addAttendee}
                  className="flex items-center gap-1 text-[10px] font-medium text-apptivia-coral hover:text-apptivia-coral/80 transition-colors"
                >
                  <Plus size={12} />
                  Add Attendee
                </button>
              </div>
            </div>

            {/* Link to Deal */}
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                Link to Deal (optional)
              </label>
              {selectedDeal ? (
                <div className="flex items-center justify-between bg-apptivia-coral/5 border border-apptivia-coral/20 rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <DollarSign size={12} className="text-apptivia-coral" />
                    <span className="text-xs font-medium text-apptivia-ink">{selectedDeal.deal_name}</span>
                    {selectedDeal.deal_value && (
                      <span className="text-[10px] text-apptivia-carbon-400">${Number(selectedDeal.deal_value).toLocaleString()}</span>
                    )}
                  </div>
                  <button type="button" onClick={() => { setSelectedDeal(null); setDealSearch(''); }}
                    className="text-apptivia-carbon-400 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input type="text" value={dealSearch} onChange={e => setDealSearch(e.target.value)}
                    className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none" placeholder="Search deals..." />
                  {dealResults.length > 0 && (
                    <div className="absolute z-20 w-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                      {dealResults.map(d => (
                        <button key={d.id} type="button" onClick={() => { setSelectedDeal(d); setDealSearch(''); setDealResults([]); }}
                          className="w-full text-left px-3 py-2 text-xs text-apptivia-ink hover:bg-apptivia-paper transition-colors flex items-center gap-2">
                          <DollarSign size={10} className="text-apptivia-coral" />
                          <span className="font-medium">{d.deal_name}</span>
                          {d.deal_value && <span className="text-apptivia-carbon-400">${Number(d.deal_value).toLocaleString()}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider mb-1">
                Description
              </label>
              <textarea
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Meeting agenda, notes..."
                rows={6}
                className="w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink resize-y focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
                <p className="text-xs text-red-700">{error}</p>
              </div>
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-medium text-apptivia-carbon-600 bg-apptivia-paper rounded-lg hover:bg-apptivia-carbon-100 transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !title.trim()}
                className="px-4 py-2 text-xs font-medium text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {submitting && <Loader size={12} className="animate-spin" />}
                {submitting ? 'Scheduling...' : 'Schedule Meeting'}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
