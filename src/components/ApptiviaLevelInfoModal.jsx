import React, { useState } from 'react';
import { X, Zap, Award, Target, TrendingUp, Star, ChevronRight, Trophy, BookOpen } from 'lucide-react';
import { SKILLSET_CATEGORIES } from '../constants/skillsets';

const APPTIVIA_LEVELS = [
  { name: 'Developing', range: '0 – 999 pts', color: 'from-orange-400 to-orange-600', bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', icon: '🌱', description: 'Building foundational habits and early KPI consistency.' },
  { name: 'Intermediate', range: '1,000 – 2,499 pts', color: 'from-blue-400 to-blue-600', bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', icon: '📈', description: 'Demonstrating steady performance and growing skillset mastery.' },
  { name: 'Proficient', range: '2,500 – 4,999 pts', color: 'from-emerald-400 to-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', icon: '⚡', description: 'Consistently hitting targets with strong multi-skill execution.' },
  { name: 'Elite', range: '5,000 – 9,999 pts', color: 'from-yellow-400 to-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200', text: 'text-yellow-700', icon: '🏅', description: 'Top-tier performance with deep mastery across all skillsets.' },
  { name: 'Master', range: '10,000+ pts', color: 'from-purple-500 to-pink-500', bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', icon: '👑', description: 'Peak sustained excellence — the highest level of achievement.' },
];

const SKILLSET_LEVELS = [
  { name: 'Beginner', range: '0 – 39%', color: 'bg-gray-200', text: 'text-gray-600' },
  { name: 'Developing', range: '40 – 59%', color: 'bg-orange-200', text: 'text-orange-700' },
  { name: 'Intermediate', range: '60 – 79%', color: 'bg-blue-200', text: 'text-blue-700' },
  { name: 'Advanced', range: '80 – 99%', color: 'bg-emerald-200', text: 'text-emerald-700' },
  { name: 'Master', range: '100%', color: 'bg-purple-200', text: 'text-purple-700' },
];

const TABS = [
  { id: 'overview', label: 'How It Works', icon: BookOpen },
  { id: 'levels', label: 'Apptivia Levels', icon: TrendingUp },
  { id: 'skillsets', label: 'Skillset Mastery', icon: Target },
  { id: 'achievements', label: 'Achievements & Badges', icon: Award },
];

export default function ApptiviaLevelInfoModal({ isOpen, onClose }) {
  const [activeTab, setActiveTab] = useState('overview');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />
      <div className="relative w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500 px-6 py-5">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-bold text-white">How Apptivia Levels Work</h2>
              <p className="text-white/80 text-xs mt-0.5">From daily activity to mastery — your progression journey</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
              aria-label="Close"
            >
              <X size={18} />
            </button>
          </div>
          {/* Tabs */}
          <div className="flex gap-1 mt-4 -mb-5 px-0">
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-t-lg text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                <tab.icon size={14} />
                <span className="hidden sm:inline">{tab.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Visual flow diagram */}
              <div className="bg-gray-50 rounded-xl p-5">
                <h3 className="text-sm font-semibold text-gray-900 mb-4">Your Progression Flow</h3>
                <div className="flex flex-col sm:flex-row items-center gap-2 sm:gap-0">
                  {[
                    { icon: Zap, label: 'Activity', sub: 'Daily sales actions', color: 'bg-blue-100 text-blue-600' },
                    { icon: Target, label: 'Scorecard', sub: 'KPI attainment', color: 'bg-green-100 text-green-600' },
                    { icon: Award, label: 'Achievements', sub: 'Milestones earned', color: 'bg-yellow-100 text-yellow-600' },
                    { icon: Star, label: 'Skillsets', sub: 'Mastery progress', color: 'bg-purple-100 text-purple-600' },
                    { icon: Trophy, label: 'Level Up', sub: 'Apptivia Level', color: 'bg-pink-100 text-pink-600' },
                  ].map((step, i) => (
                    <React.Fragment key={step.label}>
                      <div className="flex flex-col items-center text-center min-w-[90px]">
                        <div className={`w-12 h-12 rounded-xl ${step.color} flex items-center justify-center mb-1.5`}>
                          <step.icon size={22} />
                        </div>
                        <div className="text-xs font-semibold text-gray-900">{step.label}</div>
                        <div className="text-[10px] text-gray-500">{step.sub}</div>
                      </div>
                      {i < 4 && <ChevronRight size={16} className="text-gray-300 shrink-0 hidden sm:block" />}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Zap size={16} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">1. Activity → Scorecard</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Daily sales activities (calls, emails, meetings, pipeline actions) are captured through integrated tools 
                    and feed into the weekly Apptivia Scorecard KPI tracking.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center"><Award size={16} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">2. Scorecard → Achievements</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Consistent KPI attainment earns achievements and badges. Weekly performance builds a historical record 
                    that strengthens coaching insights over time.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 text-purple-600 flex items-center justify-center"><Star size={16} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">3. Achievements → Skillset Mastery</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Achievements are mapped to skillsets (e.g., pipeline, call execution). As badges accumulate, 
                    skillset mastery progresses and unlocks milestone bonuses.
                  </p>
                </div>
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-7 h-7 rounded-lg bg-pink-100 text-pink-600 flex items-center justify-center"><Trophy size={16} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">4. Mastery → Apptivia Level</h4>
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">
                    Sustained skillset progress and accumulated points elevate your Apptivia Level. Higher levels reflect 
                    consistent execution and repeatable success.
                  </p>
                </div>
              </div>

              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0 mt-0.5"><BookOpen size={16} /></div>
                <div className="text-xs text-blue-700 leading-relaxed">
                  <span className="font-semibold">Pro Tip:</span> Historical data is retained to inform coaching plans, AI-powered guidance, and personalized recommendations. 
                  Your progress never decreases — achievements and points are cumulative and permanent.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'levels' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Your Apptivia Level is determined by total cumulative points earned through achievements, badges, and skillset milestone bonuses.</p>
              
              {/* Level progression visual */}
              <div className="relative">
                <div className="absolute left-6 top-8 bottom-8 w-0.5 bg-gray-200" />
                <div className="space-y-3">
                  {APPTIVIA_LEVELS.map((level, i) => (
                    <div key={level.name} className={`relative flex items-start gap-4 ${level.bg} ${level.border} border rounded-xl p-4 transition-all hover:shadow-md`}>
                      <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${level.color} flex items-center justify-center text-2xl shrink-0 shadow-sm z-10`}>
                        {level.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className={`text-sm font-bold ${level.text}`}>{level.name}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/80 text-gray-500 font-medium">{level.range}</span>
                        </div>
                        <p className="text-xs text-gray-600">{level.description}</p>
                      </div>
                      {i < APPTIVIA_LEVELS.length - 1 && (
                        <ChevronRight size={14} className="text-gray-300 shrink-0 mt-3 hidden sm:block rotate-90" />
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">How Points Are Earned</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <Award size={18} className="mx-auto text-blue-500 mb-1" />
                    <div className="text-xs font-semibold text-gray-900">Achievements</div>
                    <div className="text-[10px] text-gray-500">10–100 pts each</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <Trophy size={18} className="mx-auto text-purple-500 mb-1" />
                    <div className="text-xs font-semibold text-gray-900">Badge Awards</div>
                    <div className="text-[10px] text-gray-500">25–200 pts each</div>
                  </div>
                  <div className="text-center p-3 bg-white rounded-lg border border-gray-100">
                    <Star size={18} className="mx-auto text-yellow-500 mb-1" />
                    <div className="text-xs font-semibold text-gray-900">Skillset Milestones</div>
                    <div className="text-[10px] text-gray-500">250–1,000 pts at 25/50/75/100%</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'skillsets' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Each skillset tracks mastery through achievement completion. As you earn achievements mapped to a skillset, your mastery percentage grows.</p>
              
              {/* Skillset mastery levels */}
              <div className="bg-gray-50 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-900 mb-3">Skillset Mastery Levels</h4>
                <div className="space-y-2">
                  {SKILLSET_LEVELS.map(level => (
                    <div key={level.name} className="flex items-center gap-3">
                      <div className={`w-20 h-2 rounded-full ${level.color}`} />
                      <span className={`text-xs font-semibold ${level.text} w-24`}>{level.name}</span>
                      <span className="text-[10px] text-gray-500">{level.range}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-900 mb-2">Skillset Categories</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {SKILLSET_CATEGORIES.map(s => (
                    <div key={s.name} className="flex items-center gap-2 p-2 rounded-lg hover:bg-gray-50">
                      <div className={`w-2 h-8 rounded-full ${s.color}`} />
                      <div>
                        <div className="text-xs font-semibold text-gray-900">{s.name}</div>
                        <div className="text-[10px] text-gray-500">{s.kpis}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-purple-50 border border-purple-100 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-purple-800 mb-1">Milestone Bonuses</h4>
                <p className="text-xs text-purple-700 leading-relaxed">
                  When a skillset reaches 25%, 50%, 75%, or 100% mastery, you earn bonus points: 250, 500, 750, and 1,000 points respectively. 
                  These milestones are one-time awards that significantly boost your Apptivia Level progression.
                </p>
              </div>
            </div>
          )}

          {activeTab === 'achievements' && (
            <div className="space-y-4">
              <p className="text-xs text-gray-500">Achievements and badges are the core building blocks of your progression. They're earned permanently and never removed.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center"><Target size={18} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">Achievements</h4>
                  </div>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Earned by hitting KPI thresholds (e.g., 50+ calls in a week)</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>4 difficulty tiers: Easy, Medium, Hard, Expert</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Each mapped to a skillset to drive mastery</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-blue-500 mt-0.5">•</span>
                      <span>Higher difficulty = more points earned</span>
                    </li>
                  </ul>
                </div>

                <div className="bg-white border border-gray-200 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-8 h-8 rounded-lg bg-yellow-100 text-yellow-600 flex items-center justify-center"><Award size={18} /></div>
                    <h4 className="text-sm font-semibold text-gray-900">Badges</h4>
                  </div>
                  <ul className="space-y-2 text-xs text-gray-600">
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>Special recognitions for milestones and contests</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>Manual awards from managers or auto-triggered</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>Rarity tiers: Common, Rare, Epic, Legendary</span>
                    </li>
                    <li className="flex items-start gap-2">
                      <span className="text-yellow-500 mt-0.5">•</span>
                      <span>Displayed on your profile and shared publicly</span>
                    </li>
                  </ul>
                </div>
              </div>

              <div className="bg-white border border-gray-200 rounded-xl p-4">
                <h4 className="text-xs font-semibold text-gray-900 mb-3">Achievement Difficulty & Points</h4>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { label: 'Easy', pts: '10 pts', color: 'bg-green-100 text-green-700 border-green-200' },
                    { label: 'Medium', pts: '25 pts', color: 'bg-blue-100 text-blue-700 border-blue-200' },
                    { label: 'Hard', pts: '50 pts', color: 'bg-orange-100 text-orange-700 border-orange-200' },
                    { label: 'Expert', pts: '100 pts', color: 'bg-red-100 text-red-700 border-red-200' },
                  ].map(d => (
                    <div key={d.label} className={`text-center p-3 rounded-lg border ${d.color}`}>
                      <div className="text-xs font-bold">{d.label}</div>
                      <div className="text-[10px] mt-0.5">{d.pts}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-green-50 border border-green-100 rounded-xl p-4 flex items-start gap-3">
                <div className="w-7 h-7 rounded-lg bg-green-100 text-green-600 flex items-center justify-center shrink-0 mt-0.5"><TrendingUp size={16} /></div>
                <div className="text-xs text-green-700 leading-relaxed">
                  <span className="font-semibold">Cumulative & Permanent:</span> Once earned, achievements and badges are never removed. 
                  Your total points only go up, ensuring your Apptivia Level reflects your full career growth on the platform.
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
