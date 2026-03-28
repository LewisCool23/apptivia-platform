import { useState, useEffect, useMemo, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { useAuth } from '../AuthContext';

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
  description?: string;
  organization_id?: string;
}

export function useTeamManagement() {
  const { profile, role } = useAuth();
  const isManager = role === 'manager';
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
  const [addingTeam, setAddingTeam] = useState(false);

  const loadTeams = useCallback(async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*').order('name');
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
  }, [isManager, teamId]);

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
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .order('first_name');
      if (!error) setAllProfiles(data || []);
    } catch (e) {
      console.error('Error loading profiles:', e);
    }
  }, []);

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
      });
      if (error) throw error;
      setShowAddTeamModal(false);
      setNewTeamName('');
      setNewTeamDescription('');
      await loadTeams();
      return { success: true };
    } catch (err: any) {
      return { success: false, error: err.message || 'Failed to create team' };
    } finally {
      setAddingTeam(false);
    }
  }, [newTeamName, newTeamDescription, profile?.organization_id, loadTeams]);

  const openAddTeamModal = useCallback(() => {
    setShowAddTeamModal(true);
    setNewTeamName('');
    setNewTeamDescription('');
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
    // Add Team
    showAddTeamModal,
    setShowAddTeamModal,
    openAddTeamModal,
    newTeamName,
    setNewTeamName,
    newTeamDescription,
    setNewTeamDescription,
    addingTeam,
    handleAddTeam,
  };
}
