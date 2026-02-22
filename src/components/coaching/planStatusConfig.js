import { CheckCircle, Clock, AlertTriangle } from 'lucide-react';

export const statusConfig = {
  draft:       { label: 'Draft',       color: 'bg-gray-100 text-gray-700',   icon: Clock },
  active:      { label: 'Active',      color: 'bg-blue-100 text-blue-700',   icon: Clock },
  in_progress: { label: 'In Progress', color: 'bg-yellow-100 text-yellow-700', icon: Clock },
  completed:   { label: 'Complete',    color: 'bg-green-100 text-green-700', icon: CheckCircle },
  overdue:     { label: 'Overdue',     color: 'bg-red-100 text-red-700',     icon: AlertTriangle },
};
