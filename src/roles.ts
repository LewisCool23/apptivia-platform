// User roles and permissions system
export type Role = 'Admin' | 'Manager' | 'Coach' | 'User';

export interface Permission {
  name: string;
  description: string;
}

export const Permissions: Record<Role, Permission[]> = {
  Admin: [
    { name: 'edit_user_profiles', description: 'Edit user profiles (email, phone)' },
    { name: 'create_records', description: 'Create all records, users, and teams' },
    // Inherit all Manager, Coach, and User permissions below
    { name: 'add_remove_team_member', description: 'Add/remove team member' },
    { name: 'set_user_goals', description: 'Set/assign user goals' },
    { name: 'create_contests', description: 'Create contests' },
    { name: 'create_update_action_plans', description: 'Create/update action plans' },
    { name: 'update_photo_name_integrations', description: 'Update photo, name, and personal integrations' },
    { name: 'view_team_data', description: 'View team data' },
    { name: 'view_personal_data', description: 'View personal data' },
  ],
  Manager: [
    { name: 'add_remove_team_member', description: 'Add/remove team member' },
    { name: 'set_user_goals', description: 'Set/assign user goals' },
    { name: 'create_contests', description: 'Create contests' },
    { name: 'create_update_action_plans', description: 'Create/update action plans' },
    // Inherit all Coach and User permissions below
    { name: 'update_photo_name_integrations', description: 'Update photo, name, and personal integrations' },
    { name: 'view_team_data', description: 'View team data' },
    { name: 'view_personal_data', description: 'View personal data' },
  ],
  Coach: [
    { name: 'set_user_goals', description: 'Set/assign user goals' },
    { name: 'create_contests', description: 'Create contests' },
    { name: 'create_update_action_plans', description: 'Create/update action plans' },
    // Inherit all User permissions below
    { name: 'update_photo_name_integrations', description: 'Update photo, name, and personal integrations' },
    { name: 'view_team_data', description: 'View team data' },
    { name: 'view_personal_data', description: 'View personal data' },
  ],
  User: [
    { name: 'update_photo_name_integrations', description: 'Update photo, name, and personal integrations' },
    { name: 'view_team_data', description: 'View team data' },
    { name: 'view_personal_data', description: 'View personal data' },
  ],
};

export function hasPermission(role: Role, permissionName: string): boolean {
  // Check inherited permissions
  const roleOrder: Role[] = ['User', 'Coach', 'Manager', 'Admin'];
  const roleIndex = roleOrder.indexOf(role);
  for (let i = roleIndex; i >= 0; i--) {
    if (Permissions[roleOrder[i]].some(p => p.name === permissionName)) {
      return true;
    }
  }
  return false;
}
