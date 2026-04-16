import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { backendFetch } from '../../utils/backendFetch';
import { useAuth } from '../../AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { reviewStatusConfig } from './reviewStatusConfig';
import { aggregateReviewData } from '../../utils/reviewDataAggregator';
import { fetchRepTrend } from '../../utils/scorecardFetch';
import { ROLES } from '../../constants/roles';
import ReviewCard from './ReviewCard';
import ReviewBuilderForm from './ReviewBuilderForm';
import ReviewDetailModal from './ReviewDetailModal';
import ConfirmModal from '../ConfirmModal';

const emptyForm = () => ({
  title: '', review_type: '', profile_id: '', period_start: '', period_end: '',
});

export default function ReviewTab({ teamMembers, startForRepId }) {
  const { user, profile, role } = useAuth();
  const toast = useToast();
  const orgId = profile?.organization_id;

  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBuilder, setShowBuilder] = useState(false);
  const [editingReview, setEditingReview] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [saving, setSaving] = useState(false);
  const [selectedReview, setSelectedReview] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [deleteConfirm, setDeleteConfirm] = useState({ isOpen: false, review: null });

  const isAdmin = role === ROLES.ADMIN;
  const isManager = role === ROLES.ADMIN || role === ROLES.MANAGER;
  const isPowerUser = role === ROLES.POWER_USER;
  const [aiGenerating, setAiGenerating] = useState(false);

  // Generate AI draft for manager assessment with 5-week trend analysis
  const handleGenerateReviewDraft = useCallback(async () => {
    if (!selectedReview || aiGenerating) return;
    setAiGenerating(true);
    try {
      const rep = (teamMembers || []).find(m => m.id === selectedReview.profile_id);
      const repName = rep ? (rep.full_name || rep.email) : 'Rep';

      // Fetch 5-week trend data for richer AI context
      const trendResult = await fetchRepTrend(selectedReview.profile_id, 5, orgId);
      const weeklyScores = trendResult.weeks.filter(w => w.hasData).map(w => ({ week: w.week, score: w.score }));

      // Build self-assessment data if available
      const selfAssessment = selectedReview.rep_self_assessment ? {
        rep_self_assessment: selectedReview.rep_self_assessment,
        rep_accomplishments: selectedReview.rep_accomplishments,
        rep_challenges: selectedReview.rep_challenges,
        rep_goals_next_period: selectedReview.rep_goals_next_period,
      } : null;

      const response = await backendFetch('/api/ai/review-draft', {
        repName,
        reviewType: selectedReview.review_type,
        periodStart: selectedReview.period_start,
        periodEnd: selectedReview.period_end,
        scorecardSummary: selectedReview.scorecard_summary,
        kpiAttainment: selectedReview.kpi_attainment,
        skillsetProgress: selectedReview.skillset_progress,
        achievementsEarned: selectedReview.achievements_earned,
        badgesEarned: selectedReview.badges_earned,
        coachingPlansSummary: selectedReview.coaching_plans_summary,
        idpsSummary: selectedReview.idps_summary,
        selfAssessment,
        // 5-week trend data
        trendData: {
          weeklyScores,
          avg5w: trendResult.avg5w,
          trendDelta: trendResult.trendDelta,
          currentScore: trendResult.currentScore,
          oldestScore: trendResult.oldestScore,
          laggingKpis: trendResult.laggingKpis,
        },
      });

      const draft = response?.draft;
      if (!draft) throw new Error('AI did not return a valid draft');
      return draft;
    } catch (err) {
      console.error('Review AI draft error:', err);
      toast.error(err.message || 'Failed to generate AI draft. You can fill in the fields manually.');
      return null;
    } finally {
      setAiGenerating(false);
    }
  }, [selectedReview, aiGenerating, teamMembers, toast]);

  // Fetch reviews
  const fetchReviews = useCallback(async () => {
    if (!orgId) return;
    setLoading(true);
    const query = supabase.from('performance_reviews').select('*').eq('organization_id', orgId).order('created_at', { ascending: false });
    if (isPowerUser) query.eq('profile_id', profile?.id);
    const { data, error } = await query;
    if (error) console.error('Reviews fetch error:', error.message);
    setReviews(data || []);
    setLoading(false);
  }, [orgId, isPowerUser, profile?.id]);

  useEffect(() => { fetchReviews(); }, [fetchReviews]);

  // Auto-open builder when startForRepId is provided (from Coach page "Start Review" button)
  useEffect(() => {
    if (startForRepId && !showBuilder) {
      setForm({ ...emptyForm(), profile_id: startForRepId });
      setShowBuilder(true);
    }
  }, [startForRepId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Filter
  const filtered = useMemo(() => {
    let list = reviews;
    if (statusFilter !== 'all') list = list.filter(r => r.status === statusFilter);
    if (typeFilter !== 'all') list = list.filter(r => r.review_type === typeFilter);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      list = list.filter(r => (r.title || '').toLowerCase().includes(q));
    }
    return list;
  }, [reviews, statusFilter, typeFilter, searchQuery]);

  // Create review
  const handleSave = async () => {
    if (!form.title || !form.profile_id || !form.review_type) return toast.error('Please fill all required fields');
    setSaving(true);
    try {
      // Aggregate historical data — gracefully degrade if aggregation fails
      let snapshots = {};
      try {
        snapshots = await aggregateReviewData(form.profile_id, orgId, form.period_start, form.period_end);
      } catch (aggErr) {
        console.warn('Review data aggregation failed, creating review without snapshots:', aggErr);
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

      if (editingReview) {
        const { error } = await supabase.from('performance_reviews').update(row).eq('id', editingReview.id);
        if (error) throw error;
        toast.success('Review updated');
      } else {
        const { error } = await supabase.from('performance_reviews').insert(row);
        if (error) throw error;
        toast.success('Performance review created with historical data');
      }
      setShowBuilder(false);
      setEditingReview(null);
      setForm(emptyForm());
      fetchReviews();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Transition handler — routes through backend state machine for validation,
  // notifications, and Aaron memory updates
  const handleTransition = async (newStatus, extraData = {}) => {
    if (!selectedReview) return;
    setSaving(true);
    try {
      const result = await backendFetch(`/api/reviews/${selectedReview.id}/transition`, {
        newStatus,
        extraData,
      });
      if (result?.error) throw new Error(result.error);

      toast.success(`Review status updated to ${newStatus.replace(/_/g, ' ')}`);
      setSelectedReview(prev => prev ? { ...prev, status: newStatus, ...extraData } : null);
      fetchReviews();
    } catch (err) {
      toast.error('Transition failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Manager save assessment
  const handleManagerSave = async (mgrData) => {
    if (!selectedReview) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('performance_reviews').update({
        ...mgrData,
        updated_at: new Date().toISOString(),
      }).eq('id', selectedReview.id);
      if (error) throw error;
      toast.success('Manager assessment saved');
      setSelectedReview(prev => prev ? { ...prev, ...mgrData } : null);
      fetchReviews();
    } catch (err) {
      toast.error('Save failed: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  // Acknowledge
  const handleAcknowledge = async (comment) => {
    await handleTransition('acknowledged', { acknowledgment_comment: comment || null });
  };

  // Edit
  const handleEdit = (review) => {
    setEditingReview(review);
    setForm({
      title: review.title, review_type: review.review_type, profile_id: review.profile_id,
      period_start: review.period_start, period_end: review.period_end,
    });
    setShowBuilder(true);
  };

  // Delete
  const handleDelete = async () => {
    const r = deleteConfirm.review;
    if (!r) return;
    const { error } = await supabase.from('performance_reviews').delete().eq('id', r.id);
    if (error) toast.error('Delete failed: ' + error.message);
    else toast.success('Review deleted');
    setDeleteConfirm({ isOpen: false, review: null });
    fetchReviews();
  };

  return (
    <div>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2 flex-1">
          <div className="relative flex-1 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search reviews..."
              className="w-full pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg" />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"><X size={14} /></button>
            )}
          </div>
        </div>
        {isManager && (
          <button onClick={() => { setEditingReview(null); setForm(emptyForm()); setShowBuilder(true); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700">
            <Plus size={14} /> Create Review
          </button>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-4">
        <div className="flex flex-wrap gap-1.5">
          {[
            { id: 'all', label: 'All' },
            { id: 'draft', label: 'Draft' },
            { id: 'pending_self_assessment', label: 'Awaiting Self-Assessment' },
            { id: 'self_assessment_submitted', label: 'Self-Assessment Done' },
            { id: 'manager_review', label: 'Manager Review' },
            { id: 'finalized', label: 'Finalized' },
            { id: 'acknowledged', label: 'Acknowledged' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setStatusFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                statusFilter === tab.id ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex gap-1.5">
          {[
            { id: 'all', label: 'All Types' },
            { id: 'mid_year', label: 'Mid-Year' },
            { id: 'annual', label: 'Annual' },
          ].map(tab => (
            <button key={tab.id} onClick={() => setTypeFilter(tab.id)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-all ${
                typeFilter === tab.id ? 'bg-purple-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Builder form */}
      {showBuilder && (
        <ReviewBuilderForm
          editingReview={editingReview}
          form={form}
          setForm={setForm}
          onSave={handleSave}
          saving={saving}
          teamMembers={teamMembers}
          onCancel={() => { setShowBuilder(false); setEditingReview(null); setForm(emptyForm()); }}
        />
      )}

      {/* Cards */}
      {loading ? (
        <div className="text-center py-12 text-sm text-gray-500">Loading reviews...</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-sm text-gray-500 mb-2">{isPowerUser ? 'No performance reviews for you yet' : 'No performance reviews yet'}</p>
          {isManager && !showBuilder && (
            <button onClick={() => { setForm(emptyForm()); setShowBuilder(true); }}
              className="px-4 py-2 text-sm font-semibold text-blue-600 border border-blue-600 rounded-lg hover:bg-blue-50">
              Create Your First Review
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(review => (
            <ReviewCard
              key={review.id}
              review={review}
              canManage={isManager}
              teamMembers={teamMembers}
              onView={setSelectedReview}
              onEdit={handleEdit}
              onDelete={r => setDeleteConfirm({ isOpen: true, review: r })}
            />
          ))}
        </div>
      )}

      {/* Detail modal */}
      {selectedReview && (
        <ReviewDetailModal
          review={selectedReview}
          onClose={() => setSelectedReview(null)}
          onTransition={handleTransition}
          onManagerSave={handleManagerSave}
          onAcknowledge={handleAcknowledge}
          isManager={isManager || (selectedReview.manager_id === profile?.id && (role === ROLES.MANAGER || role === ROLES.ADMIN))}
          isRep={selectedReview.profile_id === profile?.id}
          teamMembers={teamMembers}
          saving={saving}
          onGenerateAiDraft={handleGenerateReviewDraft}
          aiGenerating={aiGenerating}
        />
      )}

      {/* Delete confirm */}
      {deleteConfirm.isOpen && (
        <ConfirmModal
          isOpen={deleteConfirm.isOpen}
          title="Delete Performance Review"
          message={`Are you sure you want to delete "${deleteConfirm.review?.title}"? This cannot be undone.`}
          confirmText="Delete"
          onConfirm={handleDelete}
          onClose={() => setDeleteConfirm({ isOpen: false, review: null })}
        />
      )}
    </div>
  );
}
