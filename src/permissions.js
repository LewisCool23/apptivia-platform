const STORAGE_KEY = 'apptivia.permissionOverrides';

export const PERMISSIONS = [
  {
    key: 'view_dashboard',
    label: 'View Scorecard Dashboard',
    description: 'Access the Apptivia Scorecard page and scorecard data.'
  },
  {
    key: 'view_coach',
    label: 'View Apptivia Coach',
    description: 'Access coaching insights, skillset progress, and coaching tools.'
  },
  {
    key: 'view_contests',
    label: 'View Contests',
    description: 'Access contests, leaderboards, and participation actions.'
  },
  {
    key: 'view_analytics',
    label: 'View Analytics',
    description: 'Access the analytics dashboard and advanced reporting.'
  },
  {
    key: 'view_systems',
    label: 'View Systems',
    description: 'Access integrations and systems settings.'
  },
  {
    key: 'view_profile',
    label: 'View Profile',
    description: 'Access personal profile settings and achievements.'
  },
  {
    key: 'configure_scorecard',
    label: 'Configure Scorecard',
    description: 'Edit scorecard KPI configuration and display settings.'
  },
  {
    key: 'manage_permissions',
    label: 'Manage Permissions',
    description: 'Enable or disable permissions for users.'
  },
  {
    key: 'manage_teams',
    label: 'Manage Teams',
    description: 'Create or edit teams and team metadata.'
  },
  {
    key: 'manage_team_members',
    label: 'Manage Team Members',
    description: 'Add or remove members from teams.'
  },
  {
    key: 'manage_integrations',
    label: 'Manage Integrations',
    description: 'Connect, disconnect, and manage integrations.'
  },
  {
    key: 'manage_kpis',
    label: 'Manage KPI Library',
    description: 'Create and edit KPI definitions.'
  },
  {
    key: 'view_all_data',
    label: 'View All Data',
    description: 'View data across all teams and departments.'
  },
  {
    key: 'view_team_data',
    label: 'View Team Data',
    description: 'View data scoped to assigned team(s).'
  },
  {
    key: 'view_own_data',
    label: 'View Own Data',
    description: 'View only the logged-in user’s data.'
  },
  {
    key: 'view_team_snapshot',
    label: 'Team Snapshot',
    description: 'View a summarized snapshot of team performance.'
  },
  {
    key: 'coach_team',
    label: 'Coach Team Members',
    description: 'Access tools to coach team members who need help.'
  },
  {
    key: 'create_contests',
    label: 'Create Contests',
    description: 'Create new contests.'
  },
  {
    key: 'edit_contests',
    label: 'Edit Contests',
    description: 'Edit existing contests.'
  },
  {
    key: 'join_contests',
    label: 'Join Contests',
    description: 'Join active contests.'
  },
  {
    key: 'withdraw_contests',
    label: 'Withdraw From Contests',
    description: 'Withdraw from active contests.'
  },
  {
    key: 'export_data',
    label: 'Export Data',
    description: 'Export scorecard, analytics, or coaching data.'
  },
  {
    key: 'notifications_self',
    label: 'Personal Notifications',
    description: 'Receive notifications about your own performance.'
  },
  {
    key: 'notifications_team',
    label: 'Team Notifications',
    description: 'Receive notifications about your team.'
  },
  {
    key: 'notifications_all',
    label: 'Organization Notifications',
    description: 'Receive notifications across the organization.'
  }
];

export const ROLE_DEFAULT_PERMISSIONS = {
  admin: [
    'view_dashboard',
    'view_coach',
    'view_contests',
    'view_analytics',
    'view_systems',
    'view_profile',
    'configure_scorecard',
    'manage_permissions',
    'manage_teams',
    'manage_team_members',
    'manage_integrations',
    'manage_kpis',
    'view_all_data',
    'view_team_data',
    'view_own_data',
    'view_team_snapshot',
    'coach_team',
    'create_contests',
    'edit_contests',
    'join_contests',
    'withdraw_contests',
    'export_data',
    'notifications_self',
    'notifications_team',
    'notifications_all'
  ],
  manager: [
    'view_dashboard',
    'view_coach',
    'view_contests',
    'view_analytics',
    'view_systems',
    'view_profile',
    'configure_scorecard',
    'manage_team_members',
    'view_team_data',
    'view_team_snapshot',
    'coach_team',
    'create_contests',
    'edit_contests',
    'join_contests',
    'withdraw_contests',
    'export_data',
    'notifications_self',
    'notifications_team'
  ],
  coach: [
    'view_dashboard',
    'view_coach',
    'view_contests',
    'view_analytics',
    'view_profile',
    'view_team_data',
    'view_team_snapshot',
    'coach_team',
    'join_contests',
    'withdraw_contests',
    'export_data',
    'notifications_self',
    'notifications_team'
  ],
  power_user: [
    'view_dashboard',
    'view_coach',
    'view_contests',
    'view_profile',
    'view_own_data',
    'join_contests',
    'withdraw_contests',
    'export_data',
    'notifications_self'
  ]
};

export function normalizeRole(role) {
  if (!role) return 'power_user';
  const normalized = String(role).trim().toLowerCase();
  if (normalized === 'power user' || normalized === 'power_user') return 'power_user';
  if (normalized === 'admin' || normalized === 'administrator') return 'admin';
  if (normalized === 'manager') return 'manager';
  if (normalized === 'coach') return 'coach';
  return 'power_user';
}

export function getPermissionOverrides(userId) {
  if (!userId || typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed[userId] || {} : {};
  } catch (e) {
    return {};
  }
}

export function setPermissionOverrides(userId, overrides) {
  if (!userId || typeof window === 'undefined') return;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    const next = { ...(parsed || {}), [userId]: overrides || {} };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch (e) {}
}

export function getRolePermissions(role) {
  const normalized = normalizeRole(role);
  return ROLE_DEFAULT_PERMISSIONS[normalized] || ROLE_DEFAULT_PERMISSIONS.power_user;
}

export function getEffectivePermissions({ role, permissionOverrides = {}, explicitPermissions = [] }) {
  const base = new Set(getRolePermissions(role));
  if (Array.isArray(explicitPermissions)) {
    explicitPermissions.forEach(p => base.add(p));
  }
  Object.entries(permissionOverrides || {}).forEach(([key, value]) => {
    if (value === true) base.add(key);
    if (value === false) base.delete(key);
  });
  return Array.from(base);
}

export function hasPermission(permissions, permissionKey) {
  if (!permissionKey) return true;
  return Array.isArray(permissions) && permissions.includes(permissionKey);
}

export function listPermissionsWithState({ role, overrides = {}, explicitPermissions = [] }) {
  const effective = getEffectivePermissions({ role, permissionOverrides: overrides, explicitPermissions });
  const enabledSet = new Set(effective);
  return PERMISSIONS.map(p => ({
    ...p,
    enabled: enabledSet.has(p.key)
  }));
}
