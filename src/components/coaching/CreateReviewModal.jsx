import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { aggregateReviewData } from '../../utils/reviewDataAggregator';
import ReviewBuilderForm from './ReviewBuilderForm';

const emptyForm = () => ({
  title: '',
  review_type: '',
  profile_id: '',
  period_start: '',
  period_end: '',
});

export default function CreateReviewModal({ isOpen, onClose, repId, repName, teamMembers, onReviewCreated }) {
  const { profile } = useAuth();
  const toast = useToast();
  const orgId = profile?.organization_id;

  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);

  // Pre-set rep when modal opens
  useEffect(() => {
    if (isOpen && repId) {
      setForm(prev => ({ ...prev, profile_id: repId }));
    }
  }, [isOpen, repId]);

  // Reset when closed
  useEffect(() => {
    if (!isOpen) {
      setForm(emptyForm());
      setSaving(false);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = async () => {
    if (!form.title || !form.profile_id || !form.review_type) {
      return toast.error('Please fill all required fields');
    }
    if (form.period_start && form.period_end && form.period_start > form.period_end) {
      return toast.error('End date must be after start date');
    }
    setSaving(true);
    try {
      let snapshots = {};
      try {
        snapshots = await aggregateReviewData(form.profile_id, orgId, form.period_start, form.period_end);
      } catch (aggErr) {
        console.error('aggregateReviewData failed, proceeding with empty snapshots:', aggErr);
      }

      const row = {
        organization_id: orgId,
        title: form.title,
        review_type: form.review_type,
        profile_id: form.profile_id,
        manager_id: profile?.id,
        period_start: form.period_start,
        period_end: form.period_end,
        status: 'draft',
        ...snapshots,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('performance_reviews').insert(row);
      if (error) throw error;

      toast.success('Performance review created with historical data');
      onReviewCreated?.();
      onClose();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-10">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-apptivia-ink">Start Performance Review</h2>
            {repName && <p className="text-sm text-apptivia-carbon-500">Creating review for {repName}</p>}
          </div>
          <button onClick={onClose} className="p-2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-6">
          <ReviewBuilderForm
            editingReview={null}
            form={form}
            setForm={setForm}
            onSave={handleSave}
            saving={saving}
            teamMembers={teamMembers || []}
            onCancel={onClose}
          />
        </div>
      </div>
    </div>
  );
}
