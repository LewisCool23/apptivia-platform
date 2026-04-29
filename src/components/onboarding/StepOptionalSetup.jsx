import React, { useState } from 'react';
import { Settings, ChevronDown, ChevronRight, Monitor, FileText, Bell } from 'lucide-react';
import { DEFAULT_WALLBOARD_SETTINGS } from './onboardingConstants';
import { tierHasFeature } from '../../constants/subscriptionTiers';

const SLIDE_LABELS = {
  leaderboard: 'Leaderboard',
  spotlight: 'Rep Spotlight',
  contests: 'Contests',
  team_stats: 'Team Stats',
  badges: 'Badges',
  activity: 'Activity Feed',
  achievements: 'Achievements',
  goals: 'Goal Progress',
};

export default function StepOptionalSetup({ wizardState, updateState }) {
  const { wallboardSettings, selectedTier } = wizardState;
  const [expanded, setExpanded] = useState({ wallboard: false, reports: false, notifications: false });

  const toggle = (key) => setExpanded(e => ({ ...e, [key]: !e[key] }));

  const updateSlide = (key, field, value) => {
    updateState({
      wallboardSettings: {
        ...wallboardSettings,
        slides: {
          ...wallboardSettings.slides,
          [key]: { ...wallboardSettings.slides[key], [field]: value },
        },
      },
    });
  };

  const hasReports = tierHasFeature(selectedTier || 'Pro', 'export_reports');

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-apptivia-carbon-100 rounded-lg flex items-center justify-center">
          <Settings size={20} className="text-gray-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Optional Setup</h3>
          <p className="text-sm text-gray-500">
            Configure these now or skip — all can be set up later in Settings
          </p>
        </div>
      </div>

      {/* Wallboard Config */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggle('wallboard')}
          className="w-full flex items-center justify-between px-4 py-3 bg-apptivia-paper hover:bg-apptivia-carbon-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Monitor size={16} className="text-blue-600" />
            <span className="text-sm font-medium text-gray-900">Wallboard Configuration</span>
          </div>
          {expanded.wallboard ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {expanded.wallboard && (
          <div className="p-4 space-y-2">
            <p className="text-xs text-gray-500 mb-3">Choose which slides appear on your team wallboard and how long each displays.</p>
            {Object.entries(SLIDE_LABELS).map(([key, label]) => (
              <div key={key} className="flex items-center justify-between py-1.5">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={wallboardSettings.slides[key]?.enabled ?? true}
                    onChange={(e) => updateSlide(key, 'enabled', e.target.checked)}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-gray-700">{label}</span>
                </label>
                <div className="flex items-center gap-1">
                  <input
                    type="number"
                    value={wallboardSettings.slides[key]?.duration ?? 15}
                    onChange={(e) => updateSlide(key, 'duration', Math.max(5, Math.min(120, Number(e.target.value) || 15)))}
                    className="w-14 px-2 py-1 border border-gray-300 rounded text-sm text-center"
                    min="5"
                    max="120"
                  />
                  <span className="text-xs text-gray-400">sec</span>
                </div>
              </div>
            ))}
            <div className="flex items-center gap-2 pt-2 border-t mt-2">
              <input
                type="checkbox"
                checked={wallboardSettings.celebrations}
                onChange={(e) => updateState({ wallboardSettings: { ...wallboardSettings, celebrations: e.target.checked } })}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              <span className="text-sm text-gray-700">Celebration overlays (confetti for level-ups, badges, wins)</span>
            </div>
          </div>
        )}
      </div>

      {/* Scheduled Reports */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggle('reports')}
          className="w-full flex items-center justify-between px-4 py-3 bg-apptivia-paper hover:bg-apptivia-carbon-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-purple-600" />
            <span className="text-sm font-medium text-gray-900">Scheduled Reports</span>
            {!hasReports && (
              <span className="text-xs bg-apptivia-carbon-200 text-gray-500 px-2 py-0.5 rounded-full">Pro+</span>
            )}
          </div>
          {expanded.reports ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {expanded.reports && (
          <div className="p-4">
            {hasReports ? (
              <p className="text-sm text-gray-600">
                Scheduled reports (scorecard summary, pipeline overview, contest results, team activity) can be configured in <strong>Settings → Reports</strong> after onboarding.
              </p>
            ) : (
              <p className="text-sm text-gray-500">
                Scheduled reports are available on the Pro plan and above. You can upgrade anytime in Settings → Subscription.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <button
          type="button"
          onClick={() => toggle('notifications')}
          className="w-full flex items-center justify-between px-4 py-3 bg-apptivia-paper hover:bg-apptivia-carbon-100 transition-colors"
        >
          <div className="flex items-center gap-2">
            <Bell size={16} className="text-amber-600" />
            <span className="text-sm font-medium text-gray-900">Notification Preferences</span>
          </div>
          {expanded.notifications ? <ChevronDown size={16} className="text-gray-400" /> : <ChevronRight size={16} className="text-gray-400" />}
        </button>
        {expanded.notifications && (
          <div className="p-4">
            <p className="text-sm text-gray-600">
              Notification preferences (badges, contests, achievements, data sync alerts) can be configured in <strong>Settings → Notifications</strong> after onboarding.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Optional step — always valid
StepOptionalSetup.validate = () => null;
