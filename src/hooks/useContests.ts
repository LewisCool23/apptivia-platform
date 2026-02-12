import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

export interface ContestLeaderboardEntry {
  rank: number;
  previous_rank: number | null;
  score: number;
  profile_id: string;
  profile_name: string;
  profile_email?: string | null;
  team_name: string | null;
  rank_change: 'up' | 'down' | 'same' | 'new';
}

export interface Contest {
  id: string;
  name: string;
  description: string;
  kpi_key: string;
  calculation_type: string;
  status: 'active' | 'upcoming' | 'completed' | 'cancelled' | 'archived';
  start_date: string;
  end_date: string;
  reward_type: string | null;
  reward_value: string | null;
  reward_description: string | null;
  participant_type: string;
  winner_name: string | null;
  winner_score: number | null;
  participant_count: number;
  leaderboard: ContestLeaderboardEntry[];
  is_user_enrolled: boolean;
  user_rank: number | null;
  user_score: number | null;
  days_remaining: number | null;
  created_by: string | null;
}

export interface ContestsData {
  active: Contest[];
  upcoming: Contest[];
  completed: Contest[];
  archived: Contest[];
  user_badges: Badge[];
}

export interface Badge {
  id: string;
  badge_type: string;
  badge_name: string;
  badge_description: string | null;
  icon: string | null;
  color: string | null;
  earned_at: string;
  is_featured: boolean;
  contest_name: string | null;
}

export function useContests(currentUserId?: string) {
  const [data, setData] = useState<ContestsData>({
    active: [],
    upcoming: [],
    completed: [],
    archived: [],
    user_badges: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [kpiNameByKey, setKpiNameByKey] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchContests();
  }, [currentUserId]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all contests with participant counts
      const { data: contests, error: contestsError } = await supabase
        .from('active_contests')
        .select(`
          *,
          winner:profiles!active_contests_winner_id_fkey(first_name, last_name, email),
          winner_team:teams!active_contests_winner_team_id_fkey(name)
        `)
        .order('start_date', { ascending: false });

      if (contestsError) throw contestsError;

      // Fetch leaderboards for all contests
      const { data: leaderboards, error: leaderboardError } = await supabase
        .from('contest_leaderboards')
        .select(`
          *,
          profile:profiles(first_name, last_name, email),
          team:teams(name)
        `)
        .order('rank', { ascending: true });
      const { data: kpiMetrics, error: kpiError } = await supabase
        .from('kpi_metrics')
        .select('key, name');

      if (kpiError) throw kpiError;

      const kpiMap = (kpiMetrics || []).reduce((acc: Record<string, string>, metric: any) => {
        acc[metric.key] = metric.name || metric.key;
        return acc;
      }, {} as Record<string, string>);
      setKpiNameByKey(kpiMap);


      if (leaderboardError) throw leaderboardError;

      // Fetch participant counts
      const { data: participantCounts, error: participantError } = await supabase
        .from('contest_participants')
        .select('contest_id, is_active')
        .eq('is_active', true);

      if (participantError) throw participantError;

      // Group participant counts by contest
      const countsByContest = participantCounts.reduce((acc: Record<string, number>, p: any) => {
        acc[p.contest_id] = (acc[p.contest_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Fetch user enrollment status if user ID provided
      let userEnrollments: Record<string, boolean> = {};
      if (currentUserId) {
        const { data: enrollments, error: enrollError } = await supabase
          .from('contest_participants')
          .select('contest_id, is_active')
          .eq('profile_id', currentUserId);

        if (!enrollError && enrollments) {
          userEnrollments = enrollments.reduce((acc: Record<string, boolean>, e: any) => {
            acc[e.contest_id] = e.is_active;
            return acc;
          }, {} as Record<string, boolean>);
        }
      }

      // Group leaderboards by contest
      const getProfileDisplayName = (profile: any) => {
        const first = String(profile?.first_name || '').trim();
        const last = String(profile?.last_name || '').trim();
        const name = `${first} ${last}`.trim();
        return name || profile?.email || 'Unknown';
      };

      const leaderboardsByContest = leaderboards.reduce((acc: Record<string, ContestLeaderboardEntry[]>, entry: any) => {
        if (!acc[entry.contest_id]) acc[entry.contest_id] = [];
        
        const rankChange = 
          entry.previous_rank === null ? 'new' :
          entry.rank < entry.previous_rank ? 'up' :
          entry.rank > entry.previous_rank ? 'down' :
          'same';

        acc[entry.contest_id].push({
          rank: entry.rank,
          previous_rank: entry.previous_rank,
          score: entry.score,
          profile_id: entry.profile_id,
          profile_name: getProfileDisplayName(entry.profile),
          profile_email: entry.profile?.email || null,
          team_name: entry.team?.name || null,
          rank_change: rankChange as 'up' | 'down' | 'same' | 'new',
        });
        return acc;
      }, {} as Record<string, ContestLeaderboardEntry[]>);

      // Calculate days remaining and format contests
      const now = new Date();
      const staleActiveIds: string[] = [];
      const formattedContests: Contest[] = contests.map((contest: any) => {
        const endDate = new Date(contest.end_date);
        const startDate = new Date(contest.start_date);
        const isTerminalStatus = ['completed', 'cancelled', 'archived'].includes(contest.status);
        const computedStatus = isTerminalStatus
          ? contest.status
          : endDate.getTime() < now.getTime()
          ? 'completed'
          : startDate.getTime() > now.getTime()
          ? 'upcoming'
          : 'active';

        if (!isTerminalStatus && computedStatus === 'completed') {
          staleActiveIds.push(contest.id);
        }

        const daysRemaining = computedStatus === 'active'
          ? Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : computedStatus === 'upcoming'
          ? Math.max(0, Math.ceil((startDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
          : null;

        const contestLeaderboard = leaderboardsByContest[contest.id] || [];
        const userEntry = currentUserId 
          ? contestLeaderboard.find((e: ContestLeaderboardEntry) => e.profile_id === currentUserId)
          : null;

        const winner = contestLeaderboard[0];
        const winnerDisplayName = contest.winner
          ? getProfileDisplayName(contest.winner)
          : winner?.profile_name || null;

        return {
          id: contest.id,
          name: contest.name,
          description: contest.description,
          kpi_key: contest.kpi_key,
          calculation_type: contest.calculation_type,
          status: computedStatus as Contest['status'],
          start_date: contest.start_date,
          end_date: contest.end_date,
          reward_type: contest.reward_type,
          reward_value: contest.reward_value,
          reward_description: contest.reward_description,
          participant_type: contest.participant_type,
          winner_name: ['completed', 'archived'].includes(computedStatus)
            ? winnerDisplayName
            : (winner?.profile_name || null),
          winner_score: winner?.score || null,
          participant_count: countsByContest[contest.id] || 0,
          leaderboard: contestLeaderboard,
          is_user_enrolled: userEnrollments[contest.id] || false,
          user_rank: userEntry?.rank || null,
          user_score: userEntry?.score || null,
          days_remaining: daysRemaining,
          created_by: contest.created_by,
        };
      });

      if (staleActiveIds.length > 0) {
        await supabase
          .from('active_contests')
          .update({ status: 'completed', updated_at: new Date().toISOString() })
          .in('id', staleActiveIds);
      }

      // Fetch user badges if user ID provided
      let userBadges: Badge[] = [];
      if (currentUserId) {
        const { data: badges, error: badgesError } = await supabase
          .from('profile_badges')
          .select(`
            *,
            contest:active_contests(name)
          `)
          .eq('profile_id', currentUserId)
          .order('earned_at', { ascending: false });

        if (!badgesError && badges) {
          userBadges = badges.map((badge: any) => ({
            id: badge.id,
            badge_type: badge.badge_type,
            badge_name: badge.badge_name,
            badge_description: badge.badge_description,
            icon: badge.icon,
            color: badge.color,
            earned_at: badge.earned_at,
            is_featured: badge.is_featured,
            contest_name: badge.contest?.name || null,
          }));
        }
      }

      // Separate by status
      setData({
        active: formattedContests.filter(c => c.status === 'active'),
        upcoming: formattedContests.filter(c => c.status === 'upcoming'),
        completed: formattedContests.filter(c => c.status === 'completed'),
        archived: formattedContests.filter(c => c.status === 'archived'),
        user_badges: userBadges,
      });
    } catch (err) {
      console.error('Error fetching contests:', err);
      setError(err instanceof Error ? err.message : 'Failed to load contests');
    } finally {
      setLoading(false);
    }
  };

  const enrollInContest = async (contestId: string, profileId: string) => {
    try {
      const { data: profile } = await supabase
        .from('profiles')
        .select('team_id')
        .eq('id', profileId)
        .single();

      // Check if participant row already exists
      const { data: existing } = await supabase
        .from('contest_participants')
        .select('id, is_active')
        .eq('contest_id', contestId)
        .eq('profile_id', profileId)
        .maybeSingle();

      if (existing) {
        // Row exists – just reactivate
        const { error } = await supabase
          .from('contest_participants')
          .update({ is_active: true, team_id: profile?.team_id })
          .eq('id', existing.id);
        if (error) throw error;
      } else {
        // Insert new row
        const { error } = await supabase
          .from('contest_participants')
          .insert({
            contest_id: contestId,
            profile_id: profileId,
            team_id: profile?.team_id,
            is_active: true,
          });
        if (error) throw error;
      }
      
      // Refresh contests
      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error enrolling in contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to enroll' };
    }
  };

  const withdrawFromContest = async (contestId: string, profileId: string) => {
    try {
      const { error } = await supabase
        .from('contest_participants')
        .update({ is_active: false })
        .eq('contest_id', contestId)
        .eq('profile_id', profileId);

      if (error) throw error;
      
      // Refresh contests
      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error withdrawing from contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to withdraw' };
    }
  };

  const deleteContest = async (contestId: string, userId: string) => {
    try {
      // First check if user has permission (is admin or creator)
      const { data: contest, error: fetchError } = await supabase
        .from('active_contests')
        .select('created_by, name')
        .eq('id', contestId)
        .single();

      if (fetchError) throw fetchError;

      // Get user role
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .single();

      if (profileError) throw profileError;

      // Check permissions
      const isAdmin = profile?.role === 'admin';
      const isCreator = contest?.created_by === userId;

      if (!isAdmin && !isCreator) {
        return { 
          success: false, 
          error: 'You do not have permission to delete this contest. Only administrators and the contest creator can delete contests.' 
        };
      }

      // Delete the contest (CASCADE will handle related records)
      const { error: deleteError } = await supabase
        .from('active_contests')
        .delete()
        .eq('id', contestId);

      if (deleteError) throw deleteError;
      
      // Refresh contests
      await fetchContests();
      return { success: true, message: `Successfully deleted contest: ${contest.name}` };
    } catch (err) {
      console.error('Error deleting contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to delete contest' };
    }
  };

  const endContest = async (contestId: string) => {
    try {
      const { error } = await supabase
        .from('active_contests')
        .update({
          status: 'completed',
          end_date: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', contestId);

      if (error) throw error;

      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error ending contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to end contest' };
    }
  };

  const archiveContest = async (contestId: string) => {
    try {
      const { error } = await supabase
        .from('active_contests')
        .update({
          status: 'archived',
          updated_at: new Date().toISOString(),
        })
        .eq('id', contestId);

      if (error) throw error;

      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error archiving contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to archive contest' };
    }
  };

  return {
    data,
    loading,
    error,
    kpiNameByKey,
    refetch: fetchContests,
    enrollInContest,
    withdrawFromContest,
    deleteContest,
    endContest,
    archiveContest,
  };
}