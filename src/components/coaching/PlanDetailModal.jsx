import React, { useMemo } from 'react';
import { X, Target, Users, UserPlus, TrendingUp, TrendingDown, BarChart3, Mail, Zap, ClipboardCheck, MessageSquare } from 'lucide-react';
import { statusConfig } from './planStatusConfig';
import { parseEnrichedContent } from '../../utils/emailTemplates';
import FeedbackThumb from '../shared/FeedbackThumb';
import { scoreTextColor } from '../../constants/scoreColors';
import { buildLabel } from '../../constants/kpiGuidance';
import { useModalBehavior } from '../../hooks/useModalBehavior';

export default function PlanDetailModal({
  plan,
  onClose,
  canCreatePlans,
  canManagePlans,
  assignmentStatuses,
  assignmentEffectiveness,
  teamMembers,
  user,
  isPowerUser,
  getMyAssignmentStatus,
  handleStatusChange,
  onEdit,
  onAssign,
  onShare,
}) {
  useModalBehavior(!!plan, onClose);
  const myStatus = getMyAssignmentStatus(plan);
  const myCfg = statusConfig[myStatus] || statusConfig.active;
  const MyStatusIcon = myCfg.icon;

  // Aggregate effectiveness across all completed assignments
  const planEffectiveness = useMemo(() => {
    const effData = assignmentEffectiveness?.[plan.id];
    if (!effData) return null;
    const entries = Object.entries(effData).filter(([, d]) => d.score != null);
    if (entries.length === 0) return null;
    const avgScore = Math.round(entries.reduce((s, [, d]) => s + d.score, 0) / entries.length);
    return { avgScore, entries };
  }, [assignmentEffectiveness, plan.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-apptivia-coral-tone-50 rounded-lg">
              <Target className="w-5 h-5 text-apptivia-coral" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-apptivia-ink">{plan.name}</h3>
              {(plan.date_range_start || plan.date_range_end) && (
                <p className="text-sm text-apptivia-carbon-500 mt-0.5">
                  {plan.date_range_start || '—'} to {plan.date_range_end || '—'}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-apptivia-carbon-100 rounded-lg transition-colors">
            <X size={20} className="text-apptivia-carbon-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Goals */}
          {plan.goals?.length > 0 && (
            <div className="mb-4 p-4 bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <Target size={16} className="text-apptivia-coral" />
                Goals
              </h4>
              <ul className="space-y-1.5">
                {plan.goals.map((goal, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-apptivia-carbon-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-apptivia-coral-tone-50 text-apptivia-coral flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</span>
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Focus KPIs */}
          {plan.focus_kpis?.length > 0 && (
            <div className="mb-4 p-4 bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <BarChart3 size={16} className="text-apptivia-ink" />
                Focus KPIs
              </h4>
              <div className="flex flex-wrap gap-2">
                {plan.focus_kpis.map((kpi, idx) => (
                  <span key={idx} className="px-3 py-1 bg-white text-apptivia-ink rounded-full text-sm font-medium border border-apptivia-carbon-300">
                    {buildLabel(kpi)}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Action Items */}
          {plan.action_items?.length > 0 && (
            <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <ClipboardCheck size={16} className="text-green-600" />
                Action Items
              </h4>
              <ol className="space-y-1.5">
                {plan.action_items.map((action, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-apptivia-carbon-700">
                    <span className="mt-0.5 w-5 h-5 rounded-full bg-green-100 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">{idx + 1}</span>
                    {action}
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* Success Metrics */}
          {plan.success_metrics?.length > 0 && (
            <div className="mb-4 p-4 bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <TrendingUp size={16} className="text-apptivia-ink" />
                Success Metrics
              </h4>
              <ul className="space-y-1.5">
                {plan.success_metrics.map((metric, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-apptivia-carbon-700">
                    <span className="mt-1 w-1.5 h-1.5 rounded-full bg-apptivia-ink flex-shrink-0" />
                    {metric}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {plan.notes && (
            <div className="mb-4 p-4 bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <MessageSquare size={16} className="text-apptivia-carbon-500" />
                Notes
              </h4>
              <p className="text-sm text-apptivia-carbon-700 whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}

          <div className="flex justify-end px-1 pb-2">
            <FeedbackThumb featureArea="ai_coaching_plan" contentKey={plan.id} context={{ planId: plan.id, planType: plan.plan_type, type: 'plan_detail' }} />
          </div>

          {/* Enriched Coaching Context (saved at plan creation) — hidden from power users on team-visibility plans */}
          {(() => {
            const enriched = parseEnrichedContent(plan.content);
            if (!enriched) return null;
            if (isPowerUser && plan.visibility === 'team') return null;
            const ctx = enriched.context;
            return (
              <div className="mb-4 p-4 bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg">
                <h4 className="font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                  <BarChart3 size={16} className="text-apptivia-coral" />
                  Coaching Context (at time of creation)
                </h4>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="text-center bg-white rounded-lg p-3 border border-apptivia-coral-tone-100">
                    <div className="text-2xl font-bold text-apptivia-coral">{ctx.currentScore}%</div>
                    <div className="text-xs text-apptivia-carbon-500">Score at Creation</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-3 border border-apptivia-coral-tone-100">
                    <div className="text-2xl font-bold text-red-500">{ctx.laggingKpis?.length || 0}</div>
                    <div className="text-xs text-apptivia-carbon-500">Lagging KPIs</div>
                  </div>
                  <div className="text-center bg-white rounded-lg p-3 border border-apptivia-coral-tone-100">
                    <div className="text-2xl font-bold text-green-500">{ctx.exceedingCount || 0}</div>
                    <div className="text-xs text-apptivia-carbon-500">Exceeding</div>
                  </div>
                </div>
                {ctx.laggingKpis?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <div className="text-xs font-semibold text-apptivia-carbon-500 uppercase tracking-wide">Lagging KPIs</div>
                    {ctx.laggingKpis.map(kpi => (
                      <div key={kpi.key} className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-apptivia-carbon-100">
                        <span className="text-apptivia-carbon-700">{kpi.label}</span>
                        <span className={`font-semibold ${scoreTextColor(kpi.percentage)}`}>
                          {kpi.percentage}%
                        </span>
                      </div>
                    ))}
                  </div>
                )}
                {ctx.prioritySkillsets?.length > 0 && (
                  <div className="space-y-1 mb-3">
                    <div className="text-xs font-semibold text-apptivia-carbon-500 uppercase tracking-wide">Priority Skillsets</div>
                    {ctx.prioritySkillsets.map(s => (
                      <div key={s.name} className="flex items-center justify-between text-sm bg-white rounded px-3 py-1.5 border border-apptivia-carbon-100">
                        <span className="text-apptivia-carbon-700">{s.name}</span>
                        <span className="text-apptivia-coral font-semibold">{Math.round(s.progress)}%</span>
                      </div>
                    ))}
                  </div>
                )}
                {ctx.xpEstimate?.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-apptivia-carbon-500 uppercase tracking-wide mb-1">Estimated XP Gain</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ctx.xpEstimate.map(item => (
                        <span key={item.skillset} className="inline-flex items-center gap-1 px-2.5 py-1 bg-yellow-50 text-yellow-700 rounded-full text-xs font-semibold border border-yellow-200">
                          <Zap size={10} />
                          ~{item.estimatedXp} {item.skillset} XP
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Skillset Impact Review */}
          {(() => {
            const enriched = parseEnrichedContent(plan.content);
            const impact = enriched?.context?.skillsetImpact;
            if (!impact?.projected?.length) return null;
            return (
              <div className="mb-4 p-4 bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-lg">
                <h4 className="font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                  <Zap size={16} className="text-apptivia-ink" />
                  Skillset Impact Review
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {impact.projected.map(s => {
                    const current = (impact.current || []).find(c => c.skillset_key === s.skillset.toLowerCase().replace(/\s+/g, '_'));
                    const currentXp = current?.current_xp || 0;
                    return (
                      <div key={s.skillset} className="flex items-center gap-2 text-xs bg-white rounded-md px-3 py-2 border border-apptivia-carbon-300">
                        <span className={`w-2 h-2 rounded-full ${s.color || 'bg-apptivia-ink'}`} />
                        <span className="font-medium text-apptivia-ink">{s.skillset}</span>
                        <span className="text-apptivia-carbon-400 ml-auto">{currentXp} XP</span>
                        <span className="text-apptivia-ink font-semibold">+{s.estimatedXp}</span>
                      </div>
                    );
                  })}
                </div>
                <p className="text-[10px] text-apptivia-ink mt-2">Estimated XP gain from completing this plan's focus KPIs</p>
              </div>
            );
          })()}

          {/* Assignment status for power_users */}
          {isPowerUser && plan.assigned_to?.includes(user?.id) && (
            <div className="mb-4 p-4 bg-apptivia-carbon-100 border border-apptivia-carbon-300 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-2 flex items-center gap-2">
                <UserPlus size={16} />
                Your Assignment Status
              </h4>
              <div className="mb-3">
                <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium ${myCfg.color}`}>
                  <MyStatusIcon size={14} />
                  Current: {myCfg.label}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                {myStatus === 'draft' && (
                  <button
                    onClick={() => handleStatusChange(plan, 'in_progress')}
                    className="px-3 py-1.5 text-xs font-semibold rounded-md transition-colors bg-yellow-500 text-white hover:bg-yellow-600"
                  >
                    Mark In Progress
                  </button>
                )}
                <button
                  onClick={() => handleStatusChange(plan, 'completed')}
                  disabled={myStatus === 'completed'}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    myStatus === 'completed'
                      ? 'bg-green-200 text-green-800 cursor-default'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  Mark Completed
                </button>
              </div>
            </div>
          )}

          {/* Manager assignment overview */}
          {canManagePlans && plan.assigned_to?.length > 0 && (
            <div className="mb-4 p-4 bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                <Users size={16} />
                Assignment Overview
              </h4>
              <div className="space-y-2">
                {plan.assigned_to.map(memberId => {
                  const member = teamMembers.find(m => m.id === memberId);
                  const memberName = member
                    ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email
                    : 'Unknown Member';
                  const memberStatus = assignmentStatuses[plan.id]?.[memberId] || 'active';
                  const isOverdue = plan.date_range_end && new Date() > new Date(plan.date_range_end) && memberStatus !== 'completed';
                  const displayStatus = isOverdue ? 'overdue' : memberStatus;
                  const cfg = statusConfig[displayStatus] || statusConfig.active;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={memberId} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-apptivia-carbon-100">
                      <span className="text-sm text-apptivia-ink">{memberName}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                        <StatusIcon size={11} />
                        {cfg.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Plan Effectiveness — shown when at least one assignee has completed with effectiveness data */}
          {planEffectiveness && (
            <div className="mb-4 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <h4 className="font-semibold text-apptivia-ink mb-3 flex items-center gap-2">
                <BarChart3 size={16} className="text-emerald-600" />
                Plan Effectiveness
                <span className={`ml-auto inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold ${
                  planEffectiveness.avgScore >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                }`}>
                  {planEffectiveness.avgScore >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                  {planEffectiveness.avgScore >= 0 ? '+' : ''}{planEffectiveness.avgScore}% avg improvement
                </span>
              </h4>
              <div className="space-y-3">
                {planEffectiveness.entries.map(([memberId, data]) => {
                  const member = teamMembers.find(m => m.id === memberId);
                  const memberName = member
                    ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email
                    : 'Unknown Member';
                  return (
                    <div key={memberId} className="border border-emerald-100 rounded-lg p-3 bg-white">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-medium text-apptivia-ink">{memberName}</span>
                        <span className={`text-xs font-bold ${data.score >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                          {data.score >= 0 ? '+' : ''}{data.score}%
                        </span>
                      </div>
                      {data.baseline && data.final && plan.focus_kpis?.length > 0 && (
                        <div className="space-y-1">
                          {plan.focus_kpis.map(kpi => {
                            const b = data.baseline[kpi];
                            const f = data.final[kpi];
                            if (!b && !f) return null;
                            const delta = (f?.pct || 0) - (b?.pct || 0);
                            return (
                              <div key={kpi} className="flex items-center justify-between text-xs">
                                <span className="text-apptivia-carbon-600">{buildLabel(kpi)}</span>
                                <div className="flex items-center gap-2">
                                  <span className="text-apptivia-carbon-400">{b?.pct || 0}%</span>
                                  <span className="text-apptivia-carbon-300">&rarr;</span>
                                  <span className="font-medium text-apptivia-ink">{f?.pct || 0}%</span>
                                  <span className={`font-bold ${delta >= 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                    ({delta >= 0 ? '+' : ''}{delta})
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-apptivia-carbon-200 p-4 flex justify-end gap-2">
          {canCreatePlans && (
            <button
              onClick={() => { onClose(); onEdit(plan); }}
              className="px-4 py-2 text-sm font-semibold border border-apptivia-coral text-apptivia-coral rounded-md hover:bg-apptivia-coral-tone-50"
            >
              Edit Plan
            </button>
          )}
          {canManagePlans && plan.visibility !== 'team' && (
            <button
              onClick={() => { onClose(); onAssign(plan); }}
              className="px-4 py-2 text-sm font-semibold border border-green-600 text-green-600 rounded-md hover:bg-green-50"
            >
              Assign Plan
            </button>
          )}
          {(canCreatePlans || canManagePlans) && (
            <button
              onClick={() => { onClose(); onShare(plan); }}
              className="flex items-center gap-1.5 px-4 py-2 text-sm font-semibold border border-apptivia-coral-tone-100 text-apptivia-coral rounded-md hover:bg-apptivia-coral-tone-50"
            >
              <Mail size={14} />
              Email
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-apptivia-carbon-300 text-apptivia-carbon-700 rounded-md hover:bg-apptivia-paper">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
