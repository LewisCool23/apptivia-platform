import React from 'react';
import { Target, Edit, Trash2, UserPlus, Users } from 'lucide-react';
import { statusConfig } from './planStatusConfig';

export default function PlanCard({
  plan,
  canCreatePlans,
  canManagePlans,
  assignmentStatuses,
  user,
  isPowerUser,
  getPlanStatus,
  onView,
  onEdit,
  onAssign,
  onDelete,
}) {
  const planStatus = getPlanStatus(plan);
  const isOverdue = plan.date_range_end && new Date() > new Date(plan.date_range_end) && planStatus !== 'completed';
  const displayStatus = isOverdue ? 'overdue' : planStatus;
  const cfg = statusConfig[displayStatus] || statusConfig.active;
  const StatusIcon = cfg.icon;

  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow flex flex-col">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h4 className="font-semibold text-gray-900 mb-1">{plan.name}</h4>
          <p className="text-xs text-gray-500">{new Date(plan.created_at).toLocaleDateString()}</p>
          {plan.date_range_start && plan.date_range_end && (
            <p className="text-xs text-gray-500">{plan.date_range_start} → {plan.date_range_end}</p>
          )}
        </div>
        <span className={`px-2 py-1 text-xs rounded-full ${
          plan.plan_type === 'auto' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
        }`}>
          {plan.plan_type === 'auto' ? 'Template' : 'Custom'}
        </span>
      </div>

      {/* Focus KPIs */}
      {plan.focus_kpis?.length > 0 && (
        <div className="mb-3">
          <div className="text-xs font-medium text-gray-500 mb-1">Focus KPIs:</div>
          <div className="flex flex-wrap gap-1">
            {plan.focus_kpis.slice(0, 2).map((kpi, idx) => (
              <span key={idx} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                {kpi.replace(/_/g, ' ')}
              </span>
            ))}
            {plan.focus_kpis.length > 2 && (
              <span className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                +{plan.focus_kpis.length - 2}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Status badge */}
      {plan.assigned_to?.length > 0 && (
        <div className="mb-3">
          <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${cfg.color}`}>
            <StatusIcon size={12} />
            {cfg.label}
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
          <span className="inline-flex items-center gap-1 px-2 py-1 bg-indigo-100 text-indigo-700 rounded-full text-xs font-medium">
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
          className="flex-1 flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-blue-600 border border-blue-600 rounded-md hover:bg-blue-50"
        >
          <Target size={14} />
          View
        </button>
        {canCreatePlans && (
          <button
            onClick={() => onEdit(plan)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
            title="Edit Plan"
          >
            <Edit size={14} />
          </button>
        )}
        {canManagePlans && (
          <button
            onClick={() => onAssign(plan)}
            className="flex items-center justify-center gap-1 px-3 py-1.5 text-xs font-semibold text-green-600 border border-green-600 rounded-md hover:bg-green-50"
            title="Assign to Members"
          >
            <UserPlus size={14} />
          </button>
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
