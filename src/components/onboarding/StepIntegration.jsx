import React, { useEffect, useState } from 'react';
import { Plug, FileSpreadsheet, Check, Loader2, AlertCircle } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { backendFetch } from '../../utils/backendFetch';
import { tierHasIntegration } from '../../constants/subscriptionTiers';
import { validateIntegration } from './onboardingConstants';

export default function StepIntegration({ wizardState, updateState }) {
  const { selectedIntegration, integrationApiKey, integrationTestStatus, integrationMethod, selectedTier } = wizardState;
  const [availableIntegrations, setAvailableIntegrations] = useState([]);
  const [testMessage, setTestMessage] = useState('');
  const [loadingIntegrations, setLoadingIntegrations] = useState(true);

  useEffect(() => {
    loadIntegrations();
  }, []);

  const loadIntegrations = async () => {
    try {
      const { data } = await supabase
        .from('integration_mapping_templates')
        .select('*')
        .eq('is_active', true)
        .order('display_name');
      const filtered = (data || []).filter(i =>
        tierHasIntegration(selectedTier || 'Pro', i.integration_type)
      );
      setAvailableIntegrations(filtered);
    } catch (err) {
      console.error('Failed to load integrations:', err);
    } finally {
      setLoadingIntegrations(false);
    }
  };

  const testConnection = async () => {
    if (!integrationApiKey.trim()) return;
    updateState({ integrationTestStatus: 'testing' });
    setTestMessage('');
    try {
      await backendFetch('/api/engage/search/prospects', {
        q: 'test',
        source: selectedIntegration?.integration_type,
        test_api_key: integrationApiKey,
      });
      updateState({ integrationTestStatus: 'success' });
      setTestMessage('Connection successful!');
    } catch {
      updateState({ integrationTestStatus: 'error' });
      setTestMessage('Connection test failed');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-cyan-100 rounded-lg flex items-center justify-center">
          <Plug size={20} className="text-cyan-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">Connect Your Data Source</h3>
          <p className="text-sm text-apptivia-carbon-500">
            The scorecard needs activity data to generate scores. Connect a CRM integration or choose manual CSV upload.
          </p>
        </div>
      </div>

      {/* Method Selection */}
      <div className="grid grid-cols-2 gap-4">
        <button
          type="button"
          onClick={() => updateState({ integrationMethod: 'crm', integrationTestStatus: null })}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            integrationMethod === 'crm'
              ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <Plug size={24} className="text-cyan-600 mb-2" />
          <div className="font-semibold text-apptivia-ink">CRM Integration</div>
          <p className="text-xs text-apptivia-carbon-500 mt-1">
            Connect Salesforce, HubSpot, Apollo, Outreach, Gong, or SalesLoft for automatic data sync
          </p>
        </button>
        <button
          type="button"
          onClick={() => updateState({ integrationMethod: 'csv', selectedIntegration: null, integrationApiKey: '', integrationTestStatus: 'success' })}
          className={`p-4 rounded-xl border-2 text-left transition-all ${
            integrationMethod === 'csv'
              ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
              : 'border-gray-200 hover:border-gray-300'
          }`}
        >
          <FileSpreadsheet size={24} className="text-emerald-600 mb-2" />
          <div className="font-semibold text-apptivia-ink">CSV / Manual Upload</div>
          <p className="text-xs text-apptivia-carbon-500 mt-1">
            Upload data manually via CSV files. You can always connect a CRM later in Settings.
          </p>
        </button>
      </div>

      {/* CRM Selection */}
      {integrationMethod === 'crm' && (
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-apptivia-carbon-700 mb-2">Select Integration</label>
            {loadingIntegrations ? (
              <div className="text-sm text-apptivia-carbon-400 flex items-center gap-2">
                <Loader2 size={14} className="animate-spin" /> Loading integrations...
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {availableIntegrations.map(integ => (
                  <button
                    key={integ.id}
                    type="button"
                    onClick={() => updateState({ selectedIntegration: integ, integrationTestStatus: null })}
                    className={`p-3 rounded-lg border text-left transition-all text-sm ${
                      selectedIntegration?.id === integ.id
                        ? 'border-cyan-500 bg-cyan-50 ring-1 ring-cyan-200'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="font-medium text-apptivia-ink">{integ.display_name}</div>
                    <div className="text-xs text-apptivia-carbon-400">{integ.integration_type}</div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {selectedIntegration && (
            <div>
              <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">
                API Key <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={integrationApiKey}
                  onChange={(e) => updateState({ integrationApiKey: e.target.value, integrationTestStatus: null })}
                  className="flex-1 px-3 py-2.5 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder={`Enter your ${selectedIntegration.display_name} API key`}
                />
                <button
                  type="button"
                  onClick={testConnection}
                  disabled={!integrationApiKey.trim() || integrationTestStatus === 'testing'}
                  className="px-4 py-2.5 bg-cyan-600 text-white rounded-lg text-sm hover:bg-cyan-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                >
                  {integrationTestStatus === 'testing' ? (
                    <><Loader2 size={14} className="animate-spin" /> Testing...</>
                  ) : (
                    'Test Connection'
                  )}
                </button>
              </div>
              {testMessage && (
                <div className={`mt-2 flex items-center gap-1.5 text-sm ${
                  integrationTestStatus === 'success' ? 'text-emerald-600' : 'text-red-600'
                }`}>
                  {integrationTestStatus === 'success' ? <Check size={14} /> : <AlertCircle size={14} />}
                  {testMessage}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* CSV Confirmation */}
      {integrationMethod === 'csv' && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Check size={18} className="text-emerald-600 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800">CSV / Manual Upload selected</p>
              <p className="text-xs text-emerald-600 mt-1">
                You can upload activity data via CSV on the Dashboard. A CRM integration can be connected anytime in Settings → Integrations.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

StepIntegration.validate = (wizardState) =>
  validateIntegration(wizardState.integrationMethod, wizardState.selectedIntegration, wizardState.integrationTestStatus);
