import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export const statusConfig = {
  draft:       { label: 'Draft',       color: 'bg-apptivia-carbon-100 text-apptivia-carbon-700',     icon: Clock,         borderColor: 'border-l-gray-400' },
  active:      { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock,         borderColor: 'border-l-yellow-500' },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock,         borderColor: 'border-l-yellow-500' },
  completed:   { label: 'Complete',    color: 'bg-green-100 text-green-700',   icon: CheckCircle,   borderColor: 'border-l-green-500' },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700',       icon: AlertTriangle, borderColor: 'border-l-red-500' },
  cancelled:   { label: 'Cancelled',  color: 'bg-apptivia-carbon-100 text-apptivia-carbon-500',    icon: Clock,         borderColor: 'border-l-gray-300' },
};
