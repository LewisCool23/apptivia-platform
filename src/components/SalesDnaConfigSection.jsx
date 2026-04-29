import React, { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Check, Info, Sparkles } from 'lucide-react';
import { useSalesDna } from '../hooks/useSalesDna';
import {
  SALES_METHODOLOGIES,
  QUALIFICATION_FRAMEWORKS,
  METHODOLOGY_APPROACHES,
  DEFAULT_SALES_DNA,
} from '../constants/salesDna';

/**
 * SalesDnaConfigSection — Org Settings component for configuring Sales DNA.
 * Shows methodology approach selection, methodology picker, qualification framework picker,
 * and hybrid stage mapping (when applicable).
 */
export default function SalesDnaConfigSection({ organizationId, cepStages, compact = false, showSave }) {
  // Default showSave: true when not compact, false when compact (onboarding handles save externally)
  const shouldShowSave = showSave !== undefined ? showSave : !compact;
  const { salesDna, loading, saveSalesDna } = useSalesDna(organizationId);
  const [expanded, setExpanded] = useState(false);
  const [localDna, setLocalDna] = useState(DEFAULT_SALES_DNA);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [customPrinciple, setCustomPrinciple] = useState('');

  useEffect(() => {
    if (salesDna) setLocalDna({ ...DEFAULT_SALES_DNA, ...salesDna });
  }, [salesDna]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await saveSalesDna(localDna);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      console.error('Failed to save Sales DNA:', err);
    } finally {
      setSaving(false);
    }
  };

  const isDirty = JSON.stringify(localDna) !== JSON.stringify(salesDna);

  const selectedPrimary = SALES_METHODOLOGIES.find(m => m.key === localDna.primary_methodology);
  const selectedSecondary = SALES_METHODOLOGIES.find(m => m.key === localDna.secondary_methodology);
  const selectedFramework = QUALIFICATION_FRAMEWORKS.find(f => f.key === localDna.qualification_framework);

  if (loading) return null;

  // Compact mode — no expand/collapse wrapper (used by onboarding and org settings sub-panel)
  if (compact) {
    return (
      <div className="space-y-6">
        {renderContent()}
        {shouldShowSave && (
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-4 py-2 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Save Sales DNA'}
            </button>
            {isDirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="border-t pt-6">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex items-center gap-2 w-full text-left mb-4"
      >
        {expanded ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <div>
          <h3 className="text-lg font-semibold">Sales DNA</h3>
          <p className="text-xs text-apptivia-carbon-500 mt-0.5">
            Define how your team sells and qualifies deals. This drives all AI coaching recommendations.
          </p>
        </div>
        {selectedPrimary && (
          <span className="ml-auto text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2 py-1 rounded-full">
            {selectedPrimary.name}
          </span>
        )}
        {selectedFramework && (
          <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-1 rounded-full">
            {selectedFramework.name}
          </span>
        )}
      </button>

      {expanded && (
        <div className="space-y-6 pl-1">
          {renderContent()}
          {/* Save button */}
          <div className="flex items-center gap-3">
            <button
              onClick={handleSave}
              disabled={saving || !isDirty}
              className="px-4 py-2 bg-apptivia-coral text-white rounded-lg hover:bg-apptivia-coral disabled:opacity-50 text-sm flex items-center gap-2"
            >
              {saved ? <><Check size={14} /> Saved</> : saving ? 'Saving...' : 'Save Sales DNA'}
            </button>
            {isDirty && <span className="text-xs text-amber-600">Unsaved changes</span>}
          </div>
        </div>
      )}
    </div>
  );

  function renderContent() {
    return (
      <>
        {/* Methodology Approach */}
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
            How does your team sell?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {METHODOLOGY_APPROACHES.map(approach => (
              <button
                key={approach.key}
                onClick={() => setLocalDna({
                  ...localDna,
                  methodology_approach: approach.key,
                  ...(approach.key === 'single' ? { secondary_methodology: null, methodology_stage_mapping: [] } : {}),
                  ...(approach.key !== 'custom' ? { custom_methodology_name: null, custom_methodology_principles: [] } : {}),
                })}
                className={`border-2 rounded-lg p-3 text-left transition-all ${
                  localDna.methodology_approach === approach.key
                    ? 'border-apptivia-coral bg-apptivia-coral-tone-50'
                    : 'border-apptivia-carbon-200 hover:border-apptivia-coral-tone-100'
                }`}
              >
                <div className="font-medium text-sm">{approach.label}</div>
                <div className="text-xs text-apptivia-carbon-500 mt-1">{approach.description}</div>
              </button>
            ))}
          </div>
        </div>

        {/* Primary Methodology (for single/hybrid) */}
        {localDna.methodology_approach !== 'custom' && (
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
              {localDna.methodology_approach === 'hybrid' ? 'Primary Methodology' : 'Sales Methodology'}
            </label>
            <select
              value={localDna.primary_methodology || ''}
              onChange={(e) => setLocalDna({ ...localDna, primary_methodology: e.target.value || null })}
              className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a methodology...</option>
              {SALES_METHODOLOGIES.map(m => (
                <option key={m.key} value={m.key}>{m.name} — {m.short_description}</option>
              ))}
            </select>
            {selectedPrimary && (
              <div className="mt-2 p-3 bg-apptivia-paper rounded-lg text-xs">
                <div className="font-medium text-apptivia-carbon-700 mb-1">Core Principles:</div>
                <ul className="space-y-0.5 text-apptivia-carbon-600">
                  {selectedPrimary.core_principles.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
                <div className="mt-2 text-apptivia-carbon-500">
                  <Sparkles size={10} className="inline mr-1" />
                  <span className="font-medium">Coaching Focus:</span> {selectedPrimary.coaching_focus}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Secondary Methodology (hybrid only) */}
        {localDna.methodology_approach === 'hybrid' && (
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
              Secondary Methodology
            </label>
            <select
              value={localDna.secondary_methodology || ''}
              onChange={(e) => setLocalDna({ ...localDna, secondary_methodology: e.target.value || null })}
              className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a secondary methodology...</option>
              {SALES_METHODOLOGIES.filter(m => m.key !== localDna.primary_methodology).map(m => (
                <option key={m.key} value={m.key}>{m.name} — {m.short_description}</option>
              ))}
            </select>
            {selectedSecondary && (
              <div className="mt-2 p-3 bg-apptivia-paper rounded-lg text-xs">
                <div className="font-medium text-apptivia-carbon-700 mb-1">Core Principles:</div>
                <ul className="space-y-0.5 text-apptivia-carbon-600">
                  {selectedSecondary.core_principles.map((p, i) => (
                    <li key={i}>• {p}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Hybrid Stage Mapping */}
        {localDna.methodology_approach === 'hybrid' && cepStages?.length > 0 && localDna.primary_methodology && localDna.secondary_methodology && (
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
              Stage Methodology Mapping
              <span className="font-normal text-apptivia-carbon-400 ml-1">(optional)</span>
            </label>
            <p className="text-xs text-apptivia-carbon-500 mb-3">
              Optionally assign which methodology applies at each CEP stage. Unmapped stages use the primary methodology.
            </p>
            <div className="space-y-2">
              {cepStages.filter(s => !s.is_terminal).map(stage => {
                const existing = localDna.methodology_stage_mapping?.find(m => m.stage_key === stage.stage_key);
                return (
                  <div key={stage.stage_key} className="flex items-center gap-3 text-sm">
                    <span className="w-32 font-medium text-apptivia-carbon-700 truncate" title={stage.stage_name}>
                      {stage.stage_name}
                    </span>
                    <select
                      value={existing?.methodology_key || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        const filtered = (localDna.methodology_stage_mapping || []).filter(m => m.stage_key !== stage.stage_key);
                        if (val) {
                          filtered.push({ stage_key: stage.stage_key, methodology_key: val });
                        }
                        setLocalDna({ ...localDna, methodology_stage_mapping: filtered });
                      }}
                      className="flex-1 border border-apptivia-carbon-300 rounded px-2 py-1.5 text-xs"
                    >
                      <option value="">Primary ({selectedPrimary?.name})</option>
                      <option value={localDna.secondary_methodology}>{selectedSecondary?.name}</option>
                    </select>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Custom Methodology */}
        {localDna.methodology_approach === 'custom' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                Methodology Name
              </label>
              <input
                type="text"
                value={localDna.custom_methodology_name || ''}
                onChange={(e) => setLocalDna({ ...localDna, custom_methodology_name: e.target.value })}
                className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., The Acme Way, Value-Led Enterprise Selling"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                Core Principles
              </label>
              <p className="text-xs text-apptivia-carbon-500 mb-2">
                Define the key principles of your proprietary methodology. These will guide all AI coaching output.
              </p>
              <div className="space-y-1.5 mb-2">
                {(localDna.custom_methodology_principles || []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm bg-apptivia-paper rounded px-3 py-1.5">
                    <span className="text-apptivia-carbon-400">{i + 1}.</span>
                    <span className="flex-1 text-apptivia-carbon-700">{p}</span>
                    <button
                      onClick={() => setLocalDna({
                        ...localDna,
                        custom_methodology_principles: localDna.custom_methodology_principles.filter((_, idx) => idx !== i),
                      })}
                      className="text-red-400 hover:text-red-600 text-xs"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customPrinciple}
                  onChange={(e) => setCustomPrinciple(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customPrinciple.trim()) {
                      e.preventDefault();
                      setLocalDna({
                        ...localDna,
                        custom_methodology_principles: [...(localDna.custom_methodology_principles || []), customPrinciple.trim()],
                      });
                      setCustomPrinciple('');
                    }
                  }}
                  className="flex-1 border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Type a principle and press Enter"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customPrinciple.trim()) {
                      setLocalDna({
                        ...localDna,
                        custom_methodology_principles: [...(localDna.custom_methodology_principles || []), customPrinciple.trim()],
                      });
                      setCustomPrinciple('');
                    }
                  }}
                  className="px-3 py-2 bg-apptivia-carbon-100 rounded-lg hover:bg-apptivia-carbon-200 text-apptivia-carbon-600 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Qualification Framework */}
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
            How does your team qualify deals?
          </label>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {QUALIFICATION_FRAMEWORKS.map(fw => (
              <button
                key={fw.key}
                onClick={() => setLocalDna({ ...localDna, qualification_framework: fw.key })}
                className={`border-2 rounded-lg p-3 text-left transition-all ${
                  localDna.qualification_framework === fw.key
                    ? 'border-emerald-600 bg-emerald-50'
                    : 'border-apptivia-carbon-200 hover:border-emerald-300'
                }`}
              >
                <div className="font-semibold text-sm">{fw.name}</div>
                <div className="text-xs text-apptivia-carbon-500 mt-1">{fw.short_description}</div>
              </button>
            ))}
          </div>
          {selectedFramework && (
            <div className="mt-3 p-3 bg-emerald-50 rounded-lg text-xs border border-emerald-100">
              <div className="font-medium text-emerald-800 mb-1">{selectedFramework.name} Criteria:</div>
              <div className="grid grid-cols-2 gap-1">
                {selectedFramework.criteria.map(c => (
                  <div key={c.key} className="flex items-start gap-1.5">
                    <Check size={10} className="text-emerald-600 mt-0.5 shrink-0" />
                    <span className="text-emerald-700"><strong>{c.label}:</strong> {c.description}</span>
                  </div>
                ))}
              </div>
              <div className="mt-2 text-emerald-600">
                <Info size={10} className="inline mr-1" />
                This framework's criteria will auto-populate your CEP Qualification stage exit criteria.
              </div>
            </div>
          )}
        </div>
      </>
    );
  }
}
