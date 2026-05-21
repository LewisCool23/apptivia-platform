import React, { useState } from 'react';
import { X, Plus, Loader } from 'lucide-react';
import { useModalBehavior } from '../hooks/useModalBehavior';

// Signal type options grouped by category (subset of most common for manual add)
const SIGNAL_TYPE_OPTIONS = [
  { group: 'Buyer Intent', items: [
    { key: 'solution_search', label: 'Solution Search' },
    { key: 'pain_point', label: 'Pain Point Expressed' },
    { key: 'competitor_comparison', label: 'Competitor Comparison' },
    { key: 'competitor_complaint', label: 'Competitor Complaint' },
    { key: 'rfp_issuance', label: 'RFP Issued' },
    { key: 'demo_request_competitor', label: 'Competitor Demo Request' },
  ]},
  { group: 'Company Events', items: [
    { key: 'sales_leadership_hire', label: 'Sales Leadership Hire' },
    { key: 'sales_team_expansion', label: 'Sales Team Expansion' },
    { key: 'headcount_growth', label: 'Headcount Growth' },
    { key: 'funding_round', label: 'Funding Round' },
    { key: 'leadership_change', label: 'Leadership Change' },
    { key: 'company_expansion', label: 'Company Expansion' },
    { key: 'product_launch', label: 'Product Launch' },
    { key: 'hiring_velocity', label: 'Rapid Hiring' },
    { key: 'layoffs_restructuring', label: 'Layoffs / Restructuring' },
    { key: 'new_market_entry', label: 'New Market Entry' },
  ]},
  { group: 'Interest', items: [
    { key: 'tech_stack_change', label: 'Tech Stack Change' },
    { key: 'content_engagement', label: 'Content Engagement' },
    { key: 'event_participation', label: 'Event Participation' },
    { key: 'news_mention', label: 'News / Press Mention' },
  ]},
];

const SOURCE_OPTIONS = [
  { value: 'linkedin', label: 'LinkedIn' },
  { value: 'indeed', label: 'Indeed' },
  { value: 'google_jobs', label: 'Google Jobs' },
  { value: 'glassdoor', label: 'Glassdoor' },
  { value: 'news', label: 'News Article' },
  { value: 'other', label: 'Other' },
];

export default function QuickAddSignalModal({ isOpen, onClose, onSubmit }) {
  useModalBehavior(isOpen, onClose);
  const [form, setForm] = useState({
    company_name: '',
    signal_type: '',
    signal_score: 80,
    source_platform: 'linkedin',
    description: '',
    source_url: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.company_name.trim() || !form.signal_type) {
      setError('Company name and signal type are required.');
      return;
    }
    setError('');
    setSubmitting(true);
    try {
      const result = await onSubmit({
        company_name: form.company_name.trim(),
        signal_type: form.signal_type,
        signal_score: Math.max(0, Math.min(100, parseInt(form.signal_score) || 80)),
        source_platform: form.source_platform,
        description: form.description.trim() || undefined,
        source_url: form.source_url.trim() || undefined,
      });
      if (result) {
        setForm({ company_name: '', signal_type: '', signal_score: 80, source_platform: 'linkedin', description: '', source_url: '' });
        onClose();
      } else {
        setError('Failed to add signal. Check console for details.');
      }
    } catch (err) {
      setError(err.message || 'Unexpected error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-100">
          <h2 className="text-lg font-semibold text-apptivia-carbon-800">Quick Add Signal</h2>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-apptivia-carbon-100 transition-colors">
            <X size={18} className="text-apptivia-carbon-500" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Company Name */}
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Company Name <span className="text-apptivia-coral">*</span>
            </label>
            <input
              type="text"
              value={form.company_name}
              onChange={(e) => setForm(f => ({ ...f, company_name: e.target.value }))}
              placeholder="e.g., Starburst Data"
              className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none"
              autoFocus
            />
          </div>

          {/* Signal Type */}
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Signal Type <span className="text-apptivia-coral">*</span>
            </label>
            <select
              value={form.signal_type}
              onChange={(e) => setForm(f => ({ ...f, signal_type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none bg-white"
            >
              <option value="">Select a signal type...</option>
              {SIGNAL_TYPE_OPTIONS.map(group => (
                <optgroup key={group.group} label={group.group}>
                  {group.items.map(item => (
                    <option key={item.key} value={item.key}>{item.label}</option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>

          {/* Score + Source row */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Signal Score</label>
              <input
                type="number"
                min="0"
                max="100"
                value={form.signal_score}
                onChange={(e) => setForm(f => ({ ...f, signal_score: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Source</label>
              <select
                value={form.source_platform}
                onChange={(e) => setForm(f => ({ ...f, source_platform: e.target.value }))}
                className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none bg-white"
              >
                {SOURCE_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Source URL */}
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Source URL</label>
            <input
              type="url"
              value={form.source_url}
              onChange={(e) => setForm(f => ({ ...f, source_url: e.target.value }))}
              placeholder="https://linkedin.com/posts/..."
              className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none"
            />
          </div>

          {/* Notes */}
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Notes</label>
            <textarea
              value={form.description}
              onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="e.g., Saw on LinkedIn — hired Manager of Sales Development"
              rows={3}
              className="w-full px-3 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral/30 focus:border-apptivia-coral outline-none resize-none"
            />
          </div>

          {/* Error */}
          {error && (
            <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-apptivia-carbon-600 hover:text-apptivia-carbon-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || !form.company_name.trim() || !form.signal_type}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium text-white bg-apptivia-coral hover:bg-apptivia-coral-tone-600 rounded-lg disabled:opacity-40 transition-all shadow-sm"
            >
              {submitting ? <Loader size={14} className="animate-spin" /> : <Plus size={14} />}
              {submitting ? 'Adding...' : 'Add Signal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
