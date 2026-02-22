/**
 * usePromptLibrary — CRUD + filtering for prompt_templates
 * ─────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';

export interface PromptTemplate {
  id: string;
  organization_id: string | null;
  key: string;
  name: string;
  category: string;
  ai_model: string;
  description: string | null;
  system_prompt: string | null;
  user_prompt: string;
  variables: string[];
  channel: string | null;
  tags: string[];
  sort_order: number;
  max_tokens: number;
  temperature: number;
  is_active: boolean;
  is_system: boolean;
  version: number;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type PromptCategory = 'all' | 'research' | 'outreach' | 'analysis' | 'follow_up' | 'deliverability' | 'general';
export type PromptModel = 'all' | 'chatgpt' | 'claude' | 'any';

interface UsePromptLibraryOptions {
  organizationId?: string;
  category?: PromptCategory;
  aiModel?: PromptModel;
  activeOnly?: boolean;
}

export function usePromptLibrary(options: UsePromptLibraryOptions = {}) {
  const { organizationId, category = 'all', aiModel = 'all', activeOnly = true } = options;

  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      let query = supabase
        .from('prompt_templates')
        .select('*')
        .order('sort_order', { ascending: true })
        .order('created_at', { ascending: false });

      if (activeOnly) query = query.eq('is_active', true);
      if (category !== 'all') query = query.eq('category', category);
      if (aiModel !== 'all') query = query.eq('ai_model', aiModel);

      const { data, error: fetchError } = await query;
      if (fetchError) throw fetchError;
      setTemplates((data || []) as PromptTemplate[]);
    } catch (err: any) {
      setError(err.message || 'Failed to load prompt templates');
    } finally {
      setLoading(false);
    }
  }, [organizationId, category, aiModel, activeOnly]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  // Get a single template by key
  const getByKey = useCallback(
    (key: string) => templates.find((t) => t.key === key) || null,
    [templates]
  );

  // Get templates filtered for a specific use case
  const getForUseCase = useCallback(
    (cat: string, model?: string) =>
      templates.filter(
        (t) =>
          t.category === cat &&
          (model ? t.ai_model === model || t.ai_model === 'any' : true) &&
          t.is_active
      ),
    [templates]
  );

  // Resolve variables in a prompt template
  const resolvePrompt = useCallback(
    (template: PromptTemplate, vars: Record<string, string>): { system: string | null; user: string } => {
      let userPrompt = template.user_prompt;
      let systemPrompt = template.system_prompt || null;

      for (const [key, value] of Object.entries(vars)) {
        const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
        userPrompt = userPrompt.replace(pattern, value);
        if (systemPrompt) systemPrompt = systemPrompt.replace(pattern, value);
      }

      return { system: systemPrompt, user: userPrompt };
    },
    []
  );

  // Create a new prompt template
  const createTemplate = useCallback(
    async (template: Partial<PromptTemplate>) => {
      const { data, error: insertError } = await supabase
        .from('prompt_templates')
        .insert({
          ...template,
          organization_id: organizationId || template.organization_id,
        })
        .select()
        .single();

      if (insertError) throw insertError;
      setTemplates((prev) => [...prev, data as PromptTemplate]);
      return data as PromptTemplate;
    },
    [organizationId]
  );

  // Update a prompt template
  const updateTemplate = useCallback(
    async (id: string, updates: Partial<PromptTemplate>) => {
      const { data, error: updateError } = await supabase
        .from('prompt_templates')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (updateError) throw updateError;
      setTemplates((prev) => prev.map((t) => (t.id === id ? (data as PromptTemplate) : t)));
      return data as PromptTemplate;
    },
    []
  );

  // Duplicate a template (useful for customizing system prompts)
  const duplicateTemplate = useCallback(
    async (template: PromptTemplate) => {
      const { id, created_at, updated_at, is_system, ...rest } = template;
      return createTemplate({
        ...rest,
        organization_id: organizationId || null,
        name: `${rest.name} (Copy)`,
        key: `${rest.key}_custom_${Date.now()}`,
        is_system: false,
        version: 1,
      });
    },
    [organizationId, createTemplate]
  );

  // Delete a prompt template
  const deleteTemplate = useCallback(async (id: string) => {
    const { error: deleteError } = await supabase.from('prompt_templates').delete().eq('id', id);
    if (deleteError) throw deleteError;
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }, []);

  // Toggle active state
  const toggleActive = useCallback(
    async (id: string) => {
      const template = templates.find((t) => t.id === id);
      if (!template) return;
      return updateTemplate(id, { is_active: !template.is_active } as any);
    },
    [templates, updateTemplate]
  );

  // Category + model stats
  const stats = {
    total: templates.length,
    byCategory: templates.reduce<Record<string, number>>((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + 1;
      return acc;
    }, {}),
    byModel: templates.reduce<Record<string, number>>((acc, t) => {
      acc[t.ai_model] = (acc[t.ai_model] || 0) + 1;
      return acc;
    }, {}),
    system: templates.filter((t) => t.is_system).length,
    custom: templates.filter((t) => !t.is_system).length,
  };

  return {
    templates,
    loading,
    error,
    stats,
    refresh: fetchTemplates,
    getByKey,
    getForUseCase,
    resolvePrompt,
    createTemplate,
    updateTemplate,
    duplicateTemplate,
    deleteTemplate,
    toggleActive,
  };
}
