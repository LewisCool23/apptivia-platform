import React from 'react';

export default function ReviewBuilderForm({
  editingReview,
  form,
  setForm,
  onSave,
  saving,
  teamMembers,
  onCancel,
}) {
  const updateField = (field, value) => setForm(prev => ({ ...prev, [field]: value }));
  const repMembers = (teamMembers || []).filter(m => !['admin', 'manager', 'coach'].includes(m.role));

  // Auto-set dates based on review type
  const handleTypeChange = (type) => {
    updateField('review_type', type);
    const now = new Date();
    const year = now.getFullYear();
    if (type === 'mid_year') {
      updateField('period_start', `${year}-01-01`);
      updateField('period_end', `${year}-06-30`);
      updateField('title', `${year} Mid-Year Performance Review`);
    } else if (type === 'annual') {
      updateField('period_start', `${year}-01-01`);
      updateField('period_end', `${year}-12-31`);
      updateField('title', `${year} Annual Performance Review`);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">
            {editingReview ? 'Edit Performance Review' : 'Create Performance Review'}
          </h3>
          <p className="text-xs text-gray-500">Set up a review with historical data auto-populated</p>
        </div>
        <button onClick={onCancel} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">
          Cancel
        </button>
      </div>

      <div className="space-y-5">
        {/* Rep selector */}
        {repMembers.length > 0 && !editingReview && (
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Rep</label>
            <select value={form.profile_id || ''} onChange={e => updateField('profile_id', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm">
              <option value="">Select a rep...</option>
              {repMembers.map(m => (
                <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
              ))}
            </select>
          </div>
        )}

        {/* Review Type */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Review Type</label>
          <div className="flex gap-3">
            {[
              { id: 'mid_year', label: 'Mid-Year Review', desc: 'January – June' },
              { id: 'annual', label: 'Annual Review', desc: 'Full calendar year' },
            ].map(t => (
              <button
                key={t.id}
                type="button"
                onClick={() => handleTypeChange(t.id)}
                className={`flex-1 border rounded-lg p-3 text-left transition-all ${
                  form.review_type === t.id
                    ? 'border-blue-500 bg-blue-50 ring-1 ring-blue-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-sm font-semibold text-gray-900">{t.label}</div>
                <div className="text-xs text-gray-500">{t.desc}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-xs font-semibold text-gray-700 mb-1">Review Title</label>
          <input type="text" value={form.title || ''} onChange={e => updateField('title', e.target.value)}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" placeholder="e.g. 2026 Mid-Year Performance Review" />
        </div>

        {/* Date range */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Period Start</label>
            <input type="date" value={form.period_start || ''} onChange={e => updateField('period_start', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Period End</label>
            <input type="date" value={form.period_end || ''} onChange={e => updateField('period_end', e.target.value)}
              className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm" />
          </div>
        </div>

        {/* Save */}
        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">Cancel</button>
          <button onClick={onSave} disabled={saving || !form.title || !form.profile_id || !form.review_type}
            className="px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50">
            {saving ? 'Creating...' : (editingReview ? 'Update Review' : 'Create Review')}
          </button>
        </div>
      </div>
    </div>
  );
}
