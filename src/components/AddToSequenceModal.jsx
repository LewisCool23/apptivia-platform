import React, { useState, useEffect } from 'react';
import { X, GitBranch, Users, Check, Plus, ArrowRight, RefreshCw } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import toast from 'react-hot-toast';

export default function AddToSequenceModal({ isOpen, onClose, contact, organizationId }) {
  const [sequences, setSequences] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedSequenceId, setSelectedSequenceId] = useState('');
  const [enrolling, setEnrolling] = useState(false);
  const [success, setSuccess] = useState(false);

  // Create new sequence inline
  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSequences();
      setSelectedSequenceId('');
      setSuccess(false);
      setShowCreate(false);
      setNewName('');
    }
  }, [isOpen]);

  const fetchSequences = async () => {
    setLoading(true);
    try {
      const data = await backendFetch('/api/engage/sequences', undefined, 'GET');
      // Only show active or draft sequences for enrollment
      setSequences((data?.data || []).filter(s => s.status === 'active' || s.status === 'draft'));
    } catch {
      setSequences([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateSequence = async () => {
    if (!newName.trim()) return;
    setCreating(true);
    try {
      const data = await backendFetch('/api/engage/sequences', {
        name: newName.trim(), status: 'draft',
      });
      if (data?.id) {
        toast.success(`Sequence "${newName}" created`);
        setSelectedSequenceId(data.id);
        setShowCreate(false);
        setNewName('');
        fetchSequences();
      }
    } catch {
      toast.error('Failed to create sequence');
    } finally {
      setCreating(false);
    }
  };

  const handleEnroll = async () => {
    if (!selectedSequenceId || !contact?.email) return;
    setEnrolling(true);
    try {
      const res = await backendFetch(`/api/engage/sequences/${selectedSequenceId}/enroll`, {
        prospect_email: contact.email,
        prospect_name: [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.name || contact.full_name || '',
        prospect_company: contact.company_name || contact.organization?.name || '',
      });
      if (res?.error) {
        toast.error(res.error);
      } else {
        setSuccess(true);
        toast.success(`Enrolled ${contact.email} in sequence`);
      }
    } catch {
      toast.error('Failed to enroll contact');
    } finally {
      setEnrolling(false);
    }
  };

  if (!isOpen) return null;

  const contactName = [contact?.first_name, contact?.last_name].filter(Boolean).join(' ') || contact?.name || contact?.full_name || 'Unknown';
  const contactCompany = contact?.company_name || contact?.organization?.name || '';

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-apptivia-ink rounded-lg flex items-center justify-center">
              <GitBranch size={14} className="text-white" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-apptivia-ink">Add to Sequence</h3>
              <p className="text-[10px] text-apptivia-carbon-400">
                {contactName}{contactCompany ? ` at ${contactCompany}` : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors">
            <X size={18} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 space-y-4">
          {/* Contact email */}
          <div className="flex items-center gap-2 bg-apptivia-carbon-100/50 rounded-lg px-3 py-2">
            <Users size={12} className="text-apptivia-carbon-500" />
            <span className="text-xs text-apptivia-ink font-medium">{contact?.email || 'No email'}</span>
          </div>

          {success ? (
            <div className="text-center py-6">
              <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
                <Check size={20} className="text-emerald-600" />
              </div>
              <p className="text-sm font-semibold text-apptivia-ink mb-1">Enrolled successfully</p>
              <p className="text-xs text-apptivia-carbon-500">
                {contactName} has been added to the sequence.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-4 py-2 bg-apptivia-ink text-white text-xs font-medium rounded-lg hover:bg-apptivia-ink/90 transition-colors"
              >
                Done
              </button>
            </div>
          ) : (
            <>
              {/* Sequence selector */}
              <div>
                <label className="text-[10px] text-apptivia-carbon-400 uppercase font-medium block mb-1.5">
                  Select Sequence
                </label>
                {loading ? (
                  <div className="flex items-center gap-2 py-3 text-xs text-apptivia-carbon-400">
                    <RefreshCw size={12} className="animate-spin" /> Loading sequences...
                  </div>
                ) : sequences.length === 0 ? (
                  <p className="text-xs text-apptivia-carbon-400 py-2">No sequences available. Create one below.</p>
                ) : (
                  <select
                    value={selectedSequenceId}
                    onChange={(e) => setSelectedSequenceId(e.target.value)}
                    className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
                  >
                    <option value="">Choose a sequence...</option>
                    {sequences.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.name} ({s.status}) — {s.total_enrolled || 0} enrolled
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Create new sequence */}
              {!showCreate ? (
                <button
                  onClick={() => setShowCreate(true)}
                  className="flex items-center gap-1.5 text-xs text-apptivia-coral hover:text-apptivia-coral-tone-700 font-medium transition-colors"
                >
                  <Plus size={12} /> Create new sequence
                </button>
              ) : (
                <div className="bg-apptivia-carbon-100/50 rounded-lg p-3 space-y-2">
                  <input
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    placeholder="Sequence name..."
                    className="w-full text-xs border border-apptivia-carbon-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-apptivia-coral/20 focus:border-apptivia-coral"
                    autoFocus
                    onKeyDown={(e) => e.key === 'Enter' && handleCreateSequence()}
                  />
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleCreateSequence}
                      disabled={creating || !newName.trim()}
                      className="px-3 py-1.5 bg-apptivia-ink text-white text-xs font-medium rounded-lg hover:bg-apptivia-ink/90 transition-colors disabled:opacity-50"
                    >
                      {creating ? 'Creating...' : 'Create'}
                    </button>
                    <button
                      onClick={() => { setShowCreate(false); setNewName(''); }}
                      className="px-3 py-1.5 text-xs text-apptivia-carbon-500 hover:text-apptivia-carbon-700 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              {/* Enroll button */}
              <button
                onClick={handleEnroll}
                disabled={enrolling || !selectedSequenceId || !contact?.email}
                className="w-full px-4 py-2.5 bg-apptivia-coral text-white rounded-lg text-xs font-semibold hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {enrolling ? (
                  <><RefreshCw size={12} className="animate-spin" /> Enrolling...</>
                ) : (
                  <><ArrowRight size={12} /> Enroll in Sequence</>
                )}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
