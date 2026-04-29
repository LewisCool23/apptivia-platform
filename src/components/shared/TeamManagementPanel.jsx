import React from 'react';
import { X } from 'lucide-react';
import { normalizeRole } from '../../permissions';

/**
 * Shared Team Management UI — used by Systems.jsx and PermissionsTeams.jsx
 *
 * Props:
 *   teamHook     — return value from useTeamManagement()
 *   canManageTeams       — boolean
 *   canManageTeamMembers — boolean
 *   isManager            — boolean
 *   connectedIntegrations — array of { type, name } or string[] for display in member rows
 *   onNotify             — (notification) => void for success/error messages
 */
export default function TeamManagementPanel({
  teamHook,
  canManageTeams,
  canManageTeamMembers,
  isManager,
  connectedIntegrations = [],
  onNotify,
}) {
  const {
    teams,
    teamMembers,
    selectedTeamId,
    setSelectedTeamId,
    availableMembers,
    showAddMemberModal,
    setShowAddMemberModal,
    showRemoveMemberModal,
    setShowRemoveMemberModal,
    selectedAddMemberId,
    setSelectedAddMemberId,
    selectedRemoveMemberId,
    setSelectedRemoveMemberId,
    memberActionLoading,
    memberActionError,
    handleAddMember,
    handleRemoveMember,
    showAddTeamModal,
    setShowAddTeamModal,
    openAddTeamModal,
    newTeamName,
    setNewTeamName,
    newTeamDescription,
    setNewTeamDescription,
    addingTeam,
    handleAddTeam,
  } = teamHook;

  const onAddTeam = async () => {
    const result = await handleAddTeam();
    if (result.success) {
      onNotify?.({ type: 'success', message: `Team "${newTeamName.trim()}" created` });
    } else {
      onNotify?.({ type: 'error', message: result.error || 'Failed to create team' });
    }
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Teams sidebar */}
        <div className="bg-apptivia-paper rounded-lg p-3 border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs font-semibold text-apptivia-carbon-600">Teams</div>
            <button
              className="text-xs text-apptivia-coral font-semibold disabled:text-apptivia-carbon-300"
              disabled={!canManageTeams}
              onClick={openAddTeamModal}
            >+ Add Team</button>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {teams.length === 0 ? (
              <div className="text-xs text-apptivia-carbon-500">No teams found.</div>
            ) : (
              teams.map((team) => (
                <button
                  key={team.id}
                  onClick={() => setSelectedTeamId(String(team.id))}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(team.id) === String(selectedTeamId) ? 'bg-apptivia-coral text-white' : 'bg-white text-apptivia-carbon-700 hover:bg-apptivia-carbon-100'}`}
                >
                  <div>{team.name}</div>
                  <div className={`${String(team.id) === String(selectedTeamId) ? 'text-apptivia-coral-tone-300' : 'text-apptivia-carbon-400'} text-[10px]`}>{team.department || 'No department'}</div>
                </button>
              ))
            )}
          </div>
        </div>

        {/* Members panel */}
        <div className="lg:col-span-2 bg-white rounded-lg border p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-xs text-apptivia-carbon-500">Team members</div>
              <div className="text-sm font-semibold text-apptivia-ink">
                {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Select a team'}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                className="text-xs font-semibold text-apptivia-coral disabled:text-apptivia-carbon-300"
                onClick={() => setShowAddMemberModal(true)}
                disabled={!canManageTeamMembers || !selectedTeamId}
              >
                + Add Member
              </button>
              <button
                className="text-xs font-semibold text-red-500 disabled:text-apptivia-carbon-300"
                onClick={() => setShowRemoveMemberModal(true)}
                disabled={!canManageTeamMembers || teamMembers.length === 0}
              >
                Remove Member
              </button>
            </div>
          </div>
          <div className="space-y-2 max-h-[420px] overflow-auto">
            {teamMembers.length === 0 ? (
              <div className="text-xs text-apptivia-carbon-500">No team members found.</div>
            ) : (
              teamMembers.map((member) => (
                <div key={member.id} className="border rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <div className="text-sm font-semibold">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                    <div className="text-[11px] text-apptivia-carbon-500">{normalizeRole(member.role)}</div>
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-apptivia-carbon-500">
                    {connectedIntegrations.length > 0 ? connectedIntegrations.map((int) => {
                      const name = typeof int === 'string' ? int : int.name;
                      const key = typeof int === 'string' ? int : int.type;
                      return (
                        <div key={key} className="flex items-center gap-1">
                          <span className="w-2.5 h-2.5 rounded-full bg-green-500" />
                          <span>{name}</span>
                        </div>
                      );
                    }) : (
                      <span className="text-apptivia-carbon-400">No integrations connected</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Add Member Modal */}
      {showAddMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddMemberModal(false)}>
          <div className="bg-white w-[95%] max-w-md rounded-lg shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-apptivia-ink">Add Team Member</h3>
                <p className="text-xs text-apptivia-carbon-500">Assign a user to the selected team</p>
              </div>
              <button onClick={() => setShowAddMemberModal(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm">Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-apptivia-carbon-500 mb-1">Available users</label>
                <select
                  value={selectedAddMemberId}
                  onChange={(e) => setSelectedAddMemberId(e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                >
                  {availableMembers.length === 0 ? (
                    <option value="">No available users</option>
                  ) : (
                    availableMembers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {memberActionError && <div className="text-xs text-red-500">{memberActionError}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowAddMemberModal(false)} className="px-3 py-1.5 text-xs rounded border">Cancel</button>
                <button
                  onClick={handleAddMember}
                  disabled={memberActionLoading || !selectedAddMemberId}
                  className="px-3 py-1.5 text-xs rounded bg-apptivia-coral text-white disabled:opacity-60"
                >
                  {memberActionLoading ? 'Adding...' : 'Add Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Remove Member Modal */}
      {showRemoveMemberModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowRemoveMemberModal(false)}>
          <div className="bg-white w-[95%] max-w-md rounded-lg shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-apptivia-ink">Remove Team Member</h3>
                <p className="text-xs text-apptivia-carbon-500">Remove a user from the selected team</p>
              </div>
              <button onClick={() => setShowRemoveMemberModal(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm">Close</button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-apptivia-carbon-500 mb-1">Current members</label>
                <select
                  value={selectedRemoveMemberId}
                  onChange={(e) => setSelectedRemoveMemberId(e.target.value)}
                  className="w-full border rounded px-2 py-2 text-sm"
                >
                  {teamMembers.length === 0 ? (
                    <option value="">No team members</option>
                  ) : (
                    teamMembers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {`${u.first_name || ''} ${u.last_name || ''}`.trim() || u.email}
                      </option>
                    ))
                  )}
                </select>
              </div>
              {memberActionError && <div className="text-xs text-red-500">{memberActionError}</div>}
              <div className="flex justify-end gap-2">
                <button onClick={() => setShowRemoveMemberModal(false)} className="px-3 py-1.5 text-xs rounded border">Cancel</button>
                <button
                  onClick={handleRemoveMember}
                  disabled={memberActionLoading || !selectedRemoveMemberId}
                  className="px-3 py-1.5 text-xs rounded bg-red-600 text-white disabled:opacity-60"
                >
                  {memberActionLoading ? 'Removing...' : 'Remove Member'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Add Team Modal */}
      {showAddTeamModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40" onClick={() => setShowAddTeamModal(false)}>
          <div className="bg-white w-[95%] max-w-md rounded-lg shadow-2xl p-5" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-lg font-bold text-apptivia-ink">Create New Team</h3>
                <p className="text-xs text-apptivia-carbon-500">Add a new team to your organization</p>
              </div>
              <button onClick={() => setShowAddTeamModal(false)} className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600"><X size={18} /></button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Team Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Enterprise Sales"
                  value={newTeamName}
                  onChange={(e) => setNewTeamName(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Description</label>
                <input
                  type="text"
                  placeholder="Optional team description"
                  value={newTeamDescription}
                  onChange={(e) => setNewTeamDescription(e.target.value)}
                  className="w-full border border-apptivia-carbon-300 rounded-lg px-3 py-2 text-sm focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button onClick={() => setShowAddTeamModal(false)} className="px-3 py-1.5 text-sm rounded border">Cancel</button>
                <button
                  onClick={onAddTeam}
                  disabled={addingTeam || !newTeamName.trim()}
                  className="px-4 py-1.5 text-sm rounded bg-apptivia-coral text-white hover:bg-apptivia-coral disabled:opacity-60"
                >
                  {addingTeam ? 'Creating...' : 'Create Team'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
