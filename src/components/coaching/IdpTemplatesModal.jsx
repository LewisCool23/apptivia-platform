import React, { useState, useEffect } from 'react';
import { X, Target, Calendar, BookOpen, Crown, MessageCircle, Rocket } from 'lucide-react';
import { supabase } from '../../supabaseClient';
import { idpPlanTypes } from './idpStatusConfig';

const iconMap = {
  crown: Crown,
  target: Target,
  'message-circle': MessageCircle,
  rocket: Rocket,
};

export default function IdpTemplatesModal({ onClose, onSelect, organizationId }) {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await supabase
        .from('idp_templates')
        .select('*')
        .or(`is_system.eq.true,organization_id.eq.${organizationId || '00000000-0000-0000-0000-000000000000'}`)
        .eq('is_active', true)
        .order('is_system', { ascending: false });
      setTemplates(data || []);
      setLoading(false);
    })();
  }, [organizationId]);

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 overflow-y-auto">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl mx-4 mb-10">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900">IDP Templates</h2>
            <p className="text-xs text-gray-500">Choose a template to pre-fill your development plan</p>
          </div>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg"><X size={18} /></button>
        </div>

        <div className="p-6">
          {loading ? (
            <div className="text-center py-8 text-sm text-gray-500">Loading templates...</div>
          ) : templates.length === 0 ? (
            <div className="text-center py-8 text-sm text-gray-500">No templates available</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {templates.map(t => {
                const IconComp = iconMap[t.icon] || Target;
                return (
                  <button
                    key={t.id}
                    onClick={() => onSelect(t)}
                    className="text-left border border-gray-200 rounded-lg p-4 hover:shadow-md hover:border-blue-300 transition-all"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                        <IconComp size={20} className="text-blue-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-semibold text-gray-900 text-sm">{t.name}</h4>
                          {t.is_system && (
                            <span className="px-1.5 py-0.5 text-[9px] rounded bg-gray-100 text-gray-500 font-medium">System</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 mb-2">{t.description}</p>
                        <div className="flex items-center gap-3 text-[10px] text-gray-400">
                          <span className="flex items-center gap-1"><Calendar size={10} /> {idpPlanTypes[t.plan_type]?.label || t.plan_type}</span>
                          <span>{t.default_duration_days} days</span>
                          {t.suggested_milestones?.length > 0 && (
                            <span>{t.suggested_milestones.length} milestones</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
