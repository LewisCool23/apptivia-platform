import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

export interface KpiTemplateConfig {
  kpi_key: string;
  goal: number;
  weight: number;
}

export interface KpiRoleTemplate {
  id: string;
  organization_id: string | null;
  title_key: string;
  template_name: string;
  kpi_configs: KpiTemplateConfig[];
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Hook for managing KPI role templates.
 * Returns global defaults merged with org-specific overrides.
 */
export function useKpiTemplates(organizationId: string | null) {
  const [templates, setTemplates] = useState<KpiRoleTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTemplates = useCallback(async () => {
    if (!organizationId) { setTemplates([]); setLoading(false); return; }
    try {
      setLoading(true);
      setError(null);

      // Fetch global defaults + org-specific templates
      const { data, error: fetchErr } = await supabase
        .from('kpi_role_templates')
        .select('*')
        .or(`organization_id.is.null,organization_id.eq.${organizationId}`)
        .order('title_key');

      if (fetchErr) throw fetchErr;

      // Org-specific overrides global for same title_key
      const orgMap = new Map<string, KpiRoleTemplate>();
      const globalMap = new Map<string, KpiRoleTemplate>();
      (data || []).forEach((t: any) => {
        if (t.organization_id) orgMap.set(t.title_key, t);
        else globalMap.set(t.title_key, t);
      });

      const merged: KpiRoleTemplate[] = [];
      const allKeys = new Set([...globalMap.keys(), ...orgMap.keys()]);
      allKeys.forEach(key => {
        merged.push(orgMap.get(key) || globalMap.get(key)!);
      });

      setTemplates(merged);
    } catch (err: any) {
      setError(err?.message || String(err));
    } finally {
      setLoading(false);
    }
  }, [organizationId]);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  /** Save (upsert) an org-specific template */
  const saveTemplate = useCallback(async (
    titleKey: string,
    templateName: string,
    kpiConfigs: KpiTemplateConfig[]
  ) => {
    if (!organizationId) throw new Error('No organization');
    const { error: upsertErr } = await supabase
      .from('kpi_role_templates')
      .upsert({
        organization_id: organizationId,
        title_key: titleKey,
        template_name: templateName,
        kpi_configs: kpiConfigs,
        is_default: false,
      }, { onConflict: 'organization_id,title_key' });

    if (upsertErr) throw upsertErr;
    await fetchTemplates();
  }, [organizationId, fetchTemplates]);

  /** Apply a template — writes org-scoped KPI config to kpi_org_configs */
  const applyTemplate = useCallback(async (template: KpiRoleTemplate) => {
    if (!organizationId) throw new Error('No organization');

    const configs = template.kpi_configs;
    if (!configs || configs.length === 0) return;

    // Resolve kpi_key → kpi_id from the global catalog
    const { data: allMetrics, error: metricsErr } = await supabase
      .from('kpi_metrics')
      .select('id, key')
      .eq('is_active', true);
    if (metricsErr) throw metricsErr;
    const keyToId: Record<string, string> = {};
    (allMetrics || []).forEach((m: any) => { keyToId[m.key] = m.id; });

    // Clear scorecard selections for this org only
    const { error: clearErr } = await supabase
      .from('kpi_org_configs')
      .update({ show_on_scorecard: false, scorecard_position: null })
      .eq('organization_id', organizationId);
    if (clearErr) throw clearErr;

    // Upsert each template KPI into kpi_org_configs
    const scorecardKeys = configs.slice(0, 5).map(c => c.kpi_key);
    for (const cfg of configs) {
      const kpiId = keyToId[cfg.kpi_key];
      if (!kpiId) continue;
      const pos = scorecardKeys.indexOf(cfg.kpi_key);
      const { error: upsertErr } = await supabase
        .from('kpi_org_configs')
        .upsert({
          organization_id: organizationId,
          kpi_id: kpiId,
          goal: cfg.goal,
          weight: cfg.weight,
          is_active: true,
          show_on_scorecard: pos >= 0,
          scorecard_position: pos >= 0 ? pos + 1 : null,
          updated_at: new Date().toISOString(),
        }, { onConflict: 'organization_id,kpi_id' });
      if (upsertErr) throw upsertErr;
    }
  }, [organizationId]);

  /** Delete an org-specific template (reverts to global default) */
  const deleteTemplate = useCallback(async (templateId: string) => {
    if (!organizationId) throw new Error('Organization ID required');
    const { error: delErr } = await supabase
      .from('kpi_role_templates')
      .delete()
      .eq('id', templateId)
      .eq('organization_id', organizationId);

    if (delErr) throw delErr;
    await fetchTemplates();
  }, [organizationId, fetchTemplates]);

  return { templates, loading, error, saveTemplate, applyTemplate, deleteTemplate, refetch: fetchTemplates };
}
