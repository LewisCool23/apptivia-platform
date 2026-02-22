// =============================================================================
// useEngageNotifications.ts — Engage notification helpers
// =============================================================================
// Provides convenience methods to emit Engage-specific notifications
// into the existing NotificationContext / useNotificationsDB system.
// =============================================================================

import { useCallback } from 'react';
import { useNotifications } from '../contexts/NotificationContext';

type EngageNotificationType =
  | 'sequence_reply'
  | 'sequence_completed'
  | 'signal_detected'
  | 'account_score_change'
  | 'playbook_completed'
  | 'deal_at_risk'
  | 'engage_milestone';

interface EngageNotificationOptions {
  title: string;
  message: string;
  link?: string;
  dedupeKey?: string;
}

const ENGAGE_ICON_MAP: Record<EngageNotificationType, string> = {
  sequence_reply: '💬',
  sequence_completed: '✅',
  signal_detected: '📡',
  account_score_change: '📊',
  playbook_completed: '📖',
  deal_at_risk: '⚠️',
  engage_milestone: '🏆',
};

export function useEngageNotifications() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { addNotification } = useNotifications() as any;

  const notify = useCallback(
    (subtype: EngageNotificationType, opts: EngageNotificationOptions) => {
      addNotification({
        type: 'engage',
        title: opts.title,
        message: `${ENGAGE_ICON_MAP[subtype] || '📡'} ${opts.message}`,
        link: opts.link || '/engage',
        dedupeKey: opts.dedupeKey || `engage-${subtype}-${Date.now()}`,
      });
    },
    [addNotification]
  );

  const notifySequenceReply = useCallback(
    (prospectName: string, sequenceName: string) => {
      notify('sequence_reply', {
        title: 'Sequence Reply Received',
        message: `${prospectName} replied to "${sequenceName}"`,
        link: '/engage?tab=sequences',
        dedupeKey: `seq-reply-${prospectName}-${Date.now()}`,
      });
    },
    [notify]
  );

  const notifySequenceCompleted = useCallback(
    (sequenceName: string, enrolledCount: number) => {
      notify('sequence_completed', {
        title: 'Sequence Completed',
        message: `"${sequenceName}" finished — ${enrolledCount} prospects reached`,
        link: '/engage?tab=sequences',
        dedupeKey: `seq-done-${sequenceName}`,
      });
    },
    [notify]
  );

  const notifySignalDetected = useCallback(
    (company: string, signalType: string) => {
      notify('signal_detected', {
        title: 'New Intent Signal',
        message: `${signalType} signal detected for ${company}`,
        link: '/engage?tab=signals',
        dedupeKey: `signal-${company}-${signalType}-${Date.now()}`,
      });
    },
    [notify]
  );

  const notifyAccountScoreChange = useCallback(
    (accountName: string, oldScore: number, newScore: number) => {
      const direction = newScore > oldScore ? 'increased' : 'decreased';
      notify('account_score_change', {
        title: 'Account Score Change',
        message: `${accountName} score ${direction}: ${oldScore} → ${newScore}`,
        link: '/engage?tab=accounts',
        dedupeKey: `acct-score-${accountName}-${Date.now()}`,
      });
    },
    [notify]
  );

  const notifyPlaybookCompleted = useCallback(
    (playbookName: string, outcome: string) => {
      notify('playbook_completed', {
        title: 'Playbook Completed',
        message: `"${playbookName}" finished with outcome: ${outcome}`,
        link: '/engage?tab=playbooks',
        dedupeKey: `pb-done-${playbookName}-${Date.now()}`,
      });
    },
    [notify]
  );

  const notifyDealAtRisk = useCallback(
    (dealName: string, reason: string) => {
      notify('deal_at_risk', {
        title: 'Deal At Risk',
        message: `${dealName} — ${reason}`,
        link: '/engage?tab=pipeline',
        dedupeKey: `deal-risk-${dealName}-${Date.now()}`,
      });
    },
    [notify]
  );

  const notifyEngageMilestone = useCallback(
    (milestoneName: string, detail: string) => {
      notify('engage_milestone', {
        title: 'Engage Milestone',
        message: `${milestoneName}: ${detail}`,
        link: '/engage',
        dedupeKey: `engage-ms-${milestoneName}`,
      });
    },
    [notify]
  );

  return {
    notify,
    notifySequenceReply,
    notifySequenceCompleted,
    notifySignalDetected,
    notifyAccountScoreChange,
    notifyPlaybookCompleted,
    notifyDealAtRisk,
    notifyEngageMilestone,
  };
}
