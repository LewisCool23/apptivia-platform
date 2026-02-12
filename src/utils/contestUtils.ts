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
 * Update leaderboard for a specific contest
 */
export async function updateContestLeaderboard(contestId: string): Promise<LeaderboardUpdateResult> {
  try {
    // Fetch contest details
    const { data: contest, error: contestError } = await supabase
      .from('active_contests')
      .select('*')
      .eq('id', contestId)
      .single();

    if (contestError) throw contestError;
    if (!contest) throw new Error('Contest not found');

    // Fetch all participants
    const { data: participants, error: participantsError } = await supabase
      .from('contest_participants')
      .select('profile_id, team_id')
      .eq('contest_id', contestId)
      .eq('is_active', true);

    if (participantsError) throw participantsError;

    // Calculate scores for each participant
    const scorePromises = participants.map(async (participant: any) => {
      const { data: kpiValues, error: kpiError } = await supabase
        .from('kpi_values')
        .select('value')
        .eq('profile_id', participant.profile_id)
        .eq('kpi_key', contest.kpi_key)
        .gte('recorded_at', contest.start_date)
        .lte('recorded_at', contest.end_date);

      if (kpiError) {
        console.error(`Error fetching KPI values for ${participant.profile_id}:`, kpiError);
        return { profile_id: participant.profile_id, team_id: participant.team_id, score: 0 };
      }

      let score = 0;
      const values = (kpiValues as any[] | null)?.map((kv: any) => kv.value) || [];

      switch (contest.calculation_type) {
        case 'sum':
          score = values.reduce((sum: number, val: number) => sum + val, 0);
          break;
        case 'average':
          score = values.length > 0 ? values.reduce((sum: number, val: number) => sum + val, 0) / values.length : 0;
          break;
        case 'max':
          score = values.length > 0 ? Math.max(...values) : 0;
          break;
        case 'count':
          score = values.length;
          break;
        default:
          score = values.reduce((sum: number, val: number) => sum + val, 0);
      }

      return {
        profile_id: participant.profile_id,
        team_id: participant.team_id,
        score: Math.round(score * 100) / 100, // Round to 2 decimals
      };
    });

    const scores = await Promise.all(scorePromises);

    // Sort by score descending and assign ranks
    scores.sort((a, b) => b.score - a.score);
    const rankedScores = scores.map((entry, index) => ({
      ...entry,
      rank: index + 1,
    }));

    // Update leaderboard entries
    for (const entry of rankedScores) {
      const { error: upsertError } = await supabase
        .from('contest_leaderboards')
        .upsert(
          {
            contest_id: contestId,
            profile_id: entry.profile_id,
            team_id: entry.team_id,
            rank: entry.rank,
            score: entry.score,
            last_updated: new Date().toISOString(),
          },
          {
            onConflict: 'contest_id,profile_id',
          }
        );

      if (upsertError) {
        console.error(`Error updating leaderboard for ${entry.profile_id}:`, upsertError);
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
      .select('name, reward_value')
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
      }));

      const { error: badgesError } = await supabase
        .from('profile_badges')
        .insert(badges);

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
  skillsetName: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profile_badges').insert({
      profile_id: profileId,
      badge_type: 'achievement',
      badge_name: achievementName,
      badge_description: `Completed in ${skillsetName}`,
      icon: '⭐',
      color: '#3B82F6',
      achievement_id: achievementId,
      is_featured: false,
    });

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
  color: string = '#8B5CF6'
): Promise<{ success: boolean; error?: string }> {
  try {
    const { error } = await supabase.from('profile_badges').insert({
      profile_id: profileId,
      badge_type: 'milestone',
      badge_name: milestoneName,
      badge_description: description,
      icon,
      color,
      is_featured: false,
    });

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
