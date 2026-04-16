import React from 'react';
import { Users, Plus, Trash2, UserPlus } from 'lucide-react';
import { validateTeamStructure } from './onboardingConstants';
import { useTitles } from '../../hooks/useTitles';
import { ROLES } from '../../constants/roles';

export default function StepTeamStructure({ wizardState, updateState, profile }) {
  const { departments, teams, teamMembers } = wizardState;
  const titles = useTitles();

  // ── Department CRUD ──────────────────────────────────────────────

  const addDepartment = () => {
    updateState({ departments: [...departments, { name: '', sort_order: departments.length }] });
  };

  const updateDepartment = (index, name) => {
    const updated = [...departments];
    const oldName = updated[index].name;
    updated[index] = { ...updated[index], name };
    updateState({ departments: updated });
    // Update teams referencing old department name
    if (oldName) {
      const updatedTeams = teams.map(t =>
        t.departmentName === oldName ? { ...t, departmentName: name } : t
      );
      updateState({ teams: updatedTeams });
    }
  };

  const removeDepartment = (index) => {
    const deptName = departments[index].name;
    updateState({
      departments: departments.filter((_, i) => i !== index),
      teams: teams.filter(t => t.departmentName !== deptName),
    });
  };

  // ── Team CRUD ────────────────────────────────────────────────────

  const addTeam = (departmentName) => {
    updateState({
      teams: [...teams, { name: '', description: '', departmentName, managerId: null }]
    });
  };

  const updateTeam = (index, field, value) => {
    const updated = [...teams];
    updated[index] = { ...updated[index], [field]: value };
    updateState({ teams: updated });
  };

  const removeTeam = (index) => {
    const teamName = teams[index].name;
    updateState({
      teams: teams.filter((_, i) => i !== index),
      teamMembers: teamMembers.filter(m => m.teamName !== teamName),
    });
  };

  // ── Member CRUD ──────────────────────────────────────────────────

  const addMember = () => {
    const defaultTeam = teams[0]?.name || '';
    updateState({
      teamMembers: [...teamMembers, { email: '', first_name: '', last_name: '', role: 'power_user', title: '', teamName: defaultTeam, segment: null }]
    });
  };

  const updateMember = (index, field, value) => {
    const updated = [...teamMembers];
    updated[index] = { ...updated[index], [field]: value };
    updateState({ teamMembers: updated });
  };

  const removeMember = (index) => {
    updateState({ teamMembers: teamMembers.filter((_, i) => i !== index) });
  };

  const validTeams = teams.filter(t => t.name.trim());

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 bg-emerald-100 rounded-lg flex items-center justify-center">
          <Users size={20} className="text-emerald-600" />
        </div>
        <div>
          <h3 className="text-lg font-semibold text-gray-900">Team Structure</h3>
          <p className="text-sm text-gray-500">Set up departments, teams, and invite your people</p>
        </div>
      </div>

      {/* Departments */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Departments <span className="text-red-500">*</span>
          </label>
          <button
            type="button"
            onClick={addDepartment}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <Plus size={12} /> Add Department
          </button>
        </div>
        <div className="space-y-2">
          {departments.map((dept, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="text"
                value={dept.name}
                onChange={(e) => updateDepartment(i, e.target.value)}
                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                placeholder="e.g. Sales, Marketing, Customer Success"
              />
              {departments.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeDepartment(i)}
                  className="p-2 text-gray-400 hover:text-red-500"
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Teams by Department */}
      <div>
        <label className="text-sm font-medium text-gray-700 mb-2 block">
          Teams <span className="text-red-500">*</span>
        </label>
        {departments.filter(d => d.name.trim()).map((dept) => (
          <div key={dept.name} className="mb-4 bg-gray-50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{dept.name}</span>
              <button
                type="button"
                onClick={() => addTeam(dept.name)}
                className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                <Plus size={12} /> Add Team
              </button>
            </div>
            <div className="space-y-2">
              {teams
                .map((t, idx) => ({ ...t, _idx: idx }))
                .filter(t => t.departmentName === dept.name)
                .map((team) => (
                  <div key={team._idx} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={team.name}
                      onChange={(e) => updateTeam(team._idx, 'name', e.target.value)}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="Team name"
                    />
                    <select
                      value={team.managerId || ''}
                      onChange={(e) => updateTeam(team._idx, 'managerId', e.target.value || null)}
                      className={`px-2 py-2 border rounded-lg text-sm w-44 ${team.managerId ? 'border-gray-300 text-gray-600' : 'border-red-300 text-red-500'}`}
                    >
                      <option value="">Manager *</option>
                      <option value={profile?.id || 'self'}>Me ({profile?.first_name || 'Admin'})</option>
                      {teamMembers
                        .filter(m => m.role === ROLES.MANAGER && m.first_name)
                        .map((m, mi) => (
                          <option key={mi} value={`invite_${mi}`}>
                            {m.first_name} {m.last_name || ''} (invited)
                          </option>
                        ))}
                    </select>
                    {teams.filter(t => t.departmentName === dept.name).length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeTeam(team._idx)}
                        className="p-2 text-gray-400 hover:text-red-500"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                ))}
              {teams.filter(t => t.departmentName === dept.name).length === 0 && (
                <p className="text-xs text-gray-400 italic">No teams yet — click "Add Team" above</p>
              )}
            </div>
          </div>
        ))}
        {departments.filter(d => d.name.trim()).length === 0 && (
          <p className="text-sm text-gray-400">Add at least one department above to create teams</p>
        )}
      </div>

      {/* Team Member Invites */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium text-gray-700">
            Invite Team Members
          </label>
          <button
            type="button"
            onClick={addMember}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            <UserPlus size={12} /> Add Member
          </button>
        </div>
        <p className="text-xs text-gray-400 mb-3">Invitations will be sent via email. Members can be added later too.</p>
        <div className="space-y-3">
          {teamMembers.map((member, i) => (
            <div key={i} className="border border-gray-200 rounded-lg p-3 space-y-2">
              <div className="grid grid-cols-12 gap-2 items-center">
                <input
                  type="email"
                  value={member.email}
                  onChange={(e) => updateMember(i, 'email', e.target.value)}
                  className="col-span-5 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="email@company.com"
                />
                <input
                  type="text"
                  value={member.first_name}
                  onChange={(e) => updateMember(i, 'first_name', e.target.value)}
                  className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="First"
                />
                <input
                  type="text"
                  value={member.last_name}
                  onChange={(e) => updateMember(i, 'last_name', e.target.value)}
                  className="col-span-3 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="Last"
                />
                <button
                  type="button"
                  onClick={() => removeMember(i)}
                  className="col-span-1 p-2 text-gray-400 hover:text-red-500 justify-self-center"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <div className="grid grid-cols-12 gap-2 items-center">
                <select
                  value={member.title || ''}
                  onChange={(e) => {
                    const selected = titles.find(t => t.label === e.target.value);
                    const updated = [...teamMembers];
                    updated[i] = { ...updated[i], title: e.target.value, title_key: selected?.key || '' };
                    updateState({ teamMembers: updated });
                  }}
                  className="col-span-4 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="">Title</option>
                  {titles.map(t => (
                    <option key={t.key} value={t.label}>{t.label}</option>
                  ))}
                </select>
                <select
                  value={member.role}
                  onChange={(e) => updateMember(i, 'role', e.target.value)}
                  className="col-span-3 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                >
                  <option value="power_user">Rep</option>
                  <option value="manager">Manager</option>
                  <option value="coach">Coach</option>
                  <option value="admin">Admin</option>
                </select>
                <select
                  value={member.teamName}
                  onChange={(e) => updateMember(i, 'teamName', e.target.value)}
                  className="col-span-3 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  title="Assign to team"
                >
                  <option value="">Team</option>
                  {validTeams.map(t => (
                    <option key={t.name} value={t.name}>{t.name}</option>
                  ))}
                </select>
                <select
                  value={member.segment || ''}
                  onChange={(e) => updateMember(i, 'segment', e.target.value || null)}
                  className="col-span-2 px-2 py-2 border border-gray-300 rounded-lg text-sm"
                  title="Market segment"
                >
                  <option value="">Segment</option>
                  <option value="Territory">Territory</option>
                  <option value="Mid-Market">Mid-Market</option>
                  <option value="Enterprise">Enterprise</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

StepTeamStructure.validate = (wizardState) =>
  validateTeamStructure(wizardState.departments, wizardState.teams, wizardState.teamMembers);
