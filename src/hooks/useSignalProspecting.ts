/**
 * useSignalProspecting — React hook for the Signal-Based Prospecting workflow.
 *
 * Detects intent signals via web search (Tavily) and AI analysis,
 * stores them in engage_intent_signals, and links to prospects/companies.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ── Types ──────────────────────────────────────────────────

export interface IntentSignal {
  id: string;
  organization_id: string;
  prospect_id?: string;
  company_id?: string;
  company_name?: string;
  prospect_name?: string;
  signal_type: string;
  signal_strength: 'low' | 'medium' | 'high' | 'very_high';
  signal_score: number;
  title: string;
  description?: string;
  source_url?: string;
  source_platform?: string;
  detected_at: string;
  ai_summary?: string;
  ai_recommended_action?: string;
  ai_outreach_angle?: string;
  status: 'new' | 'reviewed' | 'actioned' | 'dismissed';
  actioned_by?: string;
  actioned_at?: string;
  raw_data?: any;
  tags: string[];
  created_at: string;
  // Enhanced ABM fields
  buying_stage_indicator?: string;  // which buying stage this signal suggests
  pattern_id?: string;              // links signals in same cluster
  is_pattern_trigger?: boolean;     // true if this signal triggered a pattern
  outcome?: 'won' | 'lost' | 'pending';
  outcome_at?: string;
  contributed_to_deal_id?: string;
}

export interface SignalScanConfig {
  // === COMPETITOR INTELLIGENCE ===
  competitors: string[];              // Company names/domains to track

  // === ICP FIRMOGRAPHICS ===
  icp_industries: string[];           // Target industries (e.g., "B2B SaaS", "Tech", "Professional Services")
  icp_employee_range: string;         // e.g. '50-500'
  icp_regions: string[];              // e.g. ['North America', 'EMEA']
  icp_revenue_range?: string;         // e.g. '$5M-$100M ARR'

  // === BUYER INTENT SIGNALS ===
  pain_points: string[];              // Problems you solve (e.g., "disconnected sales tools", "no rep visibility")
  solution_keywords: string[];        // What buyers search for (e.g., "sales gamification", "SDR coaching software")
  job_titles_to_track: string[];      // Hiring these = need you (e.g., "VP Sales", "Sales Ops Director", "SDR Manager")
  
  // === TECH STACK SIGNALS ===
  tech_stack_positive: string[];      // Companies using these are good fits (e.g., "Salesforce", "HubSpot", "Outreach")
  tech_stack_negative: string[];      // Companies using these are NOT fits (e.g., competitor products)
  tech_stack_churning: string[];      // Companies leaving these = opportunity (competitor products)

  // === GENERAL ===
  keywords: string[];                 // Additional topics to monitor
  signal_types: string[];             // Which signal categories to scan for
}

export interface SignalSummary {
  totalSignals: number;
  newSignals: number;
  highIntentCount: number;
  byType: Record<string, number>;
  byStrength: Record<string, number>;
  byBuyingStage: Record<string, number>;
  topCompanies: { name: string; count: number; score: number }[];
}

interface SignalState {
  signals: IntentSignal[];
  summary: SignalSummary;
  scanConfig: SignalScanConfig;
  isScanning: boolean;
  scanProgress: { step: string; detail: string }[];
  lastScanSignalIds: string[];
  loading: boolean;
  error: string | null;
}

const SIGNAL_TYPES = [
  // === BUYER INTENT SIGNALS (highest value) ===
  { key: 'solution_search', label: 'Solution Search', icon: '🔍' },        // Searching for your solution category
  { key: 'pain_point', label: 'Pain Point Expressed', icon: '😤' },        // Company expressing problems you solve
  { key: 'icp_job_posting', label: 'ICP Job Posting', icon: '📋' },        // Hiring roles that signal need
  { key: 'tech_stack_churn', label: 'Tech Stack Churn', icon: '🔄' },      // Leaving competitor/related tool
  { key: 'competitor_comparison', label: 'Competitor Comparison', icon: '⚖️' }, // Researching alternatives
  
  // === COMPETITIVE INTELLIGENCE ===
  { key: 'competitor_engagement', label: 'Competitor Engagement', icon: '🎯' },
  { key: 'competitor_complaint', label: 'Competitor Complaint', icon: '😠' },
  
  // === COMPANY EVENTS (buying triggers) ===
  { key: 'funding', label: 'Funding Round', icon: '💰' },
  { key: 'leadership_change', label: 'Leadership Change', icon: '👔' },
  { key: 'expansion', label: 'Expansion/Growth', icon: '📈' },
  { key: 'layoffs', label: 'Layoffs/Restructuring', icon: '📉' },
  { key: 'contract_win', label: 'Contract Win', icon: '🏆' },
  { key: 'product_launch', label: 'Product Launch', icon: '🚀' },
  
  // === ENGAGEMENT SIGNALS ===
  { key: 'hiring', label: 'General Hiring', icon: '👥' },
  { key: 'job_change', label: 'Job Change', icon: '💼' },
  { key: 'content_engagement', label: 'Content Engagement', icon: '📰' },
  { key: 'event_participation', label: 'Event Participation', icon: '🎤' },
  { key: 'review_sentiment', label: 'Review/Sentiment', icon: '⭐' },
  { key: 'press_release', label: 'Press Release', icon: '📢' },
  { key: 'tech_adoption', label: 'Tech Adoption', icon: '⚙️' },
];

const defaultConfig: SignalScanConfig = {
  // Competitors
  competitors: [],
  
  // ICP Firmographics
  icp_industries: [],
  icp_employee_range: '50-500',
  icp_regions: ['North America'],
  icp_revenue_range: '',
  
  // Buyer Intent (these are the key differentiators)
  pain_points: [],
  solution_keywords: [],
  job_titles_to_track: [],
  
  // Tech Stack
  tech_stack_positive: [],
  tech_stack_negative: [],
  tech_stack_churning: [],
  
  // General
  keywords: [],
  signal_types: ['solution_search', 'pain_point', 'icp_job_posting', 'competitor_complaint', 'funding', 'leadership_change'],
};

const emptySummary: SignalSummary = {
  totalSignals: 0, newSignals: 0, highIntentCount: 0,
  byType: {}, byStrength: {}, byBuyingStage: {}, topCompanies: [],
};

// ── Hook ───────────────────────────────────────────────────

export function useSignalProspecting(organizationId: string, userId?: string) {
  const [state, setState] = useState<SignalState>({
    signals: [],
    summary: emptySummary,
    scanConfig: defaultConfig,
    isScanning: false,
    scanProgress: [],
    lastScanSignalIds: [],
    loading: true,
    error: null,
  });

  const patch = useCallback((p: Partial<SignalState>) => setState((prev) => ({ ...prev, ...p })), []);

  // ── Fetch existing signals ────────────────────────────

  const fetchSignals = useCallback(async (filters?: { status?: string; signal_type?: string; limit?: number }) => {
    if (!organizationId) { patch({ loading: false }); return; }
    patch({ loading: true, error: null });

    try {
      let q = supabase
        .from('engage_intent_signals')
        .select('*')
        .eq('organization_id', organizationId)
        .order('signal_score', { ascending: false })
        .order('detected_at', { ascending: false });

      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.signal_type) q = q.eq('signal_type', filters.signal_type);
      q = q.limit(filters?.limit || 100);

      const { data, error } = await q;
      if (error) throw error;

      const signals: IntentSignal[] = data || [];

      // Compute summary
      const byType: Record<string, number> = {};
      const byStrength: Record<string, number> = {};
      const byBuyingStage: Record<string, number> = {};
      const companyMap: Record<string, { count: number; totalScore: number }> = {};
      let newCount = 0;
      let highIntentCount = 0;

      signals.forEach((s) => {
        byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
        byStrength[s.signal_strength] = (byStrength[s.signal_strength] || 0) + 1;
        if (s.buying_stage_indicator) {
          byBuyingStage[s.buying_stage_indicator] = (byBuyingStage[s.buying_stage_indicator] || 0) + 1;
        }
        if (s.status === 'new') newCount++;
        if (s.signal_score >= 70) highIntentCount++;

        if (s.company_name) {
          if (!companyMap[s.company_name]) companyMap[s.company_name] = { count: 0, totalScore: 0 };
          companyMap[s.company_name].count++;
          companyMap[s.company_name].totalScore += s.signal_score;
        }
      });

      const topCompanies = Object.entries(companyMap)
        .map(([name, { count, totalScore }]) => ({ name, count, score: Math.round(totalScore / count) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      patch({
        signals,
        summary: {
          totalSignals: signals.length,
          newSignals: newCount,
          highIntentCount,
          byType,
          byStrength,
          byBuyingStage,
          topCompanies,
        },
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch]);

  // ── Run AI Signal Scan ─────────────────────────────────

  const runSignalScan = useCallback(async (config?: Partial<SignalScanConfig>) => {
    const scanConfig = { ...state.scanConfig, ...config };
    const preExistingIds = new Set(state.signals.map((s) => s.id));
    patch({ isScanning: true, error: null, scanProgress: [], lastScanSignalIds: [], scanConfig });

    try {
      // Step 1: Search for competitor signals
      patch({ scanProgress: [{ step: 'Scanning', detail: 'Searching for intent signals across the web...' }] });

      const { data: json, error: fnError } = await supabase.functions.invoke('engage-signals', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          config: scanConfig,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Signal scan failed');
      if (json?.error) throw new Error(json.error);

      const returnedSignals: IntentSignal[] = json.signals || [];

      patch({
        scanProgress: [
          { step: 'Scanning', detail: 'Search complete.' },
          { step: 'Analysis', detail: `Found ${json.signals_found || 0} signals.` },
          { step: 'Saved', detail: `Saved ${json.signals_saved || 0} new signals to database.` },
        ],
        isScanning: false,
      });

      // Refresh signals from the database
      await fetchSignals();

      // Fallback: if DB fetch returned nothing but scan found signals, use them directly
      setState((prev) => {
        let signals = prev.signals;
        if (signals.length === 0 && returnedSignals.length > 0) {
          // Use the signals returned directly from the scan
          signals = returnedSignals;

          // Recompute summary from returned signals
          const byType: Record<string, number> = {};
          const byStrength: Record<string, number> = {};
          const byBuyingStage: Record<string, number> = {};
          const companyMap: Record<string, { count: number; totalScore: number }> = {};
          let newCount = 0;
          let highIntentCount = 0;

          signals.forEach((s) => {
            byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
            byStrength[s.signal_strength] = (byStrength[s.signal_strength] || 0) + 1;
            if (s.buying_stage_indicator) {
              byBuyingStage[s.buying_stage_indicator] = (byBuyingStage[s.buying_stage_indicator] || 0) + 1;
            }
            if (s.status === 'new') newCount++;
            if (s.signal_score >= 70) highIntentCount++;
            if (s.company_name) {
              if (!companyMap[s.company_name]) companyMap[s.company_name] = { count: 0, totalScore: 0 };
              companyMap[s.company_name].count++;
              companyMap[s.company_name].totalScore += s.signal_score;
            }
          });

          const topCompanies = Object.entries(companyMap)
            .map(([name, { count, totalScore }]) => ({ name, count, score: Math.round(totalScore / count) }))
            .sort((a, b) => b.score - a.score)
            .slice(0, 10);

          return {
            ...prev,
            signals,
            summary: {
              totalSignals: signals.length,
              newSignals: newCount,
              highIntentCount,
              byType,
              byStrength,
              byBuyingStage,
              topCompanies,
            },
            lastScanSignalIds: signals.map((s) => s.id),
          };
        }

        // Normal path: DB fetch worked, just compute new IDs
        const newIds = signals
          .filter((s) => !preExistingIds.has(s.id))
          .map((s) => s.id);
        return { ...prev, lastScanSignalIds: newIds };
      });
    } catch (err: any) {
      patch({ error: err.message, isScanning: false });
    }
  }, [state.scanConfig, organizationId, userId, patch, fetchSignals]);

  // ── Update signal status ───────────────────────────────

  const updateSignalStatus = useCallback(async (signalId: string, status: IntentSignal['status']) => {
    try {
      const updates: any = { status };
      if (status === 'actioned') {
        updates.actioned_by = userId;
        updates.actioned_at = new Date().toISOString();
      }
      await supabase.from('engage_intent_signals').update(updates).eq('id', signalId);
      await fetchSignals();
    } catch (err: any) {
      patch({ error: err.message });
    }
  }, [userId, fetchSignals, patch]);

  // ── Dismiss signal ─────────────────────────────────────

  const dismissSignal = useCallback(async (signalId: string) => {
    return updateSignalStatus(signalId, 'dismissed');
  }, [updateSignalStatus]);

  // ── Update scan config ─────────────────────────────────

  const setScanConfig = useCallback((config: Partial<SignalScanConfig>) => {
    patch({ scanConfig: { ...state.scanConfig, ...config } });
  }, [state.scanConfig, patch]);

  // ── Clear last scan results ────────────────────────────

  const clearLastScan = useCallback(() => {
    patch({ lastScanSignalIds: [], scanProgress: [] });
  }, [patch]);

  // ── Clear all signals from database ────────────────────

  const clearAllSignals = useCallback(async () => {
    if (!organizationId) return;
    try {
      patch({ loading: true, error: null });
      await supabase
        .from('engage_intent_signals')
        .delete()
        .eq('organization_id', organizationId);
      
      patch({
        signals: [],
        summary: emptySummary,
        lastScanSignalIds: [],
        scanProgress: [],
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch]);

  // ── Dismiss all signals (mark as dismissed, keep in DB) ────

  const dismissAllSignals = useCallback(async () => {
    if (!organizationId) return;
    try {
      patch({ loading: true, error: null });
      await supabase
        .from('engage_intent_signals')
        .update({ status: 'dismissed' })
        .eq('organization_id', organizationId)
        .neq('status', 'dismissed');
      
      // Update local state - mark all as dismissed and recalculate summary
      const dismissedSignals = state.signals.map((s: IntentSignal) => ({ ...s, status: 'dismissed' as const }));
      
      // Recalculate summary with all signals dismissed
      const byType: Record<string, number> = {};
      const byStrength: Record<string, number> = {};
      const byBuyingStage: Record<string, number> = {};
      const companyMap: Record<string, { count: number; totalScore: number }> = {};

      for (const sig of dismissedSignals) {
        byType[sig.signal_type] = (byType[sig.signal_type] || 0) + 1;
        byStrength[sig.signal_strength] = (byStrength[sig.signal_strength] || 0) + 1;
        if (sig.buying_stage_indicator) {
          byBuyingStage[sig.buying_stage_indicator] = (byBuyingStage[sig.buying_stage_indicator] || 0) + 1;
        }
        if (sig.company_name) {
          if (!companyMap[sig.company_name]) companyMap[sig.company_name] = { count: 0, totalScore: 0 };
          companyMap[sig.company_name].count++;
          companyMap[sig.company_name].totalScore += sig.signal_score;
        }
      }

      const topCompanies = Object.entries(companyMap)
        .map(([name, { count, totalScore }]) => ({ name, count, score: Math.round(totalScore / count) }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);

      patch({
        signals: dismissedSignals,
        summary: {
          totalSignals: dismissedSignals.length,
          newSignals: 0, // All dismissed, none are 'new'
          highIntentCount: dismissedSignals.filter((s: IntentSignal) => s.signal_score >= 80).length,
          byType,
          byStrength,
          byBuyingStage,
          topCompanies,
        },
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch, state.signals]);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  return {
    ...state,
    fetchSignals,
    runSignalScan,
    updateSignalStatus,
    dismissSignal,
    dismissAllSignals,
    setScanConfig,
    clearLastScan,
    clearAllSignals,
    SIGNAL_TYPES,
  };
}
