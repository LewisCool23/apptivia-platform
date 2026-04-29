import React, { useEffect, useState, useMemo } from 'react';
import { Activity, Settings, Users, Trophy, Rocket, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import InfoTooltip from './InfoTooltip';
import OrgHealthDetailModal from './OrgHealthDetailModal';
import { ORG_HEALTH_METRICS } from '../constants/orgHealthMetrics';

/**
 * 4E: Org Health Scorecard — 5-dimension health check for admins/managers.
 * Fetches lightweight counts from Supabase and computes 0-100 scores per dimension.
 */

const DIMENSIONS = [
  { key: 'performance', label: 'Team Performance', icon: Activity, link: '/analytics?tab=kpi-attainment',
    description: 'Average scorecard score across all reps' },
  { key: 'configuration', label: 'Configuration', icon: Settings, link: '/settings',
    description: 'KPIs, teams, and integrations set up' },
  { key: 'coaching', label: 'Coaching Activity', icon: Users, link: '/coach',
    description: 'Active coaching plans and IDPs' },
  { key: 'engagement', label: 'Engagement', icon: Trophy, link: '/contests',
    description: 'Contest participation and badge activity' },
  { key: 'outbound', label: 'Outbound Motion', icon: Rocket, link: '/engage',
    description: 'Signal processing and outreach sequences' },
];

function scoreColor(score) {
  if (score >= 75) return { text: 'text-green-700', bg: 'bg-green-100', bar: 'bg-green-500' };
  if (score >= 50) return { text: 'text-yellow-700', bg: 'bg-yellow-100', bar: 'bg-yellow-500' };
  if (score >= 25) return { text: 'text-orange-700', bg: 'bg-orange-100', bar: 'bg-orange-500' };
  return { text: 'text-red-700', bg: 'bg-red-100', bar: 'bg-red-500' };
}

export default function OrgHealthScorecard() {
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [scores, setScores] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailDim, setDetailDim] = useState(null);

  const orgId = profile?.organization_id;

  useEffect(() => {
    if (!orgId) return;
    let cancelled = false;

    async function fetchHealth() {
      setLoading(true);
      try {
        // Stage 1: Get org's rep IDs (needed to scope badges + kpi_values)
        const { data: orgReps } = await supabase
          .from('profiles')
          .select('id')
          .eq('organization_id', orgId)
          .not('role', 'in', '("admin","manager","coach")');
        const repIds = (orgReps || []).map(r => r.id);
        const repCount = repIds.length;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

        // Stage 2: Parallel lightweight queries — all org-scoped
        const [
          { count: kpiCount },
          { count: scorecardKpiCount },
          { count: teamCount },
          { count: coachingPlanCount },
          { count: idpCount },
          { count: contestCount },
          { count: badgeAwardCount },
          { count: signalCount },
          { count: sequenceCount },
          { data: recentScores },
        ] = await Promise.all([
          supabase.from('kpi_org_configs').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).eq('is_active', true),
          supabase.from('kpi_org_configs').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).eq('show_on_scorecard', true),
          supabase.from('teams').select('*', { count: 'exact', head: true }).eq('organization_id', orgId),
          supabase.from('coaching_plans').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).eq('status', 'active'),
          supabase.from('individual_development_plans').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).in('status', ['active', 'in_progress']),
          supabase.from('contests').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).eq('status', 'active'),
          // Badge count — org-scoped via repIds
          repIds.length > 0
            ? supabase.from('user_badges').select('*', { count: 'exact', head: true })
                .in('profile_id', repIds)
                .gte('earned_at', thirtyDaysAgo)
            : Promise.resolve({ count: 0 }),
          supabase.from('engage_intent_signals').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId)
            .gte('detected_at', thirtyDaysAgo),
          supabase.from('engage_sequences').select('*', { count: 'exact', head: true })
            .eq('organization_id', orgId).eq('status', 'active'),
          // KPI values — org-scoped via repIds
          repIds.length > 0
            ? supabase.from('kpi_values').select('value, kpi_id')
                .in('profile_id', repIds)
                .gte('period_start', oneWeekAgo)
                .limit(500)
            : Promise.resolve({ data: [] }),
        ]);

        // 1. Team Performance: avg of recent KPI values vs goals (simplified)
        const avgVal = recentScores?.length
          ? recentScores.reduce((s, r) => s + (r.value || 0), 0) / recentScores.length
          : 0;
        const performanceScore = Math.min(100, Math.round(avgVal > 0 ? Math.min(avgVal / 1.5, 100) : 0));

        // 2. Configuration: 5 checks: has ≥3 KPIs, has ≥5 scorecard, has teams, has reps, has ≥1 active KPI
        const configChecks = [
          (kpiCount || 0) >= 3,
          (scorecardKpiCount || 0) >= 3,
          (teamCount || 0) >= 1,
          (repCount || 0) >= 1,
          (kpiCount || 0) >= 5,
        ];
        const configurationScore = Math.round((configChecks.filter(Boolean).length / configChecks.length) * 100);

        // 3. Coaching: has plans for ≥25% of reps, has IDPs for ≥10% of reps
        const reps = repCount || 1;
        const coachingRatio = Math.min(1, (coachingPlanCount || 0) / Math.max(1, reps * 0.25));
        const idpRatio = Math.min(1, (idpCount || 0) / Math.max(1, reps * 0.1));
        const coachingScore = Math.round(((coachingRatio + idpRatio) / 2) * 100);

        // 4. Engagement: contests active + badges earned recently
        const contestScore = Math.min(50, (contestCount || 0) * 25);
        const badgeScore = Math.min(50, Math.round(((badgeAwardCount || 0) / Math.max(1, reps)) * 10));
        const engagementScore = Math.min(100, contestScore + badgeScore);

        // 5. Outbound Motion: signals detected + sequences running
        const signalScore = Math.min(60, Math.round(((signalCount || 0) / Math.max(1, reps * 5)) * 60));
        const seqScore = Math.min(40, (sequenceCount || 0) * 20);
        const outboundScore = Math.min(100, signalScore + seqScore);

        if (!cancelled) {
          setScores({
            performance: performanceScore,
            configuration: configurationScore,
            coaching: coachingScore,
            engagement: engagementScore,
            outbound: outboundScore,
            _raw: {
              kpiCount: kpiCount || 0,
              scorecardKpiCount: scorecardKpiCount || 0,
              teamCount: teamCount || 0,
              repCount,
              coachingPlanCount: coachingPlanCount || 0,
              idpCount: idpCount || 0,
              contestCount: contestCount || 0,
              badgeAwardCount: badgeAwardCount || 0,
              signalCount: signalCount || 0,
              sequenceCount: sequenceCount || 0,
              avgKpiValue: avgVal > 0 ? Math.round(avgVal) : 0,
            },
          });
        }
      } catch (err) {
        console.error('OrgHealth fetch error:', err);
        if (!cancelled) setScores(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchHealth();
    return () => { cancelled = true; };
  }, [orgId]);

  const overallScore = useMemo(() => {
    if (!scores) return 0;
    const vals = Object.entries(scores)
      .filter(([k]) => k !== '_raw')
      .map(([, v]) => v);
    return Math.round(vals.reduce((s, v) => s + v, 0) / vals.length);
  }, [scores]);

  const dimensionDataSummary = useMemo(() => {
    if (!scores?._raw) return {};
    const r = scores._raw;
    return {
      performance: [
        { label: 'Avg KPI Value', value: r.avgKpiValue },
        { label: 'Active Reps', value: r.repCount },
      ],
      configuration: [
        { label: 'Active KPIs', value: r.kpiCount },
        { label: 'Scorecard KPIs', value: r.scorecardKpiCount },
        { label: 'Teams', value: r.teamCount },
        { label: 'Reps', value: r.repCount },
      ],
      coaching: [
        { label: 'Active Plans', value: r.coachingPlanCount },
        { label: 'Active IDPs', value: r.idpCount },
        { label: 'Total Reps', value: r.repCount },
      ],
      engagement: [
        { label: 'Active Contests', value: r.contestCount },
        { label: 'Badges (30d)', value: r.badgeAwardCount },
        { label: 'Reps', value: r.repCount },
      ],
      outbound: [
        { label: 'Signals (30d)', value: r.signalCount },
        { label: 'Active Sequences', value: r.sequenceCount },
        { label: 'Reps', value: r.repCount },
      ],
    };
  }, [scores]);

  if (loading) {
    return <div className="text-center py-12 text-gray-400">Calculating org health...</div>;
  }

  if (!scores) {
    return <div className="text-center py-12 text-gray-400">Unable to load org health data.</div>;
  }

  const overall = scoreColor(overallScore);

  return (
    <div className="space-y-4">
      {/* Overall Score */}
      <div className="flex items-center gap-4 p-4 bg-white rounded-lg border border-gray-100">
        <div className={`w-16 h-16 rounded-xl flex items-center justify-center text-2xl font-bold ${overall.bg} ${overall.text}`}>
          {overallScore}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Organization Health Score</h3>
          <p className="text-sm text-gray-500">Composite score across 5 dimensions — updated in real-time</p>
        </div>
      </div>

      {/* Dimension Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {DIMENSIONS.map((dim) => {
          const score = scores[dim.key] || 0;
          const colors = scoreColor(score);
          const Icon = dim.icon;
          return (
            <div key={dim.key} className="bg-white rounded-lg border border-gray-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${colors.bg}`}>
                    <Icon size={16} className={colors.text} />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-gray-900 flex items-center gap-1">
                      {dim.label}
                      <InfoTooltip
                        text={ORG_HEALTH_METRICS[dim.key]?.explanation?.slice(0, 120) + '...'}
                        position="top"
                        wide
                      />
                    </div>
                    <div className="text-[10px] text-gray-500">{dim.description}</div>
                  </div>
                </div>
                <span className={`text-lg font-bold ${colors.text}`}>{score}</span>
              </div>
              <div className="w-full bg-apptivia-carbon-100 rounded-full h-2 mb-2">
                <div className={`h-full rounded-full ${colors.bar} transition-all`} style={{ width: `${score}%` }} />
              </div>
              <button
                onClick={() => setDetailDim(dim.key)}
                className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
              >
                View details <ArrowRight size={10} />
              </button>
            </div>
          );
        })}
      </div>

      {/* Detail Modal */}
      {detailDim && ORG_HEALTH_METRICS[detailDim] && (
        <OrgHealthDetailModal
          isOpen={!!detailDim}
          onClose={() => setDetailDim(null)}
          title={ORG_HEALTH_METRICS[detailDim].label}
          score={scores[detailDim] || 0}
          scoreColors={scoreColor(scores[detailDim] || 0)}
          icon={DIMENSIONS.find(d => d.key === detailDim)?.icon}
          explanation={ORG_HEALTH_METRICS[detailDim].explanation}
          dataPoints={ORG_HEALTH_METRICS[detailDim].dataPoints}
          dataSummary={dimensionDataSummary[detailDim] || []}
          linkTo={ORG_HEALTH_METRICS[detailDim].linkTo}
          linkLabel={ORG_HEALTH_METRICS[detailDim].linkLabel}
        />
      )}
    </div>
  );
}
