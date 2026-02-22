/**
 * usePipelineOperator — React hook for the Pipeline Operator workflow.
 *
 * Fetches deals from engage_pipeline_deals, computes at-risk flags, 
 * generates AI-powered forecasts, and manages pipeline snapshots.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { backendStream } from '../utils/backendFetch';

// ── Types ──────────────────────────────────────────────────

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

const PIPELINE_STAGES = ['discovery', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost'];
const AT_RISK_DAYS = 7;
const AT_RISK_MIN_VALUE = 10000;

const emptySummary: PipelineSummary = {
  totalValue: 0, weightedValue: 0, dealCount: 0,
  atRiskCount: 0, atRiskValue: 0, commitValue: 0, bestCaseValue: 0,
  avgDealSize: 0, closingThisMonth: 0, closingThisMonthValue: 0,
  stageBreakdown: {},
};

// ── Hook ───────────────────────────────────────────────────

export function usePipelineOperator(organizationId: string, userId?: string) {
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
      const endOfQuarter = new Date(now.getFullYear(), Math.ceil((now.getMonth() + 1) / 3) * 3, 0);

      const deals: PipelineDeal[] = (data || []).map((d: any) => {
        const ownerProfile = d.profiles;
        const ownerName = ownerProfile
          ? `${ownerProfile.first_name || ''} ${ownerProfile.last_name || ''}`.trim()
          : 'Unassigned';

        // Compute days_inactive from last_activity_at (column doesn't exist in DB)
        const lastActivity = d.last_activity_at ? new Date(d.last_activity_at) : new Date(d.created_at);
        const daysInactive = Math.floor((now.getTime() - lastActivity.getTime()) / (1000 * 60 * 60 * 24));
        const isAtRisk = d.deal_value >= AT_RISK_MIN_VALUE && daysInactive >= AT_RISK_DAYS;

        return { ...d, days_inactive: daysInactive, owner_name: ownerName, is_at_risk: isAtRisk };
      });

      // Summary
      const stageBreakdown: Record<string, { count: number; value: number }> = {};
      PIPELINE_STAGES.forEach((s) => {
        stageBreakdown[s] = { count: 0, value: 0 };
      });

      let totalValue = 0, weightedValue = 0, atRiskCount = 0, atRiskValue = 0;
      let commitValue = 0, bestCaseValue = 0;
      let closingThisMonth = 0, closingThisMonthValue = 0;

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

        const stage = d.stage || 'discovery';
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
  }, [organizationId, patch]);

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
        source: 'manual',
      })
      .select()
      .single();
    if (error) throw error;
    await fetchDeals();
    return data;
  }, [organizationId, userId, fetchDeals]);

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
      // Show empty forecast immediately so the UI renders the streaming container
      patch({ loading: false });

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
    } catch (err: any) {
      patch({ error: err.message });
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
    fetchDeals,
    fetchSnapshots,
    refreshAll,
    createDeal,
    updateDeal,
    deleteDeal,
    generateForecast,
    PIPELINE_STAGES,
  };
}
