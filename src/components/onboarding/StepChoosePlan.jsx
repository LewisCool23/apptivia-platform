import React from 'react';
import { CreditCard, CheckCircle, Check } from 'lucide-react';
import { TIER_LIMITS, TIER_DISPLAY_NAMES } from '../../constants/subscriptionTiers';

const PLANS = [
  {
    key: 'Basic',
    display: 'Starter',
    price: '$19',
    unit: '/seat/mo',
    description: 'Visibility and engagement for your sales team',
    features: [
      'Real-time Scorecard & KPI tracking',
      'Wallboard with live leaderboards',
      'Aaron AI coaching assistant',
      'CRM integrations (Salesforce, HubSpot, etc.)',
      'CSV data upload',
      'Basic analytics',
      'Email support',
    ],
  },
  {
    key: 'Pro',
    display: 'Pro',
    price: '$49',
    unit: '/seat/mo',
    description: 'Full platform with AI coaching and prospecting',
    highlighted: true,
    features: [
      'Everything in Starter',
      'AI Coaching Plans & IDPs',
      'Performance Reviews',
      'Sales Contests & Achievements',
      'Signal Prospecting (Engage)',
      'Advanced analytics & export',
      'Priority support',
    ],
  },
  {
    key: 'Enterprise',
    display: 'Enterprise',
    price: 'Custom',
    unit: '',
    description: 'For organizations with advanced requirements',
    features: [
      'Everything in Pro',
      'SSO & audit logs',
      'API access',
      'Custom integrations',
      'Org Health Scorecard',
      'Dedicated success manager',
      'SLA guarantee',
    ],
  },
];

export default function StepChoosePlan({ wizardState, updateState }) {
  const { selectedTier, teamMembers } = wizardState;
  const seatCount = Math.max(teamMembers.filter(m => m.email.trim()).length + 1, 1); // +1 for admin

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-apptivia-coral-tone-50 rounded-lg flex items-center justify-center">
          <CreditCard size={20} className="text-blue-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Choose Your Plan</h3>
          <p className="text-sm text-gray-500">
            Select the plan that fits your team. Billing is set up after onboarding — no charge today.
          </p>
        </div>
      </div>

      <div className="bg-apptivia-coral-tone-50 border border-blue-200 rounded-lg px-4 py-3 text-sm text-blue-800">
        <strong>You're on a 14-day Pro trial.</strong> All features are unlocked during your trial.
        Choose the plan you'd like after your trial ends, or continue with Starter (free).
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {PLANS.map(plan => {
          const isSelected = selectedTier === plan.key;
          const pricePerSeat = TIER_LIMITS[plan.key]?.pricePerSeat;
          const monthlyEstimate = pricePerSeat ? pricePerSeat * seatCount : null;

          return (
            <button
              key={plan.key}
              type="button"
              onClick={() => updateState({ selectedTier: plan.key })}
              className={`relative p-5 rounded-xl border-2 text-left transition-all ${
                isSelected
                  ? 'border-blue-600 bg-apptivia-coral-tone-50/50 ring-1 ring-blue-200'
                  : plan.highlighted
                    ? 'border-blue-200 hover:border-blue-400'
                    : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-apptivia-coral text-white text-xs font-semibold px-3 py-0.5 rounded-full">
                  MOST POPULAR
                </div>
              )}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <Check size={18} className="text-blue-600" />
                </div>
              )}
              <h4 className="text-lg font-bold text-gray-900">{plan.display}</h4>
              <div className="mt-1 mb-3">
                <span className="text-2xl font-bold text-gray-900">{plan.price}</span>
                {plan.unit && <span className="text-gray-500 text-sm">{plan.unit}</span>}
              </div>
              {monthlyEstimate && (
                <div className="text-xs text-blue-600 font-medium mb-2">
                  ~${monthlyEstimate}/mo for {seatCount} seat{seatCount !== 1 ? 's' : ''}
                </div>
              )}
              <p className="text-xs text-gray-500 mb-3">{plan.description}</p>
              <ul className="space-y-1.5">
                {plan.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-xs text-gray-600">
                    <CheckCircle size={12} className="text-emerald-500 flex-shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              {plan.key === 'Enterprise' && (
                <div className="mt-3 text-xs text-center text-blue-600 font-medium">
                  Contact sales@apptivia.app for pricing
                </div>
              )}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-center text-gray-400">
        Per-seat pricing. No long-term contracts. Cancel anytime. Billing is configured after onboarding.
      </p>
    </div>
  );
}

StepChoosePlan.validate = (wizardState) => {
  if (!wizardState.selectedTier) return 'Please select a subscription plan';
  return null;
};
