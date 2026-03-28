import React, { useState } from 'react';
import { X, Loader2 } from 'lucide-react';
import { SUPPORTED_INTEGRATIONS, API_KEY_PROVIDERS } from '../../constants/integrations';

export default function CredentialsModal({ providerType, onClose, onConnect, error }) {
  const [values, setValues] = useState({});
  const [saving, setSaving] = useState(false);

  if (!providerType) return null;

  const providerConfig = API_KEY_PROVIDERS[providerType];
  if (!providerConfig) return null;

  const templateInfo = SUPPORTED_INTEGRATIONS.find(s => s.integration_type === providerType);
  const allFilled = providerConfig.fields.every(f => values[f.key]?.trim());

  const handleSubmit = async () => {
    if (!allFilled) return;
    setSaving(true);
    try {
      await onConnect(providerType, values);
      setValues({});
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-[95%] max-w-md rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 bg-gradient-to-br ${templateInfo?.color || 'from-gray-400 to-gray-600'} rounded-lg flex items-center justify-center text-xs font-bold text-white`}>
            {templateInfo?.icon}
          </div>
          <div className="flex-1">
            <h2 className="text-lg font-bold text-gray-900">Connect {templateInfo?.display_name || providerType}</h2>
            <p className="text-xs text-gray-500">Enter your credentials to connect</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>
        <div className="space-y-3 mb-5">
          {providerConfig.fields.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
              <input
                type={field.type || 'text'}
                placeholder={field.placeholder}
                value={values[field.key] || ''}
                onChange={(e) => setValues(prev => ({ ...prev, [field.key]: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
              />
            </div>
          ))}
        </div>
        {error && <div className="text-xs text-red-500 mb-3">{error}</div>}
        <div className="flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-200 hover:bg-gray-50">
            Cancel
          </button>
          <button
            disabled={!allFilled || saving}
            onClick={handleSubmit}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
          >
            {saving ? <Loader2 size={14} className="animate-spin inline mr-1" /> : null}
            {saving ? 'Connecting...' : 'Connect'}
          </button>
        </div>
      </div>
    </div>
  );
}
