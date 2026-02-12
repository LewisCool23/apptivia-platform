import { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../AuthContext';

/**
 * Custom hook for managing page filters with role-based defaults
 * Reduces duplication across Scorecard, Coach, Analytics pages
 */
export function usePageFilters() {
  const { user, profile, role } = useAuth();
  const userId = user?.id ? String(user.id) : null;
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  
  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const isCoach = role === 'coach';
  const isPowerUser = role === 'power_user';

  const defaultFilters = useMemo(() => {
    if (isAdmin) {
      return {
        dateRange: 'All Time',
        departments: [],
        teams: [],
        members: [],
      };
    }
    if (isManager || isCoach) {
      return {
        dateRange: 'This Week',
        departments: [],
        teams: teamId ? [teamId] : [],
        members: [],
      };
    }
    if (isPowerUser) {
      return {
        dateRange: 'This Week',
        departments: [],
        teams: [],
        members: userId ? [userId] : [],
      };
    }
    return {
      dateRange: 'This Week',
      departments: [],
      teams: [],
      members: [],
    };
  }, [isAdmin, isManager, isCoach, isPowerUser, teamId, userId]);

  const [filters, setFilters] = useState(defaultFilters);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [filtersResetSignal, setFiltersResetSignal] = useState(0);

  // Initialize filters when component mounts
  useEffect(() => {
    if (filtersInitialized) return;
    if (!userId) return;
    setFilters(defaultFilters);
    setFiltersInitialized(true);
  }, [defaultFilters, filtersInitialized, userId]);

  // Force team filter for managers/coaches
  useEffect(() => {
    if (!filtersInitialized) return;
    if (!(isManager || isCoach)) return;
    if (!teamId) return;
    if (filters.teams.length > 0 && filters.teams.includes(teamId)) return;
    setFilters(prev => ({
      ...prev,
      teams: [teamId],
    }));
  }, [filtersInitialized, isManager, isCoach, teamId, filters.teams]);

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handleResetFilters = () => {
    setFilters(defaultFilters);
    setFiltersResetSignal(prev => prev + 1);
  };

  return {
    filters,
    setFilters,
    handleFiltersChange,
    handleResetFilters,
    filtersResetSignal,
    defaultFilters,
    restrictToTeams: (isManager || isCoach) && teamId ? [teamId] : undefined,
  };
}
