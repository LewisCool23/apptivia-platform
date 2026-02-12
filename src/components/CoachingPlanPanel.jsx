import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BadgeCheck, ClipboardCheck, Send, Target, TrendingUp, Users, FolderOpen, Share2 } from 'lucide-react';
import RightFilterPanel from './RightFilterPanel';
import { HistoricalScoresChart } from './Charts';
import { useToast } from '../contexts/ToastContext';
import { supabase } from '../supabaseClient';

const KPI_GUIDANCE = {
  sourced_opps: {
    title: 'Sourced Opportunities',
    tips: [
      'Block daily prospecting time and protect it like a meeting.',
      'Refresh target account lists weekly using intent signals and recent activity.',
      'Use multi-threading to uncover champions, referrals, and adjacent teams.'
    ]
  },
  call_connects: {
    title: 'Call Connects',
    tips: [
      'Call during higher-connect windows (8-10am and 4-6pm local time).',
      'Run a 3x3 cadence: 3 call attempts, 3 channels, over 3 days.',
      'Pair each call with a short voicemail and a same-day follow-up email.'
    ]
  },
  meetings: {
    title: 'Meetings',
    tips: [
      'Lead with a crisp problem statement and invite the right stakeholders.',
      'Qualify for next steps before asking for time.',
      'End every call with a clear calendar ask and two proposed slots.'
    ]
  },
  talk_time_minutes: {
    title: 'Talk Time Minutes',
    tips: [
      'Use a structured discovery agenda to keep conversations moving.',
      'Ask open-ended questions and summarize back to confirm value.',
      'Stack calls and avoid long gaps between sessions.'
    ]
  },
  stage2_opps: {
    title: 'Stage 2 Opportunities',
    tips: [
      'Confirm the pain, impact, and buying process before advancing stages.',
      'Map stakeholders and secure a mutual action plan.',
      'Review deal health weekly and set specific next milestones.'
    ]
  },
  pipeline_created: {
    title: 'Pipeline Created',
    tips: [
      'Target accounts with clear triggers (funding, hiring, new initiatives).',
      'Expand coverage by adding adjacent roles into outreach.',
      'Re-run outbound sequences to the top 50 accounts each week.'
    ]
  },
  qualified_leads: {
    title: 'Qualified Leads',
    tips: [
      'Tighten ICP qualification and disqualify early when needed.',
      'Validate budget, authority, need, and timeline quickly.',
      'Use win/loss notes to refine lead quality criteria.'
    ]
  },
  emails_sent: {
    title: 'Emails Sent',
    tips: [
      'Personalize the first line and include a clear CTA.',
      'Batch emails in focused blocks to maintain quality.',
      'Mix value nuggets with questions to drive replies.'
    ]
  },
  social_touches: {
    title: 'Social Touches',
    tips: [
      'Engage with prospects’ posts before sending a connection request.',
      'Use short, relevant comments to build familiarity.',
      'Follow up with insights tied to their recent activity.'
    ]
  },
  response_time: {
    title: 'Response Time',
    tips: [
      'Set a response SLA (e.g., under 2 hours during workdays).',
      'Use templates for common replies to respond faster.',
      'Batch inbox time in the morning and late afternoon.'
    ]
  },
  follow_ups: {
    title: 'Follow Ups',
    tips: [
      'Build a consistent follow-up cadence for every new lead.',
      'Schedule next steps during the call to reduce drop-offs.',
      'Use task reminders to avoid missed follow-ups.'
    ]
  },
  demos_completed: {
    title: 'Demos Completed',
    tips: [
      'Qualify right-fit prospects before demoing.',
      'Set a clear agenda and define success metrics up front.',
      'End with a mutual action plan and timeline.'
    ]
  },
  win_rate: {
    title: 'Win Rate',
    tips: [
      'Run weekly deal reviews to identify risk early.',
      'Focus on multi-threading to reduce single-thread risk.',
      'Capture and re-use winning talk tracks.'
    ]
  }
};

const ACTION_PLAYBOOKS = [
  {
    id: 'pipeline-generation',
    title: 'Pipeline Generation Sprint',
    kpis: ['sourced_opps', 'pipeline_created', 'qualified_leads', 'stage2_opps'],
    steps: [
      'Block two focused prospecting blocks daily and prioritize trigger accounts.',
      'Run a refreshed outbound sequence to the top 25–50 target accounts.',
      'Advance qualified opportunities by confirming pain, impact, and next steps.'
    ]
  },
  {
    id: 'connection-to-meetings',
    title: 'Connection → Meeting Conversion',
    kpis: ['call_connects', 'emails_sent', 'social_touches', 'meetings'],
    steps: [
      'Use a 3x3 cadence across calls, email, and social in 3 days.',
      'Personalize first-line messaging and include a single clear CTA.',
      'End live conversations with a calendar ask and two proposed slots.'
    ]
  },
  {
    id: 'discovery-quality',
    title: 'Discovery Quality & Talk Time',
    kpis: ['talk_time_minutes', 'meetings'],
    steps: [
      'Run a structured discovery agenda with open-ended questions.',
      'Summarize back and confirm value before advancing stages.',
      'Stack calls and reduce gaps to increase weekly talk time.'
    ]
  },
  {
    id: 'follow-through',
    title: 'Follow-through & Responsiveness',
    kpis: ['follow_ups', 'response_time'],
    steps: [
      'Set response SLAs and protect two inbox blocks per day.',
      'Create next steps in CRM before ending every call.',
      'Use task reminders and templates for fast follow-ups.'
    ]
  },
  {
    id: 'demo-to-win',
    title: 'Demo → Win Momentum',
    kpis: ['demos_completed', 'win_rate'],
    steps: [
      'Qualify right-fit prospects and align on success criteria early.',
      'Finish demos with mutual action plans and timelines.',
      'Run weekly deal reviews to identify risks and unblock decisions.'
    ]
  }
];

const COACHING_PLAN_TEMPLATE = `Apptivia Coaching Plan Template

Plan Name:
Owner:
Team/Segment:
Date Range:

Goals (1-3):
-

Focus KPIs (Top 3-5):
-

Action Plan (Weekly):
1.
2.
3.

Support Needed:
-

Checkpoints:
- Weekly review:
- Mid-week check-in:

Success Criteria:
-
`;

const buildLabel = (key) =>
  key
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());

export default function CoachingPlanPanel({
  isOpen,
  onClose,
  audienceLabel,
  scorecardData,
  coachData,
  historicalScores,
  kpiMetrics,
  kpiLabels,
  currentUserId,
  role,
  selectedMembers,
}) {
  const toast = useToast();
  const navigate = useNavigate();
  const [selectedRepIds, setSelectedRepIds] = useState([]);
  const [planMode, setPlanMode] = useState('auto');
  const [customPlan, setCustomPlan] = useState(COACHING_PLAN_TEMPLATE);
  const [savingPlan, setSavingPlan] = useState(false);
  const [sendingPlan, setSendingPlan] = useState(false);
  const [showShareCoachingPlan, setShowShareCoachingPlan] = useState(false);
  const [sharingPlan, setSharingPlan] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [shareNotes, setShareNotes] = useState('');

  const rows = scorecardData?.rows || [];
  const isAdmin = role === 'admin';
  const isManager = role === 'manager' || role === 'coach';
  const canBuildPlan = isAdmin || role === 'manager';

  const scopedRows = useMemo(() => {
    if (isAdmin || isManager) return rows;
    if (!currentUserId) return [];
    return rows.filter((row) => String(row.profile_id) === String(currentUserId));
  }, [rows, isAdmin, isManager, currentUserId]);

  const focusMemberId = selectedMembers?.length === 1 ? selectedMembers[0] : null;
  const focusRow = useMemo(() => {
    if (focusMemberId) {
      return scopedRows.find((row) => String(row.profile_id) === String(focusMemberId)) || null;
    }
    if (!isAdmin && !isManager && currentUserId) {
      return scopedRows.find((row) => String(row.profile_id) === String(currentUserId)) || null;
    }
    return null;
  }, [focusMemberId, scopedRows, isAdmin, isManager, currentUserId]);

  const kpiKeys = useMemo(() => {
    if (Array.isArray(kpiMetrics) && kpiMetrics.length > 0) {
      return kpiMetrics.map((k) => k.key);
    }
    const sampleRow = scopedRows[0] || rows[0];
    return sampleRow?.kpis ? Object.keys(sampleRow.kpis) : [];
  }, [kpiMetrics, scopedRows, rows]);

  const kpiPerformance = useMemo(() => {
    const sourceRows = focusRow ? [focusRow] : scopedRows;
    return kpiKeys.map((key) => {
      const percentages = sourceRows.map((row) => Number(row?.kpis?.[key]?.percentage || 0));
      const avg = percentages.length > 0
        ? Math.round(percentages.reduce((sum, val) => sum + val, 0) / percentages.length)
        : 0;
      const label = kpiLabels?.[key] || buildLabel(key);
      return { key, label, percentage: avg };
    });
  }, [kpiKeys, scopedRows, focusRow, kpiLabels]);

  const laggingKpis = kpiPerformance.filter((kpi) => kpi.percentage < 80);
  const onTrackKpis = kpiPerformance.filter((kpi) => kpi.percentage >= 80 && kpi.percentage < 100);
  const exceedingKpis = kpiPerformance.filter((kpi) => kpi.percentage >= 100);

  const currentScore = useMemo(() => {
    if (focusRow) return focusRow.apptivityScore;
    if (scopedRows.length === 0) return 0;
    return Math.round(scopedRows.reduce((sum, row) => sum + (row.apptivityScore || 0), 0) / scopedRows.length);
  }, [focusRow, scopedRows]);

  const prioritySkillsets = useMemo(() => {
    const skillsets = coachData?.skillsets || [];
    return [...skillsets]
      .sort((a, b) => (a.progress || 0) - (b.progress || 0))
      .slice(0, 3);
  }, [coachData?.skillsets]);

  const autoPlaybooks = useMemo(() => {
    if (laggingKpis.length === 0) return [];
    const laggingKeys = new Set(laggingKpis.map((k) => k.key));
    const scored = ACTION_PLAYBOOKS
      .map((playbook) => {
        const hitCount = playbook.kpis.filter((k) => laggingKeys.has(k)).length;
        return { ...playbook, hitCount };
      })
      .filter((p) => p.hitCount > 0)
      .sort((a, b) => b.hitCount - a.hitCount);
    return scored.slice(0, 3);
  }, [laggingKpis]);

  const autoPlanText = useMemo(() => {
    const lines = ['Apptivia Auto Coaching Plan', '', `Focus: ${audienceLabel || 'Team Snapshot'}`, ''];
    if (autoPlaybooks.length === 0) {
      lines.push('All KPIs are on track. Focus on maintaining current habits and consistent execution.');
      return lines.join('\n');
    }
    autoPlaybooks.forEach((playbook, idx) => {
      const related = playbook.kpis
        .map((k) => KPI_GUIDANCE[k]?.title || buildLabel(k))
        .join(', ');
      lines.push(`${idx + 1}. ${playbook.title}`);
      lines.push(`   Related KPIs: ${related}`);
      playbook.steps.forEach((step) => lines.push(`   - ${step}`));
      lines.push('');
    });
    return lines.join('\n');
  }, [autoPlaybooks, audienceLabel]);

  const reps = useMemo(() => {
    if (!isManager) return [];
    return scopedRows.map((row) => ({ id: row.profile_id, name: row.name, email: row.email }));
  }, [isManager, scopedRows]);

  const toggleRep = (repId) => {
    setSelectedRepIds((prev) =>
      prev.includes(repId)
        ? prev.filter((id) => id !== repId)
        : [...prev, repId]
    );
  };

  const selectAllReps = () => {
    setSelectedRepIds(reps.map((rep) => rep.id));
  };

  const clearSelectedReps = () => {
    setSelectedRepIds([]);
  };

  const buildPlanPayload = () => {
    const planText = planMode === 'custom' ? customPlan : autoPlanText;
    const highlights = {
      lagging: laggingKpis.map((k) => ({ key: k.key, label: k.label, percentage: k.percentage })),
      onTrack: onTrackKpis.length,
      exceeding: exceedingKpis.length,
      currentScore,
    };
    return {
      planType: planMode,
      planText,
      highlights,
      audienceLabel: audienceLabel || null,
      memberIds: selectedMembers || [],
      selectedRepIds,
    };
  };

  const handleSavePlan = async () => {
    if (!canBuildPlan) return;
    setSavingPlan(true);
    try {
      const payload = buildPlanPayload();
      const { error } = await supabase
        .from('coaching_plans')
        .insert({
          created_by: currentUserId,
          plan_type: payload.planType,
          plan_text: payload.planText,
          highlights: payload.highlights,
          audience_label: payload.audienceLabel,
          member_ids: payload.memberIds,
          status: 'draft',
        });
      if (error) throw error;
      toast.success('Coaching plan saved.');
    } catch (err) {
      console.error('Failed to save coaching plan', err);
      toast.error('Failed to save coaching plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  const handleSendPlan = async () => {
    if (selectedRepIds.length === 0) return;
    setSendingPlan(true);
    try {
      const selectedReps = reps.filter((rep) => selectedRepIds.includes(rep.id));
      const recipients = selectedReps.map((rep) => rep.email).filter(Boolean);
      if (recipients.length === 0) {
        toast.error('No recipient emails found for selected reps.');
        setSendingPlan(false);
        return;
      }

      const payload = buildPlanPayload();
      const subject = `Weekly Coaching Plan • ${audienceLabel || 'Team'}`;
      const body = `${payload.planText}\n\nHighlights:\n- Current score: ${currentScore}%\n- Lagging KPIs: ${laggingKpis.length}\n- On track: ${onTrackKpis.length}\n- Exceeding: ${exceedingKpis.length}\n`;
      const backendBase = process.env.REACT_APP_BACKEND_URL || '';
      const res = await fetch(`${backendBase}/api/send-coaching-plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients, subject, body }),
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Email failed');
      }

      const planLabel = planMode === 'custom' ? 'custom plan' : 'auto plan';
      toast.success(`Coaching plan sent to ${recipients.length} rep${recipients.length === 1 ? '' : 's'}.`);
      toast.info(`Included ${planLabel} summary.`);
      setSelectedRepIds([]);
    } catch (err) {
      console.error('Failed to send coaching plan', err);
      toast.error('Failed to send coaching plan email.');
    } finally {
      setSendingPlan(false);
    }
  };

  const handleShareFullPlan = async () => {
    if (!shareEmail.trim()) {
      toast.error('Please enter an email address');
      return;
    }

    setSharingPlan(true);
    try {
      const payload = buildPlanPayload();
      const fullPlanText = `${payload.planText}\n\n--- Additional Notes ---\n${shareNotes || 'No additional notes.'}`;
      
      const recipients = shareEmail.split(',').map(e => e.trim()).filter(e => e);
      
      const res = await fetch('http://localhost:3001/send-coaching-plan', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients,
          planText: fullPlanText,
          highlights: payload.highlights,
          audienceLabel: payload.audienceLabel,
        }),
      });

      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || 'Email failed');
      }

      toast.success(`Full coaching plan shared successfully!`);
      setShowShareCoachingPlan(false);
      setShareEmail('');
      setShareNotes('');
    } catch (err) {
      console.error('Failed to share full coaching plan', err);
      toast.error('Failed to share coaching plan.');
    } finally {
      setSharingPlan(false);
    }
  };

  const handleCopyPlanToClipboard = () => {
    const payload = buildPlanPayload();
    const fullPlanText = `${payload.planText}\n\nHighlights:\n- Current Score: ${payload.highlights.currentScore}%\n- Lagging KPIs: ${payload.highlights.lagging.length}\n- On Track: ${payload.highlights.onTrack}\n- Exceeding: ${payload.highlights.exceeding}`;
    
    navigator.clipboard.writeText(fullPlanText);
    toast.success('Coaching plan copied to clipboard!');
  };

  return (
    <>
      {/* Share Full Coaching Plan Modal */}
      {showShareCoachingPlan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setShowShareCoachingPlan(false)} />
          <div className="relative w-full max-w-lg bg-white rounded-xl shadow-lg p-6 m-4">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">Share Full Coaching Plan</h2>
                <p className="text-sm text-gray-500">Send the complete coaching plan via email</p>
              </div>
              <button
                onClick={() => setShowShareCoachingPlan(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Recipients
                </label>
                <input
                  type="text"
                  value={shareEmail}
                  onChange={(e) => setShareEmail(e.target.value)}
                  placeholder="email@example.com, another@example.com"
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <p className="text-xs text-gray-500 mt-1">Separate multiple emails with commas</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={shareNotes}
                  onChange={(e) => setShareNotes(e.target.value)}
                  rows={4}
                  placeholder="Add any additional context or instructions..."
                  className="w-full border border-gray-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <p className="text-xs text-blue-800">
                  This will share the complete coaching plan including all KPI insights, action playbooks, and skillset priorities.
                </p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-6">
              <button
                onClick={() => setShowShareCoachingPlan(false)}
                className="px-4 py-2 text-sm rounded-md border border-gray-200 text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleShareFullPlan}
                disabled={!shareEmail.trim() || sharingPlan}
                className={`px-4 py-2 text-sm rounded-md font-semibold text-white ${shareEmail.trim() && !sharingPlan ? 'bg-blue-600 hover:bg-blue-700' : 'bg-gray-300 cursor-not-allowed'}`}
              >
                {sharingPlan ? 'Sharing...' : 'Share Plan'}
              </button>
            </div>
          </div>
        </div>
      )}

    <RightFilterPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Coaching Plan"
      subtitle="Personalized KPI improvement strategy"
      panelClassName="w-[520px] max-w-[98vw]"
      contentClassName="pb-6"
    >
      <div className="space-y-4">
        {/* Share Coaching Plan Actions */}
        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="text-sm font-semibold text-gray-900">Share Coaching Plan</div>
            <div className="flex gap-2">
              <button
                onClick={handleCopyPlanToClipboard}
                className="px-3 py-1.5 text-xs rounded-md bg-gray-100 text-gray-700 hover:bg-gray-200 font-medium transition-colors"
              >
                Copy to Clipboard
              </button>
              <button
                onClick={() => setShowShareCoachingPlan(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-700 font-medium transition-colors"
              >
                <Share2 size={14} />
                Share via Email
              </button>
            </div>
          </div>
          <p className="text-xs text-gray-500 mt-1">Share the full coaching plan with stakeholders or team members</p>
        </div>

        <div className="bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg p-4 text-white">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-xs text-white/80">{audienceLabel || 'Coaching Focus'}</div>
              <div className="text-xl font-semibold">Current Score: {currentScore}%</div>
              <div className="text-xs text-white/80 mt-1">Lagging KPIs: {laggingKpis.length} • On Track: {onTrackKpis.length} • Exceeding: {exceedingKpis.length}</div>
            </div>
            <div className="bg-white/20 rounded-full px-3 py-1 text-xs font-semibold">Plan Ready</div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white border rounded-lg p-3">
            <div className="text-xs text-gray-500">Achievements Earned</div>
            <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-gray-900">
              <ClipboardCheck size={16} className="text-green-500" />
              {coachData?.totalAchievements ?? 0}
            </div>
          </div>
          <div className="bg-white border rounded-lg p-3">
            <div className="text-xs text-gray-500">Badges Earned</div>
            <div className="flex items-center gap-2 mt-2 text-sm font-semibold text-gray-900">
              <BadgeCheck size={16} className="text-indigo-500" />
              {coachData?.totalBadges ?? 0}
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-lg p-3">
          <HistoricalScoresChart
            title="Historical Score Trend"
            data={historicalScores || []}
          />
        </div>

        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-900">
            <Target size={16} className="text-blue-500" />
            Cross-skillset Action Plan
          </div>
          {autoPlaybooks.length === 0 ? (
            <div className="text-xs text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-lg p-2">
              All KPI areas are on track. Focus on consistent execution and maintain weekly routines.
            </div>
          ) : (
            <div className="space-y-3">
              {autoPlaybooks.map((playbook) => (
                <div key={playbook.id} className="border rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-semibold text-gray-900">{playbook.title}</div>
                    <div className="text-[11px] text-gray-500">{playbook.kpis.length} KPIs</div>
                  </div>
                  <div className="mt-1 text-[11px] text-gray-500">
                    Related KPIs: {playbook.kpis.map((k) => KPI_GUIDANCE[k]?.title || buildLabel(k)).join(', ')}
                  </div>
                  <ul className="mt-2 text-xs text-gray-600 space-y-1 list-disc list-inside">
                    {playbook.steps.map((step, idx) => (
                      <li key={`${playbook.id}-step-${idx}`}>{step}</li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white border rounded-lg p-3">
          <div className="flex items-center gap-2 mb-2 text-sm font-semibold text-gray-900">
            <TrendingUp size={16} className="text-purple-500" />
            Skillset Mastery Priorities
          </div>
          <div className="space-y-2">
            {prioritySkillsets.length === 0 ? (
              <div className="text-xs text-gray-500">Skillset progress will appear here once data loads.</div>
            ) : (
              prioritySkillsets.map((skillset) => (
                <div key={skillset.skillset_id} className="flex items-center justify-between text-xs">
                  <div className="font-semibold text-gray-900">{skillset.skillset_name}</div>
                  <div className="text-gray-500">{skillset.progress}%</div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Navigate to Coaching Plans Page */}
        <div className="bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-white font-semibold mb-1">Coaching Plans</div>
              <div className="text-white/80 text-xs">Create and manage all your coaching plans</div>
            </div>
            <button
              onClick={() => navigate('/coaching-plans')}
              className="flex items-center gap-2 px-4 py-2 bg-white text-indigo-600 rounded-lg text-sm font-semibold hover:bg-indigo-50 transition-colors"
            >
              <FolderOpen size={16} />
              View Plans
            </button>
          </div>
        </div>

        {isManager && reps.length > 0 && (
          <div className="bg-white border rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                <Users size={16} className="text-blue-600" />
                Share Plan With Reps
              </div>
              <div className="flex gap-2 text-[11px]">
                <button onClick={selectAllReps} className="text-blue-600 hover:text-blue-700">Select all</button>
                <button onClick={clearSelectedReps} className="text-gray-500 hover:text-gray-600">Clear</button>
              </div>
            </div>
            <div className="max-h-32 overflow-y-auto space-y-2 text-xs text-gray-600">
              {reps.map((rep) => (
                <label key={rep.id} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    className="rounded"
                    checked={selectedRepIds.includes(rep.id)}
                    onChange={() => toggleRep(rep.id)}
                  />
                  <span>{rep.name}</span>
                </label>
              ))}
            </div>
            <button
              onClick={handleSendPlan}
              disabled={selectedRepIds.length === 0 || sendingPlan}
              className={`mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded text-xs font-semibold transition-all ${selectedRepIds.length > 0 && !sendingPlan ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-200 text-gray-500 cursor-not-allowed'}`}
            >
              <Send size={14} />
              {sendingPlan ? 'Sending...' : 'Send Coaching Plan'}
            </button>
            <div className="mt-2 text-[11px] text-gray-500">
              Sends the plan to selected reps with a review request and next-step checklist.
            </div>
          </div>
        )}
      </div>
    </RightFilterPanel>
    </>
  );
}
