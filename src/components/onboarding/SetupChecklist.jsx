/**
 * SetupChecklist — Floating button + flyout panel for post-onboarding setup.
 * Positioned next to the Aaron AI chatbot button (bottom-right).
 * Shows remaining setup items with badge count. Dismissible per-item.
 */

import React, { useState, useEffect } from 'react';
import { supabase } from '../../supabaseClient';
import { X, ChevronRight, ClipboardCheck } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { ROLES } from '../../constants/roles';

const SETUP_ITEMS = [
  {
    key: 'billing',
    label: 'Set up billing',
    description: 'Complete your subscription payment via Stripe',
    route: '/organization-settings?tab=subscription',
    checkFn: (org) => org.stripe_subscription_id != null,
  },
  {
    key: 'wallboard',
    label: 'Configure Wallboard',
    description: 'Customize which slides appear on your team display',
    route: '/organization-settings?tab=general',
    checkFn: (org) => {
      const readiness = org.onboarding_readiness || {};
      return readiness.optional_setup === 'complete';
    },
  },
  {
    key: 'reports',
    label: 'Set up scheduled reports',
    description: 'Automate scorecard summaries and pipeline reports',
    route: '/organization-settings?tab=reports',
    checkFn: () => false,
  },
  {
    key: 'notifications',
    label: 'Configure notifications',
    description: 'Choose which alerts and updates you receive',
    route: '/organization-settings?tab=notifications',
    checkFn: () => false,
  },
];

export default function SetupChecklist({ organizationId, userRole }) {
  const [org, setOrg] = useState(null);
  const [dismissed, setDismissed] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!organizationId) return;
    (async () => {
      const { data } = await supabase
        .from('organizations')
        .select('onboarding_status, onboarding_readiness, stripe_subscription_id, settings')
        .eq('id', organizationId)
        .single();
      if (data) {
        setOrg(data);
        setDismissed(data.settings?.setup_dismissed || []);
      }
    })();
  }, [organizationId]);

  if (!org || org.onboarding_status !== 'completed') return null;
  if (userRole !== ROLES.ADMIN) return null;

  const activeItems = SETUP_ITEMS.filter(item =>
    !dismissed.includes(item.key) && !item.checkFn(org)
  );

  if (activeItems.length === 0) return null;

  const dismissItem = async (key) => {
    const updated = [...dismissed, key];
    setDismissed(updated);
    const existingSettings = org.settings || {};
    await supabase.from('organizations').update({
      settings: { ...existingSettings, setup_dismissed: updated },
    }).eq('id', organizationId).catch(() => {});
  };

  return (
    <>
      {/* Floating button — positioned to the left of Aaron AI */}
      <button
        onClick={() => setPanelOpen(!panelOpen)}
        className="fixed bottom-6 right-20 sm:right-[5.5rem] w-12 h-12 sm:w-14 sm:h-14 bg-gradient-to-br from-amber-400 via-orange-500 to-red-500 text-white rounded-full shadow-lg hover:shadow-xl flex items-center justify-center z-40 transition-all duration-300 hover:scale-110"
        aria-label="Setup checklist"
      >
        <ClipboardCheck size={22} />
        {/* Badge count */}
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-600 text-white text-[10px] font-bold rounded-full flex items-center justify-center shadow">
          {activeItems.length}
        </span>
      </button>

      {/* Flyout panel */}
      {panelOpen && (
        <div className="fixed bottom-24 right-20 sm:right-[5.5rem] w-80 bg-white rounded-xl shadow-2xl border border-gray-200 z-50 animate-in slide-in-from-bottom-2 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gradient-to-r from-amber-50 to-orange-50 rounded-t-xl">
            <div className="flex items-center gap-2">
              <ClipboardCheck size={16} className="text-orange-600" />
              <span className="text-sm font-semibold text-gray-800">
                Complete Setup
              </span>
              <span className="text-xs text-orange-600 font-medium bg-orange-100 px-1.5 py-0.5 rounded-full">
                {activeItems.length} left
              </span>
            </div>
            <button
              onClick={() => setPanelOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X size={16} />
            </button>
          </div>

          {/* Items */}
          <div className="p-2 space-y-1.5 max-h-72 overflow-y-auto">
            {activeItems.map(item => (
              <div
                key={item.key}
                className="rounded-lg px-3 py-2.5 bg-apptivia-paper hover:bg-apptivia-coral-tone-50 transition-colors border border-gray-100"
              >
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{item.label}</span>
                  <button
                    onClick={() => dismissItem(item.key)}
                    className="text-[10px] text-gray-400 hover:text-gray-600 uppercase tracking-wide"
                  >
                    Dismiss
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-0.5">{item.description}</p>
                <button
                  onClick={() => { navigate(item.route); setPanelOpen(false); }}
                  className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-700 font-medium mt-1.5"
                >
                  Configure <ChevronRight size={12} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
