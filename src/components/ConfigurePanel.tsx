import React, { useEffect, useMemo, useState } from 'react';
import RightFilterPanel from './RightFilterPanel';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ConfigurePanelProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenAdvanced?: () => void;
  onSave?: () => void;
}

interface KPIConfig {
  id?: string;
  key: string;
  name: string;
  description?: string;
  goal: number;
  weight: number;
  unit?: string;
  category?: string;
  show_on_scorecard?: boolean;
  scorecard_position?: number | null;
}

export default function ConfigurePanel({
  isOpen,
  onClose,
  onSave,
}: ConfigurePanelProps) {
  const toast = useToast();
  const [kpiConfigs, setKpiConfigs] = useState<KPIConfig[]>([]);
  const [slots, setSlots] = useState<(string | null)[]>([]);
  const [addingSlotIndex, setAddingSlotIndex] = useState<number | null>(null);
  const [selectedAddKey, setSelectedAddKey] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (isOpen) {
      fetchScorecardConfigs();
    }
  }, [isOpen]);

  async function fetchScorecardConfigs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('id, key, name, description, goal, weight, unit, category, show_on_scorecard, scorecard_position')
        .eq('is_active', true)
        .order('scorecard_position', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      const configs = data || [];
      setKpiConfigs(configs);

      const selected = configs.filter((k: any) => k.show_on_scorecard);
      const nextSlots: (string | null)[] = Array.from({ length: 5 }, () => null);

      selected.forEach((kpi: any) => {
        const idx = (kpi.scorecard_position || 0) - 1;
        if (idx >= 0 && idx < 5 && !nextSlots[idx]) {
          nextSlots[idx] = kpi.key;
        }
      });

      selected.forEach((kpi: any) => {
        if (nextSlots.includes(kpi.key)) return;
        const emptyIndex = nextSlots.findIndex((slot) => slot === null);
        if (emptyIndex !== -1) nextSlots[emptyIndex] = kpi.key;
      });

      setSlots(nextSlots);
      setAddingSlotIndex(null);
      setSelectedAddKey('');
    } catch (err: any) {
      toast.error('Error loading configurations: ' + err.message);
      setMessage('Error loading configurations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateConfig(key: string, field: keyof KPIConfig, value: any) {
    const updated = kpiConfigs.map((cfg) => (cfg.key === key ? { ...cfg, [field]: value } : cfg));
    setKpiConfigs(updated);
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const loadingToast = toast.loading('Saving quick settings...');
    try {
      const selectedKeys = slots.filter((k): k is string => !!k);
      for (const key of selectedKeys) {
        const config = kpiConfigs.find((k) => k.key === key);
        if (!config) continue;
        const { error } = await supabase
          .from('kpi_metrics')
          .update({
            goal: config.goal,
            weight: config.weight,
          })
          .eq('key', config.key);

        if (error) throw error;
      }

      toast.dismiss(loadingToast);
      toast.success('Quick settings saved!');
      if (onSave) onSave();
      setMessage('Saved. You can continue editing or open full configuration.');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Error saving: ' + err.message);
      setMessage('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  const totalWeight = useMemo(() => {
    const selectedKeys = slots.filter((k): k is string => !!k);
    const sum = selectedKeys.reduce((acc, key) => {
      const cfg = kpiConfigs.find((k) => k.key === key);
      return acc + (cfg?.weight || 0);
    }, 0);
    return Math.round(sum * 100);
  }, [kpiConfigs, slots]);

  const availableKpis = useMemo(
    () => kpiConfigs.filter((kpi) => !slots.includes(kpi.key)),
    [kpiConfigs, slots]
  );

  async function handleRemove(slotIndex: number) {
    const key = slots[slotIndex];
    if (!key) return;
    const { error } = await supabase
      .from('kpi_metrics')
      .update({ show_on_scorecard: false, scorecard_position: null })
      .eq('key', key);

    if (error) {
      toast.error('Error removing KPI: ' + error.message);
      return;
    }

    setSlots((prev) => prev.map((k, idx) => (idx === slotIndex ? null : k)));
    setKpiConfigs((prev) =>
      prev.map((k) => (k.key === key ? { ...k, show_on_scorecard: false, scorecard_position: null } : k))
    );
    if (onSave) onSave();
  }

  async function handleAdd(slotIndex: number) {
    if (!selectedAddKey) return;
    const { error } = await supabase
      .from('kpi_metrics')
      .update({ show_on_scorecard: true, scorecard_position: slotIndex + 1 })
      .eq('key', selectedAddKey);

    if (error) {
      toast.error('Error adding KPI: ' + error.message);
      return;
    }

    setSlots((prev) => prev.map((k, idx) => (idx === slotIndex ? selectedAddKey : k)));
    setKpiConfigs((prev) =>
      prev.map((k) =>
        k.key === selectedAddKey ? { ...k, show_on_scorecard: true, scorecard_position: slotIndex + 1 } : k
      )
    );
    setAddingSlotIndex(null);
    setSelectedAddKey('');
    if (onSave) onSave();
  }

  return (
    <RightFilterPanel
      isOpen={isOpen}
      onClose={onClose}
      title="Quick Configure"
      subtitle="Adjust scorecard KPI goals and weights"
      panelClassName="w-[420px] max-w-[95vw]"
      contentClassName="pb-6"
    >
      <div className="flex items-center justify-between mb-3">
        <div className="text-xs text-gray-500">
          Scorecard KPIs: <span className="font-semibold text-gray-800">{slots.filter(Boolean).length}/5</span>
        </div>
      </div>

      {loading ? (
        <div className="text-center py-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-3"></div>
          <p className="text-xs text-gray-500">Loading quick settings...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {slots.map((key, index) => {
            const config = key ? kpiConfigs.find((k) => k.key === key) : null;
            return (
              <div
                key={`slot-${index}`}
                className="bg-white border border-gray-200 rounded-lg p-3 space-y-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <div className="text-[11px] text-gray-500">Slot {index + 1}</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {config ? config.name : 'Empty Slot'}
                    </div>
                    <div className="text-[11px] text-gray-500">
                      {config ? (config.description || 'No description') : 'Add a KPI to this slot'}
                    </div>
                  </div>
                  {config && (
                    <button
                      onClick={() => handleRemove(index)}
                      className="text-[11px] text-red-600 hover:text-red-700 font-semibold"
                    >
                      Remove
                    </button>
                  )}
                </div>

                {config ? (
                  <>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Goal</label>
                        <input
                          type="number"
                          value={config.goal}
                          onChange={(e) => {
                            updateConfig(config.key, 'goal', parseFloat(e.target.value) || 0);
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          step="1"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-gray-500 mb-1">Weight (%)</label>
                        <input
                          type="number"
                          value={Math.round(config.weight * 100)}
                          onChange={(e) => {
                            updateConfig(config.key, 'weight', (parseFloat(e.target.value) || 0) / 100);
                          }}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          min="0"
                          max="100"
                          step="1"
                        />
                      </div>
                    </div>
                    <div className="text-[10px] text-gray-400">Unit: {config.unit || 'n/a'}</div>
                  </>
                ) : (
                  <div>
                    {addingSlotIndex === index ? (
                      <div className="space-y-2">
                        <select
                          value={selectedAddKey}
                          onChange={(e) => setSelectedAddKey(e.target.value)}
                          className="w-full px-2 py-1.5 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        >
                          <option value="">Select a KPI...</option>
                          {availableKpis.map((kpi) => (
                            <option key={kpi.key} value={kpi.key}>
                              {kpi.name}
                            </option>
                          ))}
                        </select>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAdd(index)}
                            disabled={!selectedAddKey}
                            className="flex-1 px-2 py-1.5 text-xs bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
                          >
                            Add KPI
                          </button>
                          <button
                            onClick={() => {
                              setAddingSlotIndex(null);
                              setSelectedAddKey('');
                            }}
                            className="flex-1 px-2 py-1.5 text-xs border border-gray-300 rounded hover:bg-gray-50"
                          >
                            Cancel
                          </button>
                        </div>
                        {availableKpis.length === 0 && (
                          <div className="text-[11px] text-gray-500">No available KPIs to add.</div>
                        )}
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setAddingSlotIndex(index);
                          setSelectedAddKey('');
                        }}
                        className="px-3 py-2 text-xs bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
                      >
                        Add KPI
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          <div className="pt-2 text-xs text-gray-600">
            Total Weight: <span className="font-semibold text-gray-900">{totalWeight}%</span>
          </div>

          {message && (
            <div className={`mt-2 p-2 rounded text-xs ${
              message.toLowerCase().includes('error') ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-green-50 text-green-700 border border-green-200'
            }`}>
              {message}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <button
              onClick={onClose}
              disabled={saving}
              className="flex-1 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading || slots.filter(Boolean).length === 0}
              className="flex-1 px-3 py-2 text-xs bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      )}
    </RightFilterPanel>
  );
}
