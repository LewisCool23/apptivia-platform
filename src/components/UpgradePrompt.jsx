import React from 'react';
import { backendFetch } from '../utils/backendFetch';

const VARIANT_CONFIG = {
  aaron_limit: {
    title: 'Unlock Unlimited Aaron AI',
    message: "You've used all 10 daily Aaron messages. Pro gives you unlimited coaching conversations, persistent threads, and deeper insights.",
    icon: '🤖',
    color: '#7c3aed',
  },
  feature_gate: {
    title: 'This Feature Requires Pro',
    message: 'Upgrade to unlock coaching plans, IDPs, performance reviews, advanced analytics, and more.',
    icon: '🔒',
    color: '#7c3aed',
  },
  team_size: {
    title: 'Your Team is Growing',
    message: 'Teams with 4+ reps get the most from Pro — unlimited contests, coaching plans, and team benchmarks.',
    icon: '👥',
    color: '#7c3aed',
  },
  generic: {
    title: 'Upgrade to Apptivia Pro',
    message: 'Get unlimited Aaron AI, coaching plans, contests, advanced analytics, and cross-org benchmarks.',
    icon: '🚀',
    color: '#7c3aed',
  },
};

const COMPARISON_FEATURES = [
  { feature: 'Aaron AI coaching', basic: '10 msg/day', pro: 'Unlimited' },
  { feature: 'Performance reviews', basic: '—', pro: '✓' },
  { feature: 'Coaching plans', basic: '—', pro: 'Unlimited' },
  { feature: 'Engage signal prospecting', basic: '—', pro: '✓' },
  { feature: 'Contests + wallboard', basic: '✓', pro: '✓' },
  { feature: 'Cross-org benchmarks', basic: '—', pro: 'Summary' },
];

export default function UpgradePrompt({ feature, context = 'inline', variant = 'generic', onDismiss }) {
  const config = VARIANT_CONFIG[variant] || VARIANT_CONFIG.generic;
  const featureLabel = feature ? feature.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()) : '';

  const handleUpgrade = async () => {
    try {
      const data = await backendFetch('/api/billing/checkout', { plan: 'Pro' });
      if (data.url) window.location.href = data.url;
    } catch (err) {
      console.error('Checkout error:', err);
    }
  };

  // Banner variant — top-of-page strip
  if (context === 'banner') {
    return (
      <div className="bg-apptivia-carbon-100 border border-purple-200 rounded-lg p-4 mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{config.icon}</span>
          <div>
            <p className="text-sm font-semibold text-purple-800">{config.title}</p>
            <p className="text-xs text-purple-600">{config.message}</p>
          </div>
        </div>
        <button
          onClick={handleUpgrade}
          className="px-4 py-2 bg-apptivia-ink text-white text-sm font-semibold rounded-lg hover:bg-apptivia-ink transition-colors whitespace-nowrap"
        >
          Upgrade to Pro
        </button>
      </div>
    );
  }

  // Modal variant — centered overlay with feature comparison
  if (context === 'modal') {
    return (
      <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-lg">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-1">
              {variant === 'feature_gate' && featureLabel ? `${featureLabel} is a Pro Feature` : config.title}
            </h2>
            <p className="text-sm text-gray-500 mb-6">{config.message}</p>

            {/* Feature comparison table */}
            <div className="mb-6">
              <div className="grid grid-cols-3 text-xs font-medium text-gray-400 uppercase tracking-wide pb-2 border-b border-gray-100">
                <span>Feature</span>
                <span className="text-center">Starter</span>
                <span className="text-center">Pro</span>
              </div>
              {COMPARISON_FEATURES.map(({ feature: feat, basic, pro }) => (
                <div key={feat} className="grid grid-cols-3 text-sm py-2 border-b border-gray-50">
                  <span className="text-gray-700">{feat}</span>
                  <span className="text-center text-gray-400">{basic}</span>
                  <span className="text-center font-medium text-indigo-600">{pro}</span>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleUpgrade}
                className="flex-1 bg-apptivia-ink text-white text-sm font-medium py-2.5 rounded-lg hover:bg-apptivia-ink transition-colors"
              >
                Upgrade to Pro — $49/seat/mo
              </button>
              {onDismiss && (
                <button onClick={onDismiss} className="px-4 text-sm text-gray-500 hover:text-gray-700">
                  Not now
                </button>
              )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">14-day free trial included</p>
          </div>
        </div>
      </div>
    );
  }

  // Inline variant (default) — compact card
  return (
    <div className="bg-apptivia-carbon-100 border border-purple-200 rounded-lg p-3 mt-2">
      <div className="flex items-start gap-2">
        <span className="text-lg">{config.icon}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-purple-800">{config.title}</p>
          <p className="text-xs text-purple-600 mt-0.5">{config.message}</p>
          <button
            onClick={handleUpgrade}
            className="mt-2 px-3 py-1.5 bg-apptivia-ink text-white text-xs font-semibold rounded-md hover:bg-apptivia-ink transition-colors"
          >
            Upgrade to Pro
          </button>
        </div>
      </div>
    </div>
  );
}
