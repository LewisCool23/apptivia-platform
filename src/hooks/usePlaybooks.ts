/**
 * usePlaybooks — React hook for the AI Playbook Builder.
 *
 * AI-generated sales plays based on signal patterns, pipeline data,
 * and account intelligence. Tracks playbook usage and outcomes.
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

// ── Types ──────────────────────────────────────────────────

export interface PlaybookStep {
  step_number: number;
  action_type: 'email' | 'call' | 'linkedin' | 'task' | 'research' | 'meeting';
  description: string;
  template?: string;
  channel?: string;
  delay_days?: number;
  tips?: string;
}

export interface PlaybookTrigger {
  signal_types?: string[];
  min_signal_score?: number;
  pipeline_stages?: string[];
  account_tiers?: string[];
  deal_min_value?: number;
  deal_at_risk?: boolean;
  custom_condition?: string;
}

export interface Playbook {
  id: string;
  organization_id: string;
  created_by?: string;
  name: string;
  description?: string;
  playbook_type: 'signal' | 'pipeline' | 'account' | 'custom';
  status: 'draft' | 'active' | 'archived';
  trigger_config: PlaybookTrigger;
  steps: PlaybookStep[];
  ai_generated: boolean;
  ai_source_data?: Record<string, any>;
  ai_model?: string;
  ai_tokens_used: number;
  times_used: number;
  success_rate?: number;
  tags: string[];
  metadata: Record<string, any>;
  created_at: string;
  updated_at: string;
}

export interface PlaybookExecution {
  id: string;
  playbook_id: string;
  organization_id: string;
  executed_by?: string;
  account_id?: string;
  prospect_id?: string;
  deal_id?: string;
  signal_id?: string;
  current_step: number;
  status: 'in_progress' | 'completed' | 'abandoned';
  outcome?: string;
  outcome_notes?: string;
  started_at: string;
  completed_at?: string;
  metadata: Record<string, any>;
  created_at: string;
  // Joined
  playbook_name?: string;
}

export interface PlaybookSummary {
  totalPlaybooks: number;
  activePlaybooks: number;
  totalExecutions: number;
  inProgressCount: number;
  completedCount: number;
  avgSuccessRate: number;
  byType: Record<string, number>;
}

interface PlaybookState {
  playbooks: Playbook[];
  summary: PlaybookSummary;
  activePlaybook: Playbook | null;
  executions: PlaybookExecution[];
  generating: boolean;
  loading: boolean;
  error: string | null;
}

const emptySummary: PlaybookSummary = {
  totalPlaybooks: 0, activePlaybooks: 0, totalExecutions: 0,
  inProgressCount: 0, completedCount: 0, avgSuccessRate: 0, byType: {},
};

// ── Hook ───────────────────────────────────────────────────

export function usePlaybooks(organizationId: string, userId?: string) {
  const [state, setState] = useState<PlaybookState>({
    playbooks: [],
    summary: emptySummary,
    activePlaybook: null,
    executions: [],
    generating: false,
    loading: true,
    error: null,
  });

  const patch = useCallback((p: Partial<PlaybookState>) => setState((prev) => ({ ...prev, ...p })), []);

  // ── Fetch all playbooks ────────────────────────────────

  const fetchPlaybooks = useCallback(async () => {
    if (!organizationId) { patch({ loading: false }); return; }
    patch({ loading: true, error: null });

    try {
      const { data, error } = await supabase
        .from('engage_playbooks')
        .select('*')
        .eq('organization_id', organizationId)
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const playbooks: Playbook[] = (data || []).map((p: any) => ({
        ...p,
        trigger_config: p.trigger_config || {},
        steps: Array.isArray(p.steps) ? p.steps : [],
      }));

      const byType: Record<string, number> = {};
      let activeCount = 0, rateSum = 0, rateCount = 0;
      playbooks.forEach((p) => {
        byType[p.playbook_type] = (byType[p.playbook_type] || 0) + 1;
        if (p.status === 'active') activeCount++;
        if (p.success_rate != null) { rateSum += p.success_rate; rateCount++; }
      });

      patch({
        playbooks,
        summary: {
          totalPlaybooks: playbooks.length,
          activePlaybooks: activeCount,
          totalExecutions: playbooks.reduce((s, p) => s + p.times_used, 0),
          inProgressCount: 0,
          completedCount: 0,
          avgSuccessRate: rateCount > 0 ? Math.round(rateSum / rateCount) : 0,
          byType,
        },
        loading: false,
      });
    } catch (err: any) {
      // If table doesn't exist yet, show empty state instead of error
      const msg = err.message || '';
      if (msg.includes('does not exist') || msg.includes('failed to fetch') || msg.includes('Failed to fetch')) {
        patch({ playbooks: [], loading: false, error: null });
      } else {
        patch({ error: msg, loading: false });
      }
    }
  }, [organizationId, patch]);

  // ── Fetch executions ───────────────────────────────────

  const fetchExecutions = useCallback(async (playbookId?: string) => {
    if (!organizationId) return;
    try {
      let q = supabase
        .from('engage_playbook_executions')
        .select('*, engage_playbooks(name)')
        .eq('organization_id', organizationId)
        .order('started_at', { ascending: false })
        .limit(50);

      if (playbookId) q = q.eq('playbook_id', playbookId);
      const { data, error } = await q;
      if (error) {
        // Table may not exist yet — silently ignore
        console.warn('fetchExecutions:', error.message);
        return;
      }

      const executions: PlaybookExecution[] = (data || []).map((e: any) => ({
        ...e,
        playbook_name: e.engage_playbooks?.name,
      }));

      const inProgress = executions.filter((e) => e.status === 'in_progress').length;
      const completed = executions.filter((e) => e.status === 'completed').length;

      patch({
        executions,
        summary: {
          ...state.summary,
          inProgressCount: inProgress,
          completedCount: completed,
          totalExecutions: executions.length,
        },
      });
    } catch (err: any) {
      // Silently handle — table may not exist
      console.warn('fetchExecutions error:', err.message);
    }
  }, [organizationId, state.summary, patch]);

  // ── Create a playbook ──────────────────────────────────

  const createPlaybook = useCallback(async (playbook: Partial<Playbook> & { trigger_type?: string }) => {
    if (!organizationId) throw new Error('Organization ID is required. Please reload the page.');
    const { data, error } = await supabase
      .from('engage_playbooks')
      .insert({
        organization_id: organizationId,
        created_by: userId || null,
        name: playbook.name,
        description: playbook.description || null,
        playbook_type: playbook.playbook_type || 'custom',
        status: playbook.status || 'draft',
        trigger_config: playbook.trigger_config || (playbook.trigger_type ? { type: playbook.trigger_type } : {}),
        steps: playbook.steps || [],
        ai_generated: playbook.ai_generated || false,
        ai_source_data: playbook.ai_source_data || null,
        ai_model: playbook.ai_model || null,
        ai_tokens_used: playbook.ai_tokens_used || 0,
        times_used: 0,
        tags: playbook.tags || [],
        metadata: playbook.metadata || {},
      })
      .select()
      .single();
    if (error) throw error;
    await fetchPlaybooks();
    return data;
  }, [organizationId, userId, fetchPlaybooks]);

  // ── Update a playbook ──────────────────────────────────

  const updatePlaybook = useCallback(async (id: string, updates: Partial<Playbook>) => {
    const { error } = await supabase
      .from('engage_playbooks')
      .update({ ...updates, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw error;
    await fetchPlaybooks();
  }, [fetchPlaybooks]);

  // ── Delete a playbook ──────────────────────────────────

  const deletePlaybook = useCallback(async (id: string) => {
    const { error } = await supabase.from('engage_playbooks').delete().eq('id', id);
    if (error) throw error;
    if (state.activePlaybook?.id === id) patch({ activePlaybook: null });
    await fetchPlaybooks();
  }, [state.activePlaybook, fetchPlaybooks, patch]);

  // ── AI Generate Playbook ──────────────────────────────

  const generatePlaybook = useCallback(async (sourceType: 'signal' | 'pipeline' | 'account', context: {
    signals?: any[];
    deals?: any[];
    accounts?: any[];
    customPrompt?: string;
    scenario?: string;
    target_role?: string;
    industry?: string;
  }) => {
    patch({ generating: true, error: null });
    try {
      let aiData: any = null;

      try {
        const { data, error } = await supabase.functions.invoke('engage-playbooks', {
          body: {
            action: 'generate',
            organization_id: organizationId,
            source_type: sourceType,
            ...context,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        aiData = data;
      } catch {
        // Edge Function unavailable — create a manual playbook from scenario description
      }

      const playbook = await createPlaybook({
        name: aiData?.name || context.scenario || `AI Playbook — ${sourceType}`,
        description: aiData?.description || context.scenario || '',
        playbook_type: sourceType,
        status: 'draft',
        trigger_config: aiData?.trigger_config || {},
        steps: aiData?.steps || [],
        ai_generated: !!aiData,
        ai_source_data: context,
        ai_model: aiData?.model_used || null,
        ai_tokens_used: aiData?.tokens_used || 0,
      });

      patch({ generating: false });
      return playbook;
    } catch (err: any) {
      patch({ error: err.message, generating: false });
      throw err;
    }
  }, [organizationId, createPlaybook, patch]);

  // ── Start a playbook execution ─────────────────────────

  const startExecution = useCallback(async (playbookId: string, context: {
    account_id?: string; prospect_id?: string; deal_id?: string; signal_id?: string;
  }) => {
    const { data, error } = await supabase
      .from('engage_playbook_executions')
      .insert({
        playbook_id: playbookId,
        organization_id: organizationId,
        executed_by: userId,
        ...context,
      })
      .select()
      .single();
    if (error) throw error;

    // Increment times_used
    const pb = state.playbooks.find((p) => p.id === playbookId);
    if (pb) {
      await supabase.from('engage_playbooks')
        .update({ times_used: (pb.times_used || 0) + 1, updated_at: new Date().toISOString() })
        .eq('id', playbookId);
    }

    await fetchPlaybooks();
    await fetchExecutions(playbookId);
    return data;
  }, [organizationId, userId, state.playbooks, fetchPlaybooks, fetchExecutions]);

  // ── Complete an execution ──────────────────────────────

  const completeExecution = useCallback(async (executionId: string, outcome: string, notes?: string) => {
    const { error } = await supabase
      .from('engage_playbook_executions')
      .update({
        status: 'completed',
        outcome,
        outcome_notes: notes,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
    if (error) throw error;
    await fetchExecutions();
  }, [fetchExecutions]);

  // ── Abandon an execution ───────────────────────────────

  const abandonExecution = useCallback(async (executionId: string, reason?: string) => {
    const { error } = await supabase
      .from('engage_playbook_executions')
      .update({
        status: 'abandoned',
        outcome: 'abandoned',
        outcome_notes: reason,
        completed_at: new Date().toISOString(),
      })
      .eq('id', executionId);
    if (error) throw error;
    await fetchExecutions();
  }, [fetchExecutions]);

  // ── Init ───────────────────────────────────────────────

  useEffect(() => {
    fetchPlaybooks();
  }, [fetchPlaybooks]);

  return {
    ...state,
    fetchPlaybooks,
    fetchExecutions,
    createPlaybook,
    updatePlaybook,
    deletePlaybook,
    generatePlaybook,
    startExecution,
    completeExecution,
    abandonExecution,
  };
}
