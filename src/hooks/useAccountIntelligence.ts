/**
 * useAccountIntelligence — React hook for Account-Based Intelligence.
 *
 * Manages account scoring, buying committee mapping, territory planning,
 * and AI-powered account analysis.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { backendFetch } from '../utils/backendFetch';

// ── Types ──────────────────────────────────────────────────

export interface Account {
  id: string;
  organization_id: string;
  company_id?: string;
  account_name: string;
  domain?: string;
  industry?: string;
  employee_count?: number;
  annual_revenue?: string;
  account_score: number;
  intent_score: number;
  engagement_score: number;
  tier: 'tier_1' | 'tier_2' | 'tier_3' | 'untiered';
  buying_committee: BuyingCommitteeMember[];
  decision_maker_id?: string;
  champion_id?: string;
  territory?: string;
  assigned_to?: string;
  assigned_name?: string;
  signals_count: number;
  last_signal_at?: string;
  outreach_count: number;
  last_outreach_at?: string;
  ai_summary?: string;
  ai_strategy?: string;
  ai_risk_factors?: string[];
  status: 'active' | 'nurture' | 'engaged' | 'opportunity' | 'customer' | 'churned';
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
  // Enhanced ABM fields
  buying_stage: 'unaware' | 'awareness' | 'consideration' | 'decision' | 'purchase';
  readiness_score: number;
  signal_velocity: number;        // signals per week
  tech_fit_score: number;
  spend_trajectory: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  last_stage_change_at?: string;
  predicted_close_date?: string;
  ai_buying_stage_reason?: string;
  technographics?: Technographic[];
  // Signal-to-Pipeline fields (migration 051)
  source?: 'manual' | 'signal_prospecting' | 'import' | 'company_research';
  promoted_from_signal_at?: string;
}

export interface Technographic {
  id: string;
  tech_name: string;
  tech_category: string;
  vendor?: string;
  confidence: 'low' | 'medium' | 'high' | 'verified';
  source?: string;
  adoption_stage: 'evaluating' | 'implementing' | 'current' | 'expanding' | 'churning';
  spend_trend: 'increasing' | 'stable' | 'decreasing' | 'unknown';
  estimated_spend?: string;
  first_detected_at?: string;
}

export interface SignalPattern {
  id: string;
  pattern_type: string;
  pattern_label: string;
  signal_count: number;
  combined_score: number;
  confidence: 'low' | 'medium' | 'high' | 'very_high';
  inferred_stage?: string;
  ai_summary?: string;
  ai_recommended_action?: string;
  ai_urgency: 'low' | 'medium' | 'high' | 'critical';
  first_signal_at?: string;
  last_signal_at?: string;
  status: 'active' | 'actioned' | 'expired' | 'dismissed';
}

export interface CampaignTrigger {
  id: string;
  name: string;
  description?: string;
  is_active: boolean;
  trigger_conditions: Record<string, any>;
  action_type: 'add_to_sequence' | 'notify_slack' | 'create_task' | 'assign_owner' | 'update_tier' | 'add_tag';
  action_config: Record<string, any>;
  times_triggered: number;
  last_triggered_at?: string;
}

export interface BuyingCommitteeMember {
  role: string;        // 'decision_maker', 'champion', 'influencer', 'blocker', 'user'
  name: string;
  prospect_id?: string;
  title?: string;
  influence_level: 'high' | 'medium' | 'low';
  email?: string;
  status?: string;
}

export interface AccountSummary {
  totalAccounts: number;
  tier1Count: number;
  tier2Count: number;
  tier3Count: number;
  avgAccountScore: number;
  highIntentCount: number;
  byStatus: Record<string, number>;
  byTerritory: Record<string, number>;
  // Enhanced ABM metrics
  avgReadinessScore: number;
  readyToBuyCount: number;         // accounts in decision/purchase stage
  byBuyingStage: Record<string, number>;
  highVelocityCount: number;       // accounts with high signal velocity
  activePatternCount: number;
}

interface AccountState {
  accounts: Account[];
  summary: AccountSummary;
  activeAccount: Account | null;
  patterns: SignalPattern[];
  triggers: CampaignTrigger[];
  loading: boolean;
  analyzing: boolean;
  error: string | null;
}

const emptySummary: AccountSummary = {
  totalAccounts: 0, tier1Count: 0, tier2Count: 0, tier3Count: 0,
  avgAccountScore: 0, highIntentCount: 0, byStatus: {}, byTerritory: {},
  avgReadinessScore: 0, readyToBuyCount: 0, byBuyingStage: {}, highVelocityCount: 0, activePatternCount: 0,
};

// ── Hook ───────────────────────────────────────────────────

export function useAccountIntelligence(organizationId: string, userId?: string) {
  const [state, setState] = useState<AccountState>({
    accounts: [],
    summary: emptySummary,
    activeAccount: null,
    patterns: [],
    triggers: [],
    loading: true,
    analyzing: false,
    error: null,
  });

  const patch = useCallback((p: Partial<AccountState>) => setState((prev) => ({ ...prev, ...p })), []);

  // ── Fetch all accounts ─────────────────────────────────

  const fetchAccounts = useCallback(async (filters?: { tier?: string; status?: string; territory?: string }) => {
    if (!organizationId) { patch({ loading: false }); return; }
    patch({ loading: true, error: null });

    try {
      let q = supabase
        .from('engage_accounts')
        .select('*, profiles!engage_accounts_assigned_to_fkey(first_name, last_name)')
        .eq('organization_id', organizationId)
        .order('account_score', { ascending: false });

      if (filters?.tier) q = q.eq('tier', filters.tier);
      if (filters?.status) q = q.eq('status', filters.status);
      if (filters?.territory) q = q.eq('territory', filters.territory);

      const { data, error } = await q;
      if (error) throw error;

      const accounts: Account[] = (data || []).map((a: any) => {
        const p = a.profiles;
        return {
          ...a,
          assigned_name: p ? `${p.first_name || ''} ${p.last_name || ''}`.trim() : undefined,
          buying_committee: Array.isArray(a.buying_committee) ? a.buying_committee : [],
        };
      });

      // Summary
      const byStatus: Record<string, number> = {};
      const byTerritory: Record<string, number> = {};
      const byBuyingStage: Record<string, number> = {};
      let scoreSum = 0, highIntentCount = 0, readinessSum = 0;
      let tier1 = 0, tier2 = 0, tier3 = 0;
      let readyToBuyCount = 0, highVelocityCount = 0;

      accounts.forEach((a) => {
        byStatus[a.status] = (byStatus[a.status] || 0) + 1;
        if (a.territory) byTerritory[a.territory] = (byTerritory[a.territory] || 0) + 1;
        if (a.buying_stage) byBuyingStage[a.buying_stage] = (byBuyingStage[a.buying_stage] || 0) + 1;
        scoreSum += a.account_score;
        readinessSum += a.readiness_score || 0;
        if (a.intent_score >= 70) highIntentCount++;
        if (a.tier === 'tier_1') tier1++;
        else if (a.tier === 'tier_2') tier2++;
        else if (a.tier === 'tier_3') tier3++;
        if (a.buying_stage === 'decision' || a.buying_stage === 'purchase') readyToBuyCount++;
        if ((a.signal_velocity || 0) >= 3) highVelocityCount++;
      });

      patch({
        accounts,
        summary: {
          totalAccounts: accounts.length,
          tier1Count: tier1,
          tier2Count: tier2,
          tier3Count: tier3,
          avgAccountScore: accounts.length > 0 ? Math.round(scoreSum / accounts.length) : 0,
          highIntentCount,
          byStatus,
          byTerritory,
          avgReadinessScore: accounts.length > 0 ? Math.round(readinessSum / accounts.length) : 0,
          readyToBuyCount,
          byBuyingStage,
          highVelocityCount,
          activePatternCount: 0, // Will be updated by fetchPatterns
        },
        loading: false,
      });
    } catch (err: any) {
      patch({ error: err.message, loading: false });
    }
  }, [organizationId, patch]);

  // ── Create an account ──────────────────────────────────

  const createAccount = useCallback(async (account: Partial<Account>) => {
    if (!organizationId) throw new Error('Organization ID is required. Please reload the page.');
    const { data, error } = await supabase
      .from('engage_accounts')
      .insert({
        organization_id: organizationId,
        account_name: account.account_name,
        domain: account.domain || null,
        industry: account.industry || null,
        tier: account.tier || 'untiered',
        status: account.status || 'active',
        account_score: account.account_score ?? 0,
        intent_score: account.intent_score ?? 0,
        engagement_score: account.engagement_score ?? 0,
        signals_count: account.signals_count ?? 0,
        buying_committee: account.buying_committee || [],
        tags: account.tags || [],
        metadata: account.metadata || {},
        ...(account.buying_stage && { buying_stage: account.buying_stage }),
        ...(account.readiness_score != null && { readiness_score: account.readiness_score }),
        ...(account.signal_velocity != null && { signal_velocity: account.signal_velocity }),
        ...(account.source && { source: account.source }),
        ...(account.promoted_from_signal_at && { promoted_from_signal_at: account.promoted_from_signal_at }),
      })
      .select()
      .single();
    if (error) throw error;
    await fetchAccounts();
    return data;
  }, [organizationId, fetchAccounts]);

  // ── Update an account ──────────────────────────────────

  const updateAccount = useCallback(async (id: string, updates: Partial<Account>) => {
    const { error } = await supabase
      .from('engage_accounts')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchAccounts();
  }, [fetchAccounts]);

  // ── Delete an account ──────────────────────────────────

  const deleteAccount = useCallback(async (id: string) => {
    if (!organizationId) throw new Error('Organization ID required');
    const { error } = await supabase.from('engage_accounts').delete().eq('id', id).eq('organization_id', organizationId);
    if (error) throw error;
    if (state.activeAccount?.id === id) patch({ activeAccount: null });
    await fetchAccounts();
  }, [organizationId, state.activeAccount, fetchAccounts, patch]);

  // ── Update buying committee ────────────────────────────

  const updateBuyingCommittee = useCallback(async (accountId: string, committee: BuyingCommitteeMember[]) => {
    const { error } = await supabase
      .from('engage_accounts')
      .update({ buying_committee: committee, updated_at: new Date().toISOString() })
      .eq('id', accountId);
    if (error) throw error;
    await fetchAccounts();
  }, [fetchAccounts]);

  // ── Set account tier ───────────────────────────────────

  const setTier = useCallback(async (accountId: string, tier: Account['tier']) => {
    return updateAccount(accountId, { tier } as Partial<Account>);
  }, [updateAccount]);

  // ── Assign territory/owner ─────────────────────────────

  const assignAccount = useCallback(async (accountId: string, assignedTo: string, territory?: string) => {
    const updates: any = { assigned_to: assignedTo, updated_at: new Date().toISOString() };
    if (territory) updates.territory = territory;
    const { error } = await supabase.from('engage_accounts').update(updates).eq('id', accountId);
    if (error) throw error;
    await fetchAccounts();
  }, [fetchAccounts]);

  // ── AI Account Analysis ────────────────────────────────

  const analyzeAccount = useCallback(async (accountId: string) => {
    patch({ analyzing: true });
    try {
      const account = state.accounts.find((a) => a.id === accountId);
      if (!account) throw new Error('Account not found');

      // Gather signals for this account
      const { data: signals } = await supabase
        .from('engage_intent_signals')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('company_name', account.account_name)
        .order('signal_score', { ascending: false })
        .limit(10);

      // Gather any pipeline deals
      const { data: deals } = await supabase
        .from('engage_pipeline_deals')
        .select('*')
        .eq('organization_id', organizationId)
        .ilike('deal_name', `%${account.account_name}%`)
        .limit(5);

      const data = await backendFetch('/api/engage/analyze-account', {
        account,
        signals: signals || [],
        deals: deals || [],
      });
      if (data?.error) throw new Error(data.error);

      // Save AI analysis back to account
      await supabase.from('engage_accounts').update({
        ai_summary: data.summary,
        ai_strategy: data.strategy,
        ai_risk_factors: data.risk_factors || [],
        account_score: data.account_score || account.account_score,
        intent_score: data.intent_score || account.intent_score,
        updated_at: new Date().toISOString(),
      }).eq('id', accountId);

      await fetchAccounts();
      patch({ analyzing: false });
      return data;
    } catch (err: any) {
      patch({ error: err.message, analyzing: false });
      throw err;
    }
  }, [organizationId, state.accounts, patch, fetchAccounts]);

  // ── Auto-score all accounts ────────────────────────────

  const scoreAllAccounts = useCallback(async () => {
    patch({ analyzing: true });
    try {
      const { data, error } = await supabase.functions.invoke('engage-accounts', {
        body: {
          action: 'score_all',
          organization_id: organizationId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);
      patch({ analyzing: false });
      await fetchAccounts();
      return data;
    } catch (err: any) {
      patch({ error: err.message, analyzing: false });
      throw err;
    }
  }, [organizationId, patch, fetchAccounts]);

  // ── Import from companies ──────────────────────────────

  const importFromCompanies = useCallback(async () => {
    patch({ loading: true });
    try {
      const { data: companies } = await supabase
        .from('engage_companies')
        .select('*')
        .eq('organization_id', organizationId);

      if (!companies?.length) { patch({ loading: false }); return 0; }

      // Check existing accounts to avoid duplicates
      const { data: existing } = await supabase
        .from('engage_accounts')
        .select('domain')
        .eq('organization_id', organizationId);
      const existingDomains = new Set((existing || []).map((a: any) => a.domain).filter(Boolean));

      const newAccounts = companies
        .filter((c: any) => c.domain && !existingDomains.has(c.domain))
        .map((c: any) => ({
          organization_id: organizationId,
          company_id: c.id,
          account_name: c.name,
          domain: c.domain,
          industry: c.industry,
          employee_count: null,
          annual_revenue: c.annual_revenue_range,
          status: 'active' as const,
        }));

      if (newAccounts.length > 0) {
        const { error } = await supabase.from('engage_accounts').insert(newAccounts);
        if (error) throw error;
      }

      await fetchAccounts();
      return newAccounts.length;
    } catch (err: any) {
      patch({ error: err.message, loading: false });
      return 0;
    }
  }, [organizationId, patch, fetchAccounts]);

  // ── Fetch technographics for an account ────────────────

  const fetchTechnographics = useCallback(async (accountId: string) => {
    const { data, error } = await supabase
      .from('engage_technographics')
      .select('*')
      .eq('account_id', accountId)
      .order('tech_category');
    if (error) throw error;
    return data || [];
  }, []);

  // ── Add technographic to account ───────────────────────

  const addTechnographic = useCallback(async (accountId: string, tech: Partial<Technographic>, companyName: string) => {
    const { error } = await supabase
      .from('engage_technographics')
      .insert({
        organization_id: organizationId,
        account_id: accountId,
        company_name: companyName,
        tech_name: tech.tech_name,
        tech_category: tech.tech_category,
        vendor: tech.vendor,
        confidence: tech.confidence || 'medium',
        source: tech.source || 'manual',
        adoption_stage: tech.adoption_stage || 'current',
        spend_trend: tech.spend_trend || 'unknown',
      });
    if (error) throw error;
  }, [organizationId]);

  // ── Fetch signal patterns ──────────────────────────────

  const fetchPatterns = useCallback(async (filters?: { status?: string; accountId?: string }) => {
    let q = supabase
      .from('engage_signal_patterns')
      .select('*')
      .eq('organization_id', organizationId)
      .order('combined_score', { ascending: false });
    
    if (filters?.status) q = q.eq('status', filters.status);
    if (filters?.accountId) q = q.eq('account_id', filters.accountId);
    
    const { data, error } = await q;
    if (error) throw error;
    
    const patterns = (data || []) as SignalPattern[];
    patch({ patterns });
    
    // Update active pattern count in summary
    const activeCount = patterns.filter(p => p.status === 'active').length;
    setState(prev => ({
      ...prev,
      summary: { ...prev.summary, activePatternCount: activeCount }
    }));
    
    return patterns;
  }, [organizationId, patch]);

  // ── Fetch campaign triggers ────────────────────────────

  const fetchTriggers = useCallback(async () => {
    const { data, error } = await supabase
      .from('engage_campaign_triggers')
      .select('*')
      .eq('organization_id', organizationId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    
    const triggers = (data || []) as CampaignTrigger[];
    patch({ triggers });
    return triggers;
  }, [organizationId, patch]);

  // ── Create campaign trigger ────────────────────────────

  const createTrigger = useCallback(async (trigger: Partial<CampaignTrigger>) => {
    const { data, error } = await supabase
      .from('engage_campaign_triggers')
      .insert({
        organization_id: organizationId,
        created_by: userId,
        name: trigger.name,
        description: trigger.description,
        is_active: trigger.is_active ?? true,
        trigger_conditions: trigger.trigger_conditions || {},
        action_type: trigger.action_type,
        action_config: trigger.action_config || {},
      })
      .select()
      .single();
    if (error) throw error;
    await fetchTriggers();
    return data;
  }, [organizationId, userId, fetchTriggers]);

  // ── Update campaign trigger ────────────────────────────

  const updateTrigger = useCallback(async (id: string, updates: Partial<CampaignTrigger>) => {
    const { error } = await supabase
      .from('engage_campaign_triggers')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchTriggers();
  }, [fetchTriggers]);

  // ── Delete campaign trigger ────────────────────────────

  const deleteTrigger = useCallback(async (id: string) => {
    const { error } = await supabase
      .from('engage_campaign_triggers')
      .delete()
      .eq('id', id);
    if (error) throw error;
    await fetchTriggers();
  }, [fetchTriggers]);

  // ── Calculate readiness score for an account ───────────

  const calculateReadinessScore = useCallback((account: Account): number => {
    // Weighted composite: Intent (35%) + Account Fit (25%) + Engagement (20%) + Tech Fit (15%) + Velocity Bonus (5%)
    const intentScore = account.intent_score || 0;
    const accountScore = account.account_score || 0;
    const engagementScore = account.engagement_score || 0;
    const techFitScore = account.tech_fit_score || 0;
    const velocityBonus = Math.min((account.signal_velocity || 0) * 5, 5);
    
    return Math.min(100, Math.max(0, Math.round(
      intentScore * 0.35 +
      accountScore * 0.25 +
      engagementScore * 0.20 +
      techFitScore * 0.15 +
      velocityBonus
    )));
  }, []);

  // ── Infer buying stage from signals ────────────────────

  const inferBuyingStage = useCallback(async (accountId: string): Promise<string> => {
    // Look up the account to get company_name for signal matching
    // (C2 fix: accountId is engage_accounts.id, NOT engage_companies.id — can't join directly)
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return 'unaware';

    // Build query: match by company_name, or by company_id if the account has one
    let q = supabase
      .from('engage_intent_signals')
      .select('signal_type, signal_score')
      .eq('organization_id', organizationId)
      .order('detected_at', { ascending: false })
      .limit(20);

    if (account.company_id) {
      // Match signals by the actual engage_companies.id
      q = q.or(`company_id.eq.${account.company_id},company_name.eq.${account.account_name}`);
    } else {
      q = q.eq('company_name', account.account_name);
    }

    const { data: signals } = await q;

    if (!signals || signals.length === 0) return 'unaware';

    const signalTypes = signals.map((s: { signal_type: string; signal_score: number }) => s.signal_type);
    const avgScore = signals.reduce((sum: number, s: { signal_type: string; signal_score: number }) => sum + s.signal_score, 0) / signals.length;

    // Decision signals (M6 fix: use current signal_key names, not legacy)
    const decisionSignals = signalTypes.filter((t: string) =>
      ['contract_win', 'leadership_change', 'company_expansion', 'rfp_issuance', 'ma_activity'].includes(t)
    ).length;

    // Consideration signals (M6 fix: use current signal_key names)
    const considerationSignals = signalTypes.filter((t: string) =>
      ['competitor_engagement', 'competitor_comparison', 'product_launch', 'review_site_activity', 'g2_review', 'capterra_review', 'tech_adoption', 'pricing_page_research'].includes(t)
    ).length;

    if (decisionSignals >= 2 && avgScore >= 70) return 'decision';
    if (considerationSignals >= 2 && avgScore >= 50) return 'consideration';
    if (signals.length >= 1) return 'awareness';

    return 'unaware';
  }, [organizationId, state.accounts]);

  // ── Update buying stage for an account ─────────────────

  const updateBuyingStage = useCallback(async (accountId: string) => {
    const stage = await inferBuyingStage(accountId);
    const account = state.accounts.find(a => a.id === accountId);
    
    if (account && account.buying_stage !== stage) {
      await supabase
        .from('engage_accounts')
        .update({
          buying_stage: stage,
          last_stage_change_at: new Date().toISOString(),
        })
        .eq('id', accountId);
      
      // Also update readiness score
      const readinessScore = calculateReadinessScore({ ...account, buying_stage: stage as any });
      await supabase
        .from('engage_accounts')
        .update({ readiness_score: readinessScore })
        .eq('id', accountId);
    }
    
    return stage;
  }, [inferBuyingStage, state.accounts, calculateReadinessScore]);

  // ── Record signal outcome (for learning) ───────────────

  // M7 fix: single outcome path via backend endpoint (handles both signal
  // update AND engage_signal_outcomes insert for learning analytics)
  const recordOutcome = useCallback(async (
    signalId: string,
    outcome: 'won' | 'lost',
    dealId?: string,
    dealValue?: number
  ) => {
    await backendFetch(`/api/engage/signals/${signalId}/outcome`, {
      outcome,
      deal_id: dealId,
      deal_value: dealValue,
    });
  }, []);

  // ── Fetch company research (cached in engage_research_reports) ──

  const fetchCompanyResearch = useCallback(async (accountName: string, companyId?: string, domain?: string) => {
    if (!organizationId || !accountName) return null;
    const { data } = await supabase
      .from('engage_research_reports')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('report_type', 'company')
      .order('created_at', { ascending: false })
      .limit(30);

    const name = accountName.toLowerCase();
    const domainLower = (domain || '').toLowerCase();
    return (data || []).find((r: any) => {
      // Primary: match by company_id if available
      if (companyId && r.company_id === companyId) return true;
      // Secondary: match by domain in content or subject_domain
      if (domainLower) {
        if ((r.content?.company?.domain || '').toLowerCase() === domainLower) return true;
        if ((r.subject_domain || '').toLowerCase() === domainLower) return true;
      }
      // Tertiary: fuzzy subject_name OR title matching
      const sn = (r.subject_name || r.title || '').toLowerCase();
      return sn && (sn === name || sn.includes(name) || name.includes(sn));
    }) || null;
  }, [organizationId]);

  // ── Fetch account activity timeline ──────────────────────

  const fetchAccountActivity = useCallback(async (accountName: string, days = 90) => {
    if (!organizationId || !accountName) return [];
    const since = new Date(Date.now() - days * 86400000).toISOString();
    const name = accountName.toLowerCase();

    const { data: events } = await supabase
      .from('engage_activity_events')
      .select('*')
      .eq('organization_id', organizationId)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);

    const filtered = (events || []).filter((e: any) => {
      const desc = (e.description || '').toLowerCase();
      const metaAccount = (e.metadata?.company_name || e.metadata?.account_name || '').toLowerCase();
      return desc.includes(name) || metaAccount === name;
    });

    const { data: deals } = await supabase
      .from('engage_pipeline_deals')
      .select('id, deal_name, deal_value, stage, created_at, updated_at')
      .eq('organization_id', organizationId)
      .ilike('deal_name', `%${accountName}%`)
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(20);

    const dealEvents = (deals || []).map((d: any) => ({
      id: `deal-${d.id}`,
      event_type: 'deal.activity',
      title: `Deal: ${d.deal_name}`,
      description: `${d.stage} · $${(d.deal_value || 0).toLocaleString()}`,
      icon: '💰',
      color: '#10b981',
      created_at: d.updated_at || d.created_at,
    }));

    return [...filtered, ...dealEvents].sort((a: any, b: any) =>
      new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
  }, [organizationId]);

  // ── Account Contacts, Meetings, Deals (Phase 5) ────────────────────────────

  const [accountContacts, setAccountContacts] = useState<any[]>([]);
  const [accountMeetings, setAccountMeetings] = useState<any[]>([]);
  const [accountDeals, setAccountDeals] = useState<any[]>([]);
  const [loadingContacts, setLoadingContacts] = useState(false);
  const [loadingMeetings, setLoadingMeetings] = useState(false);
  const [loadingDeals, setLoadingDeals] = useState(false);

  const fetchAccountContacts = useCallback(async (accountId: string) => {
    if (!accountId) return [];
    setLoadingContacts(true);
    try {
      const res = await backendFetch(`/api/engage/accounts/${accountId}/contacts`, undefined, 'GET');
      const contacts = res.contacts || [];
      setAccountContacts(contacts);
      return contacts;
    } catch (err) {
      console.error('fetchAccountContacts failed:', err);
      return [];
    } finally {
      setLoadingContacts(false);
    }
  }, []);

  const addAccountContact = useCallback(async (accountId: string, contact: Record<string, any>) => {
    const res = await backendFetch(`/api/engage/accounts/${accountId}/contacts`, contact);
    if (res.contact) setAccountContacts(prev => [res.contact, ...prev]);
    return res.contact;
  }, []);

  const bulkImportContacts = useCallback(async (accountId: string, contacts: Record<string, any>[]) => {
    const res = await backendFetch(`/api/engage/accounts/${accountId}/contacts/bulk`, { contacts });
    if (res.ok) await fetchAccountContacts(accountId);
    return res.imported || 0;
  }, [fetchAccountContacts]);

  const updateAccountContact = useCallback(async (accountId: string, contactId: string, updates: Record<string, any>) => {
    const res = await backendFetch(`/api/engage/accounts/${accountId}/contacts/${contactId}`, updates, 'PATCH');
    if (res.contact) setAccountContacts(prev => prev.map(c => c.id === contactId ? res.contact : c));
    return res.contact;
  }, []);

  const removeAccountContact = useCallback(async (accountId: string, contactId: string) => {
    await backendFetch(`/api/engage/accounts/${accountId}/contacts/${contactId}`, undefined, 'DELETE');
    setAccountContacts(prev => prev.filter(c => c.id !== contactId));
  }, []);

  const fetchAccountMeetings = useCallback(async (accountId: string) => {
    if (!accountId) return [];
    setLoadingMeetings(true);
    try {
      const res = await backendFetch(`/api/engage/accounts/${accountId}/meetings`, undefined, 'GET');
      const meetings = res.meetings || [];
      setAccountMeetings(meetings);
      return meetings;
    } catch (err) {
      console.error('fetchAccountMeetings failed:', err);
      return [];
    } finally {
      setLoadingMeetings(false);
    }
  }, []);

  const fetchAccountDeals = useCallback(async (accountId: string) => {
    if (!accountId) return [];
    setLoadingDeals(true);
    try {
      const res = await backendFetch(`/api/engage/accounts/${accountId}/deals`, undefined, 'GET');
      const deals = res.deals || [];
      setAccountDeals(deals);
      return deals;
    } catch (err) {
      console.error('fetchAccountDeals failed:', err);
      return [];
    } finally {
      setLoadingDeals(false);
    }
  }, []);

  const triggerAutoResearch = useCallback(async (accountId: string) => {
    const res = await backendFetch(`/api/engage/accounts/${accountId}/auto-research`, {});
    return res;
  }, []);

  const linkEventToDeal = useCallback(async (eventId: string, dealId: string) => {
    await backendFetch(`/api/calendar/events/${eventId}/link-deal`, { deal_id: dealId });
  }, []);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchAccounts();
    fetchPatterns({ status: 'active' });
    fetchTriggers();
  }, [fetchAccounts, fetchPatterns, fetchTriggers]);

  return {
    ...state,
    fetchAccounts,
    createAccount,
    updateAccount,
    deleteAccount,
    updateBuyingCommittee,
    setTier,
    assignAccount,
    analyzeAccount,
    scoreAllAccounts,
    importFromCompanies,
    // New ABM functions
    fetchTechnographics,
    addTechnographic,
    fetchPatterns,
    fetchTriggers,
    createTrigger,
    updateTrigger,
    deleteTrigger,
    calculateReadinessScore,
    inferBuyingStage,
    updateBuyingStage,
    recordOutcome,
    // Phase 4: Company research + activity
    fetchCompanyResearch,
    fetchAccountActivity,
    // Phase 5: Account contacts, meetings, deals
    accountContacts,
    accountMeetings,
    accountDeals,
    loadingContacts,
    loadingMeetings,
    loadingDeals,
    fetchAccountContacts,
    addAccountContact,
    bulkImportContacts,
    updateAccountContact,
    removeAccountContact,
    fetchAccountMeetings,
    fetchAccountDeals,
    triggerAutoResearch,
    linkEventToDeal,
  };
}
