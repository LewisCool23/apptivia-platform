/**
 * useKpiWatchdog — React hook for the KPI Anomaly Watchdog workflow.
 *
 * Compares current KPI values against rolling averages,
 * detects drops >30%, and generates AI-powered coaching recommendations.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';
import { getMonday } from '../utils/dateUtils';
import { LEADERSHIP_ROLE_FILTER } from '../constants/roles';

// ── Types ──────────────────────────────────────────────────

export interface KpiAnomaly {
  id: string;
  organization_id: string;
  profile_id?: string;
  kpi_key: string;
  kpi_name: string;
  anomaly_type: 'drop' | 'spike' | 'stagnation' | 'streak_break' | 'improvement';
  severity: 'info' | 'warning' | 'critical' | 'positive';
  current_value: number;
  previous_value: number;
  rolling_avg: number;
  deviation_pct: number;
  period_start?: string;
  period_end?: string;
  detected_at: string;
  ai_analysis?: string;
  ai_recommendation?: string;
  suggested_coaching_plan_id?: string;
  status: 'active' | 'acknowledged' | 'resolved' | 'dismissed';
  acknowledged_by?: string;
  acknowledged_at?: string;
  resolved_at?: string;
  metadata?: Record<string, any>;
  created_at: string;
  // Populated
  profile_name?: string;
}

export interface WatchdogSummary {
  totalAnomalies: number;
  activeAnomalies: number;
  criticalCount: number;
  warningCount: number;
  infoCount: number;
  positiveCount: number;  // 4A: positive insights
  affectedReps: number;
  topKpiAffected: string;
  byKpi: Record<string, number>;
}

interface WatchdogState {
  anomalies: KpiAnomaly[];
  summary: WatchdogSummary;
  isAnalyzing: boolean;
  analysisProgress: string[];
  loading: boolean;
  error: string | null;
}

// Anomaly detection thresholds (configurable per org in future)
const ANOMALY_DROP_THRESHOLD = -15;      // Min % drop to flag; drops between -15% and -30% are "info"
const ANOMALY_WARNING_THRESHOLD = -30;   // Warning severity
const ANOMALY_CRITICAL_THRESHOLD = -50;  // Critical severity
const ANOMALY_SPIKE_THRESHOLD = 50;      // Positive spike threshold
const POSITIVE_INSIGHT_THRESHOLD = 15;   // 4A: ≥15% improvement = positive insight

const emptySummary: WatchdogSummary = {
  totalAnomalies: 0, activeAnomalies: 0, criticalCount: 0,
  warningCount: 0, infoCount: 0, positiveCount: 0, affectedReps: 0,
  topKpiAffected: '-', byKpi: {},
};

// ── Hook ───────────────────────────────────────────────────

export function useKpiWatchdog(organizationId: string, userId?: string) {
  const [state, setState] = useState<WatchdogState>({
    anomalies: [],
    summary: emptySummary,
    isAnalyzing: false,
    analysisProgress: [],
    loading: true,
    error: null,
  });

  const patch = useCallback((p: Partial<WatchdogState>) => setState((prev) => ({ ...prev, ...p })), []);

  // ── Fetch existing anomalies ───────────────────────────

  const fetchAnomalies = useCallback(async (filters?: { status?: string; severity?: string; kpi_key?: string }) => {
    if (!organizationId) { patch({ loading: false }); return; }
    patch({ loading: true, error: null });

    try {
      let q = supabase
        .from('engage_kpi_anomalies')
        .select('*, profiles!engage_kpi_anomalies_profile_id_fkey(first_name, last_name)')
        .eq('organization_id', organizationId)
        .order('detected_at', { ascending: false });

      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.severity) q = q.eq('severity', filters.severity);
      if (filters?.kpi_key) q = q.eq('kpi_key', filters.kpi_key);

      q = q.limit(200);

      const { data, error } = await q;
      if (error) throw error;

      const anomalies: KpiAnomaly[] = (data || []).map((a: any) => {
        const prof = a.profiles;
        return {
          ...a,
          profile_name: prof ? `${prof.first_name || ''} ${prof.last_name || ''}`.trim() : 'Unknown',
        };
      });

      // Summary
      const byKpi: Record<string, number> = {};
      const profileSet = new Set<string>();
      let criticalCount = 0, warningCount = 0, infoCount = 0, positiveCount = 0, activeCount = 0;

      anomalies.forEach((a) => {
        byKpi[a.kpi_key] = (byKpi[a.kpi_key] || 0) + 1;
        if (a.profile_id) profileSet.add(a.profile_id);
        if (a.status === 'active') activeCount++;
        if (a.severity === 'critical') criticalCount++;
        else if (a.severity === 'warning') warningCount++;
        else if (a.severity === 'positive') positiveCount++;
        else infoCount++;
      });

      const topKpi = Object.entries(byKpi).sort((a, b) => b[1] - a[1])[0];

      patch({
        anomalies,
        summary: {
          totalAnomalies: anomalies.length,
          activeAnomalies: activeCount,
          criticalCount,
          warningCount,
          infoCount,
          positiveCount,
          affectedReps: profileSet.size,
          topKpiAffected: topKpi ? topKpi[0] : '-',
          byKpi,
        },
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch]);

  // ── Run KPI Analysis ───────────────────────────────────

  const runAnalysis = useCallback(async () => {
    patch({ isAnalyzing: true, error: null, analysisProgress: ['Fetching KPI metrics and values...'] });

    try {
      // Step 1: Fetch KPI metrics — org-specific when available
      let metrics: any[] = [];
      if (organizationId) {
        const { data } = await supabase
          .from('kpi_org_configs')
          .select('kpi_id, goal, weight, is_active, show_on_scorecard, kpi_metrics!inner(id, key, name, goal, weight, direction)')
          .eq('organization_id', organizationId)
          .eq('is_active', true);
        metrics = (data || []).map((c: any) => ({
          id: c.kpi_metrics.id, key: c.kpi_metrics.key, name: c.kpi_metrics.name,
          direction: c.kpi_metrics.direction,
          goal: c.goal, weight: c.weight, show_on_scorecard: c.show_on_scorecard ?? true,
        }));
      }
      // Fallback to global kpi_metrics
      if (metrics.length === 0) {
        const { data } = await supabase.from('kpi_metrics').select('*').eq('is_active', true);
        metrics = data || [];
      }

      if (metrics.length === 0) {
        patch({ isAnalyzing: false, analysisProgress: ['No active KPI metrics found.'] });
        return;
      }

      patch({ analysisProgress: ['Fetching KPI metrics and values...', `Found ${metrics.length} active KPIs. Fetching historical values...`] });

      // Build metric lookup by id for O(1) access
      const metricById = new Map<string, any>();
      metrics.forEach((m: any) => metricById.set(m.id, m));

      // Step 2: Align to calendar Mon–Sun weeks so we never include the
      // current incomplete week in anomaly detection.
      const now = new Date();
      const currentMon = getMonday(now);
      const lastMonday = new Date(currentMon.getTime() - 7 * 24 * 60 * 60 * 1000);
      const lastSunday = new Date(lastMonday.getTime() + 6 * 24 * 60 * 60 * 1000);
      const twoWeeksAgoMon = new Date(lastMonday.getTime() - 7 * 24 * 60 * 60 * 1000);
      // 4 prior weeks BEFORE the analyzed week (excludes lastMonday–lastSunday)
      const fiveWeeksAgoMon = new Date(lastMonday.getTime() - 4 * 7 * 24 * 60 * 60 * 1000);

      // Get all profiles
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, organization_id')
        .eq('organization_id', organizationId)
        .not('role', 'in', LEADERSHIP_ROLE_FILTER);

      if (!profiles || profiles.length === 0) {
        patch({ isAnalyzing: false, analysisProgress: ['No profiles to analyze.'] });
        return;
      }

      const profileIds = profiles.map((p: any) => p.id);
      const profileMap = new Map<string, any>();
      profiles.forEach((p: any) => profileMap.set(p.id, p));

      // Fetch current, previous, and rolling values in parallel
      const [currentRes, previousRes, rollingRes] = await Promise.all([
        supabase
          .from('kpi_values')
          .select('profile_id, kpi_id, value, kpi_metrics!inner(key, name, goal, direction)')
          .in('profile_id', profileIds)
          .gte('period_start', lastMonday.toISOString().split('T')[0])
          .lte('period_end', lastSunday.toISOString().split('T')[0]),
        supabase
          .from('kpi_values')
          .select('profile_id, kpi_id, value, kpi_metrics!inner(key, name)')
          .in('profile_id', profileIds)
          .gte('period_start', twoWeeksAgoMon.toISOString().split('T')[0])
          .lt('period_end', lastMonday.toISOString().split('T')[0]),
        supabase
          .from('kpi_values')
          .select('profile_id, kpi_id, value, kpi_metrics!inner(key)')
          .in('profile_id', profileIds)
          .gte('period_start', fiveWeeksAgoMon.toISOString().split('T')[0])
          .lt('period_start', lastMonday.toISOString().split('T')[0]),
      ]);

      const currentValues = currentRes.data;
      const previousValues = previousRes.data;
      const rollingValues = rollingRes.data;

      // Build O(1) lookup maps: "profileId::metricKey" -> summed value
      // H2 fix: accumulate (sum) values instead of overwriting — a rep may
      // have multiple kpi_values rows for the same KPI in a single week.
      const currentMap = new Map<string, { value: number; meta: any }>();
      (currentValues || []).forEach((v: any) => {
        const key = `${v.profile_id}::${(v.kpi_metrics as any)?.key}`;
        const existing = currentMap.get(key);
        if (existing) {
          existing.value += v.value ?? 0;
        } else {
          currentMap.set(key, { value: v.value ?? 0, meta: v.kpi_metrics });
        }
      });

      const previousMap = new Map<string, { value: number }>();
      (previousValues || []).forEach((v: any) => {
        const key = `${v.profile_id}::${(v.kpi_metrics as any)?.key}`;
        const existing = previousMap.get(key);
        if (existing) {
          existing.value += v.value ?? 0;
        } else {
          previousMap.set(key, { value: v.value ?? 0 });
        }
      });

      const rollingMap = new Map<string, number[]>();
      (rollingValues || []).forEach((v: any) => {
        const key = `${v.profile_id}::${(v.kpi_metrics as any)?.key}`;
        if (!rollingMap.has(key)) rollingMap.set(key, []);
        rollingMap.get(key)!.push(v.value);
      });

      patch({
        analysisProgress: [
          'Fetching KPI metrics and values...',
          `Found ${metrics.length} active KPIs. Fetching historical values...`,
          'Analyzing deviations and detecting anomalies...',
        ],
      });

      // Step 3: Detect anomalies (direction-aware, using O(1) Map lookups)
      const anomalies: any[] = [];

      profiles.forEach((profile: any) => {
        metrics.forEach((metric: any) => {
          const lookupKey = `${profile.id}::${metric.key}`;
          const direction = metric.direction || 'higher';

          const currentEntry = currentMap.get(lookupKey);
          const prevEntry = previousMap.get(lookupKey);
          const rollingVals = rollingMap.get(lookupKey) || [];

          // Skip if no data row exists for the analyzed week — "no row" means
          // data hasn't been recorded yet, NOT that the rep scored zero.
          if (!currentEntry) return;

          const rollingAvg = rollingVals.length > 0
            ? rollingVals.reduce((s: number, v: number) => s + v, 0) / rollingVals.length
            : 0;

          const current = currentEntry.value;
          // M3 fix: use ?? instead of || so a genuine zero value isn't
          // silently replaced by rollingAvg
          const previous = prevEntry?.value ?? rollingAvg;

          if (rollingAvg === 0 && previous === 0) return; // No historical data

          // Direction-aware deviation: for "lower is better" KPIs, an INCREASE
          // is bad (a "drop" in performance) and a DECREASE is good (a "spike").
          // We invert the sign so the thresholds work uniformly.
          const rawDeviation = rollingAvg > 0
            ? ((current - rollingAvg) / rollingAvg) * 100
            : previous > 0
              ? ((current - previous) / previous) * 100
              : 0;

          const deviationPct = direction === 'lower' ? -rawDeviation : rawDeviation;

          // Detect drops exceeding threshold
          if (deviationPct <= ANOMALY_DROP_THRESHOLD) {
            const severity = deviationPct <= ANOMALY_CRITICAL_THRESHOLD ? 'critical' : deviationPct <= ANOMALY_WARNING_THRESHOLD ? 'warning' : 'info';
            anomalies.push({
              organization_id: organizationId,
              profile_id: profile.id,
              kpi_key: metric.key,
              kpi_name: metric.name,
              anomaly_type: 'drop',
              severity,
              current_value: Math.round(current * 10) / 10,
              previous_value: Math.round(previous * 10) / 10,
              rolling_avg: Math.round(rollingAvg * 10) / 10,
              deviation_pct: Math.round(deviationPct * 10) / 10,
              period_start: lastMonday.toISOString().split('T')[0],
              period_end: lastSunday.toISOString().split('T')[0],
              detected_at: now.toISOString(),
              status: 'active',
            });
          }

          // Detect spikes exceeding threshold (positive anomaly — info level)
          if (deviationPct >= ANOMALY_SPIKE_THRESHOLD) {
            anomalies.push({
              organization_id: organizationId,
              profile_id: profile.id,
              kpi_key: metric.key,
              kpi_name: metric.name,
              anomaly_type: 'spike',
              severity: 'info',
              current_value: Math.round(current * 10) / 10,
              previous_value: Math.round(previous * 10) / 10,
              rolling_avg: Math.round(rollingAvg * 10) / 10,
              deviation_pct: Math.round(deviationPct * 10) / 10,
              period_start: lastMonday.toISOString().split('T')[0],
              period_end: lastSunday.toISOString().split('T')[0],
              detected_at: now.toISOString(),
              status: 'active',
            });
          }

          // F16: Detect stagnation (|deviation| < 5% when both current and previous are near rolling avg)
          const STAGNATION_THRESHOLD = 5;
          if (Math.abs(deviationPct) < STAGNATION_THRESHOLD && rollingAvg > 0 && current > 0) {
            const prevDev = previous > 0 ? Math.abs((previous - rollingAvg) / rollingAvg * 100) : null;
            if (prevDev !== null && prevDev < STAGNATION_THRESHOLD) {
              anomalies.push({
                organization_id: organizationId,
                profile_id: profile.id,
                kpi_key: metric.key,
                kpi_name: metric.name,
                anomaly_type: 'stagnation' as any,
                severity: 'info' as any,
                current_value: Math.round(current * 10) / 10,
                previous_value: Math.round(previous * 10) / 10,
                rolling_avg: Math.round(rollingAvg * 10) / 10,
                deviation_pct: Math.round(deviationPct * 10) / 10,
                period_start: lastMonday.toISOString().split('T')[0],
                period_end: lastSunday.toISOString().split('T')[0],
                detected_at: now.toISOString(),
                status: 'active',
                ai_analysis: `${metric.name} has been flat for 3+ weeks — currently at ${Math.round(current)} vs. ${Math.round(rollingAvg)} rolling avg.`,
                ai_recommendation: `Stagnation often indicates a ceiling. Consider adjusting approach, setting stretch goals, or coaching on new techniques for ${metric.name}.`,
              });
            }
          }

          // 4A: Detect positive improvements (≥15% but below the 50% spike threshold)
          if (deviationPct >= POSITIVE_INSIGHT_THRESHOLD && deviationPct < ANOMALY_SPIKE_THRESHOLD) {
            const roundedDev = Math.round(deviationPct);
            anomalies.push({
              organization_id: organizationId,
              profile_id: profile.id,
              kpi_key: metric.key,
              kpi_name: metric.name,
              anomaly_type: 'improvement',
              severity: 'positive',
              current_value: Math.round(current * 10) / 10,
              previous_value: Math.round(previous * 10) / 10,
              rolling_avg: Math.round(rollingAvg * 10) / 10,
              deviation_pct: roundedDev,
              period_start: lastMonday.toISOString().split('T')[0],
              period_end: lastSunday.toISOString().split('T')[0],
              detected_at: now.toISOString(),
              status: 'active',
              // Template-based message
              ai_analysis: `Great momentum on ${metric.name}! Up ${roundedDev}% vs. your 4-week rolling average.`,
              ai_recommendation: current > (metric.goal || 0)
                ? `You're exceeding your ${metric.name} goal — keep up the strong performance!`
                : `Keep pushing — you're trending in the right direction on ${metric.name}.`,
            });
          }
        });
      });

      patch({
        analysisProgress: [
          'Fetching KPI metrics and values...',
          `Found ${metrics.length} active KPIs. Fetching historical values...`,
          'Analyzing deviations and detecting anomalies...',
          `Detected ${anomalies.length} anomalies across ${new Set(anomalies.map((a: any) => a.profile_id)).size} reps.`,
        ],
      });

      // Step 4: Save anomalies — clear ALL active anomalies for this org (any period),
      // then insert new ones for the current analyzed period. Previous scans may have
      // left anomalies from older periods that no longer reflect current data.
      await supabase
        .from('engage_kpi_anomalies')
        .delete()
        .eq('organization_id', organizationId)
        .eq('status', 'active');
      if (anomalies.length > 0) {
        await supabase.from('engage_kpi_anomalies').insert(anomalies);
      }

      // Step 5: Get AI analysis for critical/warning anomalies
      const serious = anomalies.filter((a: any) => a.severity !== 'info');
      if (serious.length > 0) {
        patch({
          analysisProgress: [
            'Fetching KPI metrics and values...',
            `Found ${metrics.length} active KPIs. Fetching historical values...`,
            'Analyzing deviations and detecting anomalies...',
            `Detected ${anomalies.length} anomalies across ${new Set(anomalies.map((a: any) => a.profile_id)).size} reps.`,
            'Generating AI analysis and coaching recommendations...',
          ],
        });

        try {
          const json = await backendFetch('/api/engage/watchdog/analyze', {
            anomalies: serious.map((a: any) => {
              const prof = profileMap.get(a.profile_id);
              return {
                kpi_name: a.kpi_name,
                profile_name: prof
                  ? `${prof.first_name} ${prof.last_name}`
                  : 'Rep',
                anomaly_type: a.anomaly_type,
                severity: a.severity,
                current_value: a.current_value,
                rolling_avg: a.rolling_avg,
                deviation_pct: a.deviation_pct,
              };
            }),
          });
          const analyses = json?.analyses;
          if (analyses) {
            // Update anomalies with AI analysis
            for (let i = 0; i < Math.min(serious.length, analyses.length); i++) {
              if (analyses[i]) {
                await supabase
                  .from('engage_kpi_anomalies')
                  .update({
                    ai_analysis: analyses[i].analysis,
                    ai_recommendation: analyses[i].recommendation,
                  })
                  .eq('organization_id', organizationId)
                  .eq('profile_id', serious[i].profile_id)
                  .eq('kpi_key', serious[i].kpi_key)
                  .eq('detected_at', serious[i].detected_at);
              }
            }
          }
        } catch { /* AI analysis is optional */ }
      }

      patch({ isAnalyzing: false });
      await fetchAnomalies();
    } catch (err: any) {
      patch({ error: err.message, isAnalyzing: false });
    }
  }, [organizationId, patch, fetchAnomalies]);

  // ── Update anomaly status ──────────────────────────────

  const updateAnomalyStatus = useCallback(async (anomalyId: string, status: KpiAnomaly['status']) => {
    try {
      const updates: any = { status };
      if (status === 'acknowledged') {
        updates.acknowledged_by = userId;
        updates.acknowledged_at = new Date().toISOString();
      }
      if (status === 'resolved') {
        updates.resolved_at = new Date().toISOString();
      }
      await supabase.from('engage_kpi_anomalies').update(updates).eq('id', anomalyId);
      await fetchAnomalies();
    } catch (err: any) {
      patch({ error: err.message });
    }
  }, [userId, fetchAnomalies, patch]);

  // ── Dismiss anomaly ────────────────────────────────────

  const dismissAnomaly = useCallback(async (anomalyId: string) => {
    return updateAnomalyStatus(anomalyId, 'dismissed');
  }, [updateAnomalyStatus]);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchAnomalies();
  }, [fetchAnomalies]);

  return {
    ...state,
    fetchAnomalies,
    runAnalysis,
    updateAnomalyStatus,
    dismissAnomaly,
  };
}
