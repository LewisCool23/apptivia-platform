import { useState, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { updateContestLeaderboard } from '../utils/contestUtils';
import { ROLES } from '../constants/roles';

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

export interface ContestParticipant {
  profile_id: string;
  profile_name: string;
  team_name: string | null;
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
  participants: ContestParticipant[];
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

export function useContests(currentUserId?: string, organizationId?: string) {
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
  // M9 fix: in-flight guard for enrollment/withdrawal operations
  const enrollingRef = useRef(new Set<string>());

  useEffect(() => {
    if (organizationId) fetchContests();
  }, [currentUserId, organizationId]);

  const fetchContests = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch all contests with participant counts (org-scoped)
      let contestsQuery = supabase
        .from('active_contests')
        .select(`
          *,
          winner:profiles!active_contests_winner_id_fkey(first_name, last_name, email),
          winner_team:teams!active_contests_winner_team_id_fkey(name)
        `)
        .order('start_date', { ascending: false })
        .limit(200);
      if (organizationId) contestsQuery = contestsQuery.eq('organization_id', organizationId);
      else { setLoading(false); return; }
      const { data: contests, error: contestsError } = await contestsQuery;

      if (contestsError) throw contestsError;

      // Fetch leaderboards only for non-archived contests (limit scope)
      const contestIds = (contests || []).map((c: any) => c.id);
      const { data: leaderboards, error: leaderboardError } = contestIds.length > 0
        ? await supabase
            .from('contest_leaderboards')
            .select(`
              *,
              profile:profiles(first_name, last_name, email),
              team:teams(name)
            `)
            .in('contest_id', contestIds)
            .order('rank', { ascending: true })
        : { data: [], error: null };
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

      // Helper to format profile display names
      const getProfileDisplayName = (profile: any) => {
        const first = String(profile?.first_name || '').trim();
        const last = String(profile?.last_name || '').trim();
        const name = `${first} ${last}`.trim();
        return name || profile?.email || 'Unknown';
      };

      // Fetch participant counts with profile/team data for fallback display — scoped to org contests
      const { data: participantRows, error: participantError } = contestIds.length > 0
        ? await supabase
            .from('contest_participants')
            .select('contest_id, profile_id, is_active, profile:profiles(first_name, last_name, email), team:teams(name)')
            .eq('is_active', true)
            .in('contest_id', contestIds)
        : { data: [] as any[], error: null };

      if (participantError) throw participantError;

      // Group participant counts by contest
      const countsByContest = participantRows.reduce((acc: Record<string, number>, p: any) => {
        acc[p.contest_id] = (acc[p.contest_id] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      // Group participant details by contest for fallback leaderboard display
      const participantsByContest = participantRows.reduce((acc: Record<string, ContestParticipant[]>, p: any) => {
        if (!acc[p.contest_id]) acc[p.contest_id] = [];
        acc[p.contest_id].push({
          profile_id: p.profile_id,
          profile_name: getProfileDisplayName(p.profile),
          team_name: p.team?.name || null,
        });
        return acc;
      }, {} as Record<string, ContestParticipant[]>);

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

        const daysRemaining = computedStatus === 'active'
          ? Math.max(0, Math.floor((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)))
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
          participants: participantsByContest[contest.id] || [],
          is_user_enrolled: userEnrollments[contest.id] || false,
          user_rank: userEntry?.rank || null,
          user_score: userEntry?.score || null,
          days_remaining: daysRemaining,
          created_by: contest.created_by,
        };
      });

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
    // M9 fix: prevent double-enrollment from rapid clicks
    const key = `enroll:${contestId}:${profileId}`;
    if (enrollingRef.current.has(key)) return { success: false, error: 'Already processing' };
    enrollingRef.current.add(key);
    try {
      // Guard: only allow enrollment in active contests
      const { data: contestData } = await supabase
        .from('active_contests')
        .select('status')
        .eq('id', contestId)
        .single();

      if (!contestData || contestData.status !== 'active') {
        return { success: false, error: 'Can only enroll in active contests' };
      }

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
      
      // Optimistic UI update
      setData(prev => ({
        ...prev,
        active: prev.active.map(c => c.id === contestId
          ? { ...c, is_user_enrolled: true, participant_count: c.participant_count + 1 }
          : c),
      }));

      // Trigger leaderboard recalculation so the new participant appears
      try {
        await updateContestLeaderboard(contestId);
      } catch (e) {
        console.warn('Leaderboard recalculation after enrollment failed:', e);
      }

      // Background sync for full consistency
      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error enrolling in contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to enroll' };
    } finally {
      enrollingRef.current.delete(key);
    }
  };

  const withdrawFromContest = async (contestId: string, profileId: string) => {
    // M9 fix: prevent double-withdrawal from rapid clicks
    const wKey = `withdraw:${contestId}:${profileId}`;
    if (enrollingRef.current.has(wKey)) return { success: false, error: 'Already processing' };
    enrollingRef.current.add(wKey);
    try {
      const { error } = await supabase
        .from('contest_participants')
        .update({ is_active: false })
        .eq('contest_id', contestId)
        .eq('profile_id', profileId);

      if (error) throw error;

      // Optimistic UI update
      setData(prev => ({
        ...prev,
        active: prev.active.map(c => c.id === contestId
          ? { ...c, is_user_enrolled: false, participant_count: Math.max(0, c.participant_count - 1) }
          : c),
      }));

      // Remove withdrawn participant's stale leaderboard entry and recalculate ranks
      try {
        await supabase
          .from('contest_leaderboards')
          .delete()
          .eq('contest_id', contestId)
          .eq('profile_id', profileId);
        await updateContestLeaderboard(contestId);
      } catch (e) {
        console.warn('Leaderboard cleanup after withdrawal failed:', e);
      }

      // Background sync for full consistency
      await fetchContests();
      return { success: true };
    } catch (err) {
      console.error('Error withdrawing from contest:', err);
      return { success: false, error: err instanceof Error ? err.message : 'Failed to withdraw' };
    } finally {
      enrollingRef.current.delete(wKey);
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
      const isAdmin = profile?.role === ROLES.ADMIN;
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