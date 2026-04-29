import React from 'react';
import { Building2 } from 'lucide-react';
import { INDUSTRY_OPTIONS, validateOrgInfo } from './onboardingConstants';
import { useTitles } from '../../hooks/useTitles';

export default function StepOrgInfo({ wizardState, updateState, onError }) {
  const { orgData } = wizardState;
  const titles = useTitles();

  const update = (field, value) => {
    updateState({ orgData: { ...orgData, [field]: value } });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-apptivia-coral-tone-50 rounded-lg flex items-center justify-center">
          <Building2 size={20} className="text-apptivia-coral" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">Organization Info</h3>
          <p className="text-sm text-apptivia-carbon-500">Tell us about your company</p>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
            Company Name <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={orgData.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
            placeholder="Acme Corp"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
            Industry <span className="text-red-500">*</span>
          </label>
          <select
            value={orgData.industry}
            onChange={(e) => update('industry', e.target.value)}
            className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
          >
            <option value="">Select your industry</option>
            {INDUSTRY_OPTIONS.map(opt => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
          <p className="text-xs text-apptivia-carbon-400 mt-1">Used to tailor ICP defaults and AI coaching context</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Primary Contact Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={orgData.primary_contact_name}
              onChange={(e) => update('primary_contact_name', e.target.value)}
              className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
              placeholder="Jane Doe"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
              Contact Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email"
              value={orgData.primary_contact_email}
              onChange={(e) => update('primary_contact_email', e.target.value)}
              className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
              placeholder="jane@acme.com"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
            Your Title <span className="text-red-500">*</span>
          </label>
          <select
            value={wizardState.adminTitle || ''}
            onChange={(e) => updateState({ adminTitle: e.target.value })}
            className="w-full px-3 py-2.5 border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral text-sm"
          >
            <option value="">Select your title</option>
            {titles.map(t => (
              <option key={t.key} value={t.label}>{t.label}</option>
            ))}
          </select>
        </div>
      </div>
    </div>
  );
}

StepOrgInfo.validate = (wizardState) => validateOrgInfo(wizardState.orgData);
