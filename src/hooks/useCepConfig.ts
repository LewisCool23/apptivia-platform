/**
 * useCepConfig — React hook for CEP stage configuration and org titles.
 *
 * Used by:
 * - PipelineOperator (read CEP stages for rendering)
 * - OrganizationSettings / CepConfigSection (admin CRUD)
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../supabaseClient';
import { STANDARD_B2B_TEMPLATE, DEFAULT_TITLES } from '../constants/cepDefaults';

// ── Types ──────────────────────────────────────────────────

export interface CepChecklistItem {
  key: string;
  label: string;
  required: boolean;
}

export interface CepExitCriterion {
  key: string;
  label: string;
}

export interface CepRoleResponsibility {
  title: string;
  responsibility: string;
}

export interface CepStage {
  id: string;
  organization_id: string;
  stage_key: string;
  stage_name: string;
  stage_order: number;
  cep_type: string;
  color: string;
  win_probability: number;
  checklist_items: CepChecklistItem[];
  exit_criteria: CepExitCriterion[];
  role_responsibilities: CepRoleResponsibility[];
  expected_days: number | null;
  is_terminal: boolean;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface OrgTitle {
  id: string;
  organization_id: string;
  title_name: string;
  title_key: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
}

// ── Hook ───────────────────────────────────────────────────

export function useCepConfig(organizationId: string) {
  const [stages, setStages] = useState<CepStage[]>([]);
  const [titles, setTitles] = useState<OrgTitle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch stages ─────────────────────────────────────────

  const fetchStages = useCallback(async () => {
    if (!organizationId) { setLoading(false); return; }
    try {
      const { data, error: err } = await supabase
        .from('cep_stages')
        .select('*')
        .eq('organization_id', organizationId)
        .eq('cep_type', 'new_business')
        .order('stage_order', { ascending: true });

      if (err) throw err;
      setStages(data || []);
    } catch (err: any) {
      console.error('Error fetching CEP stages:', err);
      setError(err.message);
    }
  }, [organizationId]);

  // ── Fetch titles ─────────────────────────────────────────

  const fetchTitles = useCallback(async () => {
    if (!organizationId) return;
    try {
      const { data, error: err } = await supabase
        .from('titles')
        .select('*')
        .eq('organization_id', organizationId)
        .order('sort_order', { ascending: true });

      if (err) throw err;
      setTitles(data || []);
    } catch (err: any) {
      console.error('Error fetching titles:', err);
    }
  }, [organizationId]);

  // ── Init ─────────────────────────────────────────────────

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStages(), fetchTitles()]).finally(() => setLoading(false));
  }, [fetchStages, fetchTitles]);

  // ── Computed ─────────────────────────────────────────────

  const hasCep = stages.length > 0;

  const activeStages = useMemo(
    () => stages.filter(s => s.is_active).sort((a, b) => a.stage_order - b.stage_order),
    [stages],
  );

  const stageById = useMemo(
    () => new Map(stages.map(s => [s.id, s])),
    [stages],
  );

  const stageByKey = useMemo(
    () => new Map(stages.map(s => [s.stage_key, s])),
    [stages],
  );

  // ── Stage CRUD ───────────────────────────────────────────

  const createStage = useCallback(async (stage: Partial<CepStage>) => {
    const { error: err } = await supabase.from('cep_stages').insert({
      organization_id: organizationId,
      cep_type: 'new_business',
      stage_key: stage.stage_key,
      stage_name: stage.stage_name,
      stage_order: stage.stage_order ?? (stages.length + 1),
      color: stage.color || '#6366f1',
      win_probability: stage.win_probability ?? 0,
      checklist_items: stage.checklist_items || [],
      exit_criteria: stage.exit_criteria || [],
      role_responsibilities: stage.role_responsibilities || [],
      expected_days: stage.expected_days ?? null,
      is_terminal: stage.is_terminal ?? false,
    });
    if (err) throw err;
    await fetchStages();
  }, [organizationId, stages.length, fetchStages]);

  const updateStage = useCallback(async (id: string, updates: Partial<CepStage>) => {
    const { error: err } = await supabase
      .from('cep_stages')
      .update(updates)
      .eq('id', id);
    if (err) throw err;
    await fetchStages();
  }, [fetchStages]);

  const deleteStage = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('cep_stages')
      .delete()
      .eq('id', id);
    if (err) throw err;
    await fetchStages();
  }, [fetchStages]);

  const reorderStages = useCallback(async (stageIds: string[]) => {
    // Batch update stage_order based on array position
    const updates = stageIds.map((id, index) =>
      supabase.from('cep_stages').update({ stage_order: index + 1 }).eq('id', id)
    );
    await Promise.all(updates);
    await fetchStages();
  }, [fetchStages]);

  // ── Seed default stages from template ────────────────────

  const seedDefaultStages = useCallback(async () => {
    try {
      // Insert stages
      const stageRows = STANDARD_B2B_TEMPLATE.map(t => ({
        organization_id: organizationId,
        cep_type: 'new_business' as const,
        stage_key: t.stage_key,
        stage_name: t.stage_name,
        stage_order: t.stage_order,
        color: t.color,
        win_probability: t.win_probability,
        expected_days: t.expected_days,
        is_terminal: t.is_terminal,
        checklist_items: t.checklist_items,
        exit_criteria: t.exit_criteria,
        role_responsibilities: t.role_responsibilities,
      }));

      const { error: stageErr } = await supabase.from('cep_stages').insert(stageRows);
      if (stageErr) throw stageErr;

      // Insert default titles if none exist
      if (titles.length === 0) {
        const titleRows = DEFAULT_TITLES.map(t => ({
          organization_id: organizationId,
          title_key: t.title_key,
          title_name: t.title_name,
          description: t.description,
          sort_order: t.sort_order,
        }));
        const { error: titleErr } = await supabase.from('titles').insert(titleRows);
        if (titleErr) console.error('Error seeding titles:', titleErr);
        await fetchTitles();
      }

      await fetchStages();
    } catch (err: any) {
      console.error('Error seeding CEP stages:', err);
      throw err;
    }
  }, [organizationId, titles.length, fetchStages, fetchTitles]);

  // ── Title CRUD ───────────────────────────────────────────

  const createTitle = useCallback(async (title: Partial<OrgTitle>) => {
    const { error: err } = await supabase.from('titles').insert({
      organization_id: organizationId,
      title_key: title.title_key,
      title_name: title.title_name,
      description: title.description || null,
      sort_order: title.sort_order ?? (titles.length + 1),
    });
    if (err) throw err;
    await fetchTitles();
  }, [organizationId, titles.length, fetchTitles]);

  const updateTitle = useCallback(async (id: string, updates: Partial<OrgTitle>) => {
    const { error: err } = await supabase
      .from('titles')
      .update(updates)
      .eq('id', id);
    if (err) throw err;
    await fetchTitles();
  }, [fetchTitles]);

  const deleteTitle = useCallback(async (id: string) => {
    const { error: err } = await supabase
      .from('titles')
      .delete()
      .eq('id', id);
    if (err) throw err;
    await fetchTitles();
  }, [fetchTitles]);

  // ── Return ───────────────────────────────────────────────

  return {
    stages,
    activeStages,
    stageById,
    stageByKey,
    titles,
    hasCep,
    loading,
    error,
    fetchStages,
    createStage,
    updateStage,
    deleteStage,
    reorderStages,
    seedDefaultStages,
    fetchTitles,
    createTitle,
    updateTitle,
    deleteTitle,
  };
}
