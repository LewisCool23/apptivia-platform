import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

interface SkillsetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillsetId: string;
  skillsetName: string;
  skillsetColor: string;
  selectedMembers?: string[];
  selectedTeams?: string[];
  selectedDepartments?: string[];
  highlightAchievementName?: string | null;
}

interface Achievement {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  points: number;
  kpi_requirement?: string;
  threshold?: number;
}

interface ProfileProgress {
  profile_id: string;
  profile_name: string;
  progress: number;
  achievements_completed: number;
  level: string;
  completedAchievements: Set<string>;
}

const SKILLSET_KPI_MAP: Record<string, string[]> = {
  conversationalist: ['talk_time_minutes', 'conversations'],
  'call conqueror': ['call_connects', 'meetings', 'discovery_calls'],
  'email warrior': ['emails_sent', 'social_touches'],
  'pipeline guru': ['sourced_opps', 'stage2_opps', 'pipeline_created', 'pipeline_advanced', 'qualified_leads'],
  'task master': ['follow_ups', 'demos_completed', 'response_time', 'sales_cycle_days', 'win_rate'],  'scorecard master': ['scorecard_100_percent', 'scorecard_100_percent_streak', 'key_metric_100_percent', 'key_metric_100_percent_streak', 'scorecards_completed'],};

function difficultyRank(difficulty?: string) {
  switch (difficulty) {
    case 'easy':
      return 1;
    case 'medium':
      return 2;
    case 'hard':
      return 3;
    case 'expert':
      return 4;
    default:
      return 5;
  }
}

function getSkillsetLevel(progress: number) {
  if (progress >= 100) return 'Master';
  if (progress >= 80) return 'Advanced';
  if (progress >= 60) return 'Intermediate';
  if (progress >= 40) return 'Developing';
  return 'Beginner';
}

export default function SkillsetDetailsModal({ 
  isOpen, 
  onClose, 
  skillsetId, 
  skillsetName, 
  skillsetColor,
  selectedMembers = [],
  selectedTeams = [],
  selectedDepartments = [],
  highlightAchievementName = null
}: SkillsetDetailsModalProps) {
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [profileProgress, setProfileProgress] = useState<ProfileProgress[]>([]);
  const [loading, setLoading] = useState(false);
  const [kpiSummary, setKpiSummary] = useState('');
  const [kpiList, setKpiList] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'achievements' | 'members'>('achievements');

  const audienceLabel = (() => {
    if (selectedMembers.length > 0) return 'Selected Members';
    if (selectedTeams.length > 0) return 'Selected Team';
    if (selectedDepartments.length > 0) return 'Selected Department';
    return 'All Members';
  })();

  useEffect(() => {
    if (isOpen && skillsetId) {
      fetchSkillsetDetails();
    }
  }, [isOpen, skillsetId, selectedMembers, selectedTeams, selectedDepartments]);

  async function fetchSkillsetDetails() {
    setLoading(true);
    try {
      // Fetch achievements for this skillset
      const { data: achievementsData, error: achievementsError } = await supabase
        .from('achievements')
        .select('*')
        .eq('skillset_id', skillsetId)
        .order('difficulty')
        .order('points', { ascending: false });

      if (achievementsError) throw achievementsError;
      setAchievements(achievementsData || []);

      // Fetch KPI metrics for scorecard calculations
      const { data: metricsData, error: metricsError } = await supabase
        .from('kpi_metrics')
        .select('id, key, goal, weight, show_on_scorecard')
        .eq('is_active', true);

      if (metricsError) throw metricsError;

      const metrics = (metricsData || []).map((m: any) => ({
        ...m,
        show_on_scorecard: m?.show_on_scorecard ?? true,
      }));

      const metricsByKey = new Map<string, any>();
      metrics.forEach((metric: any) => {
        metricsByKey.set(metric.key, metric);
      });

      const scorecardMetricKeys = metrics
        .filter((m: any) => m.show_on_scorecard)
        .map((m: any) => m.key);

      // Fetch profile progress for this skillset
      let profileQuery = supabase
        .from('profiles')
        .select('id, first_name, last_name');

      if (selectedMembers.length > 0) {
        profileQuery = profileQuery.in('id', selectedMembers);
      }
      if (selectedTeams.length > 0) {
        profileQuery = profileQuery.in('team_id', selectedTeams);
      }
      if (selectedDepartments.length > 0) {
        profileQuery = profileQuery.in('department', selectedDepartments);
      }

      const { data: profilesData, error: profilesError } = await profileQuery;
      if (profilesError) throw profilesError;

      // Fetch KPI values for selected profiles
      const profileIds = profilesData?.map((p: any) => p.id) || [];
      if (profileIds.length === 0) {
        setProfileProgress([]);
        return;
      }

      const metricIds = metrics.map((m: any) => m.id);
      let valuesData: any[] = [];
      if (metricIds.length > 0) {
        const { data: valuesResult, error: valuesError } = await supabase
          .from('kpi_values')
          .select('profile_id, kpi_id, value, period_end')
          .in('profile_id', profileIds)
          .in('kpi_id', metricIds);

        if (valuesError) throw valuesError;
        valuesData = valuesResult || [];
      }

      const latestPeriodEnd = valuesData.reduce<string | null>((acc, curr: any) => {
        if (!curr?.period_end) return acc;
        if (!acc || curr.period_end > acc) return curr.period_end;
        return acc;
      }, null);

      const latestValues = latestPeriodEnd
        ? valuesData.filter((v: any) => v.period_end === latestPeriodEnd)
        : [];

      const latestValueMap = new Map<string, number>();
      latestValues.forEach((v: any) => {
        const key = `${v.profile_id}|${v.kpi_id}`;
        latestValueMap.set(key, (latestValueMap.get(key) || 0) + Number(v.value || 0));
      });

      const sortedAchievements = (achievementsData || []).slice().sort((a: any, b: any) => {
        const diffRank = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
        if (diffRank !== 0) return diffRank;
        return (a.points || 0) - (b.points || 0);
      });

      const mappedKeys = SKILLSET_KPI_MAP[skillsetName?.toLowerCase?.() || ''] || [];
      const availableMappedKeys = mappedKeys.filter(key => metricsByKey.has(key));
      const kpiKeys = availableMappedKeys.length > 0 ? availableMappedKeys : scorecardMetricKeys;

      // Format KPI names: convert snake_case to Title Case
      const formatKpiName = (name: string) => {
        return name
          .replace(/_/g, ' ')
          .replace(/\b\w/g, (c) => c.toUpperCase());
      };

      const labelList = kpiKeys
        .map((key: any) => {
          const dbName = metricsByKey.get(key)?.name;
          // If database has a proper name, use it; otherwise format the key
          return dbName || formatKpiName(key);
        })
        .filter(Boolean);
      setKpiSummary(labelList.length > 0 ? `KPIs: ${labelList.join(', ')}` : '');
      setKpiList(labelList);

      // Fetch actual earned achievements from profile_achievements (CUMULATIVE)
      const { data: earnedAchievementsData, error: earnedError } = await supabase
        .from('profile_achievements')
        .select('profile_id, achievement_id')
        .in('profile_id', profileIds);

      if (earnedError) throw earnedError;

      // Map profile -> set of earned achievement IDs
      const earnedByProfile = new Map<string, Set<string>>();
      profileIds.forEach((pid: string) => earnedByProfile.set(pid, new Set()));
      (earnedAchievementsData || []).forEach((ea: any) => {
        const achievementSet = earnedByProfile.get(ea.profile_id);
        if (achievementSet) {
          achievementSet.add(ea.achievement_id);
        }
      });

      // Fetch profile_skillsets for progress data
      const { data: profileSkillsetsData, error: psError } = await supabase
        .from('profile_skillsets')
        .select('profile_id, progress, achievements_completed, total_points_earned')
        .eq('skillset_id', skillsetId)
        .in('profile_id', profileIds);

      if (psError) throw psError;

      const profileSkillsetMap = new Map<string, any>();
      (profileSkillsetsData || []).forEach((ps: any) => {
        profileSkillsetMap.set(ps.profile_id, ps);
      });

      const progress: ProfileProgress[] = (profilesData || []).map((profile: any) => {
        const ps = profileSkillsetMap.get(profile.id);
        const completedAchievements = earnedByProfile.get(profile.id) || new Set();
        const progressValue = ps?.progress || 0;
        const achievementsCompleted = ps?.achievements_completed || 0;

        return {
          profile_id: profile.id,
          profile_name: `${profile.first_name} ${profile.last_name}`,
          progress: Math.round(progressValue),
          achievements_completed: achievementsCompleted,
          level: getSkillsetLevel(progressValue),
          completedAchievements,
        };
      });

      setProfileProgress(progress);
    } catch (err: any) {
      console.error('Error fetching skillset details:', err);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  const difficultyColors: { [key: string]: string } = {
    easy: 'bg-green-100 text-green-700',
    medium: 'bg-yellow-100 text-yellow-700',
    hard: 'bg-orange-100 text-orange-700',
    expert: 'bg-red-100 text-red-700',
  };

  const avgProgress = profileProgress.length > 0
    ? Math.round(profileProgress.reduce((sum, p) => sum + p.progress, 0) / profileProgress.length)
    : 0;

  const normalizedHighlight = highlightAchievementName?.toLowerCase?.() || '';

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: skillsetColor + '20' }}>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: skillsetColor }}>{skillsetName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-gray-600">Detailed progress and achievements</span>
              {kpiList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {kpiList.map(kpi => (
                    <span
                      key={kpi}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/80 text-gray-700 border border-gray-200"
                    >
                      {kpi}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 text-2xl font-bold"
          >
            ×
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="text-center py-8">Loading details...</div>
          ) : (
            <div className="space-y-4">
              {highlightAchievementName && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-sm text-blue-800">
                  Suggested next achievement: <span className="font-semibold">{highlightAchievementName}</span>
                </div>
              )}
              
              {/* Overall Progress Section */}
              <div className="bg-gray-50 rounded-lg p-4">
                <h3 className="font-semibold mb-3">{audienceLabel} Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: skillsetColor }}>{avgProgress}%</div>
                    <div className="text-xs text-gray-600">Average Progress</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{profileProgress.length}</div>
                    <div className="text-xs text-gray-600">Members</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-gray-900">{achievements.length}</div>
                    <div className="text-xs text-gray-600">Total Achievements</div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-gray-200">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'achievements'
                        ? 'border-current text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    style={activeTab === 'achievements' ? { borderColor: skillsetColor, color: skillsetColor } : {}}
                  >
                    Achievements ({achievements.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'members'
                        ? 'border-current text-gray-900'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                    style={activeTab === 'members' ? { borderColor: skillsetColor, color: skillsetColor } : {}}
                  >
                    Member Progress ({profileProgress.length})
                  </button>
                </div>
              </div>

              {/* Tab Content */}
              {activeTab === 'achievements' && (
                <div>
                  <div className="space-y-3">
                    {achievements.map(achievement => {
                      const completedCount = profileProgress.filter(p => p.completedAchievements.has(achievement.id)).length;
                      const totalProfiles = profileProgress.length;
                      const isCompleted = totalProfiles > 0 && completedCount === totalProfiles;
                      const isHighlighted = normalizedHighlight && achievement.name?.toLowerCase?.() === normalizedHighlight;
                      return (
                      <div
                        key={achievement.id}
                        className={`border rounded-lg p-4 transition-shadow ${isCompleted ? 'bg-green-50 border-green-200 shadow-sm' : 'hover:shadow-md'} ${isHighlighted ? 'ring-2 ring-blue-400 bg-blue-50 border-blue-200' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-gray-900">{achievement.name}</h4>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[achievement.difficulty] || 'bg-gray-100 text-gray-700'}`}>
                                {achievement.difficulty}
                              </span>
                              {isHighlighted && (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-600 text-white">Suggested</span>
                              )}
                              {isCompleted && (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600 text-white">Completed</span>
                              )}
                            </div>
                            <p className="text-sm text-gray-600">{achievement.description}</p>
                            {achievement.kpi_requirement && (
                              <div className="mt-2 text-xs text-gray-500">
                                Requirement: {achievement.kpi_requirement} {achievement.threshold ? `≥ ${achievement.threshold}` : ''}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-right flex-shrink-0">
                            <div className="text-2xl font-bold" style={{ color: skillsetColor }}>{achievement.points}</div>
                            <div className="text-xs text-gray-500">points</div>
                          </div>
                        </div>
                        {/* Show which team members completed this */}
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-gray-500 mb-1">Completed by {totalProfiles > 0 ? `${completedCount}/${totalProfiles}` : '0'} member{totalProfiles !== 1 ? 's' : ''}:</div>
                          <div className="flex flex-wrap gap-1">
                            {profileProgress
                              .filter(p => p.completedAchievements.has(achievement.id))
                              .map(p => (
                                <span key={p.profile_id} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  {p.profile_name}
                                </span>
                              ))}
                            {completedCount === 0 && (
                              <span className="text-xs text-gray-400 italic">None yet</span>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              )}

              {activeTab === 'members' && (
                <div>
                  <div className="space-y-2">
                    {profileProgress.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">No member data available</div>
                    ) : (
                      profileProgress.map(profile => (
                        <div key={profile.profile_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-medium text-gray-900">{profile.profile_name}</div>
                              <div className="text-xs text-gray-500">{profile.level}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg" style={{ color: skillsetColor }}>{profile.progress}%</div>
                              <div className="text-xs text-gray-500">{profile.achievements_completed} achievements</div>
                            </div>
                          </div>
                          <div className="w-full bg-gray-200 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${profile.progress}%`, backgroundColor: skillsetColor }}></div>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="bg-gray-50 px-6 py-4 flex justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
