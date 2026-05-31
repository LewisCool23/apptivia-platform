/**
 * usePipelineOperator — React hook for the Pipeline Operator workflow.
 *
 * Fetches deals from engage_pipeline_deals, computes at-risk flags,
 * generates AI-powered forecasts, and manages pipeline snapshots.
 * When CEP stages are provided, enriches deals with CEP deal-stage data.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { backendStream } from '../utils/backendFetch';
import type { CepStage } from './useCepConfig';

// ── Types ──────────────────────────────────────────────────

export interface CepDealStageData {
  id: string;
  cep_stage_id: string;
  checklist_completed: Record<string, boolean>;
  exit_criteria_met: Record<string, boolean>;
  entered_at: string;
  notes?: string;
  advanced_by?: string;
}

export interface PipelineDeal {
  id: string;
  organization_id: string;
  owner_id?: string;
  deal_name: string;
  deal_value: number;
  stage: string;
  probability: number;
  close_date?: string;
  last_activity_at?: string;
  last_activity_type?: string;
  days_inactive: number;
  source: string;
  external_id?: string;
  crm_url?: string;
  forecast_category: string;
  ai_forecast_note?: string;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Populated from join
  owner_name?: string;
  is_at_risk?: boolean;
  // Account link (migration 177; legacy account_id consolidated in migration 185)
  linked_account_id?: string;
  // Qualification data (migration 196)
  qualification_data?: Record<string, boolean>;
  // CEP (migration 095)
  cep_stage_id?: string;
  currentCepDealStage?: CepDealStageData | null;
}

export interface PipelineSnapshot {
  id: string;
  snapshot_date: string;
  total_pipeline_value: number;
  weighted_value: number;
  deal_count: number;
  at_risk_count: number;
  commit_value: number;
  best_case_value: number;
  ai_forecast_summary?: string;
  ai_confidence?: string;
  stage_breakdown: Record<string, { count: number; value: number }>;
}

export interface PipelineSummary {
  totalValue: number;
  weightedValue: number;
  dealCount: number;
  atRiskCount: number;
  atRiskValue: number;
  commitValue: number;
  bestCaseValue: number;
  avgDealSize: number;
  closingThisMonth: number;
  closingThisMonthValue: number;
  stageBreakdown: Record<string, { count: number; value: number }>;
}

interface PipelineState {
  deals: PipelineDeal[];
  summary: PipelineSummary;
  snapshots: PipelineSnapshot[];
  aiForecast: string | null;
  loading: boolean;
  error: string | null;
}

export const DEFAULT_PIPELINE_STAGES = ['lead', 'opp_creation', 'qualification', 'best_case', 'forecast', 'commit', 'closed_won', 'closed_lost'];
const AT_RISK_DAYS = 7;
const AT_RISK_MIN_VALUE = 10000;

const emptySummary: PipelineSummary = {
  totalValue: 0, weightedValue: 0, dealCount: 0,
  atRiskCount: 0, atRiskValue: 0, commitValue: 0, bestCaseValue: 0,
  avgDealSize: 0, closingThisMonth: 0, closingThisMonthValue: 0,
  stageBreakdown: {},
};

// ── Hook ───────────────────────────────────────────────────

export function usePipelineOperator(
  organizationId: string,
  userId?: string,
  cepStages?: CepStage[],
) {
  const [state, setState] = useState<PipelineState>({
    deals: [],
    summary: emptySummary,
    snapshots: [],
    aiForecast: null,
    loading: true,
    error: null,
  });
  const [refreshing, setRefreshing] = useState(false);

  const patch = useCallback((p: Partial<PipelineState>) => setState((prev) => ({ ...prev, ...p })), []);

  const hasCep = (cepStages?.length ?? 0) > 0;

  // ── Fetch all active deals ─────────────────────────────

  const fetchDeals = useCallback(async () => {
    if (!organizationId) { patch({ loading: false }); return; }
    patch({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('engage_pipeline_deals')
        .select('*, profiles!engage_pipeline_deals_owner_id_fkey(first_name, last_name)')
        .eq('organization_id', organizationId)
        .not('stage', 'in', '("closed_won","closed_lost")')
        .order('close_date', { ascending: true });

      if (error) throw error;

      const now = new Date();
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

      let deals: PipelineDeal[] = (data || []).map((d: any) => {
        const ownerProfile = d.profiles;
        const ownerName = ownerProfile
          ? `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim()
          : 'Unassigned';

        const lastActivity = d.last_activity_at ? new Date(d.last_activity_at) : new Date(d.created_at);
        const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        const isAtRisk = d.deal_value >= AT_RISK_MIN_VALUE && daysInactive >= AT_RISK_DAYS;

        return { ...d, days_inactive: daysInactive, owner_name: ownerName, is_at_risk: isAtRisk };
      });

      // Enrich with CEP deal-stage data if CEP is active
      if (cepStages && cepStages.length > 0 && deals.length > 0) {
        const dealIds = deals.map(d => d.id);
        const { data: dealStages } = await supabase
          .from('cep_deal_stages')
          .select('*')
          .in('deal_id', dealIds)
          .is('exited_at', null);

        const dealStageMap = new Map(
          (dealStages || []).map((ds: any) => [ds.deal_id, ds as CepDealStageData])
        );

        deals = deals.map(d => ({
          ...d,
          currentCepDealStage: (dealStageMap.get(d.id) as CepDealStageData | undefined) || null,
        }));
      }

      // Summary — use CEP stage keys if available, otherwise defaults
      const stageList = (cepStages && cepStages.length > 0)
        ? cepStages.map(s => s.stage_key)
        : DEFAULT_PIPELINE_STAGES;

      const stageBreakdown: Record<string, { count: number; value: number }> = {};
      stageList.forEach((s) => {
        stageBreakdown[s] = { count: 0, value: 0 };
      });

      let totalValue = 0, weightedValue = 0, atRiskCount = 0, atRiskValue = 0;
      let commitValue = 0, bestCaseValue = 0;
      let closingThisMonth = 0, closingThisMonthValue = 0;

      // Build CEP stage-id → stage-key lookup for accurate breakdown
      const cepIdToKey: Record<string, string> = {};
      if (cepStages && cepStages.length > 0) {
        cepStages.forEach(s => { cepIdToKey[s.id] = s.stage_key; });
      }

      deals.forEach((d) => {
        totalValue += d.deal_value;
        weightedValue += d.deal_value * (d.probability / 100);
        if (d.is_at_risk) { atRiskCount++; atRiskValue += d.deal_value; }
        if (d.forecast_category === 'commit') commitValue += d.deal_value;
        if (d.forecast_category === 'best_case') bestCaseValue += d.deal_value;

        if (d.close_date && new Date(d.close_date) <= endOfMonth) {
          closingThisMonth++;
          closingThisMonthValue += d.deal_value;
        }

        // Resolve stage key: prefer cep_stage_id lookup, fallback to stage text
        let stage = d.stage || 'discovery';
        if (d.cep_stage_id && cepIdToKey[d.cep_stage_id]) {
          stage = cepIdToKey[d.cep_stage_id];
        }
        if (!stageBreakdown[stage]) stageBreakdown[stage] = { count: 0, value: 0 };
        stageBreakdown[stage].count++;
        stageBreakdown[stage].value += d.deal_value;
      });

      const summary: PipelineSummary = {
        totalValue,
        weightedValue,
        dealCount: deals.length,
        atRiskCount,
        atRiskValue,
        commitValue,
        bestCaseValue,
        avgDealSize: deals.length > 0 ? totalValue / deals.length : 0,
        closingThisMonth,
        closingThisMonthValue,
        stageBreakdown,
      };

      patch({ deals, summary, loading: false });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch, cepStages]);

  // ── Fetch historical snapshots ─────────────────────────

  const fetchSnapshots = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data } = await supabase
        .from('engage_pipeline_snapshots')
        .select('*')
        .eq('organization_id', organizationId)
        .order('snapshot_date', { ascending: true })
        .limit(30);

      patch({ snapshots: data || [] });
    } catch { /* silent */ }
  }, [organizationId, patch]);

  // ── Create a deal ──────────────────────────────────────

  const createDeal = useCallback(async (deal: Partial<PipelineDeal>) => {
    const { data, error } = await supabase
      .from('engage_pipeline_deals')
      .insert({
        deal_name: deal.deal_name,
        deal_value: deal.deal_value,
        stage: deal.stage || 'discovery',
        probability: deal.probability ?? 20,
        close_date: deal.close_date || null,
        forecast_category: deal.forecast_category || 'pipeline',
        organization_id: organizationId,
        owner_id: userId || null,
        source: deal.source || 'manual',
        ...(deal.linked_account_id && { linked_account_id: deal.linked_account_id }),
      })
      .select()
      .single();
    if (error) throw error;

    // If CEP is active, create initial deal-stage entry
    if (cepStages && cepStages.length > 0 && data) {
      const nonTerminal = cepStages.filter(s => !s.is_terminal);
      const matchingStage = nonTerminal.find(s => s.stage_key === (deal.stage || 'discovery'));
      const firstStage = matchingStage || nonTerminal.reduce(
        (min, s) => (s.stage_order < min.stage_order ? s : min),
        nonTerminal[0],
      );

      if (firstStage) {
        await supabase.from('cep_deal_stages').insert({
          deal_id: data.id,
          cep_stage_id: firstStage.id,
          organization_id: organizationId,
          advanced_by: userId || null,
        });

        await supabase.from('engage_pipeline_deals')
          .update({ cep_stage_id: firstStage.id })
          .eq('id', data.id);
      }
    }

    // Fire-and-forget: log to Activity Feed + Deal Activity panel
    if (organizationId && data) {
      supabase.from('engage_activity_events').insert({
        organization_id: organizationId, actor_id: userId,
        event_type: 'deal.created',
        title: 'Deal Created',
        description: `${data.deal_name} — $${((data.deal_value || 0) / 1000).toFixed(0)}K`,
        icon: '\uD83D\uDCB0', color: '#FF4D2E',
      }).then(() => {}, () => {});

      // Log creation in deal-specific activity panel
      supabase.from('engage_deal_activities').insert({
        organization_id: organizationId,
        deal_id: data.id,
        actor_id: userId,
        activity_type: 'deal_created',
        title: 'Deal Created',
        description: `Created deal "${data.deal_name}" with value $${(data.deal_value || 0).toLocaleString()} in ${data.stage || 'discovery'} stage`,
      }).then(() => {}, () => {});
    }

    await fetchDeals();
    return data;
  }, [organizationId, userId, fetchDeals, cepStages]);

  // ── Update a deal ──────────────────────────────────────

  const updateDeal = useCallback(async (id: string, updates: Partial<PipelineDeal>) => {
    const { error } = await supabase
      .from('engage_pipeline_deals')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchDeals();
  }, [fetchDeals]);

  // ── Delete a deal ──────────────────────────────────────

  const deleteDeal = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('engage_pipeline_deals')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchDeals();
  }, [fetchDeals]);

  // ── CEP: Advance deal to next stage ────────────────────

  const advanceDealStage = useCallback(async (
    dealId: string,
    _fromStageId: string,
    toStageId: string,
    toStageKey: string,
    toWinProbability: number,
  ) => {
    // 1. Close current cep_deal_stages row
    await supabase
      .from('cep_deal_stages')
      .update({ exited_at: new Date().toISOString() })
      .eq('deal_id', dealId)
      .is('exited_at', null);

    // 2. Insert new cep_deal_stages row for target stage
    await supabase.from('cep_deal_stages').insert({
      deal_id: dealId,
      cep_stage_id: toStageId,
      organization_id: organizationId,
      advanced_by: userId || null,
    });

    // 3. Update deal's cep_stage_id, stage text, and probability
    await supabase
      .from('engage_pipeline_deals')
      .update({
        cep_stage_id: toStageId,
        stage: toStageKey,
        probability: toWinProbability,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealId);

    // 4. Refresh
    await fetchDeals();
  }, [organizationId, userId, fetchDeals]);

  // ── CEP: Update deal checklist ─────────────────────────

  const updateDealChecklist = useCallback(async (
    dealStageId: string,
    checklistCompleted: Record<string, boolean>,
  ) => {
    await supabase
      .from('cep_deal_stages')
      .update({ checklist_completed: checklistCompleted })
      .eq('id', dealStageId);

    await fetchDeals();
  }, [fetchDeals]);

  // ── CEP: Assign CEP stage to a deal that has none ──────

  const assignCepStage = useCallback(async (dealId: string, stageId: string, stageKey: string, winProbability: number) => {
    await supabase.from('cep_deal_stages').insert({
      deal_id: dealId,
      cep_stage_id: stageId,
      organization_id: organizationId,
      advanced_by: userId || null,
    });

    await supabase.from('engage_pipeline_deals')
      .update({
        cep_stage_id: stageId,
        stage: stageKey,
        probability: winProbability,
        updated_at: new Date().toISOString(),
      })
      .eq('id', dealId);

    await fetchDeals();
  }, [organizationId, userId, fetchDeals]);

  // ── Generate AI Forecast (streaming SSE) ─────────────
  // Streams tokens progressively from the backend so the UI updates
  // in real time rather than waiting for the full response.

  const generateForecast = useCallback(async () => {
    if (state.deals.length === 0) return;
    patch({ aiForecast: '', error: null, loading: true });

    const dealPayload = state.deals.map((d) => ({
      deal_name: d.deal_name,
      deal_value: d.deal_value,
      stage: d.stage,
      probability: d.probability,
      close_date: d.close_date,
      days_inactive: d.days_inactive,
      forecast_category: d.forecast_category,
      owner_name: d.owner_name,
      is_at_risk: d.is_at_risk,
    }));

    let fullForecast = '';

    try {
      const stream = backendStream('/api/engage/pipeline/forecast', {
        deals: dealPayload,
        summary: state.summary,
      });

      for await (const token of stream) {
        fullForecast += token;
        patch({ aiForecast: fullForecast });
      }

      // Save snapshot once the full text has been received
      await supabase.from('engage_pipeline_snapshots').upsert({
        organization_id: organizationId,
        snapshot_date: new Date().toISOString().split('T')[0],
        total_pipeline_value: state.summary.totalValue,
        weighted_value: state.summary.weightedValue,
        deal_count: state.summary.dealCount,
        at_risk_count: state.summary.atRiskCount,
        commit_value: state.summary.commitValue,
        best_case_value: state.summary.bestCaseValue,
        ai_forecast_summary: fullForecast,
        ai_confidence: 'medium',
        stage_breakdown: state.summary.stageBreakdown,
      }, { onConflict: 'organization_id,snapshot_date' });

      await fetchSnapshots();
      patch({ loading: false });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [state.deals, state.summary, organizationId, patch, fetchSnapshots]);

  // ── Refresh all data ─────────────────────────────────

  const refreshAll = useCallback(async () => {
    setRefreshing(true);
    try {
      await fetchDeals();
      await fetchSnapshots();
    } finally {
      setRefreshing(false);
    }
  }, [fetchDeals, fetchSnapshots]);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchDeals();
    fetchSnapshots();
  }, [fetchDeals, fetchSnapshots]);

  return {
    ...state,
    refreshing,
    hasCep,
    fetchDeals,
    fetchSnapshots,
    refreshAll,
    createDeal,
    updateDeal,
    deleteDeal,
    generateForecast,
    advanceDealStage,
    updateDealChecklist,
    assignCepStage,
    DEFAULT_PIPELINE_STAGES,
  };
}
