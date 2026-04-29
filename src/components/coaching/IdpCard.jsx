import React from 'react';
import { Target, Edit, Trash2, Calendar, CheckCircle2 } from 'lucide-react';
import { idpStatusConfig, idpPlanTypes } from './idpStatusConfig';
import { buildLabel } from '../../constants/kpiGuidance';

export default function IdpCard({ idp, canManage, onView, onEdit, onDelete }) {
  const isOverdue = idp.period_end && new Date() > new Date(idp.period_end) && idp.status !== 'completed' && idp.status !== 'cancelled';
  const displayStatus = isOverdue ? 'overdue' : idp.status;
  const cfg = idpStatusConfig[displayStatus] || idpStatusConfig.draft;
  const StatusIcon = cfg.icon;
  const typeLabel = idpPlanTypes[idp.plan_type]?.label || idp.plan_type;

  const completedMilestones = (idp.milestones || []).filter(m => m.status === 'completed').length;
  const totalMilestones = (idp.milestones || []).length;
  const milestoneProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  return (
    <div className={`border border-apptivia-carbon-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col border-l-4 ${cfg.borderColor}`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-apptivia-ink mb-1">{idp.name}</h4>
          {idp.description && (
            <p className="text-xs text-apptivia-carbon-500 line-clamp-2 mb-1">{idp.description}</p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
            idp.plan_type === 'annual' ? 'bg-apptivia-carbon-100 text-apptivia-ink' : 'bg-apptivia-coral-tone-50 text-apptivia-coral'
          }`}>
            {typeLabel}
          </span>
        </div>
      </div>

      {/* Date range */}
      {idp.period_start && idp.period_end && (
        <div className="flex items-center gap-1.5 mb-2 text-xs text-apptivia-carbon-500">
          <Calendar size={12} />
          <span>{new Date(idp.period_start).toLocaleDateString()} — {new Date(idp.period_end).toLocaleDateString()}</span>
        </div>
      )}

      {/* Focus KPIs */}
      {idp.focus_kpis?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-apptivia-carbon-500 mb-1">Focus KPIs:</div>
          <div className="flex flex-wrap gap-1">
            {idp.focus_kpis.slice(0, 3).map((kpi, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded text-xs">
                {buildLabel(kpi)}
              </span>
            ))}
            {idp.focus_kpis.length > 3 && (
              <span className="px-2 py-0.5 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded text-xs">
                +{idp.focus_kpis.length - 3}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Milestone progress */}
      {totalMilestones > 0 && (
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs font-medium text-apptivia-carbon-500">Milestones</span>
            <span className="text-xs text-apptivia-carbon-600">{completedMilestones}/{totalMilestones}</span>
          </div>
          <div className="w-full bg-apptivia-carbon-200 rounded-full h-1.5">
            <div
              className="bg-apptivia-coral h-1.5 rounded-full transition-all"
              style={{ width: `${milestoneProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Status badge */}
      <div className="mb-3">
        <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
          <StatusIcon size={12} />
          {cfg.label}
        </span>
      </div>

      <div className="flex-grow" />

      {/* Actions */}
      <div className="flex gap-2">
        <button
          onClick={() => onView(idp)}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-coral border border-apptivia-coral rounded-md hover:bg-apptivia-coral-tone-50"
        >
          <Target size={14} />
          View
        </button>
        {canManage && (
          <>
            <button
              onClick={() => onEdit(idp)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-apptivia-carbon-600 border border-apptivia-carbon-300 rounded-md hover:bg-apptivia-paper"
              title="Edit IDP"
            >
              <Edit size={14} />
            </button>
            <button
              onClick={() => onDelete(idp)}
              className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-red-600 border border-red-300 rounded-md hover:bg-red-50"
              title="Delete IDP"
            >
              <Trash2 size={14} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
