/**
 * Contest Leaderboard Utilities
 *
 * Functions to calculate and update contest leaderboards from real-time KPI data.
 * Can be called:
 * - On-demand via UI button
 * - Periodically via scheduled job (e.g., every 15 minutes)
 * - Via webhook when KPI values are updated
 */

import { supabase } from '../supabaseClient';

// ── Shared display helpers (used by Contests.jsx + LeaderboardModal) ──

export function getRankChangeIcon(change: string): string {
  switch (change) {
    case 'up': return '\u2B06\uFE0F';
    case 'down': return '\u2B07\uFE0F';
    case 'new': return '\uD83C\uDD95';
    default: return '';
  }
}

export function getRankDisplay(rank: number): string {
  switch (rank) {
    case 1: return '\uD83E\uDD47';
    case 2: return '\uD83E\uDD48';
    case 3: return '\uD83E\uDD49';
    default: return `#${rank}`;
  }
}

export interface LeaderboardUpdateResult {
  success: boolean;
  contestsUpdated: number;
  participantsUpdated: number;
  error?: string;
}

/**
 * Recalculate leaderboards for all active contests
 */
export async function updateAllContestLeaderboards(): Promise<LeaderboardUpdateResult> {
  try {
    // Call the database function that recalculates leaderboards
    const { error } = await supabase.rpc('update_contest_leaderboards');
    
    if (error) throw error;

    // Get counts of what was updated
    const { data: activeContests } = await supabase
      .from('active_contests')
      .select('id')
      .eq('status', 'active');

    const { data: leaderboards } = await supabase
      .from('contest_leaderboards')
      .select('id');

    return {
      success: true,
      contestsUpdated: activeContests?.length || 0,
      participantsUpdated: leaderboards?.length || 0,
    };
  } catch (err) {
    console.error('Error updating contest leaderboards:', err);
    return {
      success: false,
      contestsUpdated: 0,
      participantsUpdated: 0,
      error: err instanceof Error ? err.message : 'Failed to update leaderboards',
    };
  }
}

/**
 * Update leaderboard for a specific contest.
 * Resolves kpi_key → kpi_id via kpi_metrics, batch-fetches KPI values,
 * uses standard competition ranking (ties share rank), and batch-upserts.
 */
export async function updateContestLeaderboard(contestId: string): Promise<LeaderboardUpdateResult> {
  try {
    // Fetch contest details
    const { data: contest, error: contestError } = await supabase
      .from('active_contests')
      .select('id, kpi_key, calculation_type, participant_type, start_date, end_date')
      .eq('id', contestId)
      .single();

    if (contestError) throw contestError;
    if (!contest) throw new Error('Contest not found');

    // Resolve kpi_key → kpi_id (kpi_values uses kpi_id UUID, not kpi_key text)
    const { data: kpiMetric, error: kpiMetricError } = await supabase
      .from('kpi_metrics')
      .select('id')
      .eq('key', contest.kpi_key)
      .single();

    if (kpiMetricError || !kpiMetric) {
      throw new Error(`KPI metric not found for key: ${contest.kpi_key}`);
    }

    // Fetch all active participants
    const { data: participants, error: participantsError } = await supabase
      .from('contest_participants')
      .select('profile_id, team_id')
      .eq('contest_id', contestId)
      .eq('is_active', true);

    if (participantsError) throw participantsError;
    if (!participants || participants.length === 0) {
      return { success: true, contestsUpdated: 1, participantsUpdated: 0 };
    }

    // Batch-fetch KPI values for all participants at once (fixes N+1 query)
    const participantIds = participants.map((p: any) => p.profile_id);
    const { data: allKpiValues, error: kpiError } = await supabase
      .from('kpi_values')
      .select('profile_id, value')
      .in('profile_id', participantIds)
      .eq('kpi_id', kpiMetric.id)
      .lte('period_start', contest.end_date)
      .gte('period_end', contest.start_date);

    if (kpiError) {
      console.error('Error fetching KPI values:', kpiError);
    }

    // Group values by profile_id
    const kpiByProfile: Record<string, number[]> = {};
    for (const kv of (allKpiValues || [])) {
      if (!kpiByProfile[kv.profile_id]) kpiByProfile[kv.profile_id] = [];
      kpiByProfile[kv.profile_id].push(Number(kv.value));
    }

    // Calculate scores for each participant
    const individualScores = participants.map((participant: any) => {
      const values = kpiByProfile[participant.profile_id] || [];
      let score = 0;

      switch (contest.calculation_type) {
        case 'sum':
          score = values.reduce((sum, val) => sum + val, 0);
          break;
        case 'average':
          score = values.length > 0 ? values.reduce((sum, val) => sum + val, 0) / values.length : 0;
          break;
        case 'max':
          score = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'count':
          score = values.length;
          break;
        default:
          score = values.reduce((sum, val) => sum + val, 0);
      }

      return {
        profile_id: participant.profile_id,
        team_id: participant.team_id,
        score: Math.round(score * 100) / 100,
      };
    });

    // Team aggregation: if participant_type is 'team', sum scores by team
    let scores: typeof individualScores;
    if (contest.participant_type === 'team') {
      const teamMap: Record<string, { team_id: string; profile_id: string; score: number }> = {};
      for (const entry of individualScores) {
        const teamKey = entry.team_id || entry.profile_id;
        if (!teamMap[teamKey]) {
          teamMap[teamKey] = { team_id: entry.team_id, profile_id: entry.profile_id, score: 0 };
        } else if (entry.profile_id < teamMap[teamKey].profile_id) {
          // Deterministic: pick smallest profile_id as team representative
          teamMap[teamKey].profile_id = entry.profile_id;
        }
        teamMap[teamKey].score += entry.score;
      }
      scores = Object.values(teamMap);
    } else {
      scores = individualScores;
    }

    // Sort by score descending and assign ranks (standard competition ranking — ties share rank)
    // F7: deterministic tiebreaker — earliest created_at wins ties
    scores.sort((a: any, b: any) => {
      const diff = b.score - a.score;
      if (diff !== 0) return diff;
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });
    let currentRank = 1;
    const rankedScores = scores.map((entry: any, index: number, arr: any[]) => {
      if (index > 0 && entry.score < arr[index - 1].score) {
        currentRank = index + 1;
      }
      return { ...entry, rank: currentRank };
    });

    // Fetch existing ranks for previous_rank tracking
    const { data: existingLeaderboard } = await supabase
      .from('contest_leaderboards')
      .select('profile_id, rank')
      .eq('contest_id', contestId);
    const prevRankMap: Record<string, number> = {};
    (existingLeaderboard || []).forEach((row: any) => {
      prevRankMap[row.profile_id] = row.rank;
    });

    // Batch upsert all leaderboard entries at once
    const upsertData = rankedScores.map((entry: any) => ({
      contest_id: contestId,
      profile_id: entry.profile_id,
      team_id: entry.team_id,
      rank: entry.rank,
      previous_rank: prevRankMap[entry.profile_id] ?? null,
      score: entry.score,
      last_updated: new Date().toISOString(),
    }));

    if (upsertData.length > 0) {
      const { error: upsertError } = await supabase
        .from('contest_leaderboards')
        .upsert(upsertData, { onConflict: 'contest_id,profile_id' });

      if (upsertError) {
        console.error('Error batch updating leaderboard:', upsertError);
      }
    }

    return {
      success: true,
      contestsUpdated: 1,
      participantsUpdated: rankedScores.length,
    };
  } catch (err) {
    console.error('Error updating contest leaderboard:', err);
    return {
      success: false,
      contestsUpdated: 0,
      participantsUpdated: 0,
      error: err instanceof Error ? err.message : 'Failed to update leaderboard',
    };
  }
}

/**
 * Complete a contest and award badges to winners
 */
export async function completeContest(contestId: string): Promise<{ success: boolean; error?: string }> {
  try {
    // Update contest status
    const { error: updateError } = await supabase
      .from('active_contests')
      .update({ status: 'completed' })
      .eq('id', contestId);

    if (updateError) throw updateError;

    // Get top 3 finishers
    const { data: topFinishers, error: leaderboardError } = await supabase
      .from('contest_leaderboards')
      .select(`
        profile_id,
        rank,
        score
      `)
      .eq('contest_id', contestId)
      .lte('rank', 3)
      .order('rank');

    if (leaderboardError) throw leaderboardError;

    // Get contest details for badge description
    const { data: contest } = await supabase
      .from('active_contests')
      .select('name, reward_value, organization_id')
      .eq('id', contestId)
      .single();

    // Award badges to top 3
    if (topFinishers && topFinishers.length > 0) {
      const badges = topFinishers.map((finisher: any) => ({
        profile_id: finisher.profile_id,
        badge_type: 'contest_winner',
        badge_name:
          finisher.rank === 1
            ? '🥇 1st Place'
            : finisher.rank === 2
            ? '🥈 2nd Place'
            : '🥉 3rd Place',
        badge_description: `${contest?.name || 'Contest'} - ${contest?.reward_value || 'Winner'}`,
        icon: finisher.rank === 1 ? '🥇' : finisher.rank === 2 ? '🥈' : '🥉',
        color: finisher.rank === 1 ? '#FFD700' : finisher.rank === 2 ? '#C0C0C0' : '#CD7F32',
        contest_id: contestId,
        is_featured: finisher.rank === 1, // Feature 1st place
        organization_id: contest?.organization_id,
      }));

      const { error: badgesError } = await supabase
        .from('profile_badges')
        .upsert(badges, { onConflict: 'profile_id,badge_name', ignoreDuplicates: true });

      if (badgesError) {
        console.error('Error awarding badges:', badgesError);
      }
    }

    // Update winner_id in active_contests
    if (topFinishers && topFinishers.length > 0) {
      const { error: winnerError } = await supabase
        .from('active_contests')
        .update({ winner_id: topFinishers[0].profile_id })
        .eq('id', contestId);

      if (winnerError) {
        console.error('Error setting winner:', winnerError);
      }
    }

    return { success: true };
  } catch (err) {
    console.error('Error completing contest:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to complete contest',
    };
  }
}

/**
 * Award achievement-based badges
 */
export async function awardAchievementBadge(
  profileId: string,
  achievementId: string,
  achievementName: string,
  skillsetName: string,
  organizationId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profile_badges').upsert({
      profile_id: profileId,
      badge_type: 'achievement',
      badge_name: achievementName,
      badge_description: `Completed in ${skillsetName}`,
      icon: '⭐',
      color: '#3B82F6',
      achievement_id: achievementId,
      is_featured: false,
      ...(organizationId && { organization_id: organizationId }),
    }, { onConflict: 'profile_id,badge_name', ignoreDuplicates: true });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error awarding achievement badge:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to award badge',
    };
  }
}

/**
 * Award milestone badges (e.g., day streaks, level achievements)
 */
export async function awardMilestoneBadge(
  profileId: string,
  milestoneName: string,
  description: string,
  icon: string = '🎖️',
  color: string = '#8B5CF6',
  organizationId?: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profile_badges').upsert({
      profile_id: profileId,
      badge_type: 'milestone',
      badge_name: milestoneName,
      badge_description: description,
      icon,
      color,
      is_featured: false,
      ...(organizationId && { organization_id: organizationId }),
    }, { onConflict: 'profile_id,badge_name', ignoreDuplicates: true });

    if (error) throw error;
    return { success: true };
  } catch (err) {
    console.error('Error awarding milestone badge:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to award badge',
    };
  }
}
