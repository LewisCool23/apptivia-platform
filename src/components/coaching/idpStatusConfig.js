import { CheckCircle, Clock, AlertTriangle, Play, XCircle } from 'lucide-react';

export const idpStatusConfig = {
  draft:       { label: 'Draft',       color: 'bg-gray-100 text-gray-700',     icon: Clock,         borderColor: 'border-l-gray-400' },
  active:      { label: 'Active',      color: 'bg-blue-100 text-blue-700',     icon: Play,          borderColor: 'border-l-blue-500' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock,         borderColor: 'border-l-yellow-500' },
  completed:   { label: 'Completed',   color: 'bg-green-100 text-green-700',   icon: CheckCircle,   borderColor: 'border-l-green-500' },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700',       icon: AlertTriangle, borderColor: 'border-l-red-500' },
  cancelled:   { label: 'Cancelled',   color: 'bg-slate-100 text-slate-500',   icon: XCircle,       borderColor: 'border-l-slate-400' },
};

export const idpPlanTypes = {
  quarterly: { label: 'Quarterly', duration: '90 days' },
  annual:    { label: 'Annual',    duration: '365 days' },
  custom:    { label: 'Custom',    duration: 'Custom' },
};
