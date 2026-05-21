import React, { useState, useEffect, useMemo } from 'react';
import { DollarSign, X, Target, Loader } from 'lucide-react';
import { supabase } from '../supabaseClient';
import { useModalBehavior } from '../hooks/useModalBehavior';

const DEFAULT_STAGES = [
  { stage_key: 'discovery', stage_name: 'Discovery', win_probability: 20 },
  { stage_key: 'qualification', stage_name: 'Qualification', win_probability: 40 },
  { stage_key: 'proposal', stage_name: 'Proposal', win_probability: 60 },
  { stage_key: 'negotiation', stage_name: 'Negotiation', win_probability: 80 },
];

export default function CreateDealModal({ isOpen, onClose, organizationId, userId, cepStages, account, onDealCreated }) {
  useModalBehavior(isOpen, onClose);

  const stageOptions = useMemo(() => {
    if (cepStages && cepStages.length > 0) {
      return cepStages.filter(s => !s.is_terminal);
    }
    return DEFAULT_STAGES;
  }, [cepStages]);

  const defaultStage = stageOptions[0]?.stage_key || 'discovery';
  const defaultProb = stageOptions[0]?.win_probability ?? 20;
  const defaultCloseDate = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [form, setForm] = useState({
    deal_name: '',
    deal_value: '',
    stage: defaultStage,
    probability: defaultProb,
    close_date: defaultCloseDate,
    forecast_category: 'pipeline',
    source: 'manual',
    description: '',
  });
  const [accountSearch, setAccountSearch] = useState('');
  const [accountResults, setAccountResults] = useState([]);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  // Reset form when modal opens
  useEffect(() => {
    if (isOpen) {
      setForm({
        deal_name: account?.account_name ? `${account.account_name} — ` : '',
        deal_value: '',
        stage: defaultStage,
        probability: defaultProb,
        close_date: defaultCloseDate,
        forecast_category: 'pipeline',
        source: account ? 'signal_prospecting' : 'manual',
        description: '',
      });
      setSelectedAccount(account ? { id: account.id, account_name: account.account_name, domain: account.domain, tier: account.tier } : null);
      setAccountSearch('');
      setAccountResults([]);
      setError(null);
    }
  }, [isOpen, account, defaultStage, defaultProb, defaultCloseDate]);

  // Account search (only when no account prop)
  useEffect(() => {
    if (account || accountSearch.length < 2) { setAccountResults([]); return; }
    const timer = setTimeout(async () => {
      try {
        const { data } = await supabase.from('engage_accounts')
          .select('id, account_name, domain, tier')
          .eq('organization_id', organizationId)
          .ilike('account_name', `%${accountSearch}%`)
          .limit(5);
        setAccountResults(data || []);
      } catch {}
    }, 300);
    return () => clearTimeout(timer);
  }, [accountSearch, account, organizationId]);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    if (!form.deal_name.trim() || !form.deal_value) return;
    setSaving(true);
    setError(null);
    try {
      const { error: insertError } = await supabase
        .from('engage_pipeline_deals')
        .insert({
          organization_id: organizationId,
          owner_id: userId || null,
          deal_name: form.deal_name.trim(),
          deal_value: parseFloat(form.deal_value) || 0,
          stage: form.stage,
          probability: form.probability,
          close_date: form.close_date || null,
          forecast_category: form.forecast_category,
          source: form.source,
          description: form.description || null,
          linked_account_id: selectedAccount?.id || null,
          account_id: selectedAccount?.id || null,
        });
      if (insertError) throw insertError;
      onDealCreated?.();
      onClose();
    } catch (err) {
      setError(err?.message || 'Failed to create deal');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'mt-1 w-full border border-apptivia-carbon-200 rounded-lg px-3 py-2 text-xs text-apptivia-ink focus:ring-1 focus:ring-apptivia-coral focus:border-apptivia-coral outline-none';
  const labelCls = 'text-[10px] font-semibold text-apptivia-carbon-400 uppercase tracking-wider';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-apptivia-carbon-100">
          <div className="flex items-center gap-2">
            <DollarSign size={16} className="text-apptivia-coral" />
            <h2 className="text-sm font-semibold text-apptivia-ink">Create Deal</h2>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-apptivia-paper rounded-lg transition-colors">
            <X size={16} className="text-apptivia-carbon-400" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-700">{error}</p>
            </div>
          )}

          {/* Deal Name */}
          <div>
            <label className={labelCls}>Deal Name *</label>
            <input type="text" value={form.deal_name} onChange={e => setForm(f => ({ ...f, deal_name: e.target.value }))}
              className={inputCls} placeholder="e.g. Acme Corp — Enterprise License" autoFocus />
          </div>

          {/* Value + Close Date */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Value ($) *</label>
              <input type="number" min="0" value={form.deal_value} onChange={e => setForm(f => ({ ...f, deal_value: e.target.value }))}
                className={inputCls} placeholder="25000" />
            </div>
            <div>
              <label className={labelCls}>Close Date</label>
              <input type="date" value={form.close_date} onChange={e => setForm(f => ({ ...f, close_date: e.target.value }))}
                className={inputCls} />
            </div>
          </div>

          {/* Stage + Probability */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Stage</label>
              <select value={form.stage} onChange={e => {
                const sel = stageOptions.find(s => s.stage_key === e.target.value);
                setForm(f => ({ ...f, stage: e.target.value, probability: sel?.win_probability ?? f.probability }));
              }} className={inputCls}>
                {stageOptions.map(s => (
                  <option key={s.stage_key} value={s.stage_key}>
                    {s.stage_name} ({s.win_probability}%)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Probability (%)</label>
              <input type="number" min="0" max="100" value={form.probability}
                onChange={e => setForm(f => ({ ...f, probability: parseInt(e.target.value) || 0 }))}
                className={inputCls} />
            </div>
          </div>

          {/* Forecast + Source */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Forecast Category</label>
              <select value={form.forecast_category} onChange={e => setForm(f => ({ ...f, forecast_category: e.target.value }))}
                className={inputCls}>
                <option value="pipeline">Pipeline</option>
                <option value="best_case">Best Case</option>
                <option value="commit">Commit</option>
                <option value="omitted">Omitted</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Source</label>
              <select value={form.source} onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                className={inputCls}>
                <option value="manual">Manual</option>
                <option value="inbound">Inbound</option>
                <option value="outbound">Outbound</option>
                <option value="referral">Referral</option>
                <option value="event">Event</option>
                <option value="signal_prospecting">Signal Prospecting</option>
              </select>
            </div>
          </div>

          {/* Account Link */}
          <div>
            <label className={labelCls}>Link to Account</label>
            {selectedAccount ? (
              <div className="mt-1 flex items-center justify-between bg-apptivia-coral/5 border border-apptivia-coral/20 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2">
                  <Target size={12} className="text-apptivia-coral" />
                  <span className="text-xs font-medium text-apptivia-ink">{selectedAccount.account_name}</span>
                  {selectedAccount.tier && selectedAccount.tier !== 'untiered' && (
                    <span className="text-[10px] text-apptivia-carbon-400 capitalize">{selectedAccount.tier}</span>
                  )}
                </div>
                {!account && (
                  <button type="button" onClick={() => { setSelectedAccount(null); setAccountSearch(''); }}
                    className="text-apptivia-carbon-400 hover:text-red-500 transition-colors">
                    <X size={12} />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <input type="text" value={accountSearch} onChange={e => setAccountSearch(e.target.value)}
                  className={inputCls} placeholder="Search accounts..." />
                {accountResults.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                    {accountResults.map(a => (
                      <button key={a.id} type="button" onClick={() => { setSelectedAccount(a); setAccountSearch(''); setAccountResults([]); }}
                        className="w-full text-left px-3 py-2 text-xs text-apptivia-ink hover:bg-apptivia-paper transition-colors flex items-center gap-2">
                        <Target size={10} className="text-apptivia-coral" />
                        <span className="font-medium">{a.account_name}</span>
                        {a.domain && <span className="text-apptivia-carbon-400">{a.domain}</span>}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className={labelCls}>Description</label>
            <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              className={`${inputCls} resize-none`} rows={2} placeholder="Deal context, notes..." />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-apptivia-carbon-600 bg-apptivia-paper rounded-lg hover:bg-apptivia-carbon-100 transition-colors">
              Cancel
            </button>
            <button type="submit" disabled={!form.deal_name.trim() || !form.deal_value || saving}
              className="px-4 py-2 text-xs font-medium text-white bg-apptivia-coral rounded-lg hover:bg-apptivia-coral/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2">
              {saving && <Loader size={12} className="animate-spin" />}
              {saving ? 'Creating...' : 'Create Deal'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
