import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { BarChart3, Check, Sliders } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { useKpiTemplates } from '../../hooks/useKpiTemplates';
import { validateKpiGoals } from './onboardingConstants';

const CATEGORY_ORDER = ['activity', 'engagement', 'pipeline', 'revenue', 'efficiency'];
const CATEGORY_LABELS = {
  activity: 'Activity',
  engagement: 'Engagement',
  pipeline: 'Pipeline',
  revenue: 'Revenue',
  efficiency: 'Efficiency',
};

export default function StepKpiConfig({ wizardState, updateState, organizationId }) {
  const { kpiGoals, selectedTemplate } = wizardState;
  const { templates, loading: templatesLoading } = useKpiTemplates(organizationId);
  const [allMetrics, setAllMetrics] = useState([]);
  const [metricsLoaded, setMetricsLoaded] = useState(false);

  // Load ALL KPI metrics from global catalog, merge with org-specific overrides
  const loadMetrics = useCallback(async () => {
    if (metricsLoaded) return;
    try {
      // Always load the full global catalog
      const { data: globalData } = await supabase
        .from('kpi_metrics')
        .select('id, key, name, goal, weight, unit, is_active, show_on_scorecard, scorecard_position, category')
        .eq('is_active', true)
        .order('scorecard_position', { nullsFirst: false });

      if (!globalData || globalData.length === 0) {
        setMetricsLoaded(true);
        return;
      }

      // Load org-specific overrides if org exists
      const orgMap = {};
      if (organizationId) {
        const { data: orgData } = await supabase
          .from('kpi_org_configs')
          .select('goal, weight, is_active, show_on_scorecard, scorecard_position, kpi_metrics!inner(key)')
          .eq('organization_id', organizationId);
        if (orgData) {
          orgData.forEach(c => { orgMap[c.kpi_metrics.key] = c; });
        }
      }

      // Merge: full global catalog + org overrides where they exist
      const merged = globalData.map(m => {
        const org = orgMap[m.key];
        return {
          key: m.key,
          name: m.name,
          goal: org?.goal ?? m.goal ?? 100,
          weight: org ? org.weight : (m.weight ?? 0),
          unit: m.unit || 'count',
          is_active: true,
          show_on_scorecard: org?.show_on_scorecard ?? m.show_on_scorecard ?? false,
          scorecard_position: org?.scorecard_position ?? m.scorecard_position,
          category: m.category || '',
        };
      });

      setAllMetrics(merged);
      if (kpiGoals.length === 0 || !kpiGoals.some(k => k.enabled)) {
        const goals = merged.map(m => ({
          key: m.key,
          name: m.name,
          goal: m.goal || 100,
          weight: Math.round((m.weight || 0) * 100),
          unit: m.unit || 'count',
          enabled: m.show_on_scorecard || false,
          category: m.category || '',
        }));
        updateState({ kpiGoals: goals });
      }
      setMetricsLoaded(true);
    } catch (err) {
      console.error('Failed to load KPI metrics:', err);
    }
  }, [metricsLoaded, kpiGoals.length, organizationId]);

  useEffect(() => { loadMetrics(); }, [loadMetrics]);

  // Apply a template
  const applyTemplate = (template) => {
    const configs = template.kpi_configs || [];
    const updated = kpiGoals.map(kpi => {
      const match = configs.find(c => c.kpi_key === kpi.key);
      if (match) {
        return { ...kpi, goal: match.goal, weight: Math.round(match.weight * 100), enabled: true };
      }
      return { ...kpi, enabled: false, weight: 0 };
    });
    // Ensure template KPIs that don't exist yet get added
    configs.forEach(c => {
      if (!updated.find(k => k.key === c.kpi_key)) {
        const metric = allMetrics.find(m => m.key === c.kpi_key);
        if (metric) {
          updated.push({
            key: c.kpi_key,
            name: metric.name,
            goal: c.goal,
            weight: Math.round(c.weight * 100),
            unit: metric.unit || 'count',
            enabled: true,
            category: metric.category || '',
          });
        }
      }
    });
    updateState({ kpiGoals: updated, selectedTemplate: template.title_key });
  };

  const toggleKpi = (index) => {
    const updated = [...kpiGoals];
    const enabledCount = updated.filter(k => k.enabled).length;
    if (updated[index].enabled) {
      updated[index] = { ...updated[index], enabled: false, weight: 0 };
    } else if (enabledCount < 5) {
      updated[index] = { ...updated[index], enabled: true };
    }
    updateState({ kpiGoals: updated });
  };

  const updateKpi = (index, field, value) => {
    const updated = [...kpiGoals];
    updated[index] = { ...updated[index], [field]: field === 'goal' || field === 'weight' ? Number(value) || 0 : value };
    updateState({ kpiGoals: updated });
  };

  const enabledKpis = kpiGoals.filter(k => k.enabled);
  const totalWeight = enabledKpis.reduce((sum, k) => sum + k.weight, 0);

  // Group KPIs by category for display
  const groupedKpis = useMemo(() => {
    const groups = {};
    kpiGoals.forEach((kpi, i) => {
      const cat = kpi.category || 'other';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push({ ...kpi, _idx: i });
    });
    // Sort groups by CATEGORY_ORDER, unknown categories at end
    const ordered = [];
    for (const cat of CATEGORY_ORDER) {
      if (groups[cat]) ordered.push({ category: cat, kpis: groups[cat] });
    }
    for (const cat of Object.keys(groups)) {
      if (!CATEGORY_ORDER.includes(cat)) ordered.push({ category: cat, kpis: groups[cat] });
    }
    return ordered;
  }, [kpiGoals]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
          <BarChart3 size={20} className="text-amber-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">KPI Configuration</h3>
          <p className="text-sm text-gray-500">Choose a role-based template or configure your own scorecard</p>
        </div>
      </div>

      {/* Template Selector */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Quick Start: Role Templates</label>
        <div className="flex gap-2 flex-wrap">
          {templatesLoading ? (
            <span className="text-xs text-gray-400">Loading templates...</span>
          ) : (
            <>
              {templates.map(t => (
                <button
                  key={t.title_key}
                  type="button"
                  onClick={() => applyTemplate(t)}
                  className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                    selectedTemplate === t.title_key
                      ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                      : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t.template_name}
                  {selectedTemplate === t.title_key && <Check size={14} className="inline ml-1" />}
                </button>
              ))}
              <button
                type="button"
                onClick={() => updateState({ selectedTemplate: 'custom' })}
                className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all flex items-center gap-1 ${
                  selectedTemplate === 'custom'
                    ? 'border-amber-500 bg-amber-50 text-amber-700 ring-1 ring-amber-200'
                    : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                <Sliders size={14} /> Custom
              </button>
            </>
          )}
        </div>
      </div>

      {/* Weight Summary */}
      <div className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm ${
        Math.abs(totalWeight - 100) <= 0.5
          ? 'bg-emerald-50 text-emerald-700'
          : 'bg-red-50 text-red-700'
      }`}>
        <span>
          <strong>{enabledKpis.length}</strong> KPIs selected (3-5 required)
        </span>
        <span>
          Total weight: <strong>{totalWeight}%</strong> / 100%
        </span>
      </div>

      {/* KPI List — grouped by category */}
      <div className="space-y-4 max-h-80 overflow-y-auto pr-1">
        {groupedKpis.map(group => (
          <div key={group.category}>
            <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wide mb-1.5 py-1">
              {CATEGORY_LABELS[group.category] || group.category}
              <span className="font-normal text-gray-400 ml-1">
                ({group.kpis.filter(k => k.enabled).length}/{group.kpis.length})
              </span>
            </h4>
            <div className="space-y-1.5">
              {group.kpis.map(kpi => (
                <div
                  key={kpi.key}
                  className={`flex items-center gap-3 p-2.5 rounded-lg border transition-all ${
                    kpi.enabled
                      ? 'border-amber-200 bg-amber-50/50'
                      : 'border-gray-100 bg-gray-50/50 opacity-60'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => toggleKpi(kpi._idx)}
                    className={`w-5 h-5 rounded flex items-center justify-center flex-shrink-0 ${
                      kpi.enabled
                        ? 'bg-amber-500 text-white'
                        : 'border border-gray-300'
                    }`}
                  >
                    {kpi.enabled && <Check size={12} />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900">{kpi.name}</div>
                  </div>
                  {kpi.enabled && (
                    <>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">Goal:</label>
                        <input
                          type="number"
                          value={kpi.goal}
                          onChange={(e) => updateKpi(kpi._idx, 'goal', e.target.value)}
                          className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          min="1"
                        />
                        <span className="text-xs text-gray-400">{kpi.unit === 'dollars' ? '$' : ''}</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <label className="text-xs text-gray-500">Weight:</label>
                        <input
                          type="number"
                          value={kpi.weight}
                          onChange={(e) => updateKpi(kpi._idx, 'weight', e.target.value)}
                          className="w-16 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                          min="0"
                          max="100"
                        />
                        <span className="text-xs text-gray-400">%</span>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

StepKpiConfig.validate = (wizardState) => validateKpiGoals(wizardState.kpiGoals);
