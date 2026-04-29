import React, { useMemo } from 'react';
import { Target, Edit, Trash2, UserPlus, Users, TrendingUp, TrendingDown, Mail, Share2 } from 'lucide-react';
import { statusConfig } from './planStatusConfig';
import { estimateSkillsetXp } from '../../constants/skillsets';
import { parseEnrichedContent } from '../../utils/emailTemplates';
import { buildLabel } from '../../constants/kpiGuidance';

export default function PlanCard({
  plan,
  canCreatePlans,
  canManagePlans,
  assignmentStatuses,
  assignmentEffectiveness,
  user,
  isPowerUser,
  getPlanStatus,
  onView,
  onEdit,
  onAssign,
  onDelete,
  onShare,
  onSnapshot,
}) {
  const planStatus = getPlanStatus(plan);
  const isOverdue = plan.date_range_end && new Date() > new Date(plan.date_range_end) && planStatus !== 'completed';
  const displayStatus = isOverdue ? 'overdue' : planStatus;
  const xpEstimate = plan.focus_kpis?.length > 0 ? estimateSkillsetXp(plan.focus_kpis) : [];
  const cfg = statusConfig[displayStatus] || statusConfig.active;
  const StatusIcon = cfg.icon;

  // Aggregate effectiveness score across completed assignments
  const effScore = useMemo(() => {
    const effData = assignmentEffectiveness?.[plan.id];
    if (!effData) return null;
    const scores = Object.values(effData).filter(d => d.score != null).map(d => d.score);
    if (scores.length === 0) return null;
    return Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  }, [assignmentEffectiveness, plan.id]);

  return (
    <div className={`border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col border-l-4 ${cfg.borderColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-apptivia-ink mb-1">{plan.name}</h4>
          <p className="text-xs text-apptivia-carbon-500">{new Date(plan.created_at).toLocaleDateString()}</p>
          {plan.date_range_start && plan.date_range_end && (
            <p className="text-xs text-apptivia-carbon-500">{plan.date_range_start} → {plan.date_range_end}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          {plan.visibility === 'team' && (
            <span className="px-2 py-0.5 text-[10px] rounded-full bg-amber-100 text-amber-700 font-semibold">
              Playbook
            </span>
          )}
          <span className={`px-2 py-0.5 text-[10px] rounded-full ${
            plan.plan_type === 'auto' ? 'bg-apptivia-coral-tone-50 text-apptivia-coral' : 'bg-apptivia-carbon-100 text-apptivia-ink'
          }`}>
            {plan.plan_type === 'auto' ? 'Template' : 'Custom'}
          </span>
        </div>
      </div>

      {/* Focus KPIs */}
      {plan.focus_kpis?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-apptivia-carbon-500 mb-1">Focus KPIs:</div>
          <div className="flex flex-wrap gap-1">
            {plan.focus_kpis.slice(0, 2).map((kpi, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded text-xs">
                {buildLabel(kpi)}
              </span>
            ))}
            {plan.focus_kpis.length > 2 && (
              <span className="px-2 py-0.5 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded text-xs">
                +{plan.focus_kpis.length - 2}
              </span>
            )}
          </div>
        </div>
      )}

      {/* XP Estimate */}
      {xpEstimate.length > 0 && (
        <div className="mb-3">
          <div className="flex flex-wrap gap-1">
            {xpEstimate.slice(0, 3).map(item => (
              <span key={item.skillset} className="px-2 py-0.5 bg-yellow-50 text-yellow-700 rounded text-[10px] font-medium">
                ~{item.estimatedXp} {item.skillset} XP
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Enriched context preview */}
      {(() => {
        const enriched = parseEnrichedContent(plan.content);
        if (!enriched) return null;
        const ctx = enriched.context;
        const totalXp = ctx.xpEstimate?.reduce((s, e) => s + e.estimatedXp, 0) || 0;
        return (
          <div className="mb-3 text-xs text-apptivia-carbon-500">
            <span className="font-medium">{ctx.currentScore}% score</span>
            {ctx.laggingKpis?.length > 0 && (
              <span> · {ctx.laggingKpis.length} lagging KPI{ctx.laggingKpis.length !== 1 ? 's' : ''}</span>
            )}
            {totalXp > 0 && (
              <span> · ~{totalXp} XP potential</span>
            )}
          </div>
        );
      })()}

      {/* Status badge */}
      {plan.assigned_to?.length > 0 && (
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
            <StatusIcon size={12} />
            {cfg.label}
          </span>
        </div>
      )}

      {/* Effectiveness badge (completed plans only) */}
      {effScore != null && (
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-bold ${
            effScore >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
          }`}>
            {effScore >= 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
            {effScore >= 0 ? '+' : ''}{effScore}% improvement
          </span>
        </div>
      )}

      {/* Assignment count */}
      {plan.assigned_to?.length > 0 && (
        <div className="mb-3 flex items-center gap-1.5">
          <Users size={12} className="text-green-600" />
          <span className="text-xs text-green-700 font-medium">
            Assigned to {plan.assigned_to.length} member{plan.assigned_to.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* Power user "assigned to you" badge */}
      {isPowerUser && plan.assigned_to?.includes(user?.id) && (
        <div className="mb-3">
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-apptivia-carbon-100 text-apptivia-ink rounded-full text-xs font-medium">
            <UserPlus size={12} />
            Assigned to you
          </span>
        </div>
      )}

      <div className="flex-grow" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onView(plan)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-coral border border-blue-600 rounded-md hover:bg-apptivia-coral-tone-50"
        >
          <Target size={14} />
          View
        </button>
        {canCreatePlans && (
          <button
            onClick={() => onEdit(plan)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-carbon-600 border border-gray-300 rounded-md hover:bg-apptivia-paper"
            title="Edit Plan"
          >
            <Edit size={14} />
          </button>
        )}
        {canManagePlans && plan.visibility !== 'team' && (
          <button
            onClick={() => onAssign(plan)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-600 border border-green-600 rounded-md hover:bg-green-50"
            title="Assign to Members"
          >
            <UserPlus size={14} />
          </button>
        )}
        {(canCreatePlans || canManagePlans) && (
          <>
            <button
              onClick={() => onSnapshot && onSnapshot(plan)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-ink border border-indigo-300 rounded-md hover:bg-apptivia-carbon-100"
              title="Share Snapshot"
            >
              <Share2 size={14} />
            </button>
            <button
              onClick={() => onShare(plan)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-coral border border-blue-300 rounded-md hover:bg-apptivia-coral-tone-50"
              title="Share via Email"
            >
              <Mail size={14} />
            </button>
          </>
        )}
        {canCreatePlans && (
          <button
            onClick={() => onDelete(plan)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-md hover:bg-red-50"
            title="Delete Plan"
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
