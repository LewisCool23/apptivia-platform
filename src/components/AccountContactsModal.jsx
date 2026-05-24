import React, { useState } from 'react';
import { X, Users, Upload, Search, Plus, Check } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';
import { backendFetch } from '../utils/backendFetch';

const COMMITTEE_ROLES = ['Decision Maker', 'Champion', 'Influencer', 'Blocker', 'End User'];
const INFLUENCE_LEVELS = ['High', 'Medium', 'Low'];

const EMPTY_FORM = {
  first_name: '',
  last_name: '',
  email: '',
  phone: '',
  title: '',
  linkedin_url: '',
  add_to_committee: false,
  committee_role: 'Decision Maker',
  influence_level: 'Medium',
  notes: '',
};

export default function AccountContactsModal({ isOpen, onClose, accountId, organizationId, onContactAdded }) {
  useModalBehavior(isOpen, onClose);

  const [activeTab, setActiveTab] = useState('add');
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Bulk import state
  const [bulkText, setBulkText] = useState('');
  const [parsedContacts, setParsedContacts] = useState([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState('');

  const resetForm = () => {
    setForm({ ...EMPTY_FORM });
    setError('');
    setSuccess('');
  };

  const handleFieldChange = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleSave = async (closeAfter = true) => {
    setError('');
    setSuccess('');

    if (!form.first_name.trim() || !form.last_name.trim()) {
      setError('First name and last name are required.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        title: form.title.trim() || null,
        linkedin_url: form.linkedin_url.trim() || null,
        notes: form.notes.trim() || null,
        organization_id: organizationId,
      };

      if (form.add_to_committee) {
        payload.committee_role = form.committee_role;
        payload.influence_level = form.influence_level.toLowerCase();
      }

      await backendFetch(`/api/engage/accounts/${accountId}/contacts`, payload, 'POST');

      onContactAdded?.();

      if (closeAfter) {
        onClose();
      } else {
        resetForm();
        setSuccess('Contact saved. Add another below.');
      }
    } catch (err) {
      setError(err.message || 'Failed to save contact.');
    } finally {
      setSaving(false);
    }
  };

  const handleParse = () => {
    setError('');
    setImportResult('');
    const lines = bulkText.trim().split('\n').filter(l => l.trim());
    const parsed = lines.map(line => {
      const parts = line.split(',').map(p => p.trim());
      const nameParts = (parts[0] || '').split(/\s+/);
      const first_name = nameParts[0] || '';
      const last_name = nameParts.slice(1).join(' ') || '';
      const email = parts[1] || '';
      const title = parts[2] || '';
      return { first_name, last_name, email, title };
    }).filter(c => c.first_name);

    if (parsed.length === 0) {
      setError('No valid contacts found. Use format: First Last, email@example.com, Title');
      return;
    }

    setParsedContacts(parsed);
  };

  const handleBulkImport = async () => {
    if (parsedContacts.length === 0) return;
    setError('');
    setImportResult('');
    setImporting(true);

    try {
      const payload = {
        contacts: parsedContacts,
        organization_id: organizationId,
      };

      await backendFetch(`/api/engage/accounts/${accountId}/contacts/bulk`, payload, 'POST');

      setImportResult(`Successfully imported ${parsedContacts.length} contact${parsedContacts.length > 1 ? 's' : ''}.`);
      setParsedContacts([]);
      setBulkText('');
      onContactAdded?.();
    } catch (err) {
      setError(err.message || 'Failed to import contacts.');
    } finally {
      setImporting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black/50 z-50" onClick={onClose}>
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <Users size={18} className="text-apptivia-coral" />
            <h2 className="text-sm font-bold text-apptivia-ink">Add Contacts</h2>
          </div>
          <button onClick={onClose} aria-label="Close" className="p-1 hover:bg-apptivia-carbon-100 rounded transition-colors">
            <X size={16} className="text-apptivia-carbon-500" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-4 px-6 pt-3 border-b border-apptivia-carbon-100">
          <button
            onClick={() => { setActiveTab('add'); setError(''); setSuccess(''); }}
            className={`text-xs font-medium pb-2 transition-colors ${
              activeTab === 'add'
                ? 'border-b-2 border-apptivia-coral text-apptivia-ink'
                : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
            }`}
          >
            <span className="inline-flex items-center gap-1"><Plus size={12} /> Add Contact</span>
          </button>
          <button
            onClick={() => { setActiveTab('bulk'); setError(''); setSuccess(''); }}
            className={`text-xs font-medium pb-2 transition-colors ${
              activeTab === 'bulk'
                ? 'border-b-2 border-apptivia-coral text-apptivia-ink'
                : 'text-apptivia-carbon-500 hover:text-apptivia-ink'
            }`}
          >
            <span className="inline-flex items-center gap-1"><Upload size={12} /> Bulk Import</span>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Error */}
          {error && (
            <div className="mb-3 px-3 py-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded-md">
              {error}
            </div>
          )}

          {/* Success */}
          {success && (
            <div className="mb-3 px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-md flex items-center gap-1">
              <Check size={12} /> {success}
            </div>
          )}

          {activeTab === 'add' && (
            <div className="space-y-3">
              {/* Name row */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">First Name *</label>
                  <input
                    type="text"
                    value={form.first_name}
                    onChange={e => handleFieldChange('first_name', e.target.value)}
                    className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                    placeholder="Jane"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Last Name *</label>
                  <input
                    type="text"
                    value={form.last_name}
                    onChange={e => handleFieldChange('last_name', e.target.value)}
                    className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                    placeholder="Doe"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Email</label>
                <input
                  type="email"
                  value={form.email}
                  onChange={e => handleFieldChange('email', e.target.value)}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                  placeholder="jane@company.com"
                />
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={form.phone}
                  onChange={e => handleFieldChange('phone', e.target.value)}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              {/* Title */}
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Title</label>
                <input
                  type="text"
                  value={form.title}
                  onChange={e => handleFieldChange('title', e.target.value)}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                  placeholder="VP of Sales"
                />
              </div>

              {/* LinkedIn */}
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">LinkedIn URL</label>
                <input
                  type="url"
                  value={form.linkedin_url}
                  onChange={e => handleFieldChange('linkedin_url', e.target.value)}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                  placeholder="https://linkedin.com/in/janedoe"
                />
              </div>

              {/* Buying Committee Toggle */}
              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="add_to_committee"
                  checked={form.add_to_committee}
                  onChange={e => handleFieldChange('add_to_committee', e.target.checked)}
                  className="w-4 h-4 text-apptivia-coral border-apptivia-carbon-300 rounded focus:ring-apptivia-coral"
                />
                <label htmlFor="add_to_committee" className="text-xs font-medium text-apptivia-carbon-700">
                  Add to Buying Committee
                </label>
              </div>

              {/* Committee fields */}
              {form.add_to_committee && (
                <div className="grid grid-cols-2 gap-3 pl-6 border-l-2 border-apptivia-coral/20">
                  <div>
                    <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Committee Role</label>
                    <select
                      value={form.committee_role}
                      onChange={e => handleFieldChange('committee_role', e.target.value)}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                    >
                      {COMMITTEE_ROLES.map(role => (
                        <option key={role} value={role}>{role}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Influence Level</label>
                    <select
                      value={form.influence_level}
                      onChange={e => handleFieldChange('influence_level', e.target.value)}
                      className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                    >
                      {INFLUENCE_LEVELS.map(level => (
                        <option key={level} value={level}>{level}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* Notes */}
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={e => handleFieldChange('notes', e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent resize-none"
                  placeholder="Optional notes about this contact..."
                />
              </div>
            </div>
          )}

          {activeTab === 'bulk' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Paste Contacts</label>
                <textarea
                  value={bulkText}
                  onChange={e => { setBulkText(e.target.value); setParsedContacts([]); setImportResult(''); }}
                  rows={6}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-transparent resize-none font-mono"
                  placeholder="Paste contacts (one per line): First Last, email@example.com, Title"
                />
              </div>

              <button
                onClick={handleParse}
                disabled={!bulkText.trim()}
                className="inline-flex items-center gap-1 bg-apptivia-ink text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-apptivia-ink/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Search size={12} /> Parse Contacts
              </button>

              {/* Import result */}
              {importResult && (
                <div className="px-3 py-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-md flex items-center gap-1">
                  <Check size={12} /> {importResult}
                </div>
              )}

              {/* Parsed preview */}
              {parsedContacts.length > 0 && (
                <div className="border border-apptivia-carbon-200 rounded-md overflow-hidden">
                  <div className="px-3 py-2 bg-apptivia-carbon-50 text-xs font-medium text-apptivia-carbon-700 flex items-center justify-between">
                    <span>{parsedContacts.length} contact{parsedContacts.length > 1 ? 's' : ''} parsed</span>
                  </div>
                  <div className="max-h-40 overflow-y-auto">
                    <table className="w-full text-xs">
                      <thead className="bg-apptivia-carbon-50 sticky top-0">
                        <tr className="text-left text-apptivia-carbon-500">
                          <th className="px-3 py-1.5">Name</th>
                          <th className="px-3 py-1.5">Email</th>
                          <th className="px-3 py-1.5">Title</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-apptivia-carbon-100">
                        {parsedContacts.map((c, i) => (
                          <tr key={i} className="hover:bg-apptivia-carbon-50/50">
                            <td className="px-3 py-1.5 text-apptivia-ink">{c.first_name} {c.last_name}</td>
                            <td className="px-3 py-1.5 text-apptivia-carbon-600">{c.email || '—'}</td>
                            <td className="px-3 py-1.5 text-apptivia-carbon-600">{c.title || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-apptivia-carbon-100 flex items-center justify-end gap-2">
          {activeTab === 'add' && (
            <>
              <button
                onClick={() => handleSave(false)}
                disabled={saving}
                className="inline-flex items-center gap-1 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg px-4 py-2 text-xs font-semibold hover:bg-apptivia-carbon-200 transition-colors disabled:opacity-50"
              >
                <Plus size={12} /> Save & Add Another
              </button>
              <button
                onClick={() => handleSave(true)}
                disabled={saving}
                className="inline-flex items-center gap-1 bg-apptivia-coral text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50"
              >
                <Check size={12} /> {saving ? 'Saving...' : 'Save & Close'}
              </button>
            </>
          )}
          {activeTab === 'bulk' && parsedContacts.length > 0 && (
            <button
              onClick={handleBulkImport}
              disabled={importing}
              className="inline-flex items-center gap-1 bg-apptivia-coral text-white rounded-lg px-4 py-2 text-xs font-semibold hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50"
            >
              <Upload size={12} /> {importing ? 'Importing...' : `Import ${parsedContacts.length} Contact${parsedContacts.length > 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
