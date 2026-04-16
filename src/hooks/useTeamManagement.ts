import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';
import { ROLES } from '../constants/roles';

export interface TeamProfile {
  id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  role?: string;
  team_id?: string;
}

export interface Team {
  id: string;
  name: string;
  department?: string;
  department_id?: string;
  description?: string;
  organization_id?: string;
}

export function useTeamManagement() {
  const { profile: rawProfile, role } = useAuth();
  const profile = rawProfile as any;
  const isManager = role === ROLES.MANAGER;
  const teamId = profile?.team_id ? String(profile.team_id) : null;

  const [teams, setTeams] = useState<Team[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamProfile[]>([]);
  const [allProfiles, setAllProfiles] = useState<TeamProfile[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);

  // Add/Remove member state
  const [showAddMemberModal, setShowAddMemberModal] = useState(false);
  const [showRemoveMemberModal, setShowRemoveMemberModal] = useState(false);
  const [selectedAddMemberId, setSelectedAddMemberId] = useState('');
  const [selectedRemoveMemberId, setSelectedRemoveMemberId] = useState('');
  const [memberActionLoading, setMemberActionLoading] = useState(false);
  const [memberActionError, setMemberActionError] = useState('');

  // Add Team state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamDescription, setNewTeamDescription] = useState('');
  const [newTeamManagerId, setNewTeamManagerId] = useState('');
  const [addingTeam, setAddingTeam] = useState(false);

  const orgId = profile?.organization_id;

  const loadTeams = useCallback(async () => {
    if (!orgId) { setTeams([]); return; }
    try {
      const { data, error } = await supabase.from('teams').select('*').eq('organization_id', orgId).order('name');
      if (!error) {
        setTeams(data || []);
        setSelectedTeamId(prev => {
          if (prev) return prev;
          if (isManager && teamId) return teamId;
          if (data?.length) return String(data[0].id);
          return null;
        });
      }
    } catch (e) {
      console.error('Error loading teams:', e);
    }
  }, [isManager, teamId, orgId]);

  const loadTeamMembers = useCallback(async (tid: string | null) => {
    if (!tid) { setTeamMembers([]); return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .eq('team_id', tid)
        .order('first_name');
      if (!error) setTeamMembers(data || []);
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  }, []);

  const loadAllProfiles = useCallback(async () => {
    if (!orgId) { setAllProfiles([]); return; }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .eq('organization_id', orgId)
        .order('first_name');
      if (!error) setAllProfiles(data || []);
    } catch (e) {
      console.error('Error loading profiles:', e);
    }
  }, [orgId]);

  const availableMembers = useMemo(() => {
    if (!selectedTeamId) return [];
    return allProfiles.filter(p => String(p.team_id) !== String(selectedTeamId));
  }, [allProfiles, selectedTeamId]);

  // Auto-select first available member when add modal opens
  useEffect(() => {
    if (!showAddMemberModal) return;
    if (!selectedAddMemberId && availableMembers.length > 0) {
      setSelectedAddMemberId(String(availableMembers[0].id));
    }
  }, [showAddMemberModal, availableMembers, selectedAddMemberId]);

  // Auto-select first team member when remove modal opens
  useEffect(() => {
    if (!showRemoveMemberModal) return;
    if (!selectedRemoveMemberId && teamMembers.length > 0) {
      setSelectedRemoveMemberId(String(teamMembers[0].id));
    }
  }, [showRemoveMemberModal, teamMembers, selectedRemoveMemberId]);

  const handleAddMember = useCallback(async () => {
    if (!selectedAddMemberId || !selectedTeamId) return;
    setMemberActionLoading(true);
    setMemberActionError('');
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: selectedTeamId })
      .eq('id', selectedAddMemberId);
    if (error) {
      setMemberActionError(error.message || 'Unable to add member.');
    } else {
      setShowAddMemberModal(false);
      setSelectedAddMemberId('');
      await loadTeamMembers(selectedTeamId);
      await loadAllProfiles();
    }
    setMemberActionLoading(false);
  }, [selectedAddMemberId, selectedTeamId, loadTeamMembers, loadAllProfiles]);

  const handleRemoveMember = useCallback(async () => {
    if (!selectedRemoveMemberId) return;
    setMemberActionLoading(true);
    setMemberActionError('');
    const { error } = await supabase
      .from('profiles')
      .update({ team_id: null })
      .eq('id', selectedRemoveMemberId);
    if (error) {
      setMemberActionError(error.message || 'Unable to remove member.');
    } else {
      setShowRemoveMemberModal(false);
      setSelectedRemoveMemberId('');
      await loadTeamMembers(selectedTeamId);
      await loadAllProfiles();
    }
    setMemberActionLoading(false);
  }, [selectedRemoveMemberId, selectedTeamId, loadTeamMembers, loadAllProfiles]);

  const handleDeleteTeam = useCallback(async (teamId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      // Unassign all members from this team first
      const { error: unassignErr } = await supabase
        .from('profiles')
        .update({ team_id: null })
        .eq('team_id', teamId);
      if (unassignErr) throw unassignErr;

      // Delete the team
      const { error: deleteErr } = await supabase
        .from('teams')
        .delete()
        .eq('id', teamId);
      if (deleteErr) throw deleteErr;

      await loadTeams();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to delete team' };
    }
  }, [loadTeams]);

  const handleAddTeam = useCallback(async (): Promise<{ success: boolean; error?: string }> => {
    if (!newTeamName.trim() || !profile?.organization_id) {
      return { success: false, error: 'Team name and organization required' };
    }
    setAddingTeam(true);
    try {
      const { error } = await supabase.from('teams').insert({
        name: newTeamName.trim(),
        description: newTeamDescription.trim() || null,
        organization_id: profile.organization_id,
        ...(newTeamManagerId ? { manager_id: newTeamManagerId } : {}),
      });
      if (error) throw error;
      setShowAddTeamModal(false);
      setNewTeamName('');
      setNewTeamDescription('');
      setNewTeamManagerId('');
      await loadTeams();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create team' };
    } finally {
      setAddingTeam(false);
    }
  }, [newTeamName, newTeamDescription, newTeamManagerId, profile?.organization_id, loadTeams]);

  const openAddTeamModal = useCallback(() => {
    setShowAddTeamModal(true);
    setNewTeamName('');
    setNewTeamDescription('');
    setNewTeamManagerId('');
  }, []);

  return {
    teams,
    teamMembers,
    allProfiles,
    selectedTeamId,
    setSelectedTeamId,
    loadTeams,
    loadTeamMembers,
    loadAllProfiles,
    availableMembers,
    // Add/Remove member
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
    setMemberActionError,
    handleAddMember,
    handleRemoveMember,
    // Delete Team
    handleDeleteTeam,
    // Add Team
    showAddTeamModal,
    setShowAddTeamModal,
    openAddTeamModal,
    newTeamName,
    setNewTeamName,
    newTeamDescription,
    setNewTeamDescription,
    newTeamManagerId,
    setNewTeamManagerId,
    addingTeam,
    handleAddTeam,
  };
}
