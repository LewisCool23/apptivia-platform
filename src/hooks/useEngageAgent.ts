/**
 * useEngageAgent — React hook that orchestrates the full
 * Apptivia Engage research / prospecting workflow.
 *
 * Agent Flow
 * ──────────
 *  1. User enters a search query or selects an ICP filter.
 *  2. searchProspects / searchCompanies  →  Apollo.io
 *  3. User picks a company → researchCompany  →  Apollo enrich + Tavily web + Claude brief
 *  4. User picks a prospect → researchProspect → Apollo enrich + Tavily + Claude brief
 *  5. User requests outreach → generateOutreach → Claude draft
 *  6. Every action persists to Supabase (engage_* tables) and logs to activity_log.
 *
 * The hook exposes simple imperative methods and reactive state
 * so the Engage page can render results, loading spinners, and
 * error messages without managing async plumbing itself.
 */

import { useState, useCallback, useRef } from 'react';
import { engageApi, engageDb, type SearchFilters, type EngageCompany, type EngageProspect, type ResearchReport, type OutreachDraft } from '../utils/engageApi';

// ── Types ──────────────────────────────────────────────────

export interface AgentStep {
  id: string;
  label: string;
  status: 'pending' | 'running' | 'done' | 'error';
  detail?: string;
  startedAt?: number;
  finishedAt?: number;
}

interface AgentState {
  // Search results (raw from Apollo)
  prospectResults: any[];
  companyResults: any[];
  totalResults: number;

  // Persisted entities (from Supabase)
  savedProspects: EngageProspect[];
  savedCompanies: EngageCompany[];

  // Research
  currentReport: ResearchReport | null;
  currentDraft: OutreachDraft | null;

  // Pipeline visibility
  steps: AgentStep[];
  isRunning: boolean;
  error: string | null;
}

const initialState: AgentState = {
  prospectResults: [],
  companyResults: [],
  totalResults: 0,
  savedProspects: [],
  savedCompanies: [],
  currentReport: null,
  currentDraft: null,
  steps: [],
  isRunning: false,
  error: null,
};

// ── Hook ───────────────────────────────────────────────────

export function useEngageAgent(organizationId: string, userId?: string) {
  const [state, setState] = useState<AgentState>(initialState);
  const abortRef = useRef<AbortController | null>(null);

  // Helpers
  const patch = useCallback((partial: Partial<AgentState>) => {
    setState((prev) => ({ ...prev, ...partial }));
  }, []);

  const pushStep = useCallback(
    (id: string, label: string) => {
      setState((prev) => ({
        ...prev,
        steps: [...prev.steps, { id, label, status: 'running', startedAt: Date.now() }],
      }));
    },
    []
  );

  const finishStep = useCallback(
    (id: string, status: 'done' | 'error' = 'done', detail?: string) => {
      setState((prev) => ({
        ...prev,
        steps: prev.steps.map((s) =>
          s.id === id ? { ...s, status, detail, finishedAt: Date.now() } : s
        ),
      }));
    },
    []
  );

  const resetPipeline = useCallback(() => {
    abortRef.current?.abort();
    patch({ steps: [], isRunning: false, error: null });
  }, [patch]);

  // ─── 1. Search Prospects ────────────────────────────────

  const searchProspects = useCallback(
    async (filters: SearchFilters) => {
      resetPipeline();
      patch({ isRunning: true, error: null, prospectResults: [] });
      pushStep('search', 'Searching prospects via Apollo');

      try {
        const res = await engageApi.searchProspects(filters);
        const people = res.data?.people || res.data?.contacts || [];
        patch({ prospectResults: people, totalResults: res.data?.pagination?.total_entries || people.length });
        finishStep('search', 'done', `Found ${people.length} prospects`);

        // Log activity
        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'search',
          entity_type: 'prospect',
          metadata: { filters, result_count: people.length },
        });
      } catch (err: any) {
        finishStep('search', 'error', err.message);
        patch({ error: err.message });
      } finally {
        patch({ isRunning: false });
      }
    },
    [organizationId, userId, resetPipeline, patch, pushStep, finishStep]
  );

  // ─── 2. Search Companies ───────────────────────────────

  const searchCompanies = useCallback(
    async (filters: SearchFilters) => {
      resetPipeline();
      patch({ isRunning: true, error: null, companyResults: [] });
      pushStep('search', 'Searching companies via Apollo');

      try {
        const res = await engageApi.searchCompanies(filters);
        const orgs = res.data?.organizations || res.data?.accounts || [];
        patch({ companyResults: orgs, totalResults: res.data?.pagination?.total_entries || orgs.length });
        finishStep('search', 'done', `Found ${orgs.length} companies`);

        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'search',
          entity_type: 'company',
          metadata: { filters, result_count: orgs.length },
        });
      } catch (err: any) {
        finishStep('search', 'error', err.message);
        patch({ error: err.message });
      } finally {
        patch({ isRunning: false });
      }
    },
    [organizationId, userId, resetPipeline, patch, pushStep, finishStep]
  );

  // ─── 3. Deep Company Research ──────────────────────────

  const researchCompany = useCallback(
    async (domain: string, companyName?: string) => {
      resetPipeline();
      patch({ isRunning: true, error: null, currentReport: null });

      pushStep('enrich', 'Enriching company data');
      pushStep('web', 'Searching the web for recent intel');
      pushStep('ai', 'Generating AI research brief');
      pushStep('save', 'Saving to your workspace');

      try {
        // Backend runs the full pipeline
        finishStep('enrich', 'done');
        const res = await engageApi.researchCompany(domain);
        finishStep('web', 'done');
        finishStep('ai', 'done');

        // Persist company
        const { data: savedCompany } = await engageDb.upsertCompany({
          organization_id: organizationId,
          name: res.company?.name || companyName || domain,
          domain,
          industry: res.company?.industry,
          employee_count_range: res.company?.estimated_num_employees?.toString(),
          headquarters_city: res.company?.city,
          headquarters_state: res.company?.state,
          headquarters_country: res.company?.country,
          tech_stack: res.brief?.tech_stack || [],
          funding_data: res.brief?.funding_history ? { rounds: res.brief.funding_history } : {},
          description: res.brief?.summary,
          logo_url: res.company?.logo_url,
          linkedin_url: res.company?.linkedin_url,
          website_url: res.company?.website_url || `https://${domain}`,
          source: 'apollo',
          enriched_at: new Date().toISOString(),
          raw_data: res.company,
          created_by: userId,
        });

        // Persist report
        const { data: report } = await engageDb.saveReport({
          organization_id: organizationId,
          company_id: savedCompany?.id,
          report_type: 'company_brief',
          title: `Company Brief: ${res.company?.name || domain}`,
          content: res.brief || {},
          data_sources: res.data_sources,
          tokens_used: res.tokens_used,
          model_used: 'claude-sonnet-4-20250514',
          created_by: userId,
        });

        finishStep('save', 'done');
        patch({ currentReport: report, isRunning: false });

        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'generate_report',
          entity_type: 'company',
          entity_id: savedCompany?.id,
          metadata: { domain, data_sources: res.data_sources },
          credits_used: res.tokens_used ? res.tokens_used / 1000 : 0,
        });

        return { company: savedCompany, report };
      } catch (err: any) {
        // Mark whichever step is still running as error
        setState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error' as const, detail: err.message } : s)),
          error: err.message,
          isRunning: false,
        }));
        return null;
      }
    },
    [organizationId, userId, resetPipeline, patch, pushStep, finishStep]
  );

  // ─── 4. Deep Prospect Research ─────────────────────────

  const researchProspect = useCallback(
    async (identifier: { email?: string; linkedin_url?: string; first_name?: string; last_name?: string; company_name?: string }) => {
      resetPipeline();
      patch({ isRunning: true, error: null, currentReport: null });

      pushStep('enrich', 'Enriching prospect profile');
      pushStep('web', 'Searching the web');
      pushStep('ai', 'Generating AI prospect brief');
      pushStep('save', 'Saving to workspace');

      try {
        finishStep('enrich', 'done');
        const res = await engageApi.researchProspect(identifier);
        finishStep('web', 'done');
        finishStep('ai', 'done');

        const person = res.prospect || {};

        // Persist prospect
        const { data: saved } = await engageDb.upsertProspect({
          organization_id: organizationId,
          first_name: person.first_name || identifier.first_name,
          last_name: person.last_name || identifier.last_name,
          email: person.email || identifier.email,
          linkedin_url: person.linkedin_url || identifier.linkedin_url,
          title: person.title,
          seniority_level: person.seniority,
          department: person.department,
          company_name: person.organization?.name || identifier.company_name,
          fit_score: res.brief?.fit_score || 0,
          source: 'apollo',
          enriched_at: new Date().toISOString(),
          raw_data: person,
          created_by: userId,
        });

        // Persist report
        const { data: report } = await engageDb.saveReport({
          organization_id: organizationId,
          prospect_id: saved?.id,
          report_type: 'prospect_brief',
          title: `Prospect Brief: ${person.first_name || ''} ${person.last_name || ''}`.trim(),
          content: res.brief || {},
          data_sources: res.data_sources,
          tokens_used: res.tokens_used,
          model_used: 'claude-sonnet-4-20250514',
          created_by: userId,
        });

        finishStep('save', 'done');
        patch({ currentReport: report, isRunning: false });

        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'generate_report',
          entity_type: 'prospect',
          entity_id: saved?.id,
          metadata: { identifier, data_sources: res.data_sources },
          credits_used: res.tokens_used ? res.tokens_used / 1000 : 0,
        });

        return { prospect: saved, report };
      } catch (err: any) {
        setState((prev) => ({
          ...prev,
          steps: prev.steps.map((s) => (s.status === 'running' ? { ...s, status: 'error' as const, detail: err.message } : s)),
          error: err.message,
          isRunning: false,
        }));
        return null;
      }
    },
    [organizationId, userId, resetPipeline, patch, pushStep, finishStep]
  );

  // ─── 5. Generate Outreach Draft ────────────────────────

  const generateOutreach = useCallback(
    async (
      prospect: EngageProspect,
      companyBrief: Record<string, any>,
      options?: { channel?: string; tone?: string }
    ) => {
      patch({ isRunning: true, error: null, currentDraft: null });
      pushStep('draft', `Generating ${options?.channel || 'email'} draft`);

      try {
        const res = await engageApi.generateOutreach(prospect, companyBrief, options);
        finishStep('draft', 'done');

        // Persist draft
        const { data: draft } = await engageDb.saveDraft({
          organization_id: organizationId,
          prospect_id: prospect.id,
          channel: options?.channel || 'email',
          subject: res.content?.subject,
          body: res.content?.body || '',
          tone: options?.tone || 'professional',
          personalization_context: { points: res.content?.personalization_points, cta_type: res.content?.cta_type },
          model_used: 'claude-sonnet-4-20250514',
          tokens_used: res.tokens_used,
          created_by: userId,
        });

        patch({ currentDraft: draft, isRunning: false });

        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'generate_outreach',
          entity_type: 'draft',
          entity_id: draft?.id,
          metadata: { prospect_id: prospect.id, channel: options?.channel, tone: options?.tone },
          credits_used: res.tokens_used ? res.tokens_used / 1000 : 0,
        });

        return draft;
      } catch (err: any) {
        finishStep('draft', 'error', err.message);
        patch({ error: err.message, isRunning: false });
        return null;
      }
    },
    [organizationId, userId, patch, pushStep, finishStep]
  );

  // ─── 6. Save prospect to a list ────────────────────────

  const addProspectToList = useCallback(
    async (listId: string, prospectId: string) => {
      try {
        await engageDb.addToList(listId, prospectId, userId);
        engageDb.logActivity({
          organization_id: organizationId,
          user_id: userId,
          action: 'add_to_list',
          entity_type: 'prospect',
          entity_id: prospectId,
          metadata: { list_id: listId },
        });
        return true;
      } catch {
        return false;
      }
    },
    [organizationId, userId]
  );

  // ─── 7. Load saved data ────────────────────────────────

  const loadSavedProspects = useCallback(
    async (opts?: { limit?: number; status?: string; search?: string }) => {
      const { data } = await engageDb.getProspects(organizationId, opts);
      if (data) patch({ savedProspects: data as EngageProspect[] });
    },
    [organizationId, patch]
  );

  const loadSavedCompanies = useCallback(
    async (opts?: { limit?: number; search?: string }) => {
      const { data } = await engageDb.getCompanies(organizationId, opts);
      if (data) patch({ savedCompanies: data as EngageCompany[] });
    },
    [organizationId, patch]
  );

  return {
    ...state,
    // Actions
    searchProspects,
    searchCompanies,
    researchCompany,
    researchProspect,
    generateOutreach,
    addProspectToList,
    loadSavedProspects,
    loadSavedCompanies,
    resetPipeline,
  };
}
