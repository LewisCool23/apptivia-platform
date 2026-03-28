import { useMemo } from 'react';
import { useAuth } from '../AuthContext';

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
    const isAdmin = role === 'admin';
    const isManager = role === 'manager';
    const isCoach = role === 'coach';
    const isPowerUser = role === 'power_user';

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
