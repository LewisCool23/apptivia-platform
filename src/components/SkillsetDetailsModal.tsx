import React, { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { SKILLSET_KPI_MAP, difficultyRank, getSkillsetLevel, getSkillsetColor } from '../constants/skillsets';

interface SkillsetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  skillsetId: string;
  skillsetName: string;
  skillsetColor: string;
  organizationId?: string;
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

// SKILLSET_KPI_MAP, difficultyRank, and getSkillsetLevel imported from '../constants/skillsets'

export default function SkillsetDetailsModal({
  isOpen,
  onClose,
  skillsetId,
  skillsetName,
  skillsetColor,
  organizationId,
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

  // Ensure we have a valid color (fallback if DB color is null)
  const resolvedColor = getSkillsetColor(skillsetName, skillsetColor);

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
      // Phase 1: Three independent queries in parallel
      let profileQuery = supabase
        .from('profiles')
        .select('id, first_name, last_name')
        .not('role', 'in', '("admin","manager","coach")');

      // Org-scope: always filter by organization
      if (organizationId) {
        profileQuery = profileQuery.eq('organization_id', organizationId);
      }
      if (selectedMembers.length > 0) {
        profileQuery = profileQuery.in('id', selectedMembers);
      }
      if (selectedTeams.length > 0) {
        profileQuery = profileQuery.in('team_id', selectedTeams);
      }
      if (selectedDepartments.length > 0) {
        profileQuery = profileQuery.in('department', selectedDepartments);
      }

      let achievementsQuery = supabase
        .from('achievements')
        .select('*')
        .eq('skillset_id', skillsetId)
        .order('points', { ascending: true });
      // Achievements are global structural definitions (org_id = NULL after migration 157)

      const [achievementsRes, metricsRes, profilesRes] = await Promise.all([
        achievementsQuery,
        supabase
          .from('kpi_metrics')
          .select('id, key, goal, weight, show_on_scorecard')
          .eq('is_active', true),
        profileQuery,
      ]);

      if (achievementsRes.error) throw achievementsRes.error;
      if (metricsRes.error) throw metricsRes.error;
      if (profilesRes.error) throw profilesRes.error;

      // Sort achievements by difficulty then points (consistent with useCoachData)
      const sortedAchievements = (achievementsRes.data || []).slice().sort((a: any, b: any) => {
        const diffRank = difficultyRank(a.difficulty) - difficultyRank(b.difficulty);
        if (diffRank !== 0) return diffRank;
        return (a.points || 0) - (b.points || 0);
      });
      setAchievements(sortedAchievements);

      const metrics = (metricsRes.data || []).map((m: any) => ({
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

      const profileIds = profilesRes.data?.map((p: any) => p.id) || [];
      if (profileIds.length === 0) {
        setProfileProgress([]);
        return;
      }

      // Phase 2: Two independent queries in parallel (both need profileIds)
      const metricIds = metrics.map((m: any) => m.id);
      const [valuesRes, earnedRes] = await Promise.all([
        metricIds.length > 0
          ? supabase
              .from('kpi_values')
              .select('profile_id, kpi_id, value, period_end')
              .in('profile_id', profileIds)
              .in('kpi_id', metricIds)
          : Promise.resolve({ data: [] as any[], error: null }),
        supabase
          .from('profile_achievements')
          .select('profile_id, achievement_id')
          .in('profile_id', profileIds),
      ]);

      if (valuesRes.error) throw valuesRes.error;
      if (earnedRes.error) throw earnedRes.error;

      const valuesData = valuesRes.data || [];

      const latestPeriodEnd = valuesData.reduce((acc: string | null, curr: any) => {
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

      const earnedAchievementsData = earnedRes.data;

      // Map profile -> set of earned achievement IDs
      const earnedByProfile = new Map<string, Set<string>>();
      profileIds.forEach((pid: string) => earnedByProfile.set(pid, new Set()));
      (earnedAchievementsData || []).forEach((ea: any) => {
        const achievementSet = earnedByProfile.get(ea.profile_id);
        if (achievementSet) {
          achievementSet.add(ea.achievement_id);
        }
      });

      // Compute progress from actual earned achievements (source of truth)
      // instead of relying on potentially stale profile_skillsets
      const skillsetAchievementIds = new Set(sortedAchievements.map((a: any) => a.id));
      const totalSkillsetPoints = sortedAchievements.reduce((sum: number, a: any) => sum + (a.points || 0), 0);

      const progress: ProfileProgress[] = (profilesRes.data || []).map((profile: any) => {
        const allEarned = earnedByProfile.get(profile.id) || new Set();
        // Filter to only achievements in this skillset
        const earnedInSkillset = new Set<string>();
        allEarned.forEach((achId: string) => {
          if (skillsetAchievementIds.has(achId)) earnedInSkillset.add(achId);
        });

        const earnedPoints = sortedAchievements
          .filter((a: any) => earnedInSkillset.has(a.id))
          .reduce((sum: number, a: any) => sum + (a.points || 0), 0);

        const progressValue = totalSkillsetPoints > 0
          ? Math.min(100, Math.round((earnedPoints / totalSkillsetPoints) * 100))
          : 0;

        return {
          profile_id: profile.id,
          profile_name: `${profile.first_name} ${profile.last_name}`,
          progress: progressValue,
          achievements_completed: earnedInSkillset.size,
          level: getSkillsetLevel(progressValue),
          completedAchievements: allEarned,
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
        className="bg-white rounded-lg shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b flex items-center justify-between" style={{ backgroundColor: resolvedColor + '20' }}>
          <div>
            <h2 className="text-2xl font-bold" style={{ color: resolvedColor }}>{skillsetName}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span className="text-sm text-apptivia-carbon-600">Detailed progress and achievements</span>
              {kpiList.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {kpiList.map(kpi => (
                    <span
                      key={kpi}
                      className="px-2.5 py-1 rounded-full text-xs font-semibold bg-white/80 text-apptivia-carbon-700 border border-apptivia-carbon-200"
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
            className="text-apptivia-carbon-500 hover:text-apptivia-carbon-700 text-2xl font-bold"
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
                <div className="bg-apptivia-coral-tone-50 border border-apptivia-coral-tone-100 rounded-lg p-4 text-sm text-apptivia-coral-tone-700">
                  Suggested next achievement: <span className="font-semibold">{highlightAchievementName}</span>
                </div>
              )}
              
              {/* Overall Progress Section */}
              <div className="bg-apptivia-paper rounded-lg p-4">
                <h3 className="font-semibold mb-3">{audienceLabel} Overview</h3>
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <div className="text-2xl font-bold" style={{ color: resolvedColor }}>{avgProgress}%</div>
                    <div className="text-xs text-apptivia-carbon-600">Average Progress</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-apptivia-ink">{profileProgress.length}</div>
                    <div className="text-xs text-apptivia-carbon-600">Members</div>
                  </div>
                  <div>
                    <div className="text-2xl font-bold text-apptivia-ink">{achievements.length}</div>
                    <div className="text-xs text-apptivia-carbon-600">Total Achievements</div>
                  </div>
                </div>
              </div>

              {/* Tab Navigation */}
              <div className="border-b border-apptivia-carbon-200">
                <div className="flex gap-4">
                  <button
                    onClick={() => setActiveTab('achievements')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'achievements'
                        ? 'border-current text-apptivia-ink'
                        : 'border-transparent text-apptivia-carbon-500 hover:text-apptivia-carbon-700'
                    }`}
                    style={activeTab === 'achievements' ? { borderColor: resolvedColor, color: resolvedColor } : {}}
                  >
                    Achievements ({achievements.length})
                  </button>
                  <button
                    onClick={() => setActiveTab('members')}
                    className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
                      activeTab === 'members'
                        ? 'border-current text-apptivia-ink'
                        : 'border-transparent text-apptivia-carbon-500 hover:text-apptivia-carbon-700'
                    }`}
                    style={activeTab === 'members' ? { borderColor: resolvedColor, color: resolvedColor } : {}}
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
                        className={`border rounded-lg p-4 transition-shadow ${isCompleted ? 'bg-green-50 border-green-200 shadow-sm' : 'hover:shadow-md'} ${isHighlighted ? 'ring-2 ring-apptivia-coral-tone-300 bg-apptivia-coral-tone-50 border-apptivia-coral-tone-100' : ''}`}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1 flex-wrap">
                              <h4 className="font-semibold text-apptivia-ink">{achievement.name}</h4>
                              <span className={`px-2 py-1 rounded text-xs font-medium ${difficultyColors[achievement.difficulty] || 'bg-apptivia-carbon-100 text-apptivia-carbon-700'}`}>
                                {achievement.difficulty}
                              </span>
                              {isHighlighted && (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-apptivia-coral text-white">Suggested</span>
                              )}
                              {isCompleted && (
                                <span className="px-2 py-1 rounded text-xs font-semibold bg-green-600 text-white">Completed</span>
                              )}
                            </div>
                            <p className="text-sm text-apptivia-carbon-600">{achievement.description}</p>
                            {achievement.kpi_requirement && (
                              <div className="mt-2 text-xs text-apptivia-carbon-500">
                                Requirement: {achievement.kpi_requirement} {achievement.threshold ? `≥ ${achievement.threshold}` : ''}
                              </div>
                            )}
                          </div>
                          <div className="ml-4 text-right flex-shrink-0">
                            <div className="text-2xl font-bold" style={{ color: resolvedColor }}>{achievement.points}</div>
                            <div className="text-xs text-apptivia-carbon-500">points</div>
                          </div>
                        </div>
                        {/* Show which team members completed this */}
                        <div className="mt-2 pt-2 border-t">
                          <div className="text-xs text-apptivia-carbon-500 mb-1">Completed by {totalProfiles > 0 ? `${completedCount}/${totalProfiles}` : '0'} member{totalProfiles !== 1 ? 's' : ''}:</div>
                          <div className="flex flex-wrap gap-1">
                            {profileProgress
                              .filter(p => p.completedAchievements.has(achievement.id))
                              .map(p => (
                                <span key={p.profile_id} className="px-2 py-1 bg-green-100 text-green-700 rounded text-xs font-medium">
                                  {p.profile_name}
                                </span>
                              ))}
                            {completedCount === 0 && (
                              <span className="text-xs text-apptivia-carbon-400 italic">None yet</span>
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
                      <div className="text-center py-8 text-apptivia-carbon-500">No member data available</div>
                    ) : (
                      profileProgress.map(profile => (
                        <div key={profile.profile_id} className="border rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex items-center justify-between mb-2">
                            <div>
                              <div className="font-medium text-apptivia-ink">{profile.profile_name}</div>
                              <div className="text-xs text-apptivia-carbon-500">{profile.level}</div>
                            </div>
                            <div className="text-right">
                              <div className="font-bold text-lg" style={{ color: resolvedColor }}>{profile.progress}%</div>
                              <div className="text-xs text-apptivia-carbon-500">{profile.achievements_completed} achievements</div>
                            </div>
                          </div>
                          <div className="w-full bg-apptivia-carbon-200 rounded-full h-2">
                            <div className="h-2 rounded-full transition-all" style={{ width: `${profile.progress}%`, backgroundColor: resolvedColor }}></div>
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

        <div className="bg-apptivia-paper px-6 py-4 flex justify-end border-t">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-apptivia-carbon-200 text-apptivia-carbon-700 rounded-lg hover:bg-apptivia-carbon-300"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
