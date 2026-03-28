import React from 'react';
import { X, Target, Calendar, CheckCircle2, Circle, Clock, BookOpen, Award, ArrowRight } from 'lucide-react';
import { idpStatusConfig, idpPlanTypes } from './idpStatusConfig';
import { buildLabel } from '../../constants/kpiGuidance';

const levelColors = {
  none: 'bg-gray-200 text-gray-600',
  beginner: 'bg-blue-100 text-blue-700',
  intermediate: 'bg-yellow-100 text-yellow-700',
  proficient: 'bg-green-100 text-green-700',
  advanced: 'bg-purple-100 text-purple-700',
};

export default function IdpDetailModal({ idp, onClose, onStatusChange, onMilestoneToggle, canManage }) {
  if (!idp) return null;

  const isOverdue = idp.period_end && new Date() > new Date(idp.period_end) && idp.status !== 'completed' && idp.status !== 'cancelled';
  const displayStatus = isOverdue ? 'overdue' : idp.status;
  const cfg = idpStatusConfig[displayStatus] || idpStatusConfig.draft;
  const StatusIcon = cfg.icon;

  const completedMilestones = (idp.milestones || []).filter(m => m.status === 'completed').length;
  const totalMilestones = (idp.milestones || []).length;
  const milestoneProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : 0;

  const milestoneStatusIcon = (status) => {
    if (status === 'completed') return <CheckCircle2 size={14} className="text-green-500" />;
    if (status === 'in_progress') return <Clock size={14} className="text-yellow-500" />;
    return <Circle size={14} className="text-gray-300" />;
  };

  const categoryColors = {
    training: 'bg-blue-50 text-blue-700',
    on_the_job: 'bg-amber-50 text-amber-700',
    practice: 'bg-green-50 text-green-700',
    coaching: 'bg-purple-50 text-purple-700',
    habit: 'bg-rose-50 text-rose-700',
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-3xl mx-4 mb-10">
        {/* Header */}
        <div className="p-6 border-b flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h2 className="text-lg font-bold text-gray-900">{idp.name}</h2>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${cfg.color}`}>
                <StatusIcon size={12} /> {cfg.label}
              </span>
              <span className={`px-2 py-0.5 text-[10px] rounded-full font-semibold ${
                idp.plan_type === 'annual' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'
              }`}>
                {idpPlanTypes[idp.plan_type]?.label || idp.plan_type}
              </span>
            </div>
            {idp.description && <p className="text-sm text-gray-600">{idp.description}</p>}
            {idp.period_start && idp.period_end && (
              <div className="flex items-center gap-1.5 mt-2 text-xs text-gray-500">
                <Calendar size={12} />
                <span>{new Date(idp.period_start).toLocaleDateString()} — {new Date(idp.period_end).toLocaleDateString()}</span>
              </div>
            )}
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6 space-y-6">
          {/* Status actions */}
          {canManage && (
            <div className="flex flex-wrap gap-2">
              {idp.status === 'draft' && (
                <button onClick={() => onStatusChange('active')} className="px-3 py-1.5 text-xs font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700">Activate Plan</button>
              )}
              {idp.status === 'active' && (
                <>
                  <button onClick={() => onStatusChange('in_progress')} className="px-3 py-1.5 text-xs font-semibold text-yellow-700 bg-yellow-100 rounded-md hover:bg-yellow-200">Mark In Progress</button>
                  <button onClick={() => onStatusChange('completed')} className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 rounded-md hover:bg-green-200">Mark Complete</button>
                  <button onClick={() => onStatusChange('cancelled')} className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                </>
              )}
              {idp.status === 'in_progress' && (
                <>
                  <button onClick={() => onStatusChange('completed')} className="px-3 py-1.5 text-xs font-semibold text-green-700 bg-green-100 rounded-md hover:bg-green-200">Mark Complete</button>
                  <button onClick={() => onStatusChange('cancelled')} className="px-3 py-1.5 text-xs font-semibold text-gray-500 bg-gray-100 rounded-md hover:bg-gray-200">Cancel</button>
                </>
              )}
            </div>
          )}

          {/* Focus KPIs */}
          {idp.focus_kpis?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Target size={14} /> Focus KPIs</h3>
              <div className="flex flex-wrap gap-2">
                {idp.focus_kpis.map((kpi, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">{buildLabel(kpi)}</span>
                ))}
              </div>
            </div>
          )}

          {/* Career Goals */}
          {idp.career_goals?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><Award size={14} /> Career Goals</h3>
              <div className="space-y-2">
                {idp.career_goals.map((g, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800">{g.goal}</span>
                    {g.timeframe && <span className="text-xs text-gray-500 ml-2">{g.timeframe}</span>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Development Areas */}
          {idp.development_areas?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Development Areas</h3>
              <div className="space-y-2">
                {idp.development_areas.map((d, idx) => (
                  <div key={idx} className="flex items-center gap-3 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="text-sm text-gray-800 flex-1">{d.area}</span>
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[d.current_level] || levelColors.beginner}`}>
                      {d.current_level}
                    </span>
                    <ArrowRight size={12} className="text-gray-400" />
                    <span className={`px-2 py-0.5 rounded text-xs font-medium ${levelColors[d.target_level] || levelColors.intermediate}`}>
                      {d.target_level}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Milestones */}
          {totalMilestones > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900">Milestones ({completedMilestones}/{totalMilestones})</h3>
                <span className="text-xs text-gray-500">{milestoneProgress}% complete</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${milestoneProgress}%` }} />
              </div>
              <div className="space-y-2">
                {idp.milestones.map((m, idx) => {
                  const nextStatus = m.status === 'pending' ? 'in_progress' : m.status === 'in_progress' ? 'completed' : 'pending';
                  return (
                    <div
                      key={idx}
                      className={`flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2 ${onMilestoneToggle ? 'cursor-pointer hover:bg-gray-100 transition-colors' : ''}`}
                      onClick={() => onMilestoneToggle && onMilestoneToggle(idx, nextStatus)}
                      title={onMilestoneToggle ? `Click to mark ${nextStatus.replace('_', ' ')}` : undefined}
                    >
                      {milestoneStatusIcon(m.status)}
                      <span className={`text-sm flex-1 ${m.status === 'completed' ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{m.title}</span>
                      {m.target_date && (
                        <span className="text-xs text-gray-400">{new Date(m.target_date).toLocaleDateString()}</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Action Items */}
          {idp.action_items?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Action Items</h3>
              <div className="space-y-2">
                {idp.action_items.map((a, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${categoryColors[a.category] || categoryColors.practice}`}>
                      {(a.category || 'practice').replace('_', ' ')}
                    </span>
                    <span className="text-sm text-gray-700">{a.action}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Resources */}
          {idp.resources?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2 flex items-center gap-1.5"><BookOpen size={14} /> Resources</h3>
              <div className="space-y-2">
                {idp.resources.map((r, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-indigo-50 text-indigo-700">{r.type}</span>
                    <span className="text-sm text-gray-700">{r.title}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Success Criteria */}
          {idp.success_criteria?.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-2">Success Criteria</h3>
              <ul className="space-y-1">
                {idp.success_criteria.map((s, idx) => (
                  <li key={idx} className="flex items-start gap-2 text-sm text-gray-700">
                    <CheckCircle2 size={14} className="text-green-400 mt-0.5 shrink-0" />
                    {s.criterion}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Notes */}
          {idp.notes && (
            <div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1">Notes</h3>
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{idp.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
