import React from 'react';
import { Trophy, CheckCircle, Clock, AlertCircle, ArrowRight, Rocket } from 'lucide-react';
import { useOnboardingReadiness } from './useOnboardingReadiness';

export default function StepReviewLaunch({ wizardState, onGoToStep }) {
  const items = useOnboardingReadiness(wizardState);
  const mandatoryIncomplete = items.filter(i => i.mandatory && i.status === 'incomplete');
  const canLaunch = mandatoryIncomplete.length === 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-indigo-500 rounded-lg flex items-center justify-center">
          <Trophy size={20} className="text-white" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-apptivia-ink">Review & Launch</h3>
          <p className="text-sm text-apptivia-carbon-500">
            {canLaunch
              ? 'Everything looks great! Review your setup and launch your workspace.'
              : 'Complete the required items below before launching.'}
          </p>
        </div>
      </div>

      {/* Readiness Checklist */}
      <div className="space-y-2">
        {items.map(item => (
          <div
            key={item.key}
            className={`flex items-center justify-between p-3 rounded-lg border ${
              item.status === 'complete'
                ? 'border-emerald-200 bg-emerald-50/50'
                : item.status === 'skipped'
                  ? 'border-amber-200 bg-amber-50/50'
                  : 'border-red-200 bg-red-50/50'
            }`}
          >
            <div className="flex items-center gap-3">
              {item.status === 'complete' ? (
                <CheckCircle size={18} className="text-emerald-500" />
              ) : item.status === 'skipped' ? (
                <Clock size={18} className="text-amber-500" />
              ) : (
                <AlertCircle size={18} className="text-red-500" />
              )}
              <div>
                <div className="text-sm font-medium text-apptivia-ink">{item.label}</div>
                <div className="text-xs text-apptivia-carbon-500">{item.description}</div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {item.status === 'complete' && (
                <span className="text-xs text-emerald-600 font-medium">Complete</span>
              )}
              {item.status === 'skipped' && (
                <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">
                  Recommended
                </span>
              )}
              {item.status === 'incomplete' && (
                <>
                  <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">
                    Required
                  </span>
                  <button
                    type="button"
                    onClick={() => onGoToStep(item.stepNumber)}
                    className="flex items-center gap-1 text-xs text-apptivia-coral hover:text-apptivia-coral font-medium"
                  >
                    Go to Step {item.stepNumber} <ArrowRight size={12} />
                  </button>
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Launch Message */}
      {canLaunch && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 rounded-lg p-6 text-center text-white">
          <Rocket size={32} className="mx-auto mb-3 opacity-90" />
          <h4 className="text-xl font-bold mb-2">You're ready to go!</h4>
          <p className="text-apptivia-coral-tone-300 text-sm mb-1">
            Your scorecard, coaching engine, and team structure are all configured.
          </p>
          <p className="text-apptivia-coral-tone-300 text-xs">
            Click "Launch Apptivia" below to complete onboarding and start using the platform.
          </p>
        </div>
      )}

      {!canLaunch && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
          <p className="text-sm text-red-700">
            <strong>{mandatoryIncomplete.length}</strong> required item{mandatoryIncomplete.length !== 1 ? 's' : ''} still need{mandatoryIncomplete.length === 1 ? 's' : ''} to be completed before launching.
          </p>
        </div>
      )}
    </div>
  );
}

StepReviewLaunch.validate = (wizardState) => {
  // Delegate to readiness check — handled by the launch button enable/disable
  return null;
};

StepReviewLaunch.canLaunch = (wizardState, readinessItems) => {
  return readinessItems.every(i => !i.mandatory || i.status === 'complete');
};
