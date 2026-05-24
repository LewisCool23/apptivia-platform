import React, { useState, useEffect } from 'react';
import { X, Calendar, Clock, Mail, FileText } from 'lucide-react';
import { backendFetch } from '../utils/backendFetch';
import { useModalBehavior } from '../hooks/useModalBehavior';

const INITIAL_FORM = {
  report_type: 'scorecard',
  frequency: 'weekly',
  day_of_week: 'monday',
  time: '09:00',
  recipients: '',
  include_charts: true,
  include_summary: true,
  active: true
};

export default function ScheduleReportModal({ isOpen, onClose, onSuccess, editReport = null }) {
  useModalBehavior(isOpen, onClose);
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const isEditing = !!editReport;

  // Populate form when editing
  useEffect(() => {
    if (editReport) {
      setFormData({
        report_type: editReport.report_type || 'scorecard',
        frequency: editReport.frequency || 'weekly',
        day_of_week: editReport.day_of_week || 'monday',
        time: editReport.time || '09:00',
        recipients: Array.isArray(editReport.recipients)
          ? editReport.recipients.join(', ')
          : editReport.recipients || '',
        include_charts: editReport.include_charts ?? true,
        include_summary: editReport.include_summary ?? true,
        active: editReport.active ?? true,
      });
    } else {
      setFormData(INITIAL_FORM);
    }
    setError('');
  }, [editReport]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSaving(true);
    setError('');

    // Validate recipients (basic email validation)
    const emails = formData.recipients.split(',').map(s => s.trim()).filter(s => s);
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (emails.length === 0) {
      setError('At least one recipient email is required.');
      setSaving(false);
      return;
    }

    if (invalidEmails.length > 0) {
      setError(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      setSaving(false);
      return;
    }

    try {
      const payload = {
        ...formData,
        recipients: emails,
      };

      if (isEditing) {
        const res = await backendFetch(`/api/scheduled-reports/${editReport.id}`, payload, 'PATCH');
        if (res.error) throw new Error(res.error);
      } else {
        const res = await backendFetch('/api/scheduled-reports', payload, 'POST');
        if (res.error) throw new Error(res.error);
      }

      onSuccess?.();
      onClose();
      setFormData(INITIAL_FORM);
    } catch (err) {
      setError(err.message || 'Failed to save report schedule');
    } finally {
      setSaving(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-bold text-apptivia-ink">
              {isEditing ? 'Edit Report Schedule' : 'Schedule Report'}
            </h2>
            <p className="text-sm text-apptivia-carbon-500 mt-1">
              {isEditing ? 'Update your automated report delivery' : 'Set up automated report delivery'}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              <FileText size={16} className="inline mr-2" />
              Report Type
            </label>
            <select
              value={formData.report_type}
              onChange={(e) => setFormData({ ...formData, report_type: e.target.value })}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
            >
              <option value="scorecard">Scorecard Summary</option>
              <option value="analytics">Analytics Report</option>
              <option value="coach">Coaching Insights</option>
              <option value="contests">Contest Results</option>
              <option value="team_performance">Team Performance</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                <Calendar size={16} className="inline mr-2" />
                Frequency
              </label>
              <select
                value={formData.frequency}
                onChange={(e) => setFormData({ ...formData, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
              >
                <option value="daily">Daily</option>
                <option value="weekly">Weekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>

            {formData.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                  Day of Week
                </label>
                <select
                  value={formData.day_of_week}
                  onChange={(e) => setFormData({ ...formData, day_of_week: e.target.value })}
                  className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
                >
                  <option value="monday">Monday</option>
                  <option value="tuesday">Tuesday</option>
                  <option value="wednesday">Wednesday</option>
                  <option value="thursday">Thursday</option>
                  <option value="friday">Friday</option>
                  <option value="saturday">Saturday</option>
                  <option value="sunday">Sunday</option>
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              <Clock size={16} className="inline mr-2" />
              Time
            </label>
            <input
              type="time"
              value={formData.time}
              onChange={(e) => setFormData({ ...formData, time: e.target.value })}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              <Mail size={16} className="inline mr-2" />
              Recipients
            </label>
            <input
              type="text"
              value={formData.recipients}
              onChange={(e) => setFormData({ ...formData, recipients: e.target.value })}
              className="w-full px-3 py-2 border border-apptivia-carbon-300 rounded-md focus:outline-none focus:ring-2 focus:ring-apptivia-coral"
              placeholder="email1@example.com, email2@example.com"
              required
            />
            <p className="mt-1 text-xs text-apptivia-carbon-500">
              Separate multiple emails with commas
            </p>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-apptivia-carbon-700">
              <input
                type="checkbox"
                checked={formData.include_charts}
                onChange={(e) => setFormData({ ...formData, include_charts: e.target.checked })}
                className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral"
              />
              Include charts and visualizations
            </label>
            <label className="flex items-center gap-2 text-sm text-apptivia-carbon-700">
              <input
                type="checkbox"
                checked={formData.include_summary}
                onChange={(e) => setFormData({ ...formData, include_summary: e.target.checked })}
                className="rounded border-apptivia-carbon-300 text-apptivia-coral focus:ring-apptivia-coral"
              />
              Include executive summary
            </label>
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-apptivia-carbon-700 bg-apptivia-carbon-100 rounded-md hover:bg-apptivia-carbon-200 transition-colors"
              disabled={saving}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-apptivia-coral text-white rounded-md hover:bg-apptivia-coral/90 transition-colors disabled:opacity-50"
              disabled={saving}
            >
              {saving
                ? (isEditing ? 'Updating...' : 'Scheduling...')
                : (isEditing ? 'Update Schedule' : 'Schedule Report')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
