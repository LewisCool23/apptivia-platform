import React, { useState } from 'react';
import { Compass, Check, Info } from 'lucide-react';
import {
  SALES_METHODOLOGIES,
  QUALIFICATION_FRAMEWORKS,
} from '../../constants/salesDna';
import { STANDARD_B2B_TEMPLATE } from '../../constants/cepDefaults';
import { validateSalesDna } from './onboardingConstants';

export default function StepSalesDna({ wizardState, updateState }) {
  const { salesDna } = wizardState;

  const update = (field, value) => {
    updateState({ salesDna: { ...salesDna, [field]: value } });
  };

  const [customCriterionLabel, setCustomCriterionLabel] = useState('');
  const [customCriterionDesc, setCustomCriterionDesc] = useState('');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-apptivia-carbon-100 rounded-lg flex items-center justify-center">
          <Compass size={20} className="text-apptivia-ink" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">Sales DNA</h3>
          <p className="text-sm text-apptivia-carbon-500">
            Your methodology and qualification framework power AI coaching, pipeline stages, and exit criteria
          </p>
        </div>
      </div>

      {/* Methodology Approach */}
      <div>
        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
          Methodology Approach <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-3 gap-3">
          {[
            { key: 'single', label: 'Single Methodology', desc: 'One core framework' },
            { key: 'hybrid', label: 'Hybrid', desc: 'Primary + secondary' },
            { key: 'custom', label: 'Custom / Proprietary', desc: 'Your own methodology' },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              onClick={() => update('methodology_approach', opt.key)}
              className={`p-3 rounded-lg border text-left transition-all text-sm ${
                salesDna.methodology_approach === opt.key
                  ? 'border-apptivia-carbon-300 bg-apptivia-carbon-100 ring-1 ring-apptivia-coral-tone-100'
                  : 'border-apptivia-carbon-200 hover:border-apptivia-carbon-300'
              }`}
            >
              <div className="font-medium text-apptivia-ink">{opt.label}</div>
              <div className="text-xs text-apptivia-carbon-500 mt-0.5">{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Primary Methodology */}
      {salesDna.methodology_approach !== 'custom' && (
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
            {salesDna.methodology_approach === 'hybrid' ? 'Primary ' : ''}Sales Methodology <span className="text-red-500">*</span>
          </label>
          <select
            value={salesDna.primary_methodology || ''}
            onChange={(e) => update('primary_methodology', e.target.value)}
            className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-carbon-300 text-sm"
          >
            <option value="">Select a methodology</option>
            {SALES_METHODOLOGIES.map(m => (
              <option key={m.key} value={m.key}>{m.name}</option>
            ))}
          </select>
          {salesDna.primary_methodology && (() => {
            const sel = SALES_METHODOLOGIES.find(m => m.key === salesDna.primary_methodology);
            return sel ? (
              <p className="text-xs text-apptivia-carbon-500 mt-1.5">{sel.short_description}</p>
            ) : null;
          })()}
        </div>
      )}

      {/* Secondary Methodology (hybrid only) */}
      {salesDna.methodology_approach === 'hybrid' && (
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
            Secondary Methodology <span className="text-red-500">*</span>
          </label>
          <select
            value={salesDna.secondary_methodology || ''}
            onChange={(e) => update('secondary_methodology', e.target.value)}
            className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-carbon-300 text-sm"
          >
            <option value="">Select secondary methodology</option>
            {SALES_METHODOLOGIES
              .filter(m => m.key !== salesDna.primary_methodology)
              .map(m => (
                <option key={m.key} value={m.key}>{m.name}</option>
              ))}
          </select>
        </div>
      )}

      {/* Custom Methodology */}
      {salesDna.methodology_approach === 'custom' && (
        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Methodology Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={salesDna.custom_methodology_name || ''}
              onChange={(e) => update('custom_methodology_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-carbon-300 text-sm"
              placeholder="e.g. The Acme Way"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Core Principles (one per line)
            </label>
            <textarea
              value={(salesDna.custom_methodology_principles || []).join('\n')}
              onChange={(e) => update('custom_methodology_principles', e.target.value.split('\n').filter(Boolean))}
              rows={4}
              className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-carbon-300 text-sm resize-none"
              placeholder="e.g. Always lead with value&#10;Ask 3 discovery questions before presenting"
            />
            <p className="text-xs text-apptivia-carbon-400 mt-1">These principles guide Aaron AI's coaching context</p>
          </div>
        </div>
      )}

      {/* Qualification Framework */}
      <div>
        <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">
          Qualification Framework <span className="text-red-500">*</span>
        </label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {QUALIFICATION_FRAMEWORKS.map(f => (
            <button
              key={f.key}
              type="button"
              onClick={() => {
                const updates = { qualification_framework: f.key };
                if (f.key !== 'custom') {
                  updates.custom_qualification_name = null;
                  updates.custom_qualification_criteria = [];
                }
                updateState({ salesDna: { ...salesDna, ...updates } });
              }}
              className={`p-3 rounded-lg border text-left transition-all text-sm ${
                salesDna.qualification_framework === f.key
                  ? 'border-apptivia-carbon-300 bg-apptivia-carbon-100 ring-1 ring-apptivia-coral-tone-100'
                  : 'border-apptivia-carbon-200 hover:border-apptivia-carbon-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-apptivia-ink">{f.name}</span>
                {salesDna.qualification_framework === f.key && (
                  <Check size={14} className="text-apptivia-ink" />
                )}
              </div>
              {f.criteria.length > 0 && (
                <div className="text-xs text-apptivia-carbon-500 mt-1">
                  {f.criteria.map(c => c.label).join(' / ')}
                </div>
              )}
              {f.key === 'custom' && (
                <div className="text-xs text-apptivia-carbon-500 mt-1">
                  Define your own criteria
                </div>
              )}
            </button>
          ))}
        </div>
        <p className="text-xs text-apptivia-carbon-400 mt-2">
          This framework auto-configures exit criteria on your pipeline Qualification stage
        </p>

        {/* Custom Qualification Framework Builder */}
        {salesDna.qualification_framework === 'custom' && (
          <div className="mt-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100 space-y-3">
            <div>
              <label className="block text-sm font-medium text-emerald-800 mb-1">Framework Name</label>
              <input
                type="text"
                value={salesDna.custom_qualification_name || ''}
                onChange={(e) => update('custom_qualification_name', e.target.value)}
                className="w-full border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none"
                placeholder="e.g. PACT, VALUE, IMPACT"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-emerald-800 mb-1">
                Qualification Criteria <span className="font-normal text-emerald-600">(min 2)</span>
              </label>
              <p className="text-xs text-emerald-600 mb-2">
                Define the criteria your team must confirm to qualify a deal. These auto-populate CEP exit criteria and guide AI coaching.
              </p>
              <div className="space-y-1.5 mb-2">
                {(salesDna.custom_qualification_criteria || []).map((c, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm bg-white rounded-lg px-3 py-2 border border-emerald-100">
                    <Check size={10} className="text-emerald-600 mt-1 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <span className="font-medium text-emerald-800">{c.label}</span>
                      {c.description && <span className="text-emerald-600 ml-1">— {c.description}</span>}
                    </div>
                    <button
                      type="button"
                      onClick={() => updateState({
                        salesDna: {
                          ...salesDna,
                          custom_qualification_criteria: (salesDna.custom_qualification_criteria || []).filter((_, idx) => idx !== i),
                        },
                      })}
                      className="text-red-400 hover:text-red-600 text-xs shrink-0"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={customCriterionLabel}
                  onChange={(e) => setCustomCriterionLabel(e.target.value)}
                  className="w-32 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Label"
                />
                <input
                  type="text"
                  value={customCriterionDesc}
                  onChange={(e) => setCustomCriterionDesc(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && customCriterionLabel.trim()) {
                      e.preventDefault();
                      const key = customCriterionLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                      updateState({
                        salesDna: {
                          ...salesDna,
                          custom_qualification_criteria: [
                            ...(salesDna.custom_qualification_criteria || []),
                            { key, label: customCriterionLabel.trim(), description: customCriterionDesc.trim() },
                          ],
                        },
                      });
                      setCustomCriterionLabel('');
                      setCustomCriterionDesc('');
                    }
                  }}
                  className="flex-1 border border-emerald-200 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-emerald-500 outline-none"
                  placeholder="Description (press Enter to add)"
                />
                <button
                  type="button"
                  onClick={() => {
                    if (customCriterionLabel.trim()) {
                      const key = customCriterionLabel.trim().toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
                      updateState({
                        salesDna: {
                          ...salesDna,
                          custom_qualification_criteria: [
                            ...(salesDna.custom_qualification_criteria || []),
                            { key, label: customCriterionLabel.trim(), description: customCriterionDesc.trim() },
                          ],
                        },
                      });
                      setCustomCriterionLabel('');
                      setCustomCriterionDesc('');
                    }
                  }}
                  className="px-3 py-2 bg-emerald-100 rounded-lg hover:bg-emerald-200 text-emerald-700 text-sm"
                >
                  Add
                </button>
              </div>
            </div>
            <div className="text-emerald-600 text-xs">
              <Info size={10} className="inline mr-1" />
              These criteria will auto-populate your CEP Qualification stage exit criteria and guide all AI coaching.
            </div>
          </div>
        )}
      </div>

      {/* CEP Pipeline Configuration */}
      {salesDna.qualification_framework && (salesDna.primary_methodology || salesDna.methodology_approach === 'custom') && (
        <div className="bg-apptivia-carbon-100/50 border border-apptivia-carbon-300/60 rounded-lg p-4">
          <h4 className="text-sm font-medium text-apptivia-ink mb-2">
            Sales Pipeline Stages
          </h4>
          <p className="text-xs text-apptivia-ink/70 mb-3">
            Default B2B pipeline. Edit stage names as needed — you can also customize further in Organization Settings.
          </p>
          <div className="space-y-2">
            {(wizardState.cepStages || STANDARD_B2B_TEMPLATE).map((stage, i) => (
              <div key={stage.stage_key || i} className="flex items-center gap-2">
                <span className="text-xs text-apptivia-carbon-400 w-4 text-right flex-shrink-0">{i + 1}</span>
                <div className="w-4 h-4 rounded flex-shrink-0" style={{ backgroundColor: stage.color }} />
                <input
                  type="text"
                  value={stage.stage_name}
                  onChange={(e) => {
                    const updated = [...(wizardState.cepStages || STANDARD_B2B_TEMPLATE.map(s => ({ ...s })))];
                    updated[i] = { ...updated[i], stage_name: e.target.value };
                    updateState({ cepStages: updated });
                  }}
                  className="flex-1 px-2 py-1.5 border border-apptivia-carbon-200 rounded text-sm focus:ring-1 focus:ring-apptivia-coral-tone-300 focus:border-apptivia-carbon-300"
                />
                <span className="text-xs text-apptivia-carbon-400 flex-shrink-0 w-8">{stage.win_probability}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

StepSalesDna.validate = (wizardState) => validateSalesDna(wizardState.salesDna);
