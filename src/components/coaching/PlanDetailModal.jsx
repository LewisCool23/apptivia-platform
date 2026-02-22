import React from 'react';
import { X, Target, Users, UserPlus } from 'lucide-react';
import { statusConfig } from './planStatusConfig';

export default function PlanDetailModal({
  plan,
  onClose,
  canCreatePlans,
  canManagePlans,
  assignmentStatuses,
  teamMembers,
  user,
  isPowerUser,
  getMyAssignmentStatus,
  handleStatusChange,
  onEdit,
  onAssign,
}) {
  const myStatus = getMyAssignmentStatus(plan);
  const myCfg = statusConfig[myStatus] || statusConfig.active;
  const MyStatusIcon = myCfg.icon;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Target className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-gray-900">{plan.name}</h3>
              {plan.date_range_start && plan.date_range_end && (
                <p className="text-sm text-gray-500 mt-0.5">
                  {plan.date_range_start} to {plan.date_range_end}
                </p>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <X size={20} className="text-gray-400" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {plan.goals?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Goals</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {plan.goals.map((goal, idx) => <li key={idx}>{goal}</li>)}
              </ul>
            </div>
          )}

          {plan.focus_kpis?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Focus KPIs</h4>
              <div className="flex flex-wrap gap-2">
                {plan.focus_kpis.map((kpi, idx) => (
                  <span key={idx} className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-medium">
                    {kpi.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                  </span>
                ))}
              </div>
            </div>
          )}

          {plan.action_items?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Action Items</h4>
              <ol className="list-decimal list-inside text-sm text-gray-700 space-y-1">
                {plan.action_items.map((action, idx) => <li key={idx}>{action}</li>)}
              </ol>
            </div>
          )}

          {plan.success_metrics?.length > 0 && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Success Metrics</h4>
              <ul className="list-disc list-inside text-sm text-gray-700 space-y-1">
                {plan.success_metrics.map((metric, idx) => <li key={idx}>{metric}</li>)}
              </ul>
            </div>
          )}

          {plan.notes && (
            <div className="mb-4">
              <h4 className="font-semibold text-gray-900 mb-2">Notes</h4>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{plan.notes}</p>
            </div>
          )}

          {/* Assignment status for power_users */}
          {isPowerUser && plan.assigned_to?.includes(user?.id) && (
            <div className="mb-4 p-4 bg-indigo-50 border border-indigo-200 rounded-lg">
              <h4 className="font-semibold text-indigo-900 mb-2 flex items-center gap-2">
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
                <button
                  onClick={() => handleStatusChange(plan, 'in_progress')}
                  disabled={myStatus === 'in_progress'}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                    myStatus === 'in_progress'
                      ? 'bg-yellow-200 text-yellow-800 cursor-default'
                      : 'bg-blue-600 text-white hover:bg-blue-700'
                  }`}
                >
                  Mark In Progress
                </button>
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
            <div className="mb-4 p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Users size={16} />
                Assignment Overview
              </h4>
              <div className="space-y-2">
                {plan.assigned_to.map(memberId => {
                  const member = teamMembers.find(m => m.id === memberId);
                  const memberName = member
                    ? `${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email
                    : memberId.slice(0, 8);
                  const memberStatus = assignmentStatuses[plan.id]?.[memberId] || 'active';
                  const isOverdue = plan.date_range_end && new Date() > new Date(plan.date_range_end) && memberStatus !== 'completed';
                  const displayStatus = isOverdue ? 'overdue' : memberStatus;
                  const cfg = statusConfig[displayStatus] || statusConfig.active;
                  const StatusIcon = cfg.icon;
                  return (
                    <div key={memberId} className="flex items-center justify-between py-1.5 px-2 rounded-md hover:bg-gray-100">
                      <span className="text-sm text-gray-800">{memberName}</span>
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
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 p-4 flex justify-end gap-2">
          {canCreatePlans && (
            <button
              onClick={() => { onClose(); onEdit(plan); }}
              className="px-4 py-2 text-sm font-semibold border border-blue-600 text-blue-600 rounded-md hover:bg-blue-50"
            >
              Edit Plan
            </button>
          )}
          {canManagePlans && (
            <button
              onClick={() => { onClose(); onAssign(plan); }}
              className="px-4 py-2 text-sm font-semibold border border-green-600 text-green-600 rounded-md hover:bg-green-50"
            >
              Assign Plan
            </button>
          )}
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50">
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
