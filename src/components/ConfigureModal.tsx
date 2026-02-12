import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { useToast } from '../contexts/ToastContext';

interface ConfigureModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave?: () => void;
  currentUserId?: string;
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
  is_custom?: boolean;
  is_active?: boolean;
  show_on_scorecard?: boolean;
  scorecard_position?: number;
}

export default function ConfigureModal({ isOpen, onClose, onSave, currentUserId }: ConfigureModalProps) {
  const toast = useToast();
  const [kpiConfigs, setKpiConfigs] = useState<KPIConfig[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'manage' | 'create' | 'scorecard'>('manage');
  const [editingKpi, setEditingKpi] = useState<string | null>(null);
  
  // New KPI form state
  const [newKpi, setNewKpi] = useState({
    key: '',
    name: '',
    description: '',
    goal: 100,
    weight: 0.1,
    unit: 'count',
    category: 'activity',
  });

  // Scorecard KPIs state
  const [scorecardKpis, setScorecardKpis] = useState<string[]>([]);

  useEffect(() => {
    if (isOpen) {
      fetchCurrentConfigs();
      fetchScorecardKpis();
    }
  }, [isOpen]);

  async function fetchScorecardKpis() {
    try {
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('key')
        .eq('show_on_scorecard', true)
        .order('scorecard_position');
      
      if (error) throw error;
      setScorecardKpis(data?.map((k: any) => k.key) || []);
    } catch (err: any) {
      console.error('Error fetching scorecard KPIs:', err);
    }
  }

  async function fetchCurrentConfigs() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('kpi_metrics')
        .select('id, key, name, description, goal, weight, unit, category, is_custom, is_active, show_on_scorecard, scorecard_position')
        .eq('is_active', true)
        .order('category', { ascending: true })
        .order('name', { ascending: true });

      if (error) throw error;
      setKpiConfigs(data || []);
    } catch (err: any) {
      toast.error('Error loading configurations: ' + err.message);
      setMessage('Error loading configurations: ' + err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setMessage('');
    const loadingToast = toast.loading('Saving configuration...');
    try {
      // Update each KPI metric
      for (const config of kpiConfigs) {
        const { error } = await supabase
          .from('kpi_metrics')
          .update({ 
            name: config.name,
            description: config.description,
            goal: config.goal, 
            weight: config.weight,
            unit: config.unit,
            category: config.category
          })
          .eq('key', config.key);

        if (error) throw error;
      }

      toast.dismiss(loadingToast);
      toast.success('Configuration saved successfully!');
      if (onSave) onSave(); // Trigger scorecard refresh
      setMessage('Configuration saved! You can continue editing or close the modal.');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Error saving: ' + err.message);
      setMessage('Error saving: ' + err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateKpi() {
    if (!newKpi.key || !newKpi.name) {
      toast.error('Please fill in Key and Name fields');
      return;
    }

    const loadingToast = toast.loading('Creating KPI...');
    try {
      const { error } = await supabase
        .from('kpi_metrics')
        .insert({
          key: newKpi.key.toLowerCase().replace(/\s+/g, '_'),
          name: newKpi.name,
          description: newKpi.description,
          goal: newKpi.goal,
          weight: newKpi.weight,
          unit: newKpi.unit,
          category: newKpi.category,
          is_custom: true,
          is_active: true,
        });

      if (error) throw error;

      toast.dismiss(loadingToast);
      toast.success(`KPI "${newKpi.name}" created successfully!`);
      
      // Reset form
      setNewKpi({
        key: '',
        name: '',
        description: '',
        goal: 100,
        weight: 0.1,
        unit: 'count',
        category: 'activity',
      });
      
      // Refresh lists
      await fetchCurrentConfigs();
      await fetchScorecardKpis();
      setActiveTab('manage');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Error creating KPI: ' + err.message);
    }
  }

  async function handleDeleteKpi(kpi: KPIConfig) {
    if (!kpi.is_custom) {
      toast.error('Cannot delete system KPIs. You can only delete custom KPIs.');
      return;
    }

    const confirmed = window.confirm(`Are you sure you want to delete "${kpi.name}"? This will remove it from all scorecards.`);
    if (!confirmed) return;

    const loadingToast = toast.loading('Deleting KPI...');
    try {
      const { error } = await supabase
        .from('kpi_metrics')
        .update({ is_active: false })
        .eq('key', kpi.key);

      if (error) throw error;

      toast.dismiss(loadingToast);
      toast.success(`KPI "${kpi.name}" deleted successfully`);
      await fetchCurrentConfigs();
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Error deleting KPI: ' + err.message);
    }
  }

  async function handleToggleScorecardKpi(key: string) {
    if (scorecardKpis.includes(key)) {
      // Remove from scorecard
      const newList = scorecardKpis.filter(k => k !== key);
      setScorecardKpis(newList);
      
      // Update database
      const { error } = await supabase
        .from('kpi_metrics')
        .update({ show_on_scorecard: false, scorecard_position: null })
        .eq('key', key);
      
      if (error) {
        toast.error('Error updating scorecard');
        console.error(error);
      } else {
        // Refresh configs and trigger parent refresh
        await fetchCurrentConfigs();
        if (onSave) onSave();
      }
    } else {
      // Add to scorecard (max 5)
      if (scorecardKpis.length >= 5) {
        toast.error('You can only select 5 KPIs for the scorecard');
        return;
      }
      
      const newList = [...scorecardKpis, key];
      setScorecardKpis(newList);
      
      // Update database
      const { error } = await supabase
        .from('kpi_metrics')
        .update({ 
          show_on_scorecard: true, 
          scorecard_position: newList.length 
        })
        .eq('key', key);
      
      if (error) {
        toast.error('Error updating scorecard');
        console.error(error);
      } else {
        // Refresh configs and trigger parent refresh
        await fetchCurrentConfigs();
        if (onSave) onSave();
      }
    }
  }

  async function handleMoveScorecardKpi(key: string, direction: 'up' | 'down') {
    const currentIndex = scorecardKpis.indexOf(key);
    if (currentIndex === -1) return;
    
    const newIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (newIndex < 0 || newIndex >= scorecardKpis.length) return;
    
    const newList = [...scorecardKpis];
    [newList[currentIndex], newList[newIndex]] = [newList[newIndex], newList[currentIndex]];
    setScorecardKpis(newList);
    
    // Update positions in database
    for (let i = 0; i < newList.length; i++) {
      await supabase
        .from('kpi_metrics')
        .update({ scorecard_position: i + 1 })
        .eq('key', newList[i]);
    }
  }

  async function handleSaveScorecardSelection() {
    if (scorecardKpis.length !== 5) {
      toast.error('Please select exactly 5 KPIs for the scorecard');
      return;
    }

    const loadingToast = toast.loading('Saving scorecard selection...');
    try {
      // Refresh KPI configs to ensure we have latest data
      await fetchCurrentConfigs();
      
      toast.dismiss(loadingToast);
      toast.success('Scorecard selection saved! You can now edit goals and weights in the Manage KPIs tab.');
      if (onSave) onSave();
      
      // Switch to manage tab so user can edit goals/weights
      setActiveTab('manage');
    } catch (err: any) {
      toast.dismiss(loadingToast);
      toast.error('Error saving: ' + err.message);
    }
  }

  function updateConfig(index: number, field: keyof KPIConfig, value: any) {
    const updated = [...kpiConfigs];
    updated[index] = { ...updated[index], [field]: value };
    setKpiConfigs(updated);
  }

  function toggleEdit(key: string) {
    setEditingKpi(editingKpi === key ? null : key);
  }

  if (!isOpen) return null;

  const categories = ['activity', 'engagement', 'pipeline', 'revenue', 'efficiency'];
  const units = ['count', 'minutes', 'hours', 'days', 'currency', 'percentage'];

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-4">
          <h2 className="text-2xl font-bold">Scorecard Configuration</h2>
          <p className="text-sm text-whitscorecard')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'scorecard'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            📊 Scorecard Selection ({scorecardKpis.length}/5)
          </button>
          <button
            onClick={() => setActiveTab('e/80 mt-1">Manage KPI metrics, goals, and weights for your custom scorecard</p>
        </div>

        {/* Tabs */}
        <div className="flex border-b bg-gray-50">
          <button
            onClick={() => setActiveTab('manage')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'manage'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            Manage KPIs ({kpiConfigs.length})
          </button>
          <button
            onClick={() => setActiveTab('create')}
            className={`px-6 py-3 font-semibold transition-colors ${
              activeTab === 'create'
                ? 'text-blue-600 border-b-2 border-blue-600 bg-white'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            + Create Custom KPI
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
              <p className="text-gray-500">Loading configurations...</p>
            </div>
          ) : activeTab === 'manage' ? (
            <div className="space-y-6">
              {/* Info banner about scorecard KPIs */}
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
                <div className="flex items-start gap-3">
                  <span className="text-blue-600 text-xl">💡</span>
                  <div>
                    <p className="text-blue-900 font-semibold mb-1">Apptivia Score Calculation</p>
                    <p className="text-blue-800 text-sm">
                      Only KPIs marked with <span className="inline-flex items-center bg-blue-600 text-white px-2 py-0.5 rounded text-xs font-bold mx-1">📊 Scorecard #X</span> contribute to the Apptivia Score. 
                      Select your 5 scorecard KPIs in the <button onClick={() => setActiveTab('scorecard')} className="underline font-semibold">Scorecard Selection</button> tab.
                    </p>
                  </div>
                </div>
              </div>

              {/* Group KPIs by category */}
              {categories.map(category => {
                const categoryKpis = kpiConfigs.filter(k => k.category === category);
                if (categoryKpis.length === 0) return null;

                return (
                  <div key={category} className="space-y-3">
                    <h3 className="text-lg font-semibold text-gray-900 capitalize flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-500"></span>
                      {category} Metrics
                      <span className="text-sm font-normal text-gray-500">({categoryKpis.length})</span>
                    </h3>
                    
                    <div className="space-y-2">
                      {categoryKpis.map((config, idx) => (
                        <div
                          key={config.key}
                          className={`bg-white rounded-lg p-4 hover:shadow-md transition-all duration-200 ${
                            config.show_on_scorecard 
                              ? 'border-2 border-blue-500 shadow-sm bg-blue-50/30' 
                              : 'border border-gray-200'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-2">
                                {editingKpi === config.key ? (
                                  <input
                                    type="text"
                                    value={config.name}
                                    onChange={(e) => {
                                      const index = kpiConfigs.findIndex(k => k.key === config.key);
                                      updateConfig(index, 'name', e.target.value);
                                    }}
                                    className="text-lg font-semibold text-gray-900 border-b-2 border-blue-500 focus:outline-none"
                                  />
                                ) : (
                                  <h4 className="text-lg font-semibold text-gray-900">{config.name}</h4>
                                )}
                                {config.show_on_scorecard && (
                                  <span className="text-xs bg-blue-600 text-white px-2 py-1 rounded font-bold flex items-center gap-1">
                                    📊 Scorecard #{config.scorecard_position}
                                  </span>
                                )}
                                {config.is_custom && (
                                  <span className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded">Custom</span>
                                )}
                              </div>
                              {editingKpi === config.key ? (
                                <input
                                  type="text"
                                  value={config.description || ''}
                                  onChange={(e) => {
                                    const index = kpiConfigs.findIndex(k => k.key === config.key);
                                    updateConfig(index, 'description', e.target.value);
                                  }}
                                  placeholder="Description (optional)"
                                  className="text-sm text-gray-600 w-full border border-gray-300 rounded px-2 py-1"
                                />
                              ) : (
                                <p className="text-sm text-gray-600">{config.description || 'No description'}</p>
                              )}
                              <p className="text-xs text-gray-400 mt-1">Key: {config.key}</p>
                            </div>

                            <div className="flex items-center gap-3">
                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Goal</label>
                                <input
                                  type="number"
                                  value={config.goal}
                                  onChange={(e) => {
                                    const index = kpiConfigs.findIndex(k => k.key === config.key);
                                    updateConfig(index, 'goal', parseFloat(e.target.value) || 0);
                                  }}
                                  className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                  min="0"
                                  step="1"
                                />
                              </div>

                              <div>
                                <label className="text-xs text-gray-500 block mb-1">Weight</label>
                                <div className="flex items-center gap-1">
                                  <input
                                    type="number"
                                    value={Math.round(config.weight * 100)}
                                    onChange={(e) => {
                                      const index = kpiConfigs.findIndex(k => k.key === config.key);
                                      updateConfig(index, 'weight', (parseFloat(e.target.value) || 0) / 100);
                                    }}
                                    className="w-20 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                                    min="0"
                                    max="100"
                                    step="1"
                                  />
                                  <span className="text-gray-500 text-sm">%</span>
                                </div>
                              </div>

                              {editingKpi === config.key ? (
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Unit</label>
                                  <select
                                    value={config.unit}
                                    onChange={(e) => {
                                      const index = kpiConfigs.findIndex(k => k.key === config.key);
                                      updateConfig(index, 'unit', e.target.value);
                                    }}
                                    className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm"
                                  >
                                    {units.map(u => (
                                      <option key={u} value={u}>{u}</option>
                                    ))}
                                  </select>
                                </div>
                              ) : (
                                <div>
                                  <label className="text-xs text-gray-500 block mb-1">Unit</label>
                                  <span className="text-sm text-gray-700 font-medium">{config.unit}</span>
                                </div>
                              )}

                              <div className="flex flex-col gap-1">
                                <button
                                  onClick={() => toggleEdit(config.key)}
                                  className="p-2 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                  title={editingKpi === config.key ? 'Done editing' : 'Edit KPI'}
                                >
                                  {editingKpi === config.key ? '✓' : '✏️'}
                                </button>
                                {config.is_custom && (
                                  <button
                                    onClick={() => handleDeleteKpi(config)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors"
                                    title="Delete KPI"
                                  >
                                    🗑️
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-blue-600 text-xl">ℹ️</span>
                  <div className="text-sm text-blue-800">
                    <strong>Tips:</strong>
                    <ul className="list-disc ml-4 mt-2 space-y-1">
                      <li>Weights should add up to 100% for accurate scoring</li>
                      <li>Click the edit icon to modify KPI names and descriptions</li>
                      <li>Custom KPIs can be deleted; system KPIs cannot</li>
                      <li>Changes apply to all team scorecards</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'scorecard' ? (
            // Scorecard Selection Tab
            <div className="space-y-6">
              <div className="bg-gradient-to-r from-blue-50 to-indigo-50 p-6 rounded-lg border border-blue-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">📊 Select Your Top 5 Scorecard Metrics</h3>
                <p className="text-sm text-gray-600">Choose the 5 most impactful KPIs to display on your main scorecard. These metrics represent the core productivity success indicators for your organization.</p>
              </div>

              <div className="bg-yellow-50 border border-yellow-200 p-4 rounded-lg">
                <div className="flex items-start gap-2">
                  <span className="text-yellow-600 text-xl">⚠️</span>
                  <div className="text-sm text-yellow-800">
                    <strong>Important:</strong> You must select exactly 5 KPIs. Currently selected: <strong>{scorecardKpis.length}/5</strong>
                  </div>
                </div>
              </div>

              {/* Selected KPIs */}
              {scorecardKpis.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Selected Scorecard KPIs (in order):</h4>
                  {scorecardKpis.map((key, index) => {
                    const kpi = kpiConfigs.find(k => k.key === key);
                    if (!kpi) return null;
                    return (
                      <div key={key} className="bg-blue-50 border border-blue-300 rounded-lg p-4 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <span className="bg-blue-600 text-white rounded-full w-8 h-8 flex items-center justify-center font-bold">
                            {index + 1}
                          </span>
                          <div>
                            <h5 className="font-semibold text-gray-900">{kpi.name}</h5>
                            <p className="text-sm text-gray-600">{kpi.description || 'No description'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleMoveScorecardKpi(key, 'up')}
                            disabled={index === 0}
                            className="p-2 text-gray-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move up"
                          >
                            ↑
                          </button>
                          <button
                            onClick={() => handleMoveScorecardKpi(key, 'down')}
                            disabled={index === scorecardKpis.length - 1}
                            className="p-2 text-gray-600 hover:bg-white rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            title="Move down"
                          >
                            ↓
                          </button>
                          <button
                            onClick={() => handleToggleScorecardKpi(key)}
                            className="px-3 py-2 bg-red-500 text-white rounded hover:bg-red-600 transition-colors text-sm font-medium"
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Available KPIs */}
              {scorecardKpis.length < 5 && (
                <div className="space-y-3">
                  <h4 className="font-semibold text-gray-900">Available KPIs ({kpiConfigs.filter(k => !scorecardKpis.includes(k.key)).length}):</h4>
                  <div className="grid grid-cols-1 gap-2 max-h-96 overflow-y-auto">
                    {kpiConfigs
                      .filter(k => !scorecardKpis.includes(k.key))
                      .map(kpi => (
                        <div
                          key={kpi.key}
                          className="bg-white border border-gray-200 rounded-lg p-4 flex items-center justify-between hover:shadow-md transition-all duration-200"
                        >
                          <div>
                            <h5 className="font-semibold text-gray-900">{kpi.name}</h5>
                            <p className="text-sm text-gray-600">{kpi.description || 'No description'}</p>
                            <span className="text-xs text-gray-500 capitalize">{kpi.category} • {kpi.unit}</span>
                          </div>
                          <button
                            onClick={() => handleToggleScorecardKpi(kpi.key)}
                            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors text-sm font-medium"
                          >
                            Add to Scorecard
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {scorecardKpis.length === 5 && (
                <div className="bg-green-50 border border-green-200 p-4 rounded-lg">
                  <div className="flex items-start gap-2">
                    <span className="text-green-600 text-xl">✓</span>
                    <div className="text-sm text-green-800">
                      <strong>Perfect!</strong> You've selected all 5 KPIs. Click "Save Changes" below to apply.
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            // Create New KPI Form
            <div className="max-w-2xl mx-auto space-y-6">
              <div className="bg-gradient-to-r from-purple-50 to-blue-50 p-6 rounded-lg border border-purple-200">
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Create Custom KPI</h3>
                <p className="text-sm text-gray-600">Add a new metric to track team performance</p>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      KPI Key <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newKpi.key}
                      onChange={(e) => setNewKpi({ ...newKpi, key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      placeholder="e.g., custom_metric"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Unique identifier (lowercase, underscores)</p>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      KPI Name <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={newKpi.name}
                      onChange={(e) => setNewKpi({ ...newKpi, name: e.target.value })}
                      placeholder="e.g., Custom Sales Metric"
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                    <p className="text-xs text-gray-500 mt-1">Display name for the KPI</p>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newKpi.description}
                    onChange={(e) => setNewKpi({ ...newKpi, description: e.target.value })}
                    placeholder="Describe what this metric measures..."
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    rows={3}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={newKpi.category}
                      onChange={(e) => setNewKpi({ ...newKpi, category: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="activity">Activity</option>
                      <option value="engagement">Engagement</option>
                      <option value="pipeline">Pipeline</option>
                      <option value="revenue">Revenue</option>
                      <option value="efficiency">Efficiency</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                    <select
                      value={newKpi.unit}
                      onChange={(e) => setNewKpi({ ...newKpi, unit: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="count">Count</option>
                      <option value="minutes">Minutes</option>
                      <option value="hours">Hours</option>
                      <option value="days">Days</option>
                      <option value="currency">Currency ($)</option>
                      <option value="percentage">Percentage (%)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Goal/Target</label>
                    <input
                      type="number"
                      value={newKpi.goal}
                      onChange={(e) => setNewKpi({ ...newKpi, goal: parseFloat(e.target.value) || 0 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      step="1"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Weight (%)</label>
                    <input
                      type="number"
                      value={Math.round(newKpi.weight * 100)}
                      onChange={(e) => setNewKpi({ ...newKpi, weight: (parseFloat(e.target.value) || 0) / 100 })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      min="0"
                      max="100"
                      step="1"
                    />
                  </div>
                </div>

                <button
                  onClick={handleCreateKpi}
                  className="w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-3 rounded-lg font-semibold hover:from-blue-600 hover:to-purple-600 transition-all duration-200 hover:shadow-lg"
                >
                  Create KPI
                </button>
              </div>
            </div>
          )}

          {message && (
            <div className={`mt-4 p-3 rounded-lg text-sm ${
              message.includes('✓') || message.includes('Success') ? 'bg-green-50 text-green-700 border border-green-200' : 'bg-red-50 text-red-700 border border-red-200'
            }`}>
              {message}
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-between items-center gap-3 border-t">
          <div className="text-sm text-gray-600">
            Total Weight: <span className="font-bold text-gray-900">
              {Math.round(kpiConfigs.reduce((sum, k) => sum + k.weight, 0) * 100)}%
            </span>
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              disabled={saving}
              className="px-6 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 transition-all duration-200"
            >
              Close
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 transition-all duration-200 hover:shadow-lg"
            >
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
