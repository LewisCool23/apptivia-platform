import { FileEdit, Send, CheckCircle, ClipboardCheck, Eye, RotateCcw, Clock } from 'lucide-react';

export const reviewStatusConfig = {
  draft:                      { label: 'Draft',                color: 'bg-apptivia-carbon-100 text-gray-700',     icon: FileEdit,       borderColor: 'border-l-gray-400' },
  pending_self_assessment:    { label: 'Awaiting Self-Assessment', color: 'bg-amber-100 text-amber-700', icon: Send,        borderColor: 'border-l-amber-500' },
  self_assessment_submitted:  { label: 'Self-Assessment Done', color: 'bg-apptivia-coral-tone-50 text-blue-700',     icon: CheckCircle,    borderColor: 'border-l-blue-500' },
  manager_review:             { label: 'Manager Review',       color: 'bg-apptivia-carbon-100 text-purple-700', icon: ClipboardCheck, borderColor: 'border-l-purple-500' },
  finalized:                  { label: 'Finalized',            color: 'bg-green-100 text-green-700',   icon: Eye,            borderColor: 'border-l-green-500' },
  acknowledged:               { label: 'Acknowledged',         color: 'bg-emerald-100 text-emerald-700', icon: CheckCircle, borderColor: 'border-l-emerald-500' },
  reopened:                   { label: 'Reopened',             color: 'bg-orange-100 text-orange-700', icon: RotateCcw,      borderColor: 'border-l-orange-500' },
};

export const reviewTypes = {
  mid_year: { label: 'Mid-Year Review', shortLabel: 'Mid-Year' },
  annual:   { label: 'Annual Review',   shortLabel: 'Annual' },
};

// State machine transitions
export const reviewTransitions = {
  draft:                     { next: 'pending_self_assessment', action: 'Send for Self-Assessment', actor: 'manager' },
  pending_self_assessment:   { next: 'self_assessment_submitted', action: 'Submit Self-Assessment', actor: 'rep' },
  self_assessment_submitted: { next: 'manager_review', action: 'Begin Manager Review', actor: 'manager' },
  manager_review:            { next: 'finalized', action: 'Finalize Review', actor: 'manager' },
  finalized:                 { next: 'acknowledged', action: 'Acknowledge Review', actor: 'rep', alt: { next: 'reopened', action: 'Reopen', actor: 'manager' } },
  reopened:                  { next: 'manager_review', action: 'Resume Review', actor: 'manager' },
  acknowledged:              null, // terminal
};
