/**
 * Apptivia Engage — Frontend API Client
 * ──────────────────────────────────────
 * Routes all server-side calls through Supabase Edge Functions.
 * Supabase CRUD calls go direct via RLS as before.
 */

import { supabase } from '../supabaseClient';
import { backendFetch } from './backendFetch';

// ── Edge Function helper ─────────────────────────────────────

async function invokeEdge<T = any>(
  functionName: string,
  body?: Record<string, any>,
  queryParams?: Record<string, string>
): Promise<T> {
  const qs = queryParams ? '?' + new URLSearchParams(queryParams).toString() : '';

  const { data, error } = await supabase.functions.invoke(`${functionName}${qs}`, {
    body: body ?? {},
  });

  if (error) {
    // Supabase FunctionsHttpError may contain the actual response body
    let detail = error.message || 'Edge function call failed';
    try {
      if (error.context && typeof error.context.json === 'function') {
        const ctx = await error.context.json();
        if (ctx?.error) detail = ctx.error;
      }
    } catch { /* ignore */ }
    console.error(`[invokeEdge] ${functionName}${qs} error:`, detail);
    throw new Error(detail);
  }
  if (data?.error) throw new Error(data.error);
  return data as T;
}

// ── Types ────────────────────────────────────────────────────

export interface EngageCompany {
  id: string;
  name: string;
  domain?: string;
  logo_url?: string;
  linkedin_url?: string;
  website_url?: string;
  industry?: string;
  sub_industry?: string;
  employee_count_range?: string;
  annual_revenue_range?: string;
  founded_year?: number;
  headquarters_city?: string;
  headquarters_state?: string;
  headquarters_country?: string;
  tech_stack?: string[];
  funding_data?: Record<string, any>;
  description?: string;
  tags?: string[];
  source?: string;
  source_id?: string;
  enriched_at?: string;
  raw_data?: any;
  created_at?: string;
  created_by?: string;
}

export interface EngageProspect {
  id: string;
  organization_id?: string;
  company_id?: string;
  first_name?: string;
  last_name?: string;
  full_name?: string;
  email?: string;
  phone?: string;
  linkedin_url?: string;
  avatar_url?: string;
  title?: string;
  seniority_level?: string;
  department?: string;
  company_name?: string;
  fit_score?: number;
  intent_score?: number;
  status?: string;
  notes?: string;
  tags?: string[];
  source?: string;
  source_id?: string;
  enriched_at?: string;
  raw_data?: any;
  created_at?: string;
  created_by?: string;
}

export interface EngageProspectList {
  id: string;
  name: string;
  description?: string;
  is_smart: boolean;
  prospect_count: number;
  created_at?: string;
}

export interface EngageSavedSearch {
  id: string;
  name: string;
  search_type: 'prospect' | 'company';
  filters: Record<string, any>;
  result_count: number;
  last_run_at?: string;
  created_at?: string;
}

export interface ResearchReport {
  id: string;
  report_type: string;
  title: string;
  content: Record<string, any>;
  data_sources?: string[];
  created_at?: string;
}

export interface OutreachDraft {
  id: string;
  channel: string;
  subject?: string;
  body: string;
  tone: string;
  status: string;
  version: number;
  created_at?: string;
}

export interface ProviderStatus {
  apollo: boolean;
  tavily: boolean;
  pdl: boolean;
  anthropic: boolean;
}

export interface SearchFilters {
  titles?: string[];
  seniority?: string[];
  industries?: string[];
  employee_ranges?: string[];
  locations?: string[];
  domains?: string[];
  keywords?: string;
  technology?: string;
  page?: number;
  per_page?: number;
}

// ── Backend API calls (via Supabase Edge Functions) ──────────

/** Call the Express backend directly as a fallback (authenticated via backendFetch) */
async function fetchBackend<T = any>(path: string, body?: Record<string, any>, method: string = 'POST'): Promise<T> {
  return backendFetch<T>(path, body, method);
}

/** Try Edge Function first, fall back to Express backend */
async function invokeWithFallback<T = any>(
  edgeFn: string,
  body: Record<string, any> | undefined,
  queryParams: Record<string, string> | undefined,
  backendPath: string,
  backendMethod: string = 'POST'
): Promise<T> {
  try {
    return await invokeEdge<T>(edgeFn, body, queryParams);
  } catch (edgeErr) {
    console.warn(`Edge function ${edgeFn} failed, falling back to ${backendPath}:`, edgeErr);
    return fetchBackend<T>(backendPath, body, backendMethod);
  }
}

export const engageApi = {
  /** Check which data providers are configured */
  getStatus: () => invokeWithFallback<{ ok: boolean; providers: ProviderStatus }>(
    'engage-search', undefined, { action: 'status' }, '/api/engage/status', 'GET'
  ),

  /** Search for prospects via Apollo — goes directly to backend for Hunter enrichment */
  searchProspects: (filters: SearchFilters) =>
    fetchBackend<{ ok: boolean; data: any }>('/api/engage/search/prospects', filters as any),

  /** Search for companies via Apollo — ICP Prospector filter-based search */
  searchCompanies: (filters: SearchFilters) =>
    invokeEdge<{ ok: boolean; data: any }>(
      'engage-research', filters as any, { action: 'search_companies' }
    ),

  /** Batch enrich companies by domain — returns tech stack, revenue, founded_year, keywords */
  batchEnrichCompanies: (domains: string[]) =>
    invokeEdge<{ ok: boolean; data: Array<{ domain: string; data: any }> }>(
      'engage-research', { domains }, { action: 'batch_enrich_companies' }
    ),

  /** Company disambiguation — search for matching companies by name */
  searchOrganizations: (query: string) =>
    fetchBackend<{ ok: boolean; companies: any[] }>('/api/engage/search/organizations', { query }),

  /** Find people at a specific company — goes directly to backend for Hunter enrichment */
  findPeopleAtCompany: (domain: string, opts?: { titles?: string[]; seniority?: string[]; per_page?: number }) =>
    fetchBackend<{ ok: boolean; data: any }>('/api/engage/search/people-at-company', { domain, ...(opts || {}) }),

  /** Get suggested contacts after company research — goes directly to backend for Hunter enrichment */
  getSuggestedContacts: (domain: string) =>
    fetchBackend<{ ok: boolean; data: any }>('/api/engage/search/suggested-contacts', { domain }),

  /** Full company research (Apollo + Tavily + Claude brief) */
  researchCompany: (domain: string) =>
    invokeWithFallback<{ ok: boolean; company: any; brief: any; data_sources: string[]; tokens_used: number; errors: any[] }>(
      'engage-research',
      { domain },
      { action: 'company' },
      '/api/engage/research/company'
    ),

  /** Full prospect research */
  researchProspect: (identifier: { email?: string; linkedin_url?: string; first_name?: string; last_name?: string; company_name?: string }) =>
    invokeWithFallback<{ ok: boolean; prospect: any; brief: any; data_sources: string[]; tokens_used: number; errors: any[] }>(
      'engage-research',
      identifier,
      { action: 'prospect' },
      '/api/engage/research/prospect'
    ),

  /** Generate AI outreach draft */
  generateOutreach: (prospect: any, companyBrief: any, options?: { channel?: string; tone?: string; template_id?: string; template_system_prompt?: string; template_user_prompt?: string }) =>
    invokeWithFallback<{ ok: boolean; content: any; tokens_used: number }>('engage-outreach', {
      prospect,
      company_brief: companyBrief,
      ...options,
    }, undefined, '/api/engage/outreach/draft'),

  /** AI web search */
  webSearch: (query: string, maxResults = 5) =>
    invokeWithFallback<{ ok: boolean; data: any }>(
      'engage-search', { query, max_results: maxResults }, { action: 'web' }, '/api/engage/search/web'
    ),

  // ── Phase 3: Sequences ──
  /** Generate AI content for a sequence step */
  generateSequenceStep: (params: {
    sequence_name: string;
    sequence_description?: string;
    step_number: number;
    channel?: string;
    tone?: string;
    previous_steps?: string[];
  }) => invokeEdge<{ ok: boolean; subject?: string; body: string }>('engage-sequences', params, { action: 'generate-step' }),

  // ── Phase 3: Account Intelligence ──
  /** AI analysis for a target account */
  analyzeAccount: (account: Record<string, any>) =>
    invokeEdge<{
      ok: boolean;
      summary: string;
      strategy: string;
      risk_factors: string[];
      opportunities: string[];
      recommended_tier: string;
      intent_score: number;
      engagement_score: number;
    }>('engage-accounts', { account }, { action: 'analyze' }),

  /** Bulk score accounts with AI */
  scoreAccounts: (accounts: Record<string, any>[]) =>
    invokeEdge<{ ok: boolean; scores: Array<{ account_name: string; account_score: number; intent_score: number; engagement_score: number; recommended_tier: string }> }>(
      'engage-accounts',
      { accounts },
      { action: 'score' }
    ),

  // ── Phase 3: Playbooks ──
  /** AI-generate a complete playbook from a scenario description */
  generatePlaybook: (params: { scenario: string; target_role?: string; industry?: string }) =>
    invokeEdge<{
      ok: boolean;
      name: string;
      description: string;
      trigger_type: string;
      steps: Array<{ action: string; description: string; expected_output?: string; tool?: string; condition?: string }>;
      tags: string[];
      estimated_duration_days?: number;
    }>('engage-playbooks', params, { action: 'generate' }),
};

// ── Supabase CRUD (direct from frontend via RLS) ─────────────

export const engageDb = {
  // ─ Companies ─
  async getCompanies(orgId: string, opts?: { limit?: number; offset?: number; search?: string }) {
    let q = supabase
      .from('engage_companies')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (opts?.search) q = q.ilike('name', `%${opts.search}%`);
    if (opts?.limit) q = q.limit(opts.limit);
    if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 25) - 1);
    return q;
  },

  async upsertCompany(company: Partial<EngageCompany> & { organization_id: string }) {
    return supabase.from('engage_companies').upsert(company, { onConflict: 'organization_id,domain' }).select().single();
  },

  async getCompany(id: string) {
    return supabase.from('engage_companies').select('*').eq('id', id).single();
  },

  // ─ Prospects ─
  async getProspects(orgId: string, opts?: { limit?: number; offset?: number; status?: string; search?: string; listId?: string }) {
    let q = supabase
      .from('engage_prospects')
      .select('*, engage_companies(name, domain, logo_url)')
      .eq('organization_id', orgId)
      .order('fit_score', { ascending: false });
    if (opts?.status) q = q.eq('status', opts.status);
    if (opts?.search) q = q.or(`full_name.ilike.%${opts.search}%,email.ilike.%${opts.search}%,company_name.ilike.%${opts.search}%`);
    if (opts?.limit) q = q.limit(opts.limit);
    if (opts?.offset) q = q.range(opts.offset, opts.offset + (opts.limit || 25) - 1);
    return q;
  },

  async upsertProspect(prospect: Partial<EngageProspect> & { organization_id: string }) {
    return supabase.from('engage_prospects').upsert(prospect, { onConflict: 'organization_id,email' }).select().single();
  },

  async updateProspectStatus(id: string, status: string) {
    return supabase.from('engage_prospects').update({ status }).eq('id', id).select().single();
  },

  async getProspect(id: string) {
    return supabase.from('engage_prospects').select('*, engage_companies(*)').eq('id', id).single();
  },

  // ─ Lists ─
  async getLists(orgId: string) {
    return supabase
      .from('engage_prospect_lists')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
  },

  async createList(list: { organization_id: string; name: string; description?: string; created_by?: string }) {
    return supabase.from('engage_prospect_lists').insert(list).select().single();
  },

  async addToList(listId: string, prospectId: string, addedBy?: string) {
    return supabase.from('engage_prospect_list_items').insert({ list_id: listId, prospect_id: prospectId, added_by: addedBy });
  },

  async removeFromList(listId: string, prospectId: string) {
    return supabase.from('engage_prospect_list_items').delete().eq('list_id', listId).eq('prospect_id', prospectId);
  },

  async getListProspects(listId: string) {
    return supabase
      .from('engage_prospect_list_items')
      .select('*, engage_prospects(*, engage_companies(name, domain, logo_url))')
      .eq('list_id', listId)
      .order('added_at', { ascending: false });
  },

  // ─ Saved Searches ─
  async getSavedSearches(orgId: string) {
    return supabase
      .from('engage_saved_searches')
      .select('*')
      .eq('organization_id', orgId)
      .order('updated_at', { ascending: false });
  },

  async saveSearch(search: { organization_id: string; name: string; search_type: string; filters: Record<string, any>; created_by?: string }) {
    return supabase.from('engage_saved_searches').insert(search).select().single();
  },

  async deleteSavedSearch(id: string) {
    return supabase.from('engage_saved_searches').delete().eq('id', id);
  },

  // ─ Research Reports ─
  async getReports(orgId: string, opts?: { companyId?: string; prospectId?: string }) {
    let q = supabase
      .from('engage_research_reports')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (opts?.companyId) q = q.eq('company_id', opts.companyId);
    if (opts?.prospectId) q = q.eq('prospect_id', opts.prospectId);
    return q;
  },

  async saveReport(report: {
    organization_id: string;
    report_type: string;
    title: string;
    content: Record<string, any>;
    company_id?: string;
    prospect_id?: string;
    model_used?: string;
    data_sources?: string[];
    tokens_used?: number;
    created_by?: string;
  }) {
    return supabase.from('engage_research_reports').insert(report).select().single();
  },

  // ─ Outreach Drafts ─
  async getDrafts(orgId: string, prospectId?: string) {
    let q = supabase
      .from('engage_outreach_drafts')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
    if (prospectId) q = q.eq('prospect_id', prospectId);
    return q;
  },

  async saveDraft(draft: {
    organization_id: string;
    prospect_id: string;
    channel: string;
    subject?: string;
    body: string;
    tone?: string;
    personalization_context?: Record<string, any>;
    model_used?: string;
    tokens_used?: number;
    created_by?: string;
  }) {
    return supabase.from('engage_outreach_drafts').insert(draft).select().single();
  },

  async updateDraftStatus(id: string, status: string) {
    return supabase.from('engage_outreach_drafts').update({ status }).eq('id', id).select().single();
  },

  // ─ Activity Feed Events (shown in the Activity Feed panel) ─
  async logActivityEvent(entry: {
    organization_id: string;
    actor_id?: string;
    event_type: string; // e.g. 'deal.created', 'signal.actioned', 'outreach.generated'
    title: string;
    description?: string;
    icon?: string;
    color?: string;
  }) {
    return supabase.from('engage_activity_events').insert(entry);
  },

  // ─ Activity Log (API usage tracking) ─
  async logActivity(entry: {
    organization_id: string;
    user_id?: string;
    action: string;
    entity_type?: string;
    entity_id?: string;
    metadata?: Record<string, any>;
    credits_used?: number;
  }) {
    return supabase.from('engage_activity_log').insert(entry);
  },

  async getActivity(orgId: string, limit = 50) {
    return supabase
      .from('engage_activity_log')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false })
      .limit(limit);
  },

  // ── Phase 3: Sequences ────────────────────────────
  async getSequences(orgId: string) {
    return supabase
      .from('engage_sequences')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
  },

  async getSequence(id: string) {
    return supabase.from('engage_sequences').select('*').eq('id', id).single();
  },

  async createSequence(seq: { organization_id: string; name: string; description?: string; default_channel?: string; created_by?: string }) {
    return supabase.from('engage_sequences').insert(seq).select().single();
  },

  async updateSequence(id: string, updates: Record<string, any>) {
    return supabase.from('engage_sequences').update(updates).eq('id', id).select().single();
  },

  async deleteSequence(id: string) {
    return supabase.from('engage_sequences').delete().eq('id', id);
  },

  async getSequenceSteps(sequenceId: string) {
    return supabase
      .from('engage_sequence_steps')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('step_number', { ascending: true });
  },

  async upsertStep(step: Record<string, any>) {
    return supabase.from('engage_sequence_steps').upsert(step, { onConflict: 'sequence_id,step_number' }).select().single();
  },

  async deleteStep(stepId: string) {
    return supabase.from('engage_sequence_steps').delete().eq('id', stepId);
  },

  async getEnrollments(sequenceId: string) {
    return supabase
      .from('engage_sequence_enrollments')
      .select('*')
      .eq('sequence_id', sequenceId)
      .order('enrolled_at', { ascending: false });
  },

  async enrollProspect(enrollment: { sequence_id: string; prospect_id: string; organization_id: string; enrolled_by?: string }) {
    return supabase.from('engage_sequence_enrollments').insert(enrollment).select().single();
  },

  async updateEnrollment(id: string, updates: Record<string, any>) {
    return supabase.from('engage_sequence_enrollments').update(updates).eq('id', id).select().single();
  },

  // ── Phase 3: Account Intelligence ─────────────────
  async getAccounts(orgId: string, opts?: { tier?: string; search?: string }) {
    let q = supabase
      .from('engage_accounts')
      .select('*')
      .eq('organization_id', orgId)
      .order('account_score', { ascending: false });
    if (opts?.tier) q = q.eq('tier', opts.tier);
    if (opts?.search) q = q.ilike('account_name', `%${opts.search}%`);
    return q;
  },

  async getAccount(id: string) {
    return supabase.from('engage_accounts').select('*').eq('id', id).single();
  },

  async createAccount(account: { organization_id: string; account_name: string; domain?: string; industry?: string; tier?: string; created_by?: string }) {
    return supabase.from('engage_accounts').insert(account).select().single();
  },

  async updateAccount(id: string, updates: Record<string, any>) {
    return supabase.from('engage_accounts').update(updates).eq('id', id).select().single();
  },

  async deleteAccount(id: string) {
    return supabase.from('engage_accounts').delete().eq('id', id);
  },

  // ── Phase 3: Playbooks ────────────────────────────
  async getPlaybooks(orgId: string) {
    return supabase
      .from('engage_playbooks')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });
  },

  async getPlaybook(id: string) {
    return supabase.from('engage_playbooks').select('*').eq('id', id).single();
  },

  async createPlaybook(playbook: { organization_id: string; name: string; description?: string; trigger_type?: string; steps?: any; tags?: string[]; created_by?: string }) {
    return supabase.from('engage_playbooks').insert(playbook).select().single();
  },

  async updatePlaybook(id: string, updates: Record<string, any>) {
    return supabase.from('engage_playbooks').update(updates).eq('id', id).select().single();
  },

  async deletePlaybook(id: string) {
    return supabase.from('engage_playbooks').delete().eq('id', id);
  },

  async getPlaybookExecutions(playbookId: string) {
    return supabase
      .from('engage_playbook_executions')
      .select('*')
      .eq('playbook_id', playbookId)
      .order('started_at', { ascending: false });
  },

  async startExecution(exec: { playbook_id: string; organization_id: string; started_by?: string; context?: Record<string, any> }) {
    return supabase.from('engage_playbook_executions').insert({ ...exec, status: 'running', current_step: 1 }).select().single();
  },

  async updateExecution(id: string, updates: Record<string, any>) {
    return supabase.from('engage_playbook_executions').update(updates).eq('id', id).select().single();
  },
};
