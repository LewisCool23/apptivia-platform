import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { Edit, Camera, Award, TrendingUp, Search, X, Gift, CheckCircle, AlertCircle, Loader2, Clock, Key, RefreshCw, Building2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import ConfigureModal from '../components/ConfigureModal';
import BadgeModal from '../components/BadgeModal';
import ViewAllBadgesModal from '../components/ViewAllBadgesModal';
import BadgeCreationModal from '../components/BadgeCreationModal';
import ShareSnapshotModal from '../components/ShareSnapshotModal';
import EditProfileModal from '../components/EditProfileModal';
import ChangePasswordModal from '../components/ChangePasswordModal';
import { ROLES } from '../constants/roles';
import { normalizeRole } from '../permissions';
import { useTitles } from '../hooks/useTitles';
import { exportBadgesToCSV } from '../utils/exportUtils';
import { exportBadgesToPDF } from '../utils/exportPdf';
import ExportReportModal from '../components/ExportReportModal';
import { supabase } from '../supabaseClient';
import { useNotifications } from '../contexts/NotificationContext';
import { useToast } from '../contexts/ToastContext';
import Tooltip from '../components/shared/Tooltip';
import { useIntegrations } from '../hooks/useIntegrations';
import { SUPPORTED_INTEGRATIONS, API_KEY_PROVIDERS } from '../constants/integrations';
import CredentialsModal from '../components/shared/CredentialsModal';
import DisconnectConfirmModal from '../components/shared/DisconnectConfirmModal';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission, refreshProfile } = useAuth();
  const toast = useToast();
  const [badges, setBadges] = useState([]);
  const [badgeModal, setBadgeModal] = useState({ isOpen: false, badge: null });
  const [viewAllBadgesModal, setViewAllBadgesModal] = useState(false);
  const [showBadgeCreationModal, setShowBadgeCreationModal] = useState(false);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);
  const [showExportModal, setShowExportModal] = useState(false);
  const [shareSnapshotModal, setShareSnapshotModal] = useState(false);
  const [achievements, setAchievements] = useState([]);
  const [loadingBadges, setLoadingBadges] = useState(true);
  const [loadingAchievements, setLoadingAchievements] = useState(true);
  const [showAllBadges, setShowAllBadges] = useState(false);
  const [showAllAchievements, setShowAllAchievements] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [showAdminTeamsModal, setShowAdminTeamsModal] = useState(false);
  const [showManagerTeamsModal, setShowManagerTeamsModal] = useState(false);
  const [teams, setTeams] = useState([]);
  const [teamMembers, setTeamMembers] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState(null);
  const [profilesList, setProfilesList] = useState([]);
  const [selectedProfileId, setSelectedProfileId] = useState('');
  const [profileForm, setProfileForm] = useState({
    first_name: '',
    last_name: '',
    email: '',
    title: '',
    department: '',
    role: '',
    secondary_role: '',
    team_id: '',
    segment: ''
  });
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState('');
  const [profileSuccess, setProfileSuccess] = useState('');
  const [activeTab, setActiveTab] = useState('profile-details');
  const [showEditProfileModal, setShowEditProfileModal] = useState(false);
  const [showChangePasswordModal, setShowChangePasswordModal] = useState(false);
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [searching, setSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [allSkillsets, setAllSkillsets] = useState([]);
  const [isTeamSkillsetView, setIsTeamSkillsetView] = useState(false);
  const [showAwardBadgeModal, setShowAwardBadgeModal] = useState(false);
  const [awardBadgeForm, setAwardBadgeForm] = useState({ badge_name: '', profile_id: '' });
  const [awardingBadge, setAwardingBadge] = useState(false);
  const [availableBadgeDefs, setAvailableBadgeDefs] = useState([]);

  const isAdmin = role === ROLES.ADMIN;
  const isManager = role === ROLES.MANAGER;
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const canConfigureScorecard = hasPermission('configure_scorecard');
  const canManageTeams = hasPermission('manage_teams');
  const canManageTeamMembers = hasPermission('manage_team_members');
  const canExport = hasPermission('export_data');
  const canEditAnyProfile = isAdmin;
  const canEditTeamProfiles = isManager && canManageTeamMembers;
  const canManageBadges = isAdmin || role === ROLES.MANAGER;
  const canConnectIntegrations = hasPermission('connect_own_integrations');

  // Personal integrations
  const {
    integrations: personalIntegrations,
    loading: integrationsLoading,
    error: integrationError,
    connectOAuth,
    connectCredentials,
    disconnect: disconnectIntegration,
    refresh: refreshIntegrations,
  } = useIntegrations({ personal: true });
  const { integrations: orgIntegrations } = useIntegrations({ personal: false });
  const connectedOrgIntegrations = useMemo(
    () => (orgIntegrations || []).filter(i => i.status === 'connected'),
    [orgIntegrations]
  );
  const orgConnectedTypes = useMemo(
    () => new Set(connectedOrgIntegrations.map(i => i.integration_type)),
    [connectedOrgIntegrations]
  );
  const personalTemplates = useMemo(
    () => SUPPORTED_INTEGRATIONS.filter(t => !orgConnectedTypes.has(t.integration_type)),
    [orgConnectedTypes]
  );
  const [credentialsModal, setCredentialsModal] = useState(null);
  const [confirmDisconnect, setConfirmDisconnect] = useState(null);

  const repName = useMemo(() => {
    const first = profile?.first_name || '';
    const last = profile?.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || profile?.name || user?.name || user?.email || 'Unknown';
  }, [profile, user]);

  const tabs = useMemo(() => {
    const base = [
      { id: 'profile-details', label: 'Profile Details' },
      { id: 'skillset-progress', label: 'Skillset Progress' },
      { id: 'badges', label: 'Badges' },
      { id: 'notifications', label: 'Notifications' },
    ];
    if (canConnectIntegrations) base.push({ id: 'integrations', label: 'Integrations' });
    return base;
  }, [canConnectIntegrations]);

  // [FEATURE 2] Nudge notification preferences
  const [nudgeChannel, setNudgeChannel] = useState(profile?.nudge_channel || 'in_app');
  const [slackWebhookUrl, setSlackWebhookUrl] = useState(profile?.slack_webhook_url || '');
  const [savingNudgePrefs, setSavingNudgePrefs] = useState(false);

  useEffect(() => {
    if (profile?.nudge_channel) setNudgeChannel(profile.nudge_channel);
    if (profile?.slack_webhook_url) setSlackWebhookUrl(profile.slack_webhook_url);
  }, [profile?.nudge_channel, profile?.slack_webhook_url]);

  const handleSaveNudgePrefs = async () => {
    setSavingNudgePrefs(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ nudge_channel: nudgeChannel, slack_webhook_url: slackWebhookUrl || null })
        .eq('id', user?.id);
      if (error) throw error;
      toast?.({ type: 'success', message: 'Notification preferences saved' });
      refreshProfile?.();
    } catch (err) {
      toast?.({ type: 'error', message: err.message || 'Failed to save preferences' });
    } finally {
      setSavingNudgePrefs(false);
    }
  };

  useEffect(() => {
    if (user?.id) {
      fetchBadges();
      fetchAchievements();
    }
  }, [user?.id]);

  useEffect(() => {
    if (profile?.team_id && !selectedTeamId) {
      setSelectedTeamId(String(profile.team_id));
    }
  }, [profile?.team_id, selectedTeamId]);

  const orgId = profile?.organization_id;
  const titles = useTitles(orgId);

  const loadEditableProfiles = useCallback(async () => {
    if (!user?.id) return;
    if (!canEditAnyProfile && !canEditTeamProfiles) {
      setProfilesList(profile ? [profile] : []);
      return;
    }
    if (canEditTeamProfiles && !canEditAnyProfile && !teamId) {
      setProfilesList(profile ? [profile] : []);
      return;
    }
    try {
      let query = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, secondary_role, team_id, department, title, segment, title_id')
        .order('first_name');
      if (orgId) query = query.eq('organization_id', orgId);
      else return;
      if (canEditTeamProfiles && !canEditAnyProfile && teamId) {
        query = query.eq('team_id', teamId);
      }
      const { data, error } = await query;
      if (!error) setProfilesList(data || []);
    } catch (e) {
      console.error('Error loading editable profiles:', e);
    }
  }, [user?.id, canEditAnyProfile, canEditTeamProfiles, teamId, profile, orgId]);

  useEffect(() => {
    loadEditableProfiles();
  }, [loadEditableProfiles]);

  const loadTeams = async () => {
    try {
      let teamsQ = supabase.from('teams').select('*').order('name');
      if (orgId) teamsQ = teamsQ.eq('organization_id', orgId);
      else return;
      const { data, error } = await teamsQ;
      if (!error) {
        setTeams(data || []);
        if (!selectedTeamId && data?.length) {
          setSelectedTeamId(String(data[0].id));
        }
      }
    } catch (e) {
      console.error('Error loading teams:', e);
    }
  };

  useEffect(() => {
    if (orgId) {
      loadTeams();
    }
  }, [orgId]);


  const loadTeamMembers = async (teamIdValue) => {
    if (!teamIdValue) {
      setTeamMembers([]);
      return;
    }
    try {
      let membersQ = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .eq('team_id', teamIdValue)
        .order('first_name');
      if (orgId) membersQ = membersQ.eq('organization_id', orgId);
      const { data, error } = await membersQ;
      if (!error) setTeamMembers(data || []);
    } catch (e) {
      console.error('Error loading team members:', e);
    }
  };

  const editableProfiles = useMemo(() => {
    if (canEditAnyProfile || canEditTeamProfiles) return profilesList;
    return profile ? [profile] : [];
  }, [canEditAnyProfile, canEditTeamProfiles, profilesList, profile]);

  const activeProfile = useMemo(() => {
    if (canEditAnyProfile || canEditTeamProfiles) {
      if (selectedProfileId) {
        return editableProfiles.find(p => String(p.id) === String(selectedProfileId)) || editableProfiles[0] || profile;
      }
      return editableProfiles[0] || profile;
    }
    return profile;
  }, [canEditAnyProfile, canEditTeamProfiles, editableProfiles, selectedProfileId, profile]);

  useEffect(() => {
    if (!user?.id) return;
    if (!canEditAnyProfile && !canEditTeamProfiles) {
      setSelectedProfileId(String(user.id));
      return;
    }
    if (!selectedProfileId && editableProfiles.length > 0) {
      const own = editableProfiles.find(p => String(p.id) === String(user.id));
      setSelectedProfileId(String(own?.id || editableProfiles[0].id));
    }
  }, [user?.id, canEditAnyProfile, canEditTeamProfiles, selectedProfileId, editableProfiles]);

  useEffect(() => {
    if (!activeProfile) return;
    setProfileForm({
      first_name: activeProfile.first_name || '',
      last_name: activeProfile.last_name || '',
      email: activeProfile.email || user?.email || '',
      title: activeProfile.title || '',
      department: activeProfile.department || '',
      role: normalizeRole(activeProfile.role),
      secondary_role: activeProfile.secondary_role || '',
      team_id: activeProfile.team_id ? String(activeProfile.team_id) : '',
      segment: activeProfile.segment || ''
    });
    setProfileError('');
    setProfileSuccess('');
  }, [activeProfile, user?.email]);

  const handleProfileFieldChange = (field, value) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileReset = () => {
    if (!activeProfile) return;
    setProfileForm({
      first_name: activeProfile.first_name || '',
      last_name: activeProfile.last_name || '',
      email: activeProfile.email || user?.email || '',
      title: activeProfile.title || '',
      department: activeProfile.department || '',
      role: normalizeRole(activeProfile.role),
      secondary_role: activeProfile.secondary_role || '',
      team_id: activeProfile.team_id ? String(activeProfile.team_id) : '',
      segment: activeProfile.segment || ''
    });
    setProfileError('');
    setProfileSuccess('');
  };

  const handleProfileSave = async () => {
    if (!activeProfile?.id) return;
    setProfileSaving(true);
    setProfileError('');
    setProfileSuccess('');
    const payload = {
      first_name: profileForm.first_name?.trim() || null,
      last_name: profileForm.last_name?.trim() || null,
    };
    // Only admins can edit title, department, role, team, secondary_role, segment
    if (canEditAnyProfile) {
      payload.title = profileForm.title?.trim() || null;
      payload.department = profileForm.department?.trim() || null;
      payload.role = profileForm.role || 'power_user';
      payload.secondary_role = profileForm.secondary_role || null;
      payload.team_id = profileForm.team_id || null;
      payload.segment = profileForm.segment || null;
      // Resolve title_id from selected title label (use UUID, not key)
      const matchedTitle = titles.find(t => t.label === profileForm.title);
      if (matchedTitle?.id) {
        payload.title_id = matchedTitle.id;
      }
      // Auto-resolve department from team's department_id
      if (profileForm.team_id) {
        const team = teams.find(t => String(t.id) === String(profileForm.team_id));
        if (team?.department_id) {
          const { data: dept } = await supabase.from('departments').select('name').eq('id', team.department_id).maybeSingle();
          if (dept?.name) payload.department = dept.name;
        }
      }
    }
    try {
      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', activeProfile.id);
      if (error) throw error;
      setProfileSuccess('Profile updated.');
      await loadEditableProfiles();
      if (String(activeProfile.id) === String(user?.id)) {
        refreshProfile();
      }
    } catch (err) {
      setProfileError(err?.message || 'Unable to update profile.');
    } finally {
      setProfileSaving(false);
    }
  };

  const formatProfileName = (p) => {
    if (!p) return 'Unknown user';
    const full = `${p.first_name || ''} ${p.last_name || ''}`.trim();
    return full || p.email || 'Unknown user';
  };

  const roleOptions = useMemo(() => ([
    { value: 'admin', label: 'Admin' },
    { value: 'manager', label: 'Manager' },
    { value: 'coach', label: 'Coach' },
    { value: 'power_user', label: 'Power User' }
  ]), []);

  useEffect(() => {
    if (showAdminTeamsModal || showManagerTeamsModal) {
      loadTeams();
    }
  }, [showAdminTeamsModal, showManagerTeamsModal]);


  useEffect(() => {
    if ((showAdminTeamsModal || showManagerTeamsModal) && selectedTeamId) {
      loadTeamMembers(selectedTeamId);
    }
  }, [showAdminTeamsModal, showManagerTeamsModal, selectedTeamId]);


  const fetchBadges = async () => {
    try {
      setLoadingBadges(true);
      const { data, error } = await supabase
        .from('profile_badges')
        .select(`
          *,
          contest:active_contests(name),
          achievement:achievements(name)
        `)
        .eq('profile_id', selectedProfileId || user.id)
        .order('is_featured', { ascending: false })
        .order('earned_at', { ascending: false });

      if (error) throw error;
      setBadges(data || []);
    } catch (err) {
      console.error('Error fetching badges:', err);
    } finally {
      setLoadingBadges(false);
    }
  };

  const fetchAchievements = async () => {
    try {
      setLoadingAchievements(true);

      // Managers/admins/coaches see team-aggregated skillset progress
      const showTeam = isManager || isAdmin || role === ROLES.COACH;
      let targetProfileIds = [user.id];

      if (showTeam) {
        let membersQuery = supabase
          .from('profiles')
          .select('id')
          .not('role', 'in', '("admin","manager","coach")');
        if (orgId) membersQuery = membersQuery.eq('organization_id', orgId);
        if (isManager && teamId) {
          membersQuery = membersQuery.eq('team_id', teamId);
        }
        const { data: members } = await membersQuery;
        if (members && members.length > 0) {
          targetProfileIds = members.map(m => m.id);
        }
      }
      setIsTeamSkillsetView(showTeam && targetProfileIds.length > 1);

      const [progressResult, skillsetsResult, achievementsResult, earnedResult] = await Promise.all([
        supabase
          .from('profile_skillsets')
          .select(`*, skillset:skillsets(id, name, description, color, icon)`)
          .in('profile_id', targetProfileIds),
        supabase.from('skillsets').select('id, name, description, color, icon').order('name'),
        supabase.from('achievements').select('id, skillset_id, points'),
        supabase
          .from('profile_achievements')
          .select('achievement_id, profile_id')
          .in('profile_id', targetProfileIds),
      ]);

      if (progressResult.error) throw progressResult.error;
      const userProgress = progressResult.data || [];
      const allSkills = skillsetsResult.data || [];
      setAllSkillsets(allSkills);

      // Build achievement info: total points + total count per skillset
      const totalPointsBySkillset = new Map();
      const totalCountBySkillset = new Map();
      const achievementInfoMap = new Map();
      (achievementsResult.data || []).forEach(ach => {
        const pts = ach.points || 0;
        totalPointsBySkillset.set(ach.skillset_id, (totalPointsBySkillset.get(ach.skillset_id) || 0) + pts);
        totalCountBySkillset.set(ach.skillset_id, (totalCountBySkillset.get(ach.skillset_id) || 0) + 1);
        achievementInfoMap.set(ach.id, { skillset_id: ach.skillset_id, points: pts });
      });

      if (showTeam && targetProfileIds.length > 1) {
        // Team aggregation: average progress across all members
        const memberCount = targetProfileIds.length;
        const earnedByMemberSkillset = new Map();
        (earnedResult.data || []).forEach(ea => {
          const info = achievementInfoMap.get(ea.achievement_id);
          if (!info) return;
          const key = `${ea.profile_id}|${info.skillset_id}`;
          const existing = earnedByMemberSkillset.get(key) || { points: 0, count: 0 };
          existing.points += info.points;
          existing.count += 1;
          earnedByMemberSkillset.set(key, existing);
        });

        const merged = allSkills.map(skill => {
          const totalPts = totalPointsBySkillset.get(skill.id) || 0;
          const totalCount = totalCountBySkillset.get(skill.id) || 0;
          let progressSum = 0, achievementsSum = 0, pointsSum = 0;

          targetProfileIds.forEach(pid => {
            const key = `${pid}|${skill.id}`;
            const earned = earnedByMemberSkillset.get(key) || { points: 0, count: 0 };
            const memberProgress = totalPts > 0 ? Math.min(100, Math.round((earned.points / totalPts) * 100)) : 0;
            progressSum += memberProgress;
            achievementsSum += earned.count;
            pointsSum += earned.points;
          });

          return {
            id: `team-${skill.id}`,
            skillset_id: skill.id,
            profile_id: 'team',
            progress: Math.round(progressSum / memberCount),
            achievements_completed: Math.round(achievementsSum / memberCount),
            total_achievements: totalCount,
            points: Math.round(pointsSum / memberCount),
            skillset: skill,
          };
        });
        merged.sort((a, b) => {
          if (a.progress !== b.progress) return b.progress - a.progress;
          return (a.skillset?.name || '').localeCompare(b.skillset?.name || '');
        });
        setAchievements(merged);
      } else {
        // Individual view (power users / reps)
        const earnedPointsBySkillset = new Map();
        const earnedCountBySkillset = new Map();
        (earnedResult.data || []).forEach(ea => {
          const info = achievementInfoMap.get(ea.achievement_id);
          if (!info) return;
          earnedPointsBySkillset.set(info.skillset_id, (earnedPointsBySkillset.get(info.skillset_id) || 0) + info.points);
          earnedCountBySkillset.set(info.skillset_id, (earnedCountBySkillset.get(info.skillset_id) || 0) + 1);
        });

        const progressMap = new Map(userProgress.map(p => [p.skillset_id || p.skillset?.id, p]));
        const merged = allSkills.map(skill => {
          const existing = progressMap.get(skill.id);
          const totalPts = totalPointsBySkillset.get(skill.id) || 0;
          const totalCount = totalCountBySkillset.get(skill.id) || 0;
          const earnedPts = earnedPointsBySkillset.get(skill.id) || 0;
          const earnedCount = earnedCountBySkillset.get(skill.id) || 0;
          const earnedProgress = totalPts > 0 ? Math.min(100, Math.round((earnedPts / totalPts) * 100)) : 0;

          return {
            id: existing?.id || `placeholder-${skill.id}`,
            skillset_id: skill.id,
            profile_id: user.id,
            progress: earnedProgress,
            achievements_completed: earnedCount,
            total_achievements: totalCount,
            points: earnedPts,
            skillset: skill,
          };
        });
        merged.sort((a, b) => {
          if (a.progress !== b.progress) return b.progress - a.progress;
          return (a.skillset?.name || '').localeCompare(b.skillset?.name || '');
        });
        setAchievements(merged);
      }
    } catch (err) {
      console.error('Error fetching achievements:', err);
    } finally {
      setLoadingAchievements(false);
    }
  };

  useEffect(() => {
    if (badges.length === 0) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem('apptivia.badges.seen') || '[]');
      const newBadges = badges.filter(b => !stored.includes(b.id));
      newBadges.slice(0, 3).forEach(badge => {
        addNotification({
          type: 'badge',
          title: 'New badge earned',
          message: badge.badge_name || 'You earned a new badge.',
          link: '/profile#badges',
          dedupeKey: `badge-${badge.id}`,
          repName,
        });
      });
      const updated = Array.from(new Set([...stored, ...badges.map(b => b.id)]));
      window.localStorage.setItem('apptivia.badges.seen', JSON.stringify(updated));
    } catch (e) {}
  }, [badges, addNotification]);

  useEffect(() => {
    if (achievements.length === 0 || isTeamSkillsetView) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem('apptivia.achievementCounts') || '{}');
      achievements.forEach(a => {
        const key = String(a.skillset_id || a.skillset?.id || '');
        if (!key) return;
        const prev = Number(stored[key] || 0);
        const current = Number(a.achievements_completed || 0);
        if (current > prev) {
          addNotification({
            type: 'achievement',
            title: 'Achievement unlocked',
            message: a.skillset?.name ? `${a.skillset.name} progress updated.` : 'Achievement progress updated.',
            link: '/profile#achievements',
            dedupeKey: `achievement-${key}-${current}`,
            repName,
          });
        }
        stored[key] = current;
      });
      window.localStorage.setItem('apptivia.achievementCounts', JSON.stringify(stored));
    } catch (e) {}
  }, [achievements, addNotification]);

  const getInitials = (name) => {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    setUploadingPhoto(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `avatars/${user.id}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('profile-pictures')
        .upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: urlData } = supabase.storage
        .from('profile-pictures')
        .getPublicUrl(path);
      const publicUrl = urlData?.publicUrl ? `${urlData.publicUrl}?t=${Date.now()}` : null;
      if (publicUrl) {
        await supabase.from('profiles').update({ profile_picture: publicUrl }).eq('id', user.id);
        refreshProfile?.();
        toast.success('Profile picture updated');
      }
    } catch (err) {
      console.error('Photo upload error:', err);
      toast.error('Failed to upload photo');
    } finally {
      setUploadingPhoto(false);
    }
  };

  // Award badge to a team member (managers/admins)
  const handleAwardBadge = async () => {
    if (!awardBadgeForm.badge_name || !awardBadgeForm.profile_id) {
      toast.error('Please select a badge and a team member');
      return;
    }
    setAwardingBadge(true);
    try {
      const badgeDef = availableBadgeDefs.find(b => b.badge_name === awardBadgeForm.badge_name);
      const { error } = await supabase.from('profile_badges').upsert([{
        profile_id: awardBadgeForm.profile_id,
        badge_name: awardBadgeForm.badge_name,
        badge_description: badgeDef?.badge_description || '',
        icon: badgeDef?.icon || '🏆',
        color: badgeDef?.color || '#3B82F6',
        badge_type: badgeDef?.badge_type || 'special',
        points: badgeDef?.points || 0,
        earned_at: new Date().toISOString(),
        organization_id: orgId,
      }], { onConflict: 'profile_id,badge_name', ignoreDuplicates: true });
      if (error) throw error;
      const member = editableProfiles.find(p => String(p.id) === String(awardBadgeForm.profile_id));
      toast.success(`Badge "${awardBadgeForm.badge_name}" awarded to ${formatProfileName(member)}`);
      setShowAwardBadgeModal(false);
      setAwardBadgeForm({ badge_name: '', profile_id: '' });
      fetchBadges();
    } catch (err) {
      console.error('Award badge error:', err);
      toast.error(err?.message || 'Failed to award badge');
    } finally {
      setAwardingBadge(false);
    }
  };

  const loadBadgeDefinitions = async () => {
    try {
      const bdQuery = supabase.from('badge_definitions').select('badge_name, badge_description, icon, color, badge_type, points').order('badge_name');
      const { data } = await bdQuery;
      setAvailableBadgeDefs(data || []);
    } catch (e) {
      console.error('Error loading badge definitions:', e);
    }
  };

  // Search functionality (org-scoped)
  const handleSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      setShowSearchResults(false);
      return;
    }
    setSearching(true);
    setShowSearchResults(true);
    const results = [];
    try {
      const searchTerm = query.trim().toLowerCase();
      let profilesSearch = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (orgId) profilesSearch = profilesSearch.eq('organization_id', orgId);
      else { setSearching(false); return; }
      const { data: profiles } = await profilesSearch;
      if (profiles) {
        profiles.forEach((profile) => {
          results.push({
            type: 'User',
            title: `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || profile.email,
            subtitle: profile.role,
            link: `/profile?user=${profile.id}`,
            icon: '👤'
          });
        });
      }
      setSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (searchQuery) handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await Promise.all([fetchBadges(), fetchAchievements()]);
      await new Promise(resolve => setTimeout(resolve, 500));
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between mb-4 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1">Profile Settings</h1>
            <p className="text-apptivia-carbon-500 text-sm">Manage your personal information</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                >
                  <X size={14} />
                </button>
              )}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-apptivia-paper border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-apptivia-ink">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-apptivia-carbon-100 text-apptivia-carbon-600">{result.type}</span>
                          </div>
                          {result.subtitle && (
                            <div className="text-[11px] text-apptivia-carbon-500 mt-0.5 truncate">{result.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            {/* Refresh Icon */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-apptivia-carbon-700 border border-apptivia-carbon-200 hover:bg-apptivia-paper group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
            >
              <svg
                className={`w-[18px] h-[18px] ${isRefreshing ? 'animate-spin' : ''}`}
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                  strokeWidth={2} 
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
                />
              </svg>
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-apptivia-ink text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => { if (canConfigureScorecard) setConfigPanelOpen(true); }}
              onNotificationsClick={openPanel}
              configureDisabled={!canConfigureScorecard}
              notificationBadge={unreadCount}
              actions={[
                {
                  label: 'Export Report',
                  onClick: () => setShowExportModal(true),
                  disabled: !canExport,
                },
                {
                  label: 'Edit Profile',
                  onClick: () => setShowEditProfileModal(true),
                },
                {
                  label: 'Change Password',
                  onClick: () => setShowChangePasswordModal(true),
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg p-2 shadow-sm border border-apptivia-carbon-100">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-apptivia-coral text-white shadow-sm'
                      : 'text-apptivia-carbon-600 hover:bg-apptivia-carbon-100'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {/* Profile Details Tab */}
          {activeTab === 'profile-details' && (
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-4">
              <div>
                <h2 className="text-lg font-semibold text-apptivia-ink flex items-center gap-2">
                  <Edit size={18} className="text-apptivia-coral" />
                  Profile Details
                </h2>
                <p className="text-xs text-apptivia-carbon-500">
                  Update your personal information{canEditAnyProfile ? ' or manage profiles for any user.' : canEditTeamProfiles ? ' or update profiles for your team.' : '.'}
                </p>
              </div>
              {(canEditAnyProfile || canEditTeamProfiles) && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-apptivia-carbon-500">User</label>
                  <select
                    value={selectedProfileId}
                    onChange={(e) => setSelectedProfileId(e.target.value)}
                    className="border rounded px-2 py-2 text-sm min-w-[220px]"
                  >
                    {editableProfiles.length === 0 ? (
                      <option value="">No profiles available</option>
                    ) : (
                      editableProfiles.map((p) => (
                        <option key={p.id} value={p.id}>
                          {formatProfileName(p)}
                        </option>
                      ))
                    )}
                  </select>
                </div>
              )}
            </div>

            {!activeProfile ? (
              <div className="text-sm text-apptivia-carbon-500">No profile selected.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Profile Picture */}
                {String(activeProfile.id) === String(user?.id) && (
                  <div className="md:col-span-2 flex items-center gap-4 pb-3 border-b border-apptivia-carbon-100 mb-1">
                    <div className="relative">
                      <div className="w-16 h-16 rounded-full bg-apptivia-coral-tone-50 flex items-center justify-center text-xl font-bold text-apptivia-coral overflow-hidden">
                        {profile?.profile_picture ? (
                          <img src={profile.profile_picture} alt="Profile" className="w-full h-full object-cover" />
                        ) : (
                          getInitials(repName)
                        )}
                      </div>
                      <label className="absolute -bottom-1 -right-1 w-7 h-7 bg-apptivia-coral rounded-full flex items-center justify-center cursor-pointer hover:bg-apptivia-coral transition-colors shadow-sm">
                        <Camera size={14} className="text-white" />
                        <input type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} disabled={uploadingPhoto} />
                      </label>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-apptivia-ink">{repName}</div>
                      <div className="text-xs text-apptivia-carbon-500">{uploadingPhoto ? 'Uploading...' : 'Click camera icon to update photo'}</div>
                    </div>
                  </div>
                )}
                <div>
                  <label className="block text-xs text-apptivia-carbon-500 mb-1">First name</label>
                  <input
                    value={profileForm.first_name}
                    onChange={(e) => handleProfileFieldChange('first_name', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-apptivia-carbon-500 mb-1">Last name</label>
                  <input
                    value={profileForm.last_name}
                    onChange={(e) => handleProfileFieldChange('last_name', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-apptivia-carbon-500 mb-1">Email</label>
                  <input
                    value={profileForm.email}
                    className="w-full border rounded px-3 py-2 text-sm bg-apptivia-paper text-apptivia-carbon-500"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs text-apptivia-carbon-500 mb-1">Title</label>
                  <select
                    value={profileForm.title}
                    onChange={(e) => handleProfileFieldChange('title', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${!canEditAnyProfile ? 'bg-apptivia-paper text-apptivia-carbon-500' : ''}`}
                    disabled={profileSaving || !canEditAnyProfile}
                  >
                    <option value="">Select title...</option>
                    {titles.map((t) => (
                      <option key={t.key} value={t.label}>{t.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-apptivia-carbon-500 mb-1">Department</label>
                  <select
                    value={profileForm.department}
                    onChange={(e) => handleProfileFieldChange('department', e.target.value)}
                    className={`w-full border rounded px-3 py-2 text-sm ${!canEditAnyProfile ? 'bg-apptivia-paper text-apptivia-carbon-500' : ''}`}
                    disabled={profileSaving || !canEditAnyProfile}
                  >
                    <option value="">Select department...</option>
                    <option value="Sales">Sales</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Customer Success">Customer Success</option>
                    <option value="Product">Product</option>
                    <option value="Engineering">Engineering</option>
                    <option value="Business Development">Business Development</option>
                  </select>
                </div>
                {canEditAnyProfile ? (
                  <>
                    <div>
                      <label className="block text-xs text-apptivia-carbon-500 mb-1">Role</label>
                      <select
                        value={profileForm.role}
                        onChange={(e) => handleProfileFieldChange('role', e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={profileSaving}
                      >
                        {roleOptions.map((opt) => (
                          <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-apptivia-carbon-500 mb-1">Secondary Role</label>
                      <select
                        value={profileForm.secondary_role}
                        onChange={(e) => handleProfileFieldChange('secondary_role', e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={profileSaving}
                      >
                        <option value="">None</option>
                        {roleOptions
                          .filter(opt => opt.value !== profileForm.role)
                          .map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-apptivia-carbon-500 mb-1">Team</label>
                      <select
                        value={profileForm.team_id}
                        onChange={(e) => handleProfileFieldChange('team_id', e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={profileSaving}
                      >
                        <option value="">Unassigned</option>
                        {teams.map((t) => (
                          <option key={t.id} value={t.id}>{t.name}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs text-apptivia-carbon-500 mb-1">Segment</label>
                      <select
                        value={profileForm.segment}
                        onChange={(e) => handleProfileFieldChange('segment', e.target.value)}
                        className="w-full border rounded px-3 py-2 text-sm"
                        disabled={profileSaving}
                      >
                        <option value="">Select segment...</option>
                        <option value="Territory">Territory</option>
                        <option value="Mid-Market">Mid-Market</option>
                        <option value="Enterprise">Enterprise</option>
                      </select>
                    </div>
                  </>
                ) : (
                  <div>
                    <label className="block text-xs text-apptivia-carbon-500 mb-1">Team</label>
                    <input
                      value={teams.find(t => String(t.id) === String(activeProfile.team_id))?.name || 'Unassigned'}
                      className="w-full border rounded px-3 py-2 text-sm bg-apptivia-paper text-apptivia-carbon-500"
                      disabled
                    />
                  </div>
                )}
                <div className="md:col-span-2 flex items-center justify-between">
                  <div className="text-xs">
                    {profileError && <div className="text-red-500">{profileError}</div>}
                    {profileSuccess && <div className="text-green-600">{profileSuccess}</div>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleProfileReset}
                      className="px-3 py-1.5 text-xs rounded border"
                      disabled={profileSaving}
                    >
                      Reset
                    </button>
                    <button
                      onClick={handleProfileSave}
                      className="px-3 py-1.5 text-xs rounded bg-apptivia-coral text-white disabled:opacity-60"
                      disabled={profileSaving}
                    >
                      {profileSaving ? 'Saving...' : 'Save changes'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          )}

          {/* Badges Tab */}
          {activeTab === 'badges' && (
          <div className="bg-white rounded-lg shadow-sm p-5">
          {/* Badges Section */}
          <div id="badges">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-base flex items-center gap-2">
                <Award size={20} className="text-yellow-500" />
                Badges
              </h3>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setShareSnapshotModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg text-sm font-medium hover:bg-apptivia-coral-tone-50 transition-colors"
                >
                  <span>📸</span>
                  Share Snapshot
                </button>
                {canManageBadges && (
                  <>
                    <button
                      onClick={() => { loadBadgeDefinitions(); setShowAwardBadgeModal(true); }}
                      className="flex items-center gap-1 px-3 py-1.5 bg-amber-50 text-amber-700 rounded-lg text-sm font-medium hover:bg-amber-100 transition-colors"
                    >
                      <Gift size={14} />
                      Award Badge
                    </button>
                    <button
                      onClick={() => setShowBadgeCreationModal(true)}
                      className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                    >
                      <span>➕</span>
                      Create Custom Badge
                    </button>
                  </>
                )}
                <button
                  onClick={() => setViewAllBadgesModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg text-sm font-medium hover:bg-apptivia-carbon-100 transition-colors"
                >
                  <span>🎖️</span>
                  View All Badges
                </button>
              </div>
            </div>

            {loadingBadges ? (
              <div className="text-center py-8 text-apptivia-carbon-500">Loading badges...</div>
            ) : badges.length === 0 ? (
              <div className="text-center py-8 bg-apptivia-paper rounded-lg">
                <div className="text-apptivia-carbon-400 text-lg mb-2">No badges earned yet</div>
                <p className="text-apptivia-carbon-500 text-sm">Complete activities to earn badges.</p>
              </div>
            ) : (
              <>
                {/* Recently Earned Section */}
                {badges.slice(0, 3).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-3 flex items-center gap-2">
                      <span>✨</span>
                      Recently Earned
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {badges.slice(0, 3).map((badge) => (
                        <div
                          key={badge.id}
                          onClick={() => setBadgeModal({ isOpen: true, badge: { ...badge, name: badge.badge_name, description: badge.badge_description, earned_date: badge.earned_at, category: badge.badge_type, rarity: badge.is_featured ? 'epic' : 'common' } })}
                          className="rounded-lg p-4 text-center border-2 transition-all hover:scale-105 cursor-pointer hover:shadow-lg bg-gradient-to-br from-amber-50 to-yellow-50"
                          style={{ borderColor: badge.color || '#fbbf24' }}
                        >
                          <Tooltip text={badge.badge_description} position="bottom" wide>
                            <div className="cursor-pointer">
                              <div className="text-4xl mb-2">{badge.icon}</div>
                              <div className="font-semibold text-sm">{badge.badge_name}</div>
                              {badge.badge_description && (
                                <div className="text-xs text-apptivia-carbon-600 mt-1 line-clamp-2">{badge.badge_description}</div>
                              )}
                              <div className="text-xs text-apptivia-carbon-400 mt-2">
                                {new Date(badge.earned_at).toLocaleDateString()}
                              </div>
                            </div>
                          </Tooltip>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Badges Grid */}
                <div>
                  <h4 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">All Badges ({badges.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(showAllBadges ? badges : badges.slice(0, 8)).map((badge) => (
                      <div
                        key={badge.id}
                        onClick={() => setBadgeModal({ isOpen: true, badge: { ...badge, name: badge.badge_name, description: badge.badge_description, earned_date: badge.earned_at, category: badge.badge_type, rarity: badge.is_featured ? 'epic' : 'common' } })}
                        className={`rounded-lg p-4 text-center border-2 transition-all hover:scale-105 cursor-pointer hover:shadow-lg ${
                          badge.is_featured ? 'bg-gradient-to-br from-amber-50 to-yellow-50 shadow-md' : 'bg-white'
                        }`}
                        style={{ borderColor: badge.color || '#e5e7eb' }}
                      >
                        <Tooltip text={badge.badge_description} position="bottom" wide>
                          <div className="cursor-pointer">
                            {badge.is_featured && (
                              <div className="text-xs font-bold text-orange-600 mb-1">⭐ FEATURED</div>
                            )}
                            <div className="text-4xl mb-2">{badge.icon}</div>
                            <div className="font-semibold text-sm">{badge.badge_name}</div>
                            {badge.badge_description && (
                              <div className="text-xs text-apptivia-carbon-600 mt-1 line-clamp-2">{badge.badge_description}</div>
                            )}
                            {(badge.contest?.name || badge.achievement?.name) && (
                              <div className="text-xs text-apptivia-coral mt-1 font-medium truncate">
                                {badge.contest?.name || badge.achievement?.name}
                              </div>
                            )}
                            <div className="text-xs text-apptivia-carbon-400 mt-2">
                              {new Date(badge.earned_at).toLocaleDateString()}
                            </div>
                          </div>
                        </Tooltip>
                      </div>
                    ))}
                  </div>
                  {badges.length > 8 && (
                    <button
                      onClick={() => setShowAllBadges(!showAllBadges)}
                      className="w-full mt-4 py-2 text-apptivia-coral hover:text-apptivia-coral font-medium text-sm"
                    >
                      {showAllBadges ? 'Show Less' : `Show All ${badges.length} Badges`}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
          </div>
        )}

        {/* Skillset Progress Tab */}
        {activeTab === 'skillset-progress' && (
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div id="achievements">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-500" />
                  {isTeamSkillsetView ? 'Team Skillset Progress' : 'Skillset Progress'}
                  {isTeamSkillsetView && <span className="text-xs font-normal text-apptivia-carbon-500 ml-1">(team average)</span>}
                </h3>
              </div>

              {loadingAchievements ? (
                <div className="text-center py-8 text-apptivia-carbon-500">Loading achievements...</div>
              ) : achievements.length === 0 ? (
                <div className="text-center py-8 bg-apptivia-paper rounded-lg">
                  <div className="text-apptivia-carbon-400 text-lg mb-2">No achievements tracked yet</div>
                  <p className="text-apptivia-carbon-500 text-sm">Start completing achievements to unlock rewards!</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {achievements.map((achievement) => {
                    const pct = Math.round(achievement.progress || 0);
                    const color = achievement.skillset?.color || '#3B82F6';
                    return (
                      <div
                        key={achievement.id}
                        onClick={() => navigate('/coach')}
                        className="border rounded-lg px-4 py-3 hover:shadow-md transition-shadow cursor-pointer"
                        style={{ borderLeftWidth: '4px', borderLeftColor: color }}
                      >
                        <div className="flex items-center justify-between mb-1.5">
                          <div className="flex items-center gap-2">
                            {achievement.skillset?.icon && <span>{achievement.skillset.icon}</span>}
                            <span className="font-semibold text-sm">{achievement.skillset?.name || 'Unknown Skillset'}</span>
                            {achievement.skillset?.description && (
                              <span className="text-xs text-apptivia-carbon-500 hidden sm:inline">— {achievement.skillset.description}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-xs">
                              <span className="text-emerald-600 font-medium">{achievement.achievements_completed || 0} earned</span>
                              <span className="text-apptivia-carbon-300">|</span>
                              <span className="text-apptivia-coral font-medium">{achievement.points || 0} pts</span>
                              {pct >= 100 && (
                                <>
                                  <span className="text-apptivia-carbon-300">|</span>
                                  <span className="text-green-600 font-medium">Mastered!</span>
                                </>
                              )}
                            </div>
                            <Tooltip text="Percentage of total achievement points earned" wide>
                              <span className="text-lg font-bold cursor-help" style={{ color }}>{pct}%</span>
                            </Tooltip>
                          </div>
                        </div>
                        <div className="w-full bg-apptivia-carbon-200 rounded-full h-1.5">
                          <div
                            className="h-1.5 rounded-full transition-all duration-300"
                            style={{ width: `${pct}%`, backgroundColor: color }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
          {/* [FEATURE 2] Notification Preferences Tab */}
          {activeTab === 'notifications' && (
          <div className="bg-white rounded-lg shadow-sm p-5">
            <h2 className="text-lg font-semibold text-apptivia-ink mb-1">Notification Preferences</h2>
            <p className="text-xs text-apptivia-carbon-500 mb-4">Choose how you receive coaching nudges from Aaron.</p>

            <div className="space-y-3 max-w-md">
              <div>
                <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1.5">Nudge Delivery Channel</label>
                <div className="space-y-2">
                  {[
                    { value: 'in_app', label: 'In-App Only', desc: 'Notifications appear in the bell icon' },
                    { value: 'email', label: 'Email', desc: 'In-app + email delivery' },
                    { value: 'slack', label: 'Slack', desc: 'In-app + Slack message' },
                    { value: 'email_and_slack', label: 'Email + Slack', desc: 'All channels' },
                  ].map(opt => (
                    <label key={opt.value} className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="nudge_channel"
                        value={opt.value}
                        checked={nudgeChannel === opt.value}
                        onChange={() => setNudgeChannel(opt.value)}
                        className="mt-0.5"
                      />
                      <div>
                        <span className="text-sm font-medium text-apptivia-ink">{opt.label}</span>
                        <p className="text-[10px] text-apptivia-carbon-500">{opt.desc}</p>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {(nudgeChannel === 'slack' || nudgeChannel === 'email_and_slack') && (
                <div>
                  <label className="block text-xs font-medium text-apptivia-carbon-700 mb-1">Slack Incoming Webhook URL</label>
                  <input
                    type="url"
                    value={slackWebhookUrl}
                    onChange={e => setSlackWebhookUrl(e.target.value)}
                    placeholder="https://hooks.slack.com/services/..."
                    className="w-full px-3 py-2 text-sm border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-apptivia-coral"
                  />
                  <p className="text-[10px] text-apptivia-carbon-400 mt-1">
                    <a href="https://api.slack.com/messaging/webhooks" target="_blank" rel="noopener noreferrer" className="text-apptivia-coral hover:underline">How to create an incoming webhook</a>
                  </p>
                </div>
              )}

              <button
                onClick={handleSaveNudgePrefs}
                disabled={savingNudgePrefs}
                className="px-4 py-2 bg-apptivia-coral text-white text-sm font-semibold rounded-lg hover:bg-apptivia-coral disabled:opacity-50 transition-colors"
              >
                {savingNudgePrefs ? 'Saving...' : 'Save Preferences'}
              </button>
            </div>
          </div>
          )}

          {/* Integrations Tab */}
          {activeTab === 'integrations' && canConnectIntegrations && (<>

          {/* Org-level integrations (read-only) */}
          {connectedOrgIntegrations.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm p-5 mb-5">
            <div className="mb-4">
              <div className="flex items-center gap-2">
                <Building2 size={18} className="text-apptivia-coral" />
                <h2 className="text-lg font-semibold text-apptivia-ink">Org Integrations</h2>
              </div>
              <p className="text-xs text-apptivia-carbon-500 mt-0.5 ml-7">Connected by your admin — data syncs automatically for all team members</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {connectedOrgIntegrations.map((integration) => {
                const template = SUPPORTED_INTEGRATIONS.find(t => t.integration_type === integration.integration_type);
                if (!template) return null;
                return (
                  <div key={integration.id} className="bg-apptivia-paper rounded-lg p-5 border border-apptivia-carbon-100 flex flex-col">
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`w-11 h-11 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                        {template.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-apptivia-ink text-sm">{template.display_name}</div>
                        <div className="text-xs text-apptivia-carbon-500 truncate">{template.description}</div>
                      </div>
                      <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />
                    </div>
                    <div className="mb-3">
                      <span className="inline-flex items-center gap-1 text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2.5 py-1 rounded-full font-medium">
                        <Building2 size={11} /> Org-wide
                      </span>
                    </div>
                    {integration.last_sync_at && (
                      <div className="text-xs text-apptivia-carbon-400 flex items-center gap-1">
                        <Clock size={11} />
                        Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          )}

          {/* Personal integrations */}
          <div className="bg-white rounded-lg shadow-sm p-5">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-apptivia-ink">Personal Integrations</h2>
                <p className="text-xs text-apptivia-carbon-500">Connect your personal accounts to sync data</p>
              </div>
              <button onClick={refreshIntegrations} className="p-2 rounded-lg text-apptivia-carbon-500 hover:bg-apptivia-carbon-100 transition-colors" title="Refresh">
                <RefreshCw size={16} />
              </button>
            </div>

            {integrationError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                <AlertCircle size={16} />
                {integrationError}
              </div>
            )}

            {integrationsLoading ? (
              <div className="flex items-center justify-center py-12 text-apptivia-carbon-400">
                <Loader2 size={20} className="animate-spin mr-2" />
                Loading integrations...
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {personalTemplates.map((template) => {
                  const integration = personalIntegrations.find(i => i.integration_type === template.integration_type);
                  const isConnected = integration?.status === 'connected';
                  const isError = integration?.status === 'error';

                  return (
                    <div key={template.integration_type} className="bg-white rounded-lg p-5 shadow-sm border border-apptivia-carbon-100 flex flex-col hover:shadow-md transition-shadow">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-11 h-11 bg-gradient-to-br ${template.color} rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm`}>
                          {template.icon}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="font-semibold text-apptivia-ink text-sm">{template.display_name}</div>
                          <div className="text-xs text-apptivia-carbon-500 truncate">{template.description}</div>
                        </div>
                        {isConnected && <div className="w-2.5 h-2.5 rounded-full bg-green-500 shrink-0" title="Connected" />}
                        {isError && <div className="w-2.5 h-2.5 rounded-full bg-red-500 shrink-0" title="Error" />}
                      </div>

                      <div className="mb-3">
                        {isConnected && (
                          <span className="inline-flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2.5 py-1 rounded-full font-medium">
                            <CheckCircle size={12} /> Connected
                          </span>
                        )}
                        {isError && (
                          <span className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-700 px-2.5 py-1 rounded-full font-medium">
                            <AlertCircle size={12} /> Error
                          </span>
                        )}
                        {!integration && (
                          <span className="inline-flex items-center gap-1 text-xs bg-apptivia-paper text-apptivia-carbon-500 px-2.5 py-1 rounded-full font-medium">
                            Available
                          </span>
                        )}
                      </div>

                      {isConnected && integration?.last_sync_at && (
                        <div className="text-xs text-apptivia-carbon-400 mb-3 flex items-center gap-1">
                          <Clock size={11} />
                          Last synced: {new Date(integration.last_sync_at).toLocaleString()}
                        </div>
                      )}

                      <div className="mt-auto">
                        {isConnected ? (
                          <button
                            onClick={() => setConfirmDisconnect(integration.id)}
                            className="w-full py-1.5 text-xs text-red-500 hover:text-red-700 hover:bg-red-50 rounded-md transition-colors"
                          >
                            Disconnect
                          </button>
                        ) : API_KEY_PROVIDERS[template.integration_type] ? (
                          <button
                            onClick={() => setCredentialsModal(template.integration_type)}
                            className="w-full flex items-center justify-center gap-1.5 bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral transition-colors"
                          >
                            <Key size={14} /> Connect with API Key
                          </button>
                        ) : (
                          <button
                            onClick={() => connectOAuth(template.integration_type)}
                            className="w-full bg-apptivia-coral text-white py-2 rounded-md text-sm font-medium hover:bg-apptivia-coral transition-colors"
                          >
                            Connect
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          </>)}

      </div> {/* Close space-y-6 */}
      </div> {/* Close p-6 */}

      {/* Modals */}
      {showAdminTeamsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowAdminTeamsModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-6xl rounded-lg shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-apptivia-ink">Team Management</h2>
                  <p className="text-xs text-apptivia-carbon-500">Manage teams and team members across the organization</p>
                </div>
                <button
                  onClick={() => setShowAdminTeamsModal(false)}
                  className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-apptivia-paper rounded-lg p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-apptivia-carbon-600">Teams</div>
                    <span className="text-[10px] text-apptivia-carbon-400">Manage in Systems</span>
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
                <div className="lg:col-span-2 bg-white rounded-lg border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-apptivia-carbon-500">Team members</div>
                      <div className="text-sm font-semibold text-apptivia-ink">
                        {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Select a team'}
                      </div>
                    </div>
                    <div className="text-xs text-apptivia-carbon-400">
                      Team member management available in Systems → Permissions & Teams
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
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
        {showManagerTeamsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowManagerTeamsModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-5xl rounded-lg shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-apptivia-ink">Team Settings</h2>
                  <p className="text-xs text-apptivia-carbon-500">Manage your assigned team members and integrations</p>
                </div>
                <button
                  onClick={() => setShowManagerTeamsModal(false)}
                  className="text-apptivia-carbon-400 hover:text-apptivia-carbon-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="bg-white rounded-lg border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-apptivia-carbon-500">Team</div>
                    <div className="text-sm font-semibold text-apptivia-ink">
                      {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Your Team'}
                    </div>
                  </div>
                  <div className="text-xs text-apptivia-carbon-400">
                    Manage members in Systems → Permissions & Teams
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-apptivia-carbon-500">
                        <th className="py-2">Team Member</th>
                        <th className="py-2">Role</th>
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.length === 0 ? (
                        <tr>
                          <td colSpan={2} className="py-4 text-center text-apptivia-carbon-500">No team members available.</td>
                        </tr>
                      ) : (
                        teamMembers.map((member) => (
                          <tr key={member.id} className="border-t">
                            <td className="py-2">
                              <div className="font-semibold text-apptivia-ink">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                            </td>
                            <td className="py-2 text-apptivia-carbon-500">{normalizeRole(member.role)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}
        <ConfigurePanel
          isOpen={configPanelOpen}
          onClose={() => setConfigPanelOpen(false)}
          onOpenAdvanced={() => setShowConfigModal(true)}
        />
        <ConfigureModal
          isOpen={showConfigModal}
          onClose={() => setShowConfigModal(false)}
        />
        <RightFilterPanel
          isOpen={filtersOpen}
          onClose={() => setFiltersOpen(false)}
          title="Profile Filters"
          subtitle="Filter profile views"
          showReset
        >
          <div className="text-xs text-apptivia-carbon-500">No filters available yet.</div>
        </RightFilterPanel>
      <BadgeModal
        isOpen={badgeModal.isOpen}
        onClose={() => setBadgeModal({ isOpen: false, badge: null })}
        badge={badgeModal.badge}
        profileName={`${profile?.first_name || ''} ${profile?.last_name || ''}`.trim()}
      />
      <ViewAllBadgesModal
        isOpen={viewAllBadgesModal}
        onClose={() => setViewAllBadgesModal(false)}
        userId={activeProfile?.id || user?.id || profile?.id}
        refreshKey={badgeRefreshKey}
      />
      <BadgeCreationModal
        isOpen={showBadgeCreationModal}
        onClose={() => setShowBadgeCreationModal(false)}
        onBadgeCreated={() => {
          setBadgeRefreshKey((prev) => prev + 1);
        }}
      />
      <ShareSnapshotModal
        isOpen={shareSnapshotModal}
        onClose={() => setShareSnapshotModal(false)}
        userData={{
          id: profile?.id,
          name: `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim(),
          badges: badges,
          achievements: achievements,
          skillsets: achievements,
          points: profile?.points || 0,
          profile_picture: profile?.profile_picture || null
        }}
      />
      <EditProfileModal
        isOpen={showEditProfileModal}
        onClose={() => setShowEditProfileModal(false)}
        profile={profile}
        onSuccess={() => {
          refreshProfile?.();
          addNotification({
            type: 'success',
            title: 'Profile Updated',
            message: 'Your profile has been updated successfully',
            dedupeKey: 'profile-updated',
          });
        }}
      />
      <ChangePasswordModal
        isOpen={showChangePasswordModal}
        onClose={() => setShowChangePasswordModal(false)}
        onSuccess={() => {
          addNotification({
            type: 'success',
            title: 'Password Changed',
            message: 'Your password has been changed successfully',
            dedupeKey: 'password-changed',
          });
        }}
      />
      {/* Award Badge Modal */}
      {showAwardBadgeModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setShowAwardBadgeModal(false)}>
          <div className="bg-white rounded-lg shadow-2xl max-w-md w-full" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-apptivia-carbon-200">
              <div className="flex items-center gap-2">
                <Gift size={20} className="text-amber-500" />
                <h3 className="text-lg font-bold text-apptivia-ink">Award Badge</h3>
              </div>
              <button onClick={() => setShowAwardBadgeModal(false)} className="p-2 hover:bg-apptivia-carbon-100 rounded-lg">
                <X size={18} className="text-apptivia-carbon-400" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1.5">Badge</label>
                <select
                  value={awardBadgeForm.badge_name}
                  onChange={(e) => setAwardBadgeForm(prev => ({ ...prev, badge_name: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                >
                  <option value="">Select a badge...</option>
                  {availableBadgeDefs.map((b) => (
                    <option key={b.badge_name} value={b.badge_name}>{b.icon} {b.badge_name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1.5">Team Member</label>
                <select
                  value={awardBadgeForm.profile_id}
                  onChange={(e) => setAwardBadgeForm(prev => ({ ...prev, profile_id: e.target.value }))}
                  className="w-full px-3 py-2 text-sm border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-apptivia-coral focus:border-transparent"
                >
                  <option value="">Select a member...</option>
                  {editableProfiles.filter(p => !['admin', 'manager'].includes(normalizeRole(p.role))).map((p) => (
                    <option key={p.id} value={p.id}>{formatProfileName(p)}</option>
                  ))}
                </select>
              </div>
              {awardBadgeForm.badge_name && (() => {
                const sel = availableBadgeDefs.find(b => b.badge_name === awardBadgeForm.badge_name);
                return sel ? (
                  <div className="flex items-center gap-3 p-3 bg-amber-50 rounded-lg border border-amber-200">
                    <span className="text-3xl">{sel.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-apptivia-ink">{sel.badge_name}</div>
                      <div className="text-xs text-apptivia-carbon-600">{sel.badge_description}</div>
                      <div className="text-xs text-amber-600 font-medium mt-0.5">{sel.points} points</div>
                    </div>
                  </div>
                ) : null;
              })()}
              <div className="flex gap-2 pt-2">
                <button
                  onClick={handleAwardBadge}
                  disabled={awardingBadge || !awardBadgeForm.badge_name || !awardBadgeForm.profile_id}
                  className="flex-1 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {awardingBadge ? 'Awarding...' : 'Award Badge'}
                </button>
                <button
                  onClick={() => setShowAwardBadgeModal(false)}
                  className="px-4 py-2 bg-apptivia-carbon-200 text-apptivia-carbon-700 rounded-lg text-sm font-medium hover:bg-apptivia-carbon-300 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={(format) => {
          if (format === 'csv') exportBadgesToCSV(badges, profile);
          else if (format === 'pdf') exportBadgesToPDF(badges, profile);
        }}
        title="Export Badge Collection"
      />
      {canConnectIntegrations && (
        <>
          <CredentialsModal
            providerType={credentialsModal}
            onClose={() => setCredentialsModal(null)}
            onConnect={async (providerType, credentials) => {
              await connectCredentials(providerType, credentials);
              setCredentialsModal(null);
            }}
            error={integrationError}
          />
          <DisconnectConfirmModal
            isOpen={!!confirmDisconnect}
            onClose={() => setConfirmDisconnect(null)}
            onConfirm={async () => {
              await disconnectIntegration(confirmDisconnect);
              setConfirmDisconnect(null);
            }}
          />
        </>
      )}
    </DashboardLayout>
  );
}
