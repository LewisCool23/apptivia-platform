import React from 'react';
import { X } from 'lucide-react';

export default function ApptiviaLevelInfoModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-2xl bg-white rounded-xl shadow-xl p-6">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">How Apptivia Levels Work</h2>
            <p className="text-xs text-gray-500">From activity to mastery, week over week.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 text-sm text-gray-700">
          <div>
            <div className="font-semibold text-gray-900 mb-1">1) Activity → Scorecard</div>
            <p>
              Daily sales activities (calls, emails, meetings, pipeline actions) are captured through integrated tools
              like Salesforce or Outreach. Those activities feed the weekly Apptivia Scorecard and KPI attainment.
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-900 mb-1">2) Scorecard → Achievements & Badges</div>
            <p>
              Consistent KPI attainment earns achievements and badges. Weekly performance builds a historical record
              that strengthens coaching insights over time.
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-900 mb-1">3) Achievements → Skillset Mastery</div>
            <p>
              Achievements are mapped to skillsets (e.g., pipeline, call execution, discovery). As badges accumulate,
              skillset mastery progresses and unlocks next milestones.
            </p>
          </div>
          <div>
            <div className="font-semibold text-gray-900 mb-1">4) Skillset Mastery → Apptivia Level</div>
            <p>
              Sustained skillset progress elevates Apptivia Level. Higher levels reflect consistent execution, strong
              fundamentals, and repeatable success.
            </p>
          </div>
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-3 text-xs text-blue-700">
            Historical data is retained to inform coaching plans, future AI guidance, and personalized recommendations.
            Integrations will activate the automated activity capture once connected.
          </div>
        </div>
      </div>
    </div>
  );
}
