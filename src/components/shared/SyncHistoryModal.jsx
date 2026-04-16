import React, { useState, useEffect } from 'react';
import { X, CheckCircle, AlertCircle, Loader2, RefreshCw, Send } from 'lucide-react';
import { backendFetch } from '../../utils/backendFetch';

const CRM_TYPES = ['salesforce', 'hubspot'];

const STATUS_BADGE = {
  sent:       'bg-green-100 text-green-700',
  success:    'bg-green-100 text-green-700',
  pending:    'bg-yellow-100 text-yellow-700',
  processing: 'bg-blue-100 text-blue-700',
  failed:     'bg-red-100 text-red-700',
  skipped:    'bg-gray-100 text-gray-500',
};

function CrmPushSection({ integrationId }) {
  const [tab, setTab] = useState('queue');
  const [queue, setQueue] = useState([]);
  const [pushHistory, setPushHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [pushing, setPushing] = useState(false);

  async function loadData(which) {
    setLoading(true);
    try {
      if (which === 'queue' || which === 'both') {
        const data = await backendFetch(`/api/integrations/${integrationId}/push-queue`);
        setQueue(data?.queue || data || []);
      }
      if (which === 'history' || which === 'both') {
        const data = await backendFetch(`/api/integrations/${integrationId}/push-history`);
        setPushHistory(data?.history || data || []);
      }
    } catch { /* non-critical */ }
    finally { setLoading(false); }
  }

  useEffect(() => { loadData('both'); }, [integrationId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function handlePushNow() {
    setPushing(true);
    try {
      await backendFetch(`/api/integrations/${integrationId}/push`, { _method: 'POST' });
      await loadData('both');
    } catch { /* silent */ }
    finally { setPushing(false); }
  }

  return (
    <div className="mt-4 border-t pt-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">CRM Push</h3>
        <div className="flex items-center gap-2">
          <button onClick={() => loadData('both')} className="text-gray-400 hover:text-gray-600" title="Refresh">
            <RefreshCw size={13} />
          </button>
          <button
            onClick={handlePushNow}
            disabled={pushing}
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-700 disabled:opacity-50"
          >
            <Send size={11} />
            {pushing ? 'Pushing...' : 'Push now'}
          </button>
        </div>
      </div>
      <div className="flex gap-1.5 mb-3">
        {['queue', 'history'].map(t => (
          <button key={t} onClick={() => { setTab(t); loadData(t); }}
            className={`px-2.5 py-1 text-xs rounded-full font-medium transition-colors ${
              tab === t ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}>
            {t === 'queue' ? 'Queue' : 'History'}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-gray-400 text-xs">
          <Loader2 size={14} className="animate-spin mr-1.5" /> Loading...
        </div>
      ) : tab === 'queue' ? (
        queue.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">Queue is empty</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {queue.map(item => (
              <div key={item.id} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
                <span className="text-gray-700">{item.entity_type}: {item.action}</span>
                <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[item.status] || 'bg-gray-100 text-gray-500'}`}>
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        )
      ) : (
        pushHistory.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-3">No push history yet</p>
        ) : (
          <div className="space-y-1 max-h-48 overflow-y-auto">
            {pushHistory.slice(0, 10).map(entry => (
              <div key={entry.id} className="flex items-center justify-between py-1.5 text-xs border-b border-gray-50">
                <div>
                  <span className="text-gray-700 font-medium">{entry.entity_type}: {entry.action}</span>
                  <span className="text-gray-400 ml-2">{entry.external_id ? `→ ${entry.external_id}` : ''}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-medium ${STATUS_BADGE[entry.status] || 'bg-gray-100 text-gray-500'}`}>
                    {entry.status}
                  </span>
                  <span className="text-gray-400 text-[10px]">
                    {entry.completed_at ? new Date(entry.completed_at).toLocaleDateString() : ''}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}

export default function SyncHistoryModal({ isOpen, onClose, loading, history, integration }) {
  if (!isOpen) return null;

  const isCrm = integration && CRM_TYPES.includes(integration.integration_type);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={onClose}>
      <div className="bg-white w-[95%] max-w-2xl rounded-2xl shadow-2xl p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sync History</h2>
            <p className="text-xs text-gray-500">Recent synchronization runs</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-gray-400">
            <Loader2 size={20} className="animate-spin mr-2" /> Loading...
          </div>
        ) : history.length === 0 ? (
          <div className="text-sm text-gray-500 text-center py-8">No sync history yet.</div>
        ) : (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {history.map((entry) => (
              <div key={entry.id} className="border rounded-lg p-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    {entry.status === 'success' && <CheckCircle size={14} className="text-green-500" />}
                    {entry.status === 'failed' && <AlertCircle size={14} className="text-red-500" />}
                    {entry.status === 'partial' && <AlertCircle size={14} className="text-yellow-500" />}
                    {entry.status === 'running' && <Loader2 size={14} className="text-blue-500 animate-spin" />}
                    <span className="text-sm font-medium capitalize">{entry.status}</span>
                  </div>
                  <div className="text-xs text-gray-400 mt-1">
                    {new Date(entry.sync_started_at).toLocaleString()}
                    {entry.sync_completed_at && ` — ${Math.round((new Date(entry.sync_completed_at) - new Date(entry.sync_started_at)) / 1000)}s`}
                  </div>
                  {entry.error_message && (
                    <div className="text-xs text-red-500 mt-1 truncate max-w-md" title={entry.error_message}>
                      {entry.error_message}
                    </div>
                  )}
                </div>
                <div className="text-right text-xs text-gray-500">
                  <div>{entry.records_processed || 0} processed</div>
                  {entry.records_failed > 0 && <div className="text-red-500">{entry.records_failed} failed</div>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* CRM Push section for Salesforce / HubSpot */}
        {isCrm && <CrmPushSection integrationId={integration.id} />}
      </div>
    </div>
  );
}
