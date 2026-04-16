/**
 * Role constants — single source of truth for the frontend.
 * X2 fix: replaces scattered role string literals across 15+ files.
 *
 * Internal role names use underscores (power_user).
 * Database enum uses spaces ('power user') — the backend toDbRole() handles conversion.
 */

export const ROLES = {
  ADMIN: 'admin',
  MANAGER: 'manager',
  COACH: 'coach',
  POWER_USER: 'power_user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles excluded from scorecard/KPI views (leadership) */
export const LEADERSHIP_ROLES = [ROLES.ADMIN, ROLES.MANAGER, ROLES.COACH] as const;

/**
 * Supabase PostgREST filter string for excluding leadership roles.
 * Usage: `.not('role', 'in', LEADERSHIP_ROLE_FILTER)`
 */
export const LEADERSHIP_ROLE_FILTER = `("${LEADERSHIP_ROLES.join('","')}")`;
