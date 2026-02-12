import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAuth } from '../AuthContext';
import { Edit, Camera, Award, TrendingUp, Search, X } from 'lucide-react';
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
import { normalizeRole } from '../permissions';
import { supabase } from '../supabaseClient';
import { useNotifications } from '../contexts/NotificationContext';

export default function Profile() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission, refreshProfile } = useAuth();
  const [photo, setPhoto] = useState(null);
  const [badges, setBadges] = useState([]);
  const [badgeModal, setBadgeModal] = useState({ isOpen: false, badge: null });
  const [viewAllBadgesModal, setViewAllBadgesModal] = useState(false);
  const [showBadgeCreationModal, setShowBadgeCreationModal] = useState(false);
  const [badgeRefreshKey, setBadgeRefreshKey] = useState(0);
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
    team_id: ''
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

  const isAdmin = role === 'admin';
  const isManager = role === 'manager';
  const teamId = profile?.team_id ? String(profile.team_id) : user?.team_id ? String(user.team_id) : null;
  const canConfigureScorecard = hasPermission('configure_scorecard');
  const canManageTeams = hasPermission('manage_teams');
  const canManageTeamMembers = hasPermission('manage_team_members');
  const canExport = hasPermission('export_data');
  const canEditAnyProfile = isAdmin;
  const canEditTeamProfiles = isManager && canManageTeamMembers;
  const canManageBadges = isAdmin || role === 'manager';

  const integrations = useMemo(() => (['Salesforce', 'Gong', 'Outreach', 'Calendar']), []);
  const repName = useMemo(() => {
    const first = profile?.first_name || '';
    const last = profile?.last_name || '';
    const full = `${first} ${last}`.trim();
    return full || profile?.name || user?.name || user?.email || 'Unknown';
  }, [profile, user]);

  const tabs = useMemo(() => ([
    { id: 'profile-details', label: 'Profile Details' },
    { id: 'skillset-progress', label: 'Skillset Progress' },
    { id: 'badges', label: 'Badges' },
  ]), []);

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
        .select('id, first_name, last_name, email, role, team_id, department, title')
        .order('first_name');
      if (canEditTeamProfiles && !canEditAnyProfile && teamId) {
        query = query.eq('team_id', teamId);
      }
      const { data, error } = await query;
      if (!error) setProfilesList(data || []);
    } catch (e) {
      console.error('Error loading editable profiles:', e);
    }
  }, [user?.id, canEditAnyProfile, canEditTeamProfiles, teamId, profile]);

  useEffect(() => {
    loadEditableProfiles();
  }, [loadEditableProfiles]);

  const loadTeams = async () => {
    try {
      const { data, error } = await supabase.from('teams').select('*').order('name');
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
    if (isAdmin || canEditTeamProfiles) {
      loadTeams();
    }
  }, [isAdmin, canEditTeamProfiles]);


  const loadTeamMembers = async (teamIdValue) => {
    if (!teamIdValue) {
      setTeamMembers([]);
      return;
    }
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role, team_id')
        .eq('team_id', teamIdValue)
        .order('first_name');
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
      team_id: activeProfile.team_id ? String(activeProfile.team_id) : ''
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
      team_id: activeProfile.team_id ? String(activeProfile.team_id) : ''
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
      title: profileForm.title?.trim() || null,
      department: profileForm.department?.trim() || null
    };
    if (canEditAnyProfile) {
      payload.role = profileForm.role || 'power_user';
      payload.team_id = profileForm.team_id || null;
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
        .eq('profile_id', user.id)
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
      const { data, error } = await supabase
        .from('profile_skillsets')
        .select(`
          *,
          skillset:skillsets(
            id,
            name,
            description,
            color,
            icon
          )
        `)
        .eq('profile_id', user.id)
        .order('progress', { ascending: false });

      if (error) {
        console.error('Error fetching achievements:', error);
        throw error;
      }
      
      console.log('Profile achievements data:', data);
      setAchievements(data || []);
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
    if (achievements.length === 0) return;
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
  const handlePhotoUpload = (e) => {
    if (e.target.files && e.target.files[0]) {
      setPhoto(URL.createObjectURL(e.target.files[0]));
    }
  };


  const getIntegrationStatus = (memberId, integrationName) => {
    const seed = `${memberId || ''}-${integrationName}`;
    let hash = 0;
    for (let i = 0; i < seed.length; i += 1) {
      hash = (hash + seed.charCodeAt(i)) % 10;
    }
    return hash % 2 === 0;
  };

  // Search functionality
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
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
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
            <h1 className="text-2xl font-bold text-blue-700 mb-1">Profile Settings</h1>
            <p className="text-gray-500 text-sm">Manage your personal information</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => searchQuery && setShowSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              {searchQuery && (
                <button
                  onClick={() => {
                    setSearchQuery('');
                    setSearchResults([]);
                    setShowSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  <X size={14} />
                </button>
              )}
              {showSearchResults && searchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {searchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(result.link);
                        setSearchQuery('');
                        setSearchResults([]);
                        setShowSearchResults(false);
                      }}
                      className="w-full text-left px-4 py-3 hover:bg-gray-50 border-b last:border-b-0 transition-colors"
                    >
                      <div className="flex items-start gap-3">
                        <span className="text-xl">{result.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-gray-900">{result.title}</span>
                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-600">{result.type}</span>
                          </div>
                          {result.subtitle && (
                            <div className="text-[11px] text-gray-500 mt-0.5 truncate">{result.subtitle}</div>
                          )}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
              {showSearchResults && searchQuery && searchResults.length === 0 && !searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">No results found</div>
                </div>
              )}
              {searching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-gray-500 text-center">Searching...</div>
                </div>
              )}
            </div>
            {/* Refresh Icon */}
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className={`relative p-2 rounded-lg font-semibold text-sm bg-white text-gray-700 border border-gray-200 hover:bg-gray-50 group ${
                isRefreshing ? 'opacity-50 cursor-not-allowed' : 'transition-all duration-200 hover:scale-105 hover:shadow-md'
              }`}
              title="Refresh data"
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
              <span className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-50">
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </span>
            </button>
            <PageActionBar
              onFilterClick={() => setFiltersOpen(true)}
              onConfigureClick={() => { if (canConfigureScorecard) setConfigPanelOpen(true); }}
              onExportClick={() => {}}
              onNotificationsClick={openPanel}
              exportDisabled={!canExport}
              configureDisabled={!canConfigureScorecard}
              notificationBadge={unreadCount}
              actions={[
                {
                  label: 'Edit Profile',
                  onClick: () => setShowEditProfileModal(true),
                  disabled: false,
                },
                {
                  label: 'Change Password',
                  onClick: () => setShowChangePasswordModal(true),
                  disabled: false,
                },
              ]}
            />
          </div>
        </div>

        <div className="space-y-6">
          {/* Tab Navigation */}
          <div className="bg-white rounded-lg p-2 shadow-sm border border-gray-100">
            <div className="flex flex-wrap gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                    activeTab === tab.id
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-600 hover:bg-gray-100'
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
                <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                  <Edit size={18} className="text-blue-500" />
                  Profile Details
                </h2>
                <p className="text-xs text-gray-500">
                  Update your personal information{canEditAnyProfile ? ' or manage profiles for any user.' : canEditTeamProfiles ? ' or update profiles for your team.' : '.'}
                </p>
              </div>
              {(canEditAnyProfile || canEditTeamProfiles) && (
                <div className="flex items-center gap-2">
                  <label className="text-xs text-gray-500">User</label>
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
              <div className="text-sm text-gray-500">No profile selected.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-gray-500 mb-1">First name</label>
                  <input
                    value={profileForm.first_name}
                    onChange={(e) => handleProfileFieldChange('first_name', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Last name</label>
                  <input
                    value={profileForm.last_name}
                    onChange={(e) => handleProfileFieldChange('last_name', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Email</label>
                  <input
                    value={profileForm.email}
                    className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
                    disabled
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Title</label>
                  <input
                    value={profileForm.title}
                    onChange={(e) => handleProfileFieldChange('title', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                <div>
                  <label className="block text-xs text-gray-500 mb-1">Department</label>
                  <input
                    value={profileForm.department}
                    onChange={(e) => handleProfileFieldChange('department', e.target.value)}
                    className="w-full border rounded px-3 py-2 text-sm"
                    disabled={profileSaving}
                  />
                </div>
                {canEditAnyProfile ? (
                  <>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Role</label>
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
                      <label className="block text-xs text-gray-500 mb-1">Team</label>
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
                  </>
                ) : (
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Team</label>
                    <input
                      value={teams.find(t => String(t.id) === String(activeProfile.team_id))?.name || 'Unassigned'}
                      className="w-full border rounded px-3 py-2 text-sm bg-gray-50 text-gray-500"
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
                      className="px-3 py-1.5 text-xs rounded bg-blue-600 text-white disabled:opacity-60"
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
                  className="flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
                >
                  <span>📸</span>
                  Share Snapshot
                </button>
                {canManageBadges && (
                  <button
                    onClick={() => setShowBadgeCreationModal(true)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-emerald-50 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-100 transition-colors"
                  >
                    <span>➕</span>
                    Create Custom Badge
                  </button>
                )}
                <button
                  onClick={() => setViewAllBadgesModal(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-sm font-medium hover:bg-indigo-100 transition-colors"
                >
                  <span>🎖️</span>
                  View All Badges
                </button>
              </div>
            </div>

            {loadingBadges ? (
              <div className="text-center py-8 text-gray-500">Loading badges...</div>
            ) : badges.length === 0 ? (
              <div className="text-center py-8 bg-gray-50 rounded-lg">
                <div className="text-gray-400 text-lg mb-2">No badges earned yet</div>
                <p className="text-gray-500 text-sm">Complete activities to earn badges.</p>
              </div>
            ) : (
              <>
                {/* Recently Earned Section */}
                {badges.slice(0, 3).length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                      <span>✨</span>
                      Recently Earned
                    </h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {badges.slice(0, 3).map((badge) => (
                        <div
                          key={badge.id}
                          onClick={() => setBadgeModal({ isOpen: true, badge: { ...badge, name: badge.badge_name, description: badge.badge_description, earned_date: badge.earned_at } })}
                          className="rounded-lg p-4 border-2 transition-all hover:scale-105 cursor-pointer hover:shadow-lg bg-gradient-to-br from-amber-50 to-yellow-50"
                          style={{ borderColor: badge.color || '#fbbf24' }}
                          title={badge.badge_description}
                        >
                          <div className="text-4xl mb-2 text-center">{badge.icon}</div>
                          <div className="font-semibold text-sm text-center">{badge.badge_name}</div>
                          {badge.badge_description && (
                            <div className="text-xs text-gray-600 mt-1 line-clamp-2 text-center">{badge.badge_description}</div>
                          )}
                          <div className="text-xs text-gray-400 mt-2 text-center">
                            {new Date(badge.earned_at).toLocaleDateString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* All Badges Grid */}
                <div>
                  <h4 className="text-sm font-semibold text-gray-700 mb-3">All Badges ({badges.length})</h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {(showAllBadges ? badges : badges.slice(0, 8)).map((badge) => (
                      <div
                        key={badge.id}
                        onClick={() => setBadgeModal({ isOpen: true, badge: { ...badge, name: badge.badge_name, description: badge.badge_description, earned_date: badge.earned_at } })}
                        className={`rounded-lg p-4 text-center border-2 transition-all hover:scale-105 cursor-pointer hover:shadow-lg ${
                          badge.is_featured ? 'bg-gradient-to-br from-yellow-50 to-orange-50 shadow-md' : 'bg-white'
                        }`}
                        style={{ borderColor: badge.color || '#e5e7eb' }}
                        title={badge.badge_description}
                      >
                        {badge.is_featured && (
                          <div className="text-xs font-bold text-orange-600 mb-1">⭐ FEATURED</div>
                        )}
                        <div className="text-4xl mb-2">{badge.icon}</div>
                        <div className="font-semibold text-sm">{badge.badge_name}</div>
                        {badge.badge_description && (
                          <div className="text-xs text-gray-600 mt-1 line-clamp-2">{badge.badge_description}</div>
                        )}
                        {(badge.contest?.name || badge.achievement?.name) && (
                          <div className="text-xs text-blue-600 mt-1 font-medium truncate">
                            {badge.contest?.name || badge.achievement?.name}
                          </div>
                        )}
                        <div className="text-xs text-gray-400 mt-2">
                          {new Date(badge.earned_at).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                  {badges.length > 8 && (
                    <button
                      onClick={() => setShowAllBadges(!showAllBadges)}
                      className="w-full mt-4 py-2 text-blue-600 hover:text-blue-700 font-medium text-sm"
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
            {/* Achievements/Skillsets Progress */}
            <div id="achievements">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-base flex items-center gap-2">
                  <TrendingUp size={20} className="text-green-500" />
                  Skillset Progress
                </h3>
                {achievements.length > 3 && (
                  <button
                    onClick={() => setShowAllAchievements(!showAllAchievements)}
                    className="text-blue-600 hover:underline text-sm font-medium"
                  >
                    {showAllAchievements ? 'Show Less' : 'Show All'}
                  </button>
                )}
              </div>

              {loadingAchievements ? (
                <div className="text-center py-8 text-gray-500">Loading achievements...</div>
              ) : achievements.length === 0 ? (
                <div className="text-center py-8 bg-gray-50 rounded-lg">
                  <div className="text-gray-400 text-lg mb-2">No achievements tracked yet</div>
                  <p className="text-gray-500 text-sm">Start completing achievements to unlock rewards!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {(showAllAchievements ? achievements : achievements.slice(0, 3)).map((achievement) => (
                    <div
                      key={achievement.id}
                      className="border rounded-lg p-4 hover:shadow-md transition-shadow"
                      style={{ borderLeftWidth: '4px', borderLeftColor: achievement.skillset?.color || '#3B82F6' }}
                    >
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="font-semibold text-base flex items-center gap-2">
                            {achievement.skillset?.icon && <span>{achievement.skillset.icon}</span>}
                            {achievement.skillset?.name || 'Unknown Skillset'}
                          </div>
                          {achievement.skillset?.description && (
                            <div className="text-sm text-gray-600 mt-1">{achievement.skillset.description}</div>
                          )}
                        </div>
                        <div className="text-right ml-4">
                          <div className="text-2xl font-bold" style={{ color: achievement.skillset?.color || '#3B82F6' }}>
                            {Math.round(achievement.progress || 0)}%
                          </div>
                          <div className="text-xs text-gray-500 mt-1">
                            {achievement.achievements_completed || 0} of 100 achievements
                          </div>
                        </div>
                      </div>
                      
                      {/* Velocity & Activity Metrics */}
                      <div className="flex items-center gap-3 mb-3 text-xs">
                        <div className="flex items-center gap-1 text-emerald-600">
                          <span>📈</span>
                          <span className="font-medium">3 this week</span>
                        </div>
                        <div className="flex items-center gap-1 text-blue-600">
                          <span>🔥</span>
                          <span className="font-medium">5 day streak</span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-500">
                          <span>⏳</span>
                          <span>~{Math.ceil((100 - (achievement.achievements_completed || 0)) / 3)} weeks to 100%</span>
                        </div>
                      </div>
                      
                      <div className="mb-2">
                        <div className="flex justify-between text-xs text-gray-600 mb-1">
                          <span className="font-medium">Progress to next milestone</span>
                          {achievement.next_milestone && (
                            <span className="text-blue-600 font-semibold">{achievement.next_milestone}</span>
                          )}
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2">
                          <div
                            className="h-2 rounded-full transition-all duration-300"
                            style={{
                              width: `${achievement.progress || 0}%`,
                              backgroundColor: achievement.skillset?.color || '#3B82F6'
                            }}
                          />
                        </div>
                      </div>

                      {/* View Achievements Button */}
                      <button
                        onClick={() => navigate('/coach')}
                        className="w-full mt-2 py-2 px-3 rounded-lg text-sm font-medium transition-colors hover:opacity-80"
                        style={{ 
                          backgroundColor: `${achievement.skillset?.color || '#3B82F6'}15`,
                          color: achievement.skillset?.color || '#3B82F6'
                        }}
                      >
                        View All Achievements →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div> {/* Close space-y-6 */}
      </div> {/* Close p-6 */}

      {/* Modals */}
      {showAdminTeamsModal && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
            onClick={() => setShowAdminTeamsModal(false)}
          >
            <div
              className="bg-white w-[95%] max-w-6xl rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Team Management</h2>
                  <p className="text-xs text-gray-500">Manage teams and team members across the organization</p>
                </div>
                <button
                  onClick={() => setShowAdminTeamsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="bg-gray-50 rounded-xl p-3 border">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-gray-600">Teams</div>
                    <button className="text-xs text-blue-600 font-semibold">+ Add Team</button>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {teams.length === 0 ? (
                      <div className="text-xs text-gray-500">No teams found.</div>
                    ) : (
                      teams.map((team) => (
                        <button
                          key={team.id}
                          onClick={() => setSelectedTeamId(String(team.id))}
                          className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium transition-all ${String(team.id) === String(selectedTeamId) ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-100'}`}
                        >
                          <div>{team.name}</div>
                          <div className={`${String(team.id) === String(selectedTeamId) ? 'text-blue-100' : 'text-gray-400'} text-[10px]`}>{team.department || 'No department'}</div>
                        </button>
                      ))
                    )}
                  </div>
                </div>
                <div className="lg:col-span-2 bg-white rounded-xl border p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="text-xs text-gray-500">Team members</div>
                      <div className="text-sm font-semibold text-gray-900">
                        {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Select a team'}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button className="text-xs font-semibold text-blue-600">+ Add Member</button>
                      <button className="text-xs font-semibold text-red-500">Remove Member</button>
                    </div>
                  </div>
                  <div className="space-y-2 max-h-[420px] overflow-auto">
                    {teamMembers.length === 0 ? (
                      <div className="text-xs text-gray-500">No team members found.</div>
                    ) : (
                      teamMembers.map((member) => (
                        <div key={member.id} className="border rounded-lg p-3 flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                            <div className="text-[11px] text-gray-500">{normalizeRole(member.role)}</div>
                          </div>
                          <div className="flex items-center gap-2 text-[11px] text-gray-500">
                            {integrations.map((integration) => (
                              <div key={integration} className="flex items-center gap-1">
                                <span className={`w-2.5 h-2.5 rounded-full ${getIntegrationStatus(member.id, integration) ? 'bg-green-500' : 'bg-gray-300'}`} />
                                <span>{integration}</span>
                              </div>
                            ))}
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
              className="bg-white w-[95%] max-w-5xl rounded-2xl shadow-2xl p-6"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900">Team Settings</h2>
                  <p className="text-xs text-gray-500">Manage your assigned team members and integrations</p>
                </div>
                <button
                  onClick={() => setShowManagerTeamsModal(false)}
                  className="text-gray-400 hover:text-gray-600 text-sm"
                >
                  Close
                </button>
              </div>
              <div className="bg-white rounded-xl border p-4">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <div className="text-xs text-gray-500">Team</div>
                    <div className="text-sm font-semibold text-gray-900">
                      {teams.find(t => String(t.id) === String(selectedTeamId))?.name || 'Your Team'}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs font-semibold text-blue-600">+ Add Member</button>
                    <button className="text-xs font-semibold text-red-500">Remove Member</button>
                  </div>
                </div>
                <div className="overflow-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500">
                        <th className="py-2">Team Member</th>
                        {integrations.map((integration) => (
                          <th key={integration} className="py-2 text-center">{integration}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {teamMembers.length === 0 ? (
                        <tr>
                          <td colSpan={integrations.length + 1} className="py-4 text-center text-gray-500">No team members available.</td>
                        </tr>
                      ) : (
                        teamMembers.map((member) => (
                          <tr key={member.id} className="border-t">
                            <td className="py-2">
                              <div className="font-semibold text-gray-900">{`${member.first_name || ''} ${member.last_name || ''}`.trim() || member.email}</div>
                              <div className="text-[11px] text-gray-500">{normalizeRole(member.role)}</div>
                            </td>
                            {integrations.map((integration) => (
                              <td key={integration} className="text-center">
                                <span className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] ${getIntegrationStatus(member.id, integration) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                  {getIntegrationStatus(member.id, integration) ? '✓' : '—'}
                                </span>
                              </td>
                            ))}
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
          <div className="text-xs text-gray-500">No filters available yet.</div>
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
    </DashboardLayout>
  );
}
