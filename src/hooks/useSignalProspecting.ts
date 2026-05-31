/**
 * useSignalProspecting — React hook for the Signal-Based Prospecting workflow.
 *
 * Detects intent signals via web search (Tavily) and AI analysis,
 * stores them in engage_intent_signals, and links to prospects/companies.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { engageApi } from '../utils/engageApi';
import { backendFetch } from '../utils/backendFetch';

// M8 fix: import from shared constants (single source of truth)
import { SIGNAL_HIGH_INTENT_THRESHOLD } from '../constants/signalThresholds';
export { SIGNAL_HIGH_INTENT_THRESHOLD };

// ── Types ──────────────────────────────────────────────────

export interface SignalDefinition {
  definition_id: string | null;   // null for org-custom signals
  org_config_id: string | null;   // null for pure universal signals
  signal_key: string;
  signal_name: string;
  category: 'buyer_intent' | 'interest' | 'company_event' | 'universal';
  description: string | null;
  effective_score: number;
  effective_strength: 'low' | 'medium' | 'high' | 'very_high';
  icon: string | null;
  sort_order: number;
  is_universal: boolean;
  is_enabled: boolean;
}

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

export interface SuggestedContact {
  id?: string;
  name: string;
  first_name?: string;
  last_name?: string;
  title?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
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

// Action queue item — AI-drafted outreach awaiting approval
export interface SignalActionItem {
  id: string;
  signal_id: string;
  org_id: string;
  profile_id?: string;
  draft_email_subject?: string;
  draft_email_body?: string;
  draft_linkedin_message?: string;
  outreach_angle?: string;
  recommended_action?: string;
  status: 'pending' | 'approved' | 'sent' | 'dismissed';
  play_type?: 'single_action' | 'pre_call_nurture' | 'post_call_follow_up' | 'no_show_recovery' | 'lead_reactivation' | 'social_to_pipeline';
  created_at: string;
  actioned_at?: string;
  actioned_by?: string;
  signal?: IntentSignal;
}

// [SPEC 09] Multi-step play step
export interface ActionStep {
  id: string;
  action_id: string;
  organization_id: string;
  step_order: number;
  channel: 'email' | 'linkedin_dm' | 'linkedin_connection' | 'phone_call' | 'task';
  step_type: string;
  draft_subject?: string;
  draft_body: string;
  scheduled_for: string;
  status: 'pending' | 'sent' | 'replied' | 'skipped_replied_earlier' | 'cancelled' | 'failed';
  sent_at?: string;
  reply_at?: string;
  skip_if_replied: boolean;
  skip_if_meeting_booked: boolean;
  created_at: string;
  updated_at: string;
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
  orgIcpConfig: any | null;
  icpEnabled: boolean;
  orgSignalConfig: any | null;
  hasOrgSignalConfig: boolean;
  companyContacts: Record<string, SuggestedContact[]>;
  enrichingCompanies: string[];
  signalDefinitions: SignalDefinition[];
  signalDefinitionsLoading: boolean;
  // Autopilot: action queue
  actionQueue: SignalActionItem[];
  actionQueueLoading: boolean;
  lastScanAt: string | null;
  nextScanAt: string | null;
  // [SPEC 09] Multi-step play steps
  actionSteps: Record<string, ActionStep[]>;
  expandingActionId: string | null;
}

const SIGNAL_TYPES = [
  // === BUYER INTENT ===
  { key: 'rfp_issuance',            label: 'RFP Issued',              icon: '📄' },
  { key: 'demo_request_competitor', label: 'Competitor Demo Request',  icon: '🎯' },
  { key: 'pricing_page_research',   label: 'Pricing Page Research',   icon: '🔍' },
  { key: 'category_keyword_search', label: 'Category Keyword Search', icon: '🔍' },
  { key: 'case_study_consumption',  label: 'Case Study Consumption',  icon: '📰' },
  { key: 'reddit_buying_intent',    label: 'Reddit: Buying Intent',   icon: '💬' },
  { key: 'reddit_churn_risk',       label: 'Reddit: Churn Risk',      icon: '💬' },
  { key: 'solution_search',         label: 'Solution Search',         icon: '🔍' },
  { key: 'pain_point',              label: 'Pain Point Expressed',    icon: '😤' },
  { key: 'competitor_comparison',   label: 'Competitor Comparison',   icon: '⚖️' },
  { key: 'competitor_complaint',    label: 'Competitor Complaint',    icon: '😠' },
  { key: 'competitor_engagement',   label: 'Competitor Engagement',   icon: '🎯' },

  // === COMPANY EVENTS ===
  { key: 'funding_round',           label: 'Funding Round',           icon: '💰' },
  { key: 'leadership_change',       label: 'Leadership Change',       icon: '👔' },
  { key: 'sales_leadership_hire',   label: 'Sales Leadership Hire',   icon: '👔' },
  { key: 'executive_departure',     label: 'Executive Departure',     icon: '🚪' },
  { key: 'ma_activity',             label: 'M&A Activity',            icon: '🤝' },
  { key: 'ipo_or_spac',             label: 'IPO / SPAC Filing',       icon: '📈' },
  { key: 'private_equity_investment', label: 'PE Investment',         icon: '💼' },
  { key: 'layoffs_restructuring',   label: 'Layoffs / Restructuring', icon: '📉' },
  { key: 'company_expansion',       label: 'Company Expansion',       icon: '📈' },
  { key: 'key_contact_job_change',  label: 'Key Contact Job Change',  icon: '💼' },
  { key: 'headcount_growth',        label: 'Headcount Growth',        icon: '👥' },
  { key: 'sales_team_expansion',    label: 'Sales Team Expansion',    icon: '👥' },
  { key: 'sales_enablement_hire',   label: 'Sales Enablement Hire',   icon: '📋' },
  { key: 'high_employee_growth',    label: 'Rapid Employee Growth',   icon: '📈' },
  { key: 'product_launch',          label: 'Product Launch',          icon: '🚀' },
  { key: 'product_hunt_launch',     label: 'Product Hunt Launch',     icon: '🐱' },
  { key: 'hiring_velocity',         label: 'Rapid Hiring',            icon: '⚡' },
  { key: 'dept_expansion',          label: 'Dept. Expansion',         icon: '🏗️' },
  { key: 'strategic_partnership',   label: 'Strategic Partnership',   icon: '🤝' },
  { key: 'new_market_entry',        label: 'New Market Entry',        icon: '🌍' },
  { key: 'rebranding',              label: 'Company Rebrand',         icon: '🎨' },
  { key: 'government_contract_win', label: 'Gov/Enterprise Contract', icon: '🏆' },
  { key: 'revenue_milestone',       label: 'Revenue Milestone',       icon: '💰' },
  { key: 'cost_reduction_initiative', label: 'Cost Reduction',        icon: '✂️' },
  { key: 'board_change',            label: 'Board Member Addition',   icon: '👔' },
  { key: 'contract_win',            label: 'Contract Win',            icon: '🏆' },
  { key: 'sec_filing',              label: 'SEC Filing',              icon: '📑' },

  // === INTEREST ===
  { key: 'g2_review',               label: 'G2 Review',               icon: '🌟' },
  { key: 'capterra_review',         label: 'Capterra Review',         icon: '⭐' },
  { key: 'review_site_activity',    label: 'Review Site Activity',    icon: '⭐' },
  { key: 'reddit_competitor_mention', label: 'Reddit: Competitor',    icon: '💬' },
  { key: 'job_posting_ops',         label: 'Sales Ops Job Posting',   icon: '📋' },
  { key: 'crm_adoption',            label: 'CRM Adoption',            icon: '⚙️' },
  { key: 'tech_stack_change',       label: 'Tech Stack Change',       icon: '🔄' },
  { key: 'tech_stack_expansion',    label: 'Tech Stack Expansion',    icon: '🔄' },
  { key: 'cloud_migration',         label: 'Cloud Migration',         icon: '☁️' },
  { key: 'digital_transformation',  label: 'Digital Transformation',  icon: '💡' },
  { key: 'content_engagement',      label: 'Content Engagement',      icon: '📰' },
  { key: 'event_sponsorship',       label: 'Event Sponsorship',       icon: '🎤' },
  { key: 'news_mention',            label: 'News / Press Mention',    icon: '📢' },
  { key: 'analyst_report_mention',  label: 'Analyst Report Mention',  icon: '📊' },
  { key: 'operations_hire',         label: 'Operations / Finance Hire', icon: '💼' },
  { key: 'tech_adoption',           label: 'Tech Adoption',           icon: '⚙️' },
  { key: 'tech_stack_churn',        label: 'Tech Stack Churn',        icon: '🔄' },
  { key: 'event_participation',     label: 'Event Participation',     icon: '🎤' },
  { key: 'press_release',           label: 'Press Release',           icon: '📢' },

  // === GLASSDOOR ===
  { key: 'glassdoor_leadership_concern', label: 'Glassdoor: Leadership', icon: '🪟' },
  { key: 'glassdoor_culture_issue',      label: 'Glassdoor: Culture',    icon: '🪟' },
  { key: 'glassdoor_rating_decline',     label: 'Glassdoor: Rating Drop', icon: '🪟' },

  // === WEBSITE VISITOR ID ===
  { key: 'website_visit', label: 'Website Visit', icon: '🌐' },

  // === LEGACY (backward compat for existing DB rows) ===
  { key: 'funding',          label: 'Funding Round (legacy)',       icon: '💰' },
  { key: 'expansion',        label: 'Expansion (legacy)',           icon: '📈' },
  { key: 'layoffs',          label: 'Layoffs (legacy)',             icon: '📉' },
  { key: 'job_change',       label: 'Job Change (legacy)',          icon: '💼' },
  { key: 'hiring',           label: 'Hiring (legacy)',              icon: '👥' },
  { key: 'review_sentiment', label: 'Review Sentiment (legacy)',    icon: '⭐' },
  { key: 'icp_job_posting',  label: 'ICP Job Posting (legacy)',     icon: '📋' },
  { key: 'reddit_signal',    label: 'Reddit (legacy)',              icon: '💬' },
  { key: 'glassdoor_sentiment', label: 'Glassdoor (legacy)',        icon: '🪟' },
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
  signal_types: ['solution_search', 'pain_point', 'job_posting_ops', 'competitor_complaint', 'funding_round', 'leadership_change'],
};

const emptySummary: SignalSummary = {
  totalSignals: 0, newSignals: 0, highIntentCount: 0,
  byType: {}, byStrength: {}, byBuyingStage: {}, topCompanies: [],
};

/** Single-pass signal summary computation — used in fetchSignals, runSignalScan fallback, and dismissAll */
function computeSignalSummary(signals: IntentSignal[]): SignalSummary {
  const byType: Record<string, number> = {};
  const byStrength: Record<string, number> = {};
  const byBuyingStage: Record<string, number> = {};
  const companyMap: Record<string, { count: number; totalScore: number }> = {};
  let newCount = 0;
  let highIntentCount = 0;

  for (const s of signals) {
    byType[s.signal_type] = (byType[s.signal_type] || 0) + 1;
    byStrength[s.signal_strength] = (byStrength[s.signal_strength] || 0) + 1;
    if (s.buying_stage_indicator) {
      byBuyingStage[s.buying_stage_indicator] = (byBuyingStage[s.buying_stage_indicator] || 0) + 1;
    }
    if (s.status === 'new') newCount++;
    if (s.signal_score >= SIGNAL_HIGH_INTENT_THRESHOLD) highIntentCount++;
    if (s.company_name) {
      if (!companyMap[s.company_name]) companyMap[s.company_name] = { count: 0, totalScore: 0 };
      companyMap[s.company_name].count++;
      companyMap[s.company_name].totalScore += s.signal_score;
    }
  }

  const topCompanies = Object.entries(companyMap)
    .map(([name, { count, totalScore }]) => ({ name, count, score: Math.round(totalScore / count) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  return { totalSignals: signals.length, newSignals: newCount, highIntentCount, byType, byStrength, byBuyingStage, topCompanies };
}

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
    orgIcpConfig: null,
    icpEnabled: false,
    orgSignalConfig: null,
    hasOrgSignalConfig: false,
    companyContacts: {},
    enrichingCompanies: [],
    signalDefinitions: [],
    signalDefinitionsLoading: false,
    actionQueue: [],
    actionQueueLoading: false,
    lastScanAt: null,
    nextScanAt: null,
    actionSteps: {},
    expandingActionId: null,
  });

  // Use a ref for in-flight tracking to avoid stale closure issues
  const enrichingRef = useRef<Set<string>>(new Set());

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
      const summary = computeSignalSummary(signals);

      // Don't pre-hydrate contacts from stale DB cache — fetch fresh on demand
      // so contacts always reflect the org's current ICP job title configuration
      patch({
        signals,
        summary,
        companyContacts: {},
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch]);

  // ── Run AI Signal Scan ─────────────────────────────────

  const runSignalScan = useCallback(async (config?: Partial<SignalScanConfig>) => {
    const scanConfig = { ...state.scanConfig, ...config };

    // Mark scan start timestamp BEFORE calling the Edge Function
    // Used to safely distinguish old signals from new ones
    const scanStartedAt = new Date().toISOString();

    // Clear UI state but do NOT delete DB signals yet (safety net for C1/C3)
    patch({
      isScanning: true,
      error: null,
      scanProgress: [],
      lastScanSignalIds: [],
      scanConfig,
    });

    try {
      patch({ scanProgress: [{ step: 'Scanning', detail: 'Searching for intent signals across the web...' }] });

      // Step 1: Call Edge Function FIRST — it inserts new signals into DB
      const { data: json, error: fnError } = await supabase.functions.invoke('engage-signals', {
        body: {
          organization_id: organizationId,
          user_id: userId,
          config: scanConfig,
        },
      });
      if (fnError) throw new Error(fnError.message || 'Signal scan failed');
      if (json?.error) throw new Error(json.error);

      // Merge strategy: edge function handles dedup + stale cleanup.
      // No frontend DELETE needed — new signals are added, old ones preserved.

      const returnedSignals: IntentSignal[] = json.signals || [];

      patch({
        scanProgress: [
          { step: 'Scanning', detail: 'Search complete.' },
          { step: 'Analysis', detail: `Found ${json.signals_found || 0} signals.` },
          { step: 'Saved', detail: `Saved ${json.signals_saved || 0} new signals to database.` },
        ],
        isScanning: false,
      });

      // Refresh signals from DB — old signals removed, new ones present
      await fetchSignals();

      // Fallback: if DB fetch returned nothing but scan found signals, use them directly
      setState((prev) => {
        if (prev.signals.length === 0 && returnedSignals.length > 0) {
          return {
            ...prev,
            signals: returnedSignals,
            summary: computeSignalSummary(returnedSignals),
            lastScanSignalIds: returnedSignals.map((s) => s.id),
          };
        }
        // Normal path: mark all current signals as "from this scan"
        return { ...prev, lastScanSignalIds: prev.signals.map((s) => s.id) };
      });
    } catch (err: any) {
      // On failure, old signals are PRESERVED — no data loss
      patch({ error: err.message, isScanning: false });
    }
  }, [state.scanConfig, organizationId, userId, patch, fetchSignals]);

  // ── Enrich contacts for a company ─────────────────────

  const enrichCompanyContacts = useCallback(async (companyName: string): Promise<SuggestedContact[]> => {
    if (!companyName) return [];

    // Guard: already enriched (skip if array has results; allow retry if empty — may have been a failed fetch)
    if (state.companyContacts[companyName] !== undefined && state.companyContacts[companyName].length > 0) {
      return state.companyContacts[companyName];
    }

    // Guard: in-flight (use ref to avoid stale closure)
    if (enrichingRef.current.has(companyName)) return [];
    enrichingRef.current.add(companyName);

    patch({ enrichingCompanies: Array.from(enrichingRef.current) });

    try {
      // Step 1: Resolve company name → domain
      let domain: string | null = null;
      try {
        const resp = await engageApi.searchOrganizations(companyName);
        const companies: any[] = resp?.companies || [];
        const best = companies.find(
          (c: any) => c.name?.toLowerCase() === companyName.toLowerCase()
        ) || companies[0];
        domain = best?.primary_domain
          || best?.website_url?.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')
          || null;
      } catch {
        // Domain resolution failed
      }

      if (!domain) {
        enrichingRef.current.delete(companyName);
        setState((prev) => ({
          ...prev,
          companyContacts: { ...prev.companyContacts, [companyName]: [] },
          enrichingCompanies: Array.from(enrichingRef.current),
        }));
        return [];
      }

      // Step 2: Fetch suggested contacts by domain
      let contacts: SuggestedContact[] = [];
      try {
        const cleanDomain = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '');
        const resp = await engageApi.getSuggestedContacts(cleanDomain);
        const people: any[] = resp?.data?.people || resp?.data?.contacts || (Array.isArray(resp?.data) ? resp.data : []);
        contacts = people.slice(0, 3).map((p: any) => ({
          id: p.id,
          name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          first_name: p.first_name,
          last_name: p.last_name,
          title: p.title || '',
          email: p.email || '',
          phone: p.phone_numbers?.[0]?.sanitized_number
            || p.phone_numbers?.[0]?.raw_number
            || p.sanitized_phone
            || p.phone_number
            || p.phone
            || '',
          linkedin_url: p.linkedin_url || '',
        }));
      } catch {
        contacts = [];
      }

      // Step 3: Persist contacts onto matching signal rows (fire-and-forget)
      setState((prev) => {
        const matchingSignals = prev.signals.filter((s) => s.company_name === companyName);
        if (matchingSignals.length > 0 && contacts.length > 0) {
          Promise.all(
            matchingSignals.map((s) =>
              supabase
                .from('engage_intent_signals')
                .update({ raw_data: { ...(s.raw_data || {}), suggested_contacts: contacts } })
                .eq('id', s.id)
            )
          ).catch((err) => { console.warn('[Signal] Failed to persist contacts for', companyName, err); });
        }
        return prev;
      });

      // Step 4: Update state (functional update to avoid stale closure when multiple companies enrich concurrently)
      enrichingRef.current.delete(companyName);
      setState((prev) => ({
        ...prev,
        companyContacts: { ...prev.companyContacts, [companyName]: contacts },
        enrichingCompanies: Array.from(enrichingRef.current),
      }));

      return contacts;
    } catch {
      enrichingRef.current.delete(companyName);
      patch({ enrichingCompanies: Array.from(enrichingRef.current) });
      return [];
    }
  }, [state.companyContacts, patch]);

  // ── Update signal status ───────────────────────────────

  const updateSignalStatus = useCallback(async (signalId: string, status: IntentSignal['status']) => {
    try {
      const updates: any = { status };
      if (status === 'actioned') {
        updates.actioned_by = userId;
        updates.actioned_at = new Date().toISOString();
      }
      await supabase.from('engage_intent_signals').update(updates).eq('id', signalId);

      // Fire-and-forget: log to Activity Feed
      if (organizationId && (status === 'actioned' || status === 'dismissed')) {
        const signal = state.signals.find((s: any) => s.id === signalId);
        supabase.from('engage_activity_events').insert({
          organization_id: organizationId, actor_id: userId,
          event_type: `signal.${status}`,
          title: status === 'actioned' ? 'Signal Actioned' : 'Signal Dismissed',
          description: signal ? `${(signal.signal_type || '').replace(/_/g, ' ')} — ${signal.company_name || 'Unknown'}` : undefined,
          icon: status === 'actioned' ? '✅' : '🚫',
          color: status === 'actioned' ? '#10b981' : '#6b7280',
        }).then(() => {}, () => {});
      }

      await fetchSignals();
    } catch (err: any) {
      patch({ error: err.message });
    }
  }, [organizationId, userId, state.signals, fetchSignals, patch]);

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
      patch({
        signals: dismissedSignals,
        summary: computeSignalSummary(dismissedSignals),
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch, state.signals]);

  // ── Dismiss stale signals (>7 days with status 'new') ────

  const dismissStaleSignals = useCallback(async () => {
    if (!organizationId) return;
    const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    try {
      await supabase
        .from('engage_intent_signals')
        .update({ status: 'dismissed' })
        .eq('organization_id', organizationId)
        .eq('status', 'new')
        .lt('detected_at', cutoff);

      const updatedSignals = state.signals.map((s: IntentSignal) =>
        s.status === 'new' && s.detected_at && new Date(s.detected_at) < new Date(cutoff)
          ? { ...s, status: 'dismissed' as const }
          : s
      );
      patch({ signals: updatedSignals, summary: computeSignalSummary(updatedSignals) });
    } catch (err: any) {
      patch({ error: err.message });
    }
  }, [organizationId, state.signals, patch]);

  // ── Fetch signal definitions (universal + org-specific) ──

  const fetchSignalDefinitions = useCallback(async () => {
    if (!organizationId) return;
    patch({ signalDefinitionsLoading: true });

    try {
      // Query 1: all active universal signal definitions
      const { data: universalDefs, error: defErr } = await supabase
        .from('engage_signal_definitions')
        .select('*')
        .eq('is_universal', true)
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (defErr) throw defErr;

      // Query 2: org-specific configs (overrides + custom signals)
      const { data: orgConfigs, error: cfgErr } = await supabase
        .from('engage_org_signal_configs')
        .select('*')
        .eq('organization_id', organizationId);

      if (cfgErr) throw cfgErr;

      // Build a lookup: definition_id → org config row
      const overrideMap: Record<string, any> = {};
      const customSignals: SignalDefinition[] = [];

      (orgConfigs || []).forEach((cfg: any) => {
        if (cfg.signal_definition_id) {
          overrideMap[cfg.signal_definition_id] = cfg;
        } else {
          // Fully custom signal (no universal equivalent)
          customSignals.push({
            definition_id: null,
            org_config_id: cfg.id,
            signal_key: cfg.signal_key,
            signal_name: cfg.signal_name,
            category: cfg.category,
            description: cfg.description,
            effective_score: cfg.default_score ?? 50,
            effective_strength: cfg.default_strength ?? 'medium',
            icon: cfg.icon,
            sort_order: 0,
            is_universal: false,
            is_enabled: true,
          });
        }
      });

      // Merge universal defs with overrides, filter disabled
      const universalSignals: SignalDefinition[] = (universalDefs || [])
        .map((sd: any) => {
          const override = overrideMap[sd.id];
          return {
            definition_id: sd.id,
            org_config_id: override?.id ?? null,
            signal_key: sd.signal_key,
            signal_name: sd.signal_name,
            category: sd.category,
            description: sd.description,
            effective_score: override?.score_override ?? sd.default_score,
            effective_strength: override?.strength_override ?? sd.default_strength,
            icon: sd.icon,
            sort_order: sd.sort_order,
            is_universal: true,
            is_enabled: override?.is_enabled ?? true,
          };
        })
        .filter((sd: SignalDefinition) => sd.is_enabled);

      // Category order for sorting custom signals
      const categoryOrder: Record<string, number> = { buyer_intent: 1, interest: 2, company_event: 3, universal: 4 };
      const sortedCustom = customSignals.sort(
        (a, b) => (categoryOrder[a.category] ?? 9) - (categoryOrder[b.category] ?? 9)
      );

      patch({
        signalDefinitions: [...universalSignals, ...sortedCustom],
        signalDefinitionsLoading: false,
      });
    } catch {
      patch({ signalDefinitionsLoading: false });
    }
  }, [organizationId, patch]);

  // ── Fetch org ICP + signal config ─────────────────────

  // ── Action Queue ───────────────────────────────────────

  const fetchActionQueue = useCallback(async () => {
    if (!organizationId) return;
    patch({ actionQueueLoading: true });
    try {
      const result = await backendFetch<{ ok: boolean; items: SignalActionItem[] }>(
        '/api/engage/action-queue',
        undefined,
        'GET'
      );
      patch({ actionQueue: result?.items || [], actionQueueLoading: false });
    } catch (err) {
      console.warn('[Signal] Action queue fetch failed:', err);
      patch({ actionQueue: [], actionQueueLoading: false });
    }
  }, [organizationId, patch]);

  const approveAction = useCallback(async (actionId: string) => {
    await backendFetch(`/api/engage/action-queue/${actionId}/approve`);
    await fetchActionQueue();
  }, [fetchActionQueue]);

  const dismissAction = useCallback(async (
    actionId: string,
    dismissal_category?: string,
    dismissal_reason?: string,
  ) => {
    await backendFetch(`/api/engage/action-queue/${actionId}/dismiss`, {
      dismissal_category,
      dismissal_reason,
    });
    await fetchActionQueue();
  }, [fetchActionQueue]);

  const sendAction = useCallback(async (
    actionId: string,
    sent_subject: string,
    sent_body: string,
    recipient_email?: string,
  ) => {
    await backendFetch(`/api/engage/action-queue/${actionId}/send`, {
      sent_subject,
      sent_body,
      recipient_email,
    });
    await fetchActionQueue();
  }, [fetchActionQueue]);

  const markSignalOutcome = useCallback(async (
    signalId: string,
    outcome: 'won' | 'lost' | 'pending',
    dealId?: string
  ) => {
    await backendFetch(`/api/engage/signals/${signalId}/outcome`, { outcome, deal_id: dealId });
    await fetchSignals();
  }, [fetchSignals]);

  // [SPEC 09] Expand a single action into a multi-step play
  const expandToPlay = useCallback(async (actionId: string, playType: string) => {
    patch({ expandingActionId: actionId });
    try {
      const result = await backendFetch<{ ok: boolean; steps: ActionStep[] }>(
        `/api/engage/action-queue/${actionId}/expand-to-play`,
        { play_type: playType }
      );
      if (result?.steps) {
        setState(prev => ({
          ...prev,
          actionSteps: { ...prev.actionSteps, [actionId]: result.steps },
          expandingActionId: null,
        }));
      }
      await fetchActionQueue();
      return result?.steps || [];
    } catch (err) {
      patch({ expandingActionId: null });
      throw err;
    }
  }, [fetchActionQueue, patch]);

  // [SPEC 09] Fetch steps for a specific action
  const fetchActionSteps = useCallback(async (actionId: string) => {
    try {
      const result = await backendFetch<{ ok: boolean; steps: ActionStep[] }>(
        `/api/engage/action-queue/${actionId}/steps`,
        undefined,
        'GET'
      );
      if (result?.steps) {
        setState(prev => ({
          ...prev,
          actionSteps: { ...prev.actionSteps, [actionId]: result.steps },
        }));
      }
      return result?.steps || [];
    } catch (err) {
      console.warn('[Signal] Fetch action steps failed:', err);
      return [];
    }
  }, []);

  // [SPEC 09] Update or cancel a step
  const updateActionStep = useCallback(async (stepId: string, actionId: string, updates: Record<string, unknown>) => {
    await backendFetch(`/api/engage/action-steps/${stepId}`, updates, 'PATCH');
    await fetchActionSteps(actionId);
  }, [fetchActionSteps]);

  // ── Org ICP + scan timing ──────────────────────────────

  const fetchOrgIcp = useCallback(async () => {
    if (!organizationId) return;
    try {
      // Step 1: Try to load ICP config from engage_icp_profiles (new multi-profile system)
      let profileIcpConfig: any = null;
      let profileSignalConfig: any = null;
      try {
        const profileRes = await backendFetch<{ ok: boolean; profiles: any[] }>(
          '/api/engage/icp-profiles',
          undefined,
          'GET',
        );
        const profiles = profileRes?.profiles || [];
        if (profiles.length > 0) {
          const defaultProfile = profiles.find((p: any) => p.is_default) || profiles[0];
          if (defaultProfile?.icp_config && Object.keys(defaultProfile.icp_config).length > 0) {
            profileIcpConfig = defaultProfile.icp_config;
          }
          if (defaultProfile?.signal_config && Object.keys(defaultProfile.signal_config).length > 0) {
            profileSignalConfig = defaultProfile.signal_config;
          }
        }
      } catch {
        // ICP profiles endpoint not available or failed — fall back to org-level
      }

      // Step 2: Always fetch org-level data for scan timing + fallback config
      const { data } = await supabase
        .from('organizations')
        .select('icp_config, signal_config, last_signal_scan_at')
        .eq('id', organizationId)
        .single();

      setState(prev => {
        const updates: Partial<SignalState> = {};
        let mergedScanConfig = { ...prev.scanConfig };

        // Use profile ICP config if available, otherwise fall back to org-level
        const rawIcpConfig = profileIcpConfig
          || (data?.icp_config
            ? (typeof data.icp_config === 'string' ? JSON.parse(data.icp_config) : data.icp_config)
            : null);

        // Process ICP config
        if (rawIcpConfig) {
          updates.orgIcpConfig = rawIcpConfig;
          updates.icpEnabled = rawIcpConfig.enabled ?? false;
          mergedScanConfig = {
            ...mergedScanConfig,
            icp_industries: rawIcpConfig.target_industries?.length > 0
              ? rawIcpConfig.target_industries
              : prev.scanConfig.icp_industries,
            icp_employee_range: rawIcpConfig.headcount_min != null && rawIcpConfig.headcount_max != null
              ? `${rawIcpConfig.headcount_min}-${rawIcpConfig.headcount_max}`
              : prev.scanConfig.icp_employee_range,
            tech_stack_positive: rawIcpConfig.target_technologies?.length > 0
              ? rawIcpConfig.target_technologies
              : prev.scanConfig.tech_stack_positive,
          };
        }

        // Use profile signal config if available, otherwise fall back to org-level
        const rawSignalConfig = profileSignalConfig
          || (data?.signal_config
            ? (typeof data.signal_config === 'string' ? JSON.parse(data.signal_config) : data.signal_config)
            : null);

        updates.orgSignalConfig = rawSignalConfig;
        updates.hasOrgSignalConfig = !!(rawSignalConfig && (
          (rawSignalConfig.pain_points?.length ?? 0) > 0 ||
          (rawSignalConfig.solution_keywords?.length ?? 0) > 0 ||
          (rawSignalConfig.job_titles_to_track?.length ?? 0) > 0 ||
          (rawSignalConfig.competitors?.length ?? 0) > 0 ||
          (rawSignalConfig.tech_stack_churning?.length ?? 0) > 0
        ));

        if (rawSignalConfig) {
          mergedScanConfig = {
            ...mergedScanConfig,
            pain_points: rawSignalConfig.pain_points?.length > 0 ? rawSignalConfig.pain_points : prev.scanConfig.pain_points,
            solution_keywords: rawSignalConfig.solution_keywords?.length > 0 ? rawSignalConfig.solution_keywords : prev.scanConfig.solution_keywords,
            job_titles_to_track: rawSignalConfig.job_titles_to_track?.length > 0 ? rawSignalConfig.job_titles_to_track : prev.scanConfig.job_titles_to_track,
            competitors: rawSignalConfig.competitors?.length > 0 ? rawSignalConfig.competitors : prev.scanConfig.competitors,
            tech_stack_churning: rawSignalConfig.tech_stack_churning?.length > 0 ? rawSignalConfig.tech_stack_churning : prev.scanConfig.tech_stack_churning,
            exclude_industries: rawSignalConfig.exclude_industries || [],
          };
        }

        updates.scanConfig = mergedScanConfig;

        // Scan timing (always from org-level)
        if (data?.last_signal_scan_at) {
          const lastScan = new Date(data.last_signal_scan_at);
          const nextScan = new Date(lastScan.getTime() + 7 * 24 * 60 * 60 * 1000);
          updates.lastScanAt = lastScan.toISOString();
          updates.nextScanAt = nextScan.toISOString();
        }

        return { ...prev, ...updates };
      });
    } catch {
      // Non-critical — org config is an enhancement, not a blocker
    }
  }, [organizationId]);

  // ── Auto-enrich top 5 companies after scan completes ──

  useEffect(() => {
    if (state.isScanning || state.signals.length === 0) return;
    const AUTO_ENRICH_TOP_N = 5;
    const seen = new Set<string>();
    const topNames: string[] = [];
    [...state.signals]
      .sort((a, b) => b.signal_score - a.signal_score)
      .forEach((s) => {
        if (s.company_name && !seen.has(s.company_name)) {
          seen.add(s.company_name);
          topNames.push(s.company_name);
        }
      });
    topNames.slice(0, AUTO_ENRICH_TOP_N).forEach((name, i) => {
      if (state.companyContacts[name] === undefined && !enrichingRef.current.has(name)) {
        setTimeout(() => enrichCompanyContacts(name), i * 400);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.isScanning, state.signals]);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchSignals();
    fetchOrgIcp();
    fetchSignalDefinitions();
    fetchActionQueue();
  }, [fetchSignals, fetchOrgIcp, fetchSignalDefinitions, fetchActionQueue]);

  // ── Manual signal creation (Quick Add) ──────────────────────────────────
  const addManualSignal = useCallback(async (data: {
    company_name: string;
    signal_type: string;
    signal_score?: number;
    description?: string;
    source_platform?: string;
    source_url?: string;
  }) => {
    if (!organizationId || !data.company_name || !data.signal_type) return null;
    const score = data.signal_score ?? 80;
    const strength = score >= 80 ? 'high' : score >= 60 ? 'medium' : 'low';
    const typeLabel = SIGNAL_TYPES.find(t => t.key === data.signal_type)?.label || data.signal_type;
    const { data: inserted, error } = await supabase
      .from('engage_intent_signals')
      .insert({
        organization_id: organizationId,
        company_name: data.company_name.trim(),
        signal_type: data.signal_type,
        signal_score: score,
        signal_strength: strength,
        title: `${data.company_name.trim()} — ${typeLabel}`,
        description: data.description || null,
        source_platform: data.source_platform || 'linkedin',
        source_url: data.source_url || null,
        status: 'new',
        detected_at: new Date().toISOString(),
        raw_data: { source: 'manual_quick_add' },
      })
      .select()
      .single();
    if (error) { console.error('[addManualSignal]', error.message); return null; }
    await fetchSignals();
    return inserted;
  }, [organizationId, fetchSignals]);

  return {
    ...state,
    fetchSignals,
    fetchSignalDefinitions,
    runSignalScan,
    updateSignalStatus,
    dismissSignal,
    dismissAllSignals,
    dismissStaleSignals,
    setScanConfig,
    clearLastScan,
    clearAllSignals,
    enrichCompanyContacts,
    SIGNAL_TYPES,
    // Autopilot: action queue
    fetchActionQueue,
    approveAction,
    dismissAction,
    sendAction,
    markSignalOutcome,
    addManualSignal,
    // [SPEC 09] Multi-step plays
    expandToPlay,
    fetchActionSteps,
    updateActionStep,
  };
}
