import React, { useState, useEffect } from 'react';
import { X, Printer, Star, Calendar, Award, Trophy, Target, CheckCircle2, BookOpen, TrendingUp, FileText, Plus, Trash2, Sparkles } from 'lucide-react';
import { reviewStatusConfig, reviewTypes, reviewTransitions } from './reviewStatusConfig';
import { buildLabel } from '../../constants/kpiGuidance';
import SelfAssessmentForm from './SelfAssessmentForm';

export default function ReviewDetailModal({
  review,
  onClose,
  onTransition,
  onManagerSave,
  onAcknowledge,
  isManager,
  isRep,
  teamMembers,
  saving,
  onGenerateAiDraft,
  aiGenerating,
}) {
  if (!review) return null;

  const cfg = reviewStatusConfig[review.status] || reviewStatusConfig.draft;
  const StatusIcon = cfg.icon;
  const typeLabel = reviewTypes[review.review_type]?.label || review.review_type;
  const repMember = teamMembers?.find(m => m.id === review.profile_id);
  const repLabel = repMember ? (repMember.full_name || repMember.email) : 'Unknown';
  const transition = reviewTransitions[review.status];

  // Manager form state
  const [mgrSummary, setMgrSummary] = useState(review.manager_summary || '');
  const [mgrStrengths, setMgrStrengths] = useState(review.manager_strengths?.length > 0 ? review.manager_strengths : [{ text: '' }]);
  const [mgrImprovements, setMgrImprovements] = useState(review.manager_areas_for_improvement?.length > 0 ? review.manager_areas_for_improvement : [{ text: '' }]);
  const [mgrGoals, setMgrGoals] = useState(review.manager_goals_next_period?.length > 0 ? review.manager_goals_next_period : [{ text: '' }]);
  const [mgrRating, setMgrRating] = useState(review.manager_rating || 0);
  const [mgrComments, setMgrComments] = useState(review.manager_comments || '');
  const [finalRating, setFinalRating] = useState(review.final_rating || 0);
  const [finalSummary, setFinalSummary] = useState(review.final_summary || '');
  const [ackComment, setAckComment] = useState('');

  // Sync form state when review prop changes (e.g. after status transition or save)
  useEffect(() => {
    setMgrSummary(review.manager_summary || '');
    setMgrStrengths(review.manager_strengths?.length > 0 ? review.manager_strengths : [{ text: '' }]);
    setMgrImprovements(review.manager_areas_for_improvement?.length > 0 ? review.manager_areas_for_improvement : [{ text: '' }]);
    setMgrGoals(review.manager_goals_next_period?.length > 0 ? review.manager_goals_next_period : [{ text: '' }]);
    setMgrRating(review.manager_rating || 0);
    setMgrComments(review.manager_comments || '');
    setFinalRating(review.final_rating || 0);
    setFinalSummary(review.final_summary || '');
  }, [review.id, review.status, review.manager_summary, review.manager_rating, review.final_rating, review.final_summary, review.updated_at]);

  const addItem = (setter) => setter(prev => [...prev, { text: '' }]);
  const updateItem = (setter, idx, value) => setter(prev => prev.map((item, i) => i === idx ? { text: value } : item));
  const removeItem = (setter, idx) => setter(prev => prev.filter((_, i) => i !== idx));

  const handleManagerSave = () => {
    onManagerSave({
      manager_summary: mgrSummary,
      manager_strengths: mgrStrengths.filter(s => s.text.trim()),
      manager_areas_for_improvement: mgrImprovements.filter(s => s.text.trim()),
      manager_goals_next_period: mgrGoals.filter(s => s.text.trim()),
      manager_rating: mgrRating || null,
      manager_comments: mgrComments,
      final_rating: finalRating || null,
      final_summary: finalSummary,
    });
  };

  const handlePrint = () => window.print();

  // Avg scorecard score
  const avgScore = review.scorecard_summary?.length > 0
    ? Math.round(review.scorecard_summary.reduce((s, w) => s + w.score, 0) / review.scorecard_summary.length)
    : null;

  return (
    <>
    {/* Print styles for PDF export */}
    <style>{`
      @media print {
        body > *:not(.review-modal-overlay) { display: none !important; }
        .review-modal-overlay { position: static !important; background: none !important; overflow: visible !important; padding: 0 !important; }
        .review-modal-content { position: static !important; max-height: none !important; overflow: visible !important; box-shadow: none !important; border-radius: 0 !important; margin: 0 !important; max-width: none !important; }
        .print-hidden { display: none !important; }
        table { page-break-inside: avoid; }
        section { page-break-inside: avoid; }
      }
    `}</style>
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-6 overflow-y-auto review-modal-overlay">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl mx-4 mb-10 review-modal-content">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between print:border-b-2">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-lg font-bold text-apptivia-ink">{review.title}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <StatusIcon size={12} /> {cfg.label}
              </span>
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                review.review_type === 'annual' ? 'bg-apptivia-carbon-100 text-apptivia-ink' : 'bg-apptivia-coral-tone-50 text-apptivia-coral'
              }`}>
                {typeLabel}
              </span>
            </div>
            <p className="text-sm text-apptivia-carbon-600">Rep: {repLabel}</p>
            {review.period_start && review.period_end && (
              <div className="flex items-center gap-1.5 mt-1 text-xs text-apptivia-carbon-500">
                <Calendar size={12} />
                <span>{new Date(review.period_start).toLocaleDateString()} — {new Date(review.period_end).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2 print-hidden">
            <button onClick={handlePrint} className="p-2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg" title="Print / Save as PDF">
              <Printer size={18} />
            </button>
            <button onClick={onClose} className="p-2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600 hover:bg-apptivia-carbon-100 rounded-lg">
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Rating display */}
          {(review.final_rating || review.manager_rating) && (
            <div className="flex items-center gap-4 bg-apptivia-paper rounded-lg p-4">
              <div className="text-center">
                <div className="text-3xl font-bold text-apptivia-ink">{review.final_rating || review.manager_rating}/5</div>
                <div className="text-xs text-apptivia-carbon-500">{review.final_rating ? 'Final Rating' : 'Manager Rating'}</div>
              </div>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map(i => (
                  <Star key={i} size={24} className={i <= (review.final_rating || review.manager_rating) ? 'text-yellow-400 fill-yellow-400' : 'text-apptivia-carbon-300'} />
                ))}
              </div>
              {avgScore != null && (
                <div className="ml-auto text-center">
                  <div className="text-2xl font-bold text-apptivia-coral">{avgScore}%</div>
                  <div className="text-xs text-apptivia-carbon-500">Avg. Scorecard</div>
                </div>
              )}
            </div>
          )}

          {/* Workflow actions */}
          <div className="print-hidden">
            {/* Manager transitions */}
            {isManager && transition && transition.actor === 'manager' && (
              <div className="flex flex-wrap gap-2">
                <button onClick={() => onTransition(transition.next)}
                  className="px-4 py-2 text-sm font-semibold text-white bg-apptivia-coral rounded-md hover:bg-apptivia-coral" disabled={saving}>
                  {saving ? 'Processing...' : transition.action}
                </button>
                {transition.alt && transition.alt.actor === 'manager' && (
                  <button onClick={() => onTransition(transition.alt.next)}
                    className="px-4 py-2 text-sm font-semibold text-apptivia-carbon-600 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-paper">
                    {transition.alt.action}
                  </button>
                )}
              </div>
            )}
            {/* Finalized — manager can reopen */}
            {isManager && review.status === 'finalized' && (
              <button onClick={() => onTransition('reopened')}
                className="px-4 py-2 text-sm font-semibold text-orange-600 border border-orange-300 rounded-md hover:bg-orange-50">
                Reopen Review
              </button>
            )}
          </div>

          {/* ── HISTORICAL DATA ── */}

          {/* Scorecard Summary */}
          {review.scorecard_summary?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><TrendingUp size={14} /> Scorecard Scores</h3>
              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-2">
                {review.scorecard_summary.map((w, idx) => (
                  <div key={idx} className="bg-apptivia-paper rounded-lg p-2 text-center">
                    <div className="text-xs text-apptivia-carbon-500">{new Date(w.week).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}</div>
                    <div className={`text-lg font-bold ${w.score >= 80 ? 'text-green-600' : w.score >= 60 ? 'text-yellow-600' : 'text-red-600'}`}>
                      {w.score}%
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* KPI Attainment */}
          {review.kpi_attainment?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><Target size={14} /> KPI Attainment</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-xs text-apptivia-carbon-500">
                      <th className="pb-2 pr-4">KPI</th>
                      <th className="pb-2 pr-4">Avg Value</th>
                      <th className="pb-2 pr-4">Goal</th>
                      <th className="pb-2 pr-4">Attainment</th>
                      <th className="pb-2">Weeks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {review.kpi_attainment.map((kpi, idx) => (
                      <tr key={idx} className="border-b border-apptivia-carbon-100">
                        <td className="py-2 pr-4 font-medium">{kpi.name || buildLabel(kpi.key)}</td>
                        <td className="py-2 pr-4">{kpi.avg_value}</td>
                        <td className="py-2 pr-4">{kpi.goal}</td>
                        <td className="py-2 pr-4">
                          <span className={`font-semibold ${kpi.attainment_pct >= 100 ? 'text-green-600' : kpi.attainment_pct >= 80 ? 'text-yellow-600' : 'text-red-600'}`}>
                            {kpi.attainment_pct}%
                          </span>
                        </td>
                        <td className="py-2 text-apptivia-carbon-500">{kpi.weeks_measured}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Skillset Progress */}
          {review.skillset_progress?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><BookOpen size={14} /> Skillset Progress</h3>
              <div className="flex flex-wrap gap-2">
                {review.skillset_progress.map((s, idx) => (
                  <div key={idx} className="bg-apptivia-paper rounded-lg px-3 py-2">
                    <div className="text-xs font-medium text-apptivia-carbon-700">{s.skillset_key?.replace(/_/g, ' ')}</div>
                    <div className="text-xs text-apptivia-carbon-500">Level {s.level} · {s.mastery_label} · {s.current_xp} XP</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Achievements */}
          {review.achievements_earned?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><Award size={14} /> Achievements Earned ({review.achievements_earned.length})</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {review.achievements_earned.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-yellow-50 rounded-lg px-3 py-2">
                    <Trophy size={14} className="text-yellow-600" />
                    <div>
                      <div className="text-xs font-medium text-apptivia-ink">{a.name}</div>
                      <div className="text-[10px] text-apptivia-carbon-500">{a.category} · {a.tier}</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Badges */}
          {review.badges_earned?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><Award size={14} /> Badges Earned ({review.badges_earned.length})</h3>
              <div className="flex flex-wrap gap-2">
                {review.badges_earned.map((b, idx) => (
                  <div key={idx} className="bg-apptivia-coral-tone-50 rounded-lg px-3 py-2">
                    <div className="text-xs font-medium text-apptivia-coral-tone-700">{b.name}</div>
                    <div className="text-[10px] text-apptivia-coral">{b.tier}</div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Coaching Plans */}
          {review.coaching_plans_summary?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3">Coaching Plans</h3>
              <div className="space-y-2">
                {review.coaching_plans_summary.map((p, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-apptivia-paper rounded-lg px-3 py-2">
                    <span className="text-sm text-apptivia-ink">{p.name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      p.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-apptivia-carbon-100 text-apptivia-carbon-600'
                    }`}>{p.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* IDPs */}
          {review.idps_summary?.length > 0 && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3">Development Plans</h3>
              <div className="space-y-2">
                {review.idps_summary.map((i, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-apptivia-paper rounded-lg px-3 py-2">
                    <div>
                      <span className="text-sm text-apptivia-ink">{i.name}</span>
                      <span className="text-xs text-apptivia-carbon-500 ml-2">{i.milestones_completed}/{i.milestones_total} milestones</span>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${
                      i.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-apptivia-coral-tone-50 text-apptivia-coral'
                    }`}>{i.status}</span>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* ── SELF-ASSESSMENT ── */}
          {isRep && review.status === 'pending_self_assessment' && (
            <SelfAssessmentForm review={review} onSubmit={(data) => onTransition('self_assessment_submitted', data)} saving={saving} />
          )}

          {/* Display submitted self-assessment */}
          {review.rep_self_assessment && review.status !== 'pending_self_assessment' && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3 flex items-center gap-1.5"><FileText size={14} /> Self-Assessment</h3>
              <div className="bg-apptivia-coral-tone-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-apptivia-ink whitespace-pre-wrap">{review.rep_self_assessment}</p>
                {review.rep_accomplishments?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Key Accomplishments</div>
                    <ul className="space-y-1">{review.rep_accomplishments.map((a, i) => (
                      <li key={i} className="text-sm text-apptivia-carbon-700 flex items-start gap-1.5">
                        <CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" /> {a.text}
                      </li>
                    ))}</ul>
                  </div>
                )}
                {review.rep_challenges?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Challenges</div>
                    <ul className="space-y-1">{review.rep_challenges.map((c, i) => (
                      <li key={i} className="text-sm text-apptivia-carbon-700">• {c.text}</li>
                    ))}</ul>
                  </div>
                )}
                {review.rep_goals_next_period?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Goals for Next Period</div>
                    <ul className="space-y-1">{review.rep_goals_next_period.map((g, i) => (
                      <li key={i} className="text-sm text-apptivia-carbon-700">→ {g.text}</li>
                    ))}</ul>
                  </div>
                )}
                {review.rep_comments && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Comments</div>
                    <p className="text-sm text-apptivia-carbon-700">{review.rep_comments}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* ── MANAGER REVIEW FORM ── */}
          {isManager && (review.status === 'manager_review' || review.status === 'reopened') && (
            <section className="print-hidden">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-apptivia-ink">Manager Assessment</h3>
                {onGenerateAiDraft && (
                  <button
                    type="button"
                    onClick={async () => {
                      const draft = await onGenerateAiDraft();
                      if (draft) {
                        setMgrSummary(draft.manager_summary || '');
                        if (draft.strengths?.length) setMgrStrengths(draft.strengths);
                        if (draft.areas_for_improvement?.length) setMgrImprovements(draft.areas_for_improvement);
                        if (draft.goals_next_period?.length) setMgrGoals(draft.goals_next_period);
                        if (draft.suggested_rating) setMgrRating(draft.suggested_rating);
                        if (draft.final_summary) setFinalSummary(draft.final_summary);
                        if (draft.comments) setMgrComments(draft.comments);
                      }
                    }}
                    disabled={aiGenerating}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-apptivia-ink bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-carbon-100 disabled:opacity-50"
                  >
                    <Sparkles size={14} className={aiGenerating ? 'animate-spin' : ''} />
                    {aiGenerating ? 'Generating...' : 'Generate AI Draft'}
                  </button>
                )}
              </div>
              <div className="space-y-4 bg-apptivia-carbon-100 rounded-lg p-4 border border-apptivia-carbon-300 relative">
                {aiGenerating && (
                  <div className="absolute inset-0 bg-white/70 z-10 flex items-center justify-center rounded-lg">
                    <div className="flex items-center gap-2 text-apptivia-ink">
                      <Sparkles size={16} className="animate-spin" />
                      <span className="text-sm font-semibold">Generating AI assessment draft...</span>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs font-semibold text-apptivia-carbon-700 mb-1">Overall Summary</label>
                  <textarea value={mgrSummary} onChange={e => setMgrSummary(e.target.value)}
                    className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm" rows={3} placeholder="Overall assessment..." />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-apptivia-carbon-700">Strengths</label>
                    <button type="button" onClick={() => addItem(setMgrStrengths)} className="text-xs text-apptivia-coral"><Plus size={12} /> Add</button>
                  </div>
                  {mgrStrengths.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input value={item.text || ''} onChange={e => updateItem(setMgrStrengths, idx, e.target.value)}
                        className="flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-1.5 text-sm" placeholder="Strength..." />
                      {mgrStrengths.length > 1 && <button type="button" onClick={() => removeItem(setMgrStrengths, idx)} className="text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-apptivia-carbon-700">Areas for Improvement</label>
                    <button type="button" onClick={() => addItem(setMgrImprovements)} className="text-xs text-apptivia-coral"><Plus size={12} /> Add</button>
                  </div>
                  {mgrImprovements.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input value={item.text || ''} onChange={e => updateItem(setMgrImprovements, idx, e.target.value)}
                        className="flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-1.5 text-sm" placeholder="Area for improvement..." />
                      {mgrImprovements.length > 1 && <button type="button" onClick={() => removeItem(setMgrImprovements, idx)} className="text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-semibold text-apptivia-carbon-700">Goals for Next Period</label>
                    <button type="button" onClick={() => addItem(setMgrGoals)} className="text-xs text-apptivia-coral"><Plus size={12} /> Add</button>
                  </div>
                  {mgrGoals.map((item, idx) => (
                    <div key={idx} className="flex gap-2 mb-2">
                      <input value={item.text || ''} onChange={e => updateItem(setMgrGoals, idx, e.target.value)}
                        className="flex-1 border border-apptivia-carbon-300 rounded-md px-3 py-1.5 text-sm" placeholder="Goal..." />
                      {mgrGoals.length > 1 && <button type="button" onClick={() => removeItem(setMgrGoals, idx)} className="text-red-400"><Trash2 size={14} /></button>}
                    </div>
                  ))}
                </div>
                <div>
                  <label className="block text-xs font-semibold text-apptivia-carbon-700 mb-1">Manager Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} type="button" onClick={() => setMgrRating(i)}>
                        <Star size={24} className={i <= mgrRating ? 'text-yellow-400 fill-yellow-400' : 'text-apptivia-carbon-300 hover:text-yellow-200'} />
                      </button>
                    ))}
                    {mgrRating > 0 && <span className="text-sm text-apptivia-carbon-600 ml-2">{mgrRating}/5</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-apptivia-carbon-700 mb-1">Final Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} type="button" onClick={() => setFinalRating(i)}>
                        <Star size={24} className={i <= finalRating ? 'text-emerald-400 fill-emerald-400' : 'text-apptivia-carbon-300 hover:text-emerald-200'} />
                      </button>
                    ))}
                    {finalRating > 0 && <span className="text-sm text-apptivia-carbon-600 ml-2">{finalRating}/5</span>}
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-apptivia-carbon-700 mb-1">Final Summary</label>
                  <textarea value={finalSummary} onChange={e => setFinalSummary(e.target.value)}
                    className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm" rows={2} placeholder="Final summary..." />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-apptivia-carbon-700 mb-1">Comments</label>
                  <textarea value={mgrComments} onChange={e => setMgrComments(e.target.value)}
                    className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm" rows={2} placeholder="Additional comments..." />
                </div>
                <button onClick={handleManagerSave} disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-apptivia-ink rounded-md hover:bg-apptivia-ink disabled:opacity-50">
                  {saving ? 'Saving...' : 'Save Assessment'}
                </button>
              </div>
            </section>
          )}

          {/* Display saved manager assessment (read-only) */}
          {review.manager_summary && review.status !== 'manager_review' && review.status !== 'reopened' && (
            <section>
              <h3 className="text-sm font-semibold text-apptivia-ink mb-3">Manager Assessment</h3>
              <div className="bg-apptivia-carbon-100 rounded-lg p-4 space-y-3">
                <p className="text-sm text-apptivia-ink whitespace-pre-wrap">{review.manager_summary}</p>
                {review.manager_strengths?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Strengths</div>
                    <ul className="space-y-1">{review.manager_strengths.map((s, i) => (
                      <li key={i} className="text-sm text-apptivia-carbon-700 flex items-start gap-1.5"><CheckCircle2 size={12} className="text-green-500 mt-0.5 shrink-0" /> {s.text}</li>
                    ))}</ul>
                  </div>
                )}
                {review.manager_areas_for_improvement?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Areas for Improvement</div>
                    <ul className="space-y-1">{review.manager_areas_for_improvement.map((a, i) => (
                      <li key={i} className="text-sm text-apptivia-carbon-700">• {a.text}</li>
                    ))}</ul>
                  </div>
                )}
                {review.final_summary && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-700 mb-1">Final Summary</div>
                    <p className="text-sm text-apptivia-carbon-700">{review.final_summary}</p>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Acknowledgment */}
          {isRep && review.status === 'finalized' && (
            <section className="print-hidden">
              <div className="bg-green-50 rounded-lg p-4 border border-green-100">
                <h3 className="text-sm font-semibold text-green-900 mb-2">Acknowledge Review</h3>
                <p className="text-xs text-green-700 mb-3">By acknowledging, you confirm you have read and discussed this review with your manager.</p>
                <textarea value={ackComment} onChange={e => setAckComment(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-md px-3 py-2 text-sm mb-3" rows={2} placeholder="Optional comments..." />
                <button onClick={() => onAcknowledge(ackComment)} disabled={saving}
                  className="px-4 py-2 text-sm font-semibold text-white bg-green-600 rounded-md hover:bg-green-700 disabled:opacity-50">
                  {saving ? 'Processing...' : 'Acknowledge Review'}
                </button>
              </div>
            </section>
          )}

          {/* Show acknowledgment */}
          {review.acknowledged_at && (
            <section>
              <div className="bg-emerald-50 rounded-lg p-3 flex items-center gap-2">
                <CheckCircle2 size={16} className="text-emerald-600" />
                <span className="text-sm text-emerald-800">
                  Acknowledged on {new Date(review.acknowledged_at).toLocaleDateString()}
                  {review.acknowledgment_comment && ` — "${review.acknowledgment_comment}"`}
                </span>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
    </>
  );
}
