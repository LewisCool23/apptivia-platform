import { useMemo } from 'react';
import { useAuth } from '../AuthContext';
import { ROLES } from '../constants/roles';

export interface RoleFlags {
  isAdmin: boolean;
  isManager: boolean;
  isCoach: boolean;
  isPowerUser: boolean;
  /** admin OR manager */
  isLeadership: boolean;
  /** manager OR coach */
  isTeamLead: boolean;
  /** admin, manager, or coach */
  canViewTeam: boolean;
  /** admin or manager — can create contests, coaching plans, etc. */
  canManage: boolean;
  role: string | null;
}

export function useRoleFlags(): RoleFlags {
  const { role } = useAuth();

  return useMemo(() => {
    const isAdmin = role === ROLES.ADMIN;
    const isManager = role === ROLES.MANAGER;
    const isCoach = role === ROLES.COACH;
    const isPowerUser = role === ROLES.POWER_USER;

    return {
      isAdmin,
      isManager,
      isCoach,
      isPowerUser,
      isLeadership: isAdmin || isManager,
      isTeamLead: isManager || isCoach,
      canViewTeam: isAdmin || isManager || isCoach,
      canManage: isAdmin || isManager,
      role: role || null,
    };
  }, [role]);
}
