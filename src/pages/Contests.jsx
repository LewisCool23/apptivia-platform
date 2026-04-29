import React, { useEffect, useState, useRef } from 'react';
import { backendFetch } from '../utils/backendFetch';
import { Edit2, Trash2, Search, X, StopCircle, Archive, Download, Mail, CheckCircle, Info, Users, BarChart2, LogOut, Trophy, Share2, UserPlus } from 'lucide-react';
import html2canvas from 'html2canvas';
import { useNavigate } from 'react-router-dom';
import DashboardLayout from '../DashboardLayout';
import { supabase } from '../supabaseClient';
import { useContests } from '../hooks/useContests';
import { getRankChangeIcon, getRankDisplay } from '../utils/contestUtils';
import { useAuth } from '../AuthContext';
import { useToast } from '../contexts/ToastContext';
import ContestCreationModal from '../components/ContestCreationModal';
import RightFilterPanel from '../components/RightFilterPanel';
import PageActionBar from '../components/PageActionBar';
import ConfigurePanel from '../components/ConfigurePanel';
import { ROLES } from '../constants/roles';
import ConfigureModal from '../components/ConfigureModal';
import LeaderboardModal from '../components/LeaderboardModal';
import BadgeModal from '../components/BadgeModal';
import BadgeAssignmentModal from '../components/BadgeAssignmentModal';
import AddTeamMembersModal from '../components/AddTeamMembersModal';
import InfoTooltip from '../components/InfoTooltip';
import { useNotifications } from '../contexts/NotificationContext';
import ConfirmModal from '../components/ConfirmModal';
import SearchWithHistory from '../components/SearchWithHistory';
import { exportContestResultsToCSV } from '../utils/exportUtils';
import { exportContestToPDF } from '../utils/exportPdf';
import ExportReportModal from '../components/ExportReportModal';
import ScheduleReportModal from '../components/ScheduleReportModal';

export default function Contests() {
  const navigate = useNavigate();
  const { user, profile, role, hasPermission } = useAuth();
  const toast = useToast();
  const orgId = profile?.organization_id;
  const { data, loading, error, kpiNameByKey, refetch, enrollInContest, withdrawFromContest, deleteContest, endContest, archiveContest } = useContests(user?.id, orgId);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [contestToEdit, setContestToEdit] = useState(null);
  const [leaderboardModal, setLeaderboardModal] = useState({ isOpen: false, contest: null });
  const [globalSearchQuery, setGlobalSearchQuery] = useState('');
  const [globalSearchResults, setGlobalSearchResults] = useState([]);
  const [showGlobalSearchResults, setShowGlobalSearchResults] = useState(false);
  const [globalSearching, setGlobalSearching] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [shareModal, setShareModal] = useState({ isOpen: false, contest: null });
  const [shareRecipients, setShareRecipients] = useState('');
  const [shareNotes, setShareNotes] = useState('');
  const [sendingResults, setSendingResults] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [downloadingResults, setDownloadingResults] = useState(false);
  const sharePreviewRef = useRef(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [kpiFilter, setKpiFilter] = useState('all');
  const [rewardFilter, setRewardFilter] = useState('all');
  const [participantFilter, setParticipantFilter] = useState('all');
  const [enrollmentFilter, setEnrollmentFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState('all');
  const [sortKey, setSortKey] = useState('recent');
  const [statusTab, setStatusTab] = useState('all');
  const [badgeLeaderboard, setBadgeLeaderboard] = useState([]);
  const [badgeLeaderboardLoading, setBadgeLeaderboardLoading] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [configPanelOpen, setConfigPanelOpen] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [badgeModal, setBadgeModal] = useState({ isOpen: false, badge: null });
  const [badgeAssignmentModal, setBadgeAssignmentModal] = useState({ isOpen: false, badge: null });
  const [showExportModal, setShowExportModal] = useState(false);
  const [showScheduleReportModal, setShowScheduleReportModal] = useState(false);
  const [addMembersModal, setAddMembersModal] = useState({ isOpen: false, contest: null });
  const { openPanel, addNotification, unreadCount } = useNotifications();
  const [confirmModal, setConfirmModal] = useState({ isOpen: false, type: null, contest: null, isLoading: false });

  const isAdmin = role === ROLES.ADMIN;
  const isManager = role === ROLES.MANAGER;
  const canCreateContests = hasPermission('create_contests');
  const canEditContests = hasPermission('edit_contests');
  const canExport = hasPermission('export_data');
  const canConfigure = hasPermission('configure_scorecard');
  const canShareResults = isAdmin || role === ROLES.MANAGER;

  const getStatusColor = (status) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'upcoming': return 'text-apptivia-ink';
      case 'completed': return 'text-apptivia-carbon-400';
      case 'archived': return 'text-apptivia-ink';
      default: return 'text-apptivia-carbon-500';
    }
  };

  const getStatusLabel = (status) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  const getKpiDisplayName = (kpiKey) => {
    return kpiNameByKey[kpiKey] || kpiKey;
  };



  const formatDaysRemaining = (days, status) => {
    if (days === null || days === undefined) return '';
    if (days === 0) return 'Ends today';
    if (status === 'upcoming') return `Starts in ${days} days`;
    if (status === 'active') return `${days} days left`;
    return '';
  };

  useEffect(() => {
    if (!user?.name || !data?.completed?.length) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem('apptivia.contestWins') || '[]');
      const normalizedUser = user.name.toLowerCase();
      data.completed.forEach(contest => {
        const winner = String(contest.winner_name || '').toLowerCase();
        if (winner && winner === normalizedUser && !stored.includes(contest.id)) {
          addNotification({
            type: 'contest',
            title: 'Contest win',
            message: `You won ${contest.name}.`,
            link: '/contests',
            dedupeKey: `contest-win-${contest.id}`,
          });
          stored.push(contest.id);
        }
      });
      // Prune IDs for contests that no longer exist
      const allIds = new Set([
        ...(data.active || []).map(c => c.id),
        ...(data.completed || []).map(c => c.id),
        ...(data.upcoming || []).map(c => c.id),
        ...(data.archived || []).map(c => c.id),
      ]);
      const pruned = stored.filter(id => allIds.has(id));
      window.localStorage.setItem('apptivia.contestWins', JSON.stringify(pruned));
    } catch (e) {}
  }, [data, user?.name, addNotification]);

  // Mid-contest milestone notifications — detect rank changes for current user
  useEffect(() => {
    if (!user?.id || !data?.active?.length) return;
    try {
      const stored = JSON.parse(window.localStorage.getItem('apptivia.contestRanks') || '{}');
      const updated = { ...stored };
      data.active.forEach(contest => {
        if (!contest.user_rank) return;
        const prevRank = stored[contest.id];
        if (prevRank !== undefined && prevRank !== contest.user_rank) {
          const moved = prevRank > contest.user_rank ? 'up' : 'down';
          if (moved === 'up') {
            addNotification({
              type: 'contest',
              title: 'Rank change',
              message: `You moved up to #${contest.user_rank} in ${contest.name}!`,
              link: '/contests',
              dedupeKey: `contest-rank-${contest.id}-${contest.user_rank}`,
            });
          }
          if (contest.user_rank <= 3 && prevRank > 3) {
            addNotification({
              type: 'contest',
              title: 'Top 3',
              message: `You're now in the top 3 for ${contest.name}!`,
              link: '/contests',
              dedupeKey: `contest-top3-${contest.id}`,
            });
          }
        }
        updated[contest.id] = contest.user_rank;
      });
      // Prune rank entries for contests no longer active
      const activeIds = new Set((data.active || []).map(c => c.id));
      const prunedRanks = {};
      for (const [key, val] of Object.entries(updated)) {
        if (activeIds.has(key)) prunedRanks[key] = val;
      }
      window.localStorage.setItem('apptivia.contestRanks', JSON.stringify(prunedRanks));
    } catch (e) {}
  }, [data?.active, user?.id, addNotification]);

  useEffect(() => {
    if (statusTab !== 'badges') return;
    setBadgeLeaderboardLoading(true);

    Promise.all([
      orgId
        ? supabase
            .from('profile_badges')
            .select('profile_id, badge_name, earned_at, profile:profiles!inner(first_name, last_name, organization_id)')
            .eq('profile.organization_id', orgId)
        : Promise.resolve({ data: [], error: null }),
      supabase
        .from('badge_definitions')
        .select('badge_name, rarity'),
    ])
      .then(([{ data: rows, error: badgeErr }, { data: defs, error: defErr }]) => {
        if (badgeErr) throw badgeErr;
        if (defErr) throw defErr;
        if (!rows) return;

        // Build rarity lookup from badge_definitions (rarity lives there, not on profile_badges)
        const rarityMap = {};
        for (const d of (defs || [])) rarityMap[d.badge_name] = d.rarity;

        const map = {};
        for (const r of rows) {
          const id = r.profile_id;
          const rarity = rarityMap[r.badge_name] || 'common';
          if (!map[id]) map[id] = { id, name: `${r.profile?.first_name || ''} ${r.profile?.last_name || ''}`.trim(), count: 0, legendary: 0, epic: 0, rare: 0, latest: r.earned_at };
          map[id].count++;
          if (rarity === 'legendary') map[id].legendary++;
          else if (rarity === 'epic') map[id].epic++;
          else if (rarity === 'rare') map[id].rare++;
          if (r.earned_at > map[id].latest) map[id].latest = r.earned_at;
        }
        setBadgeLeaderboard(Object.values(map).sort((a, b) => b.count - a.count || b.legendary - a.legendary));
      })
      .catch((err) => {
        console.error('Failed to load badge leaderboard:', err);
        toast.error('Failed to load badge leaderboard');
      })
      .finally(() => setBadgeLeaderboardLoading(false));
  }, [statusTab]);

  const openLeaderboard = (contest) => {
    setLeaderboardModal({ isOpen: true, contest });
  };

  const closeLeaderboard = () => {
    setLeaderboardModal({ isOpen: false, contest: null });
  };

  const openShareResults = (contest) => {
    const recipients = (contest?.leaderboard || [])
      .map((entry) => entry.profile_email)
      .filter(Boolean)
      .join(', ');
    setShareRecipients(recipients);
    setShareNotes('');
    setShareModal({ isOpen: true, contest });
  };

  const closeShareResults = () => {
    setShareModal({ isOpen: false, contest: null });
    setShareRecipients('');
    setShareNotes('');
    setShowEmailForm(false);
  };

  const handleDownloadResults = async () => {
    setDownloadingResults(true);
    try {
      const element = sharePreviewRef.current;
      if (!element) return;
      const canvas = await html2canvas(element, {
        backgroundColor: '#ffffff',
        scale: 2,
        logging: false,
      });
      const link = document.createElement('a');
      const contestName = (shareModal.contest?.name || 'contest').replace(/\s+/g, '-');
      link.download = `contest-results-${contestName}-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (error) {
      console.error('Error downloading results:', error);
      toast.error('Failed to download results image');
    } finally {
      setDownloadingResults(false);
    }
  };

  const buildResultsBody = (contest) => {
    if (!contest) return '';
    const topThree = (contest.leaderboard || []).slice(0, 3);
    const lines = [];
    lines.push(`Contest Results: ${contest.name}`);
    lines.push(`Status: ${getStatusLabel(contest.status)}`);
    if (contest.start_date && contest.end_date) {
      lines.push(`Dates: ${new Date(contest.start_date).toLocaleDateString()} – ${new Date(contest.end_date).toLocaleDateString()}`);
    }
    lines.push('');
    lines.push(`Winner: ${contest.winner_name || 'N/A'} (${contest.winner_score ?? 'N/A'})`);
    if (contest.reward_value) {
      lines.push(`Reward: ${contest.reward_value}`);
    }
    lines.push('');
    if (topThree.length > 0) {
      lines.push('Top 3:');
      topThree.forEach((entry, idx) => {
        lines.push(`${idx + 1}. ${entry.profile_name} — ${entry.score}`);
      });
      lines.push('');
    }
    if (shareNotes.trim()) {
      lines.push('Writeup:');
      lines.push(shareNotes.trim());
      lines.push('');
    }
    lines.push('Great work team—let’s keep the momentum going.');
    return lines.join('\n');
  };

  const handleShareResults = async () => {
    if (!shareRecipients.trim() || !shareModal.contest) return;
    setSendingResults(true);
    try {
      const recipients = shareRecipients
        .split(',')
        .map((r) => r.trim())
        .filter(Boolean)
        .slice(0, 50); // Backend enforces 50 max
      if (recipients.length === 0) {
        toast.error('Please provide at least one recipient.');
        setSendingResults(false);
        return;
      }
      const subject = `Contest Results • ${shareModal.contest.name}`;
      const body = buildResultsBody(shareModal.contest);
      await backendFetch('/api/send-contest-results', { recipients, subject, body });
      toast.success('Contest results shared.');
      closeShareResults();
    } catch (err) {
      console.error('Failed to share contest results', err);
      toast.error('Failed to send contest results.');
    } finally {
      setSendingResults(false);
    }
  };

  const handleEditContest = (contest) => {
    setContestToEdit(contest);
    setShowCreateModal(true);
  };

  const handleCloseModal = async () => {
    setShowCreateModal(false);
    setContestToEdit(null);
    // Refetch contests so new/updated contests appear immediately
    await refetch();
  };

  const handleDeleteContest = async (contestId, contestName) => {
    if (!user?.id) return;
    setConfirmModal({
      isOpen: true,
      type: 'delete',
      contest: { id: contestId, name: contestName },
      isLoading: false
    });
  };

  const confirmDeleteContest = async () => {
    const { contest } = confirmModal;
    if (!contest) return;
    
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    const loadingToast = toast.loading(`Deleting "${contest.name}"...`);
    
    try {
      const result = await deleteContest(contest.id, user.id);
      
      toast.dismiss(loadingToast);
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
      
      if (result.success) {
        toast.success(result.message || 'Contest deleted successfully');
      } else {
        toast.error(result.error || 'Failed to delete contest');
      }
    } catch (err) {
      console.error('Error deleting contest:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to delete contest');
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
    }
  };

  const canDeleteContest = (contest) => {
    if (!user?.id) return false;
    const isCreator = contest.created_by === user.id;
    return isAdmin || isCreator;
  };

  const canEditContest = (contest) => {
    if (!user?.id) return false;
    const isCreator = contest.created_by === user.id;
    return isAdmin || canEditContests || isCreator;
  };

  const handleEndContest = async (contestId, contestName) => {
    if (!user?.id) return;
    setConfirmModal({
      isOpen: true,
      type: 'end',
      contest: { id: contestId, name: contestName },
      isLoading: false
    });
  };

  const confirmEndContest = async () => {
    const { contest } = confirmModal;
    if (!contest) return;
    
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    const loadingToast = toast.loading(`Ending "${contest.name}"...`);
    try {
      const result = await endContest(contest.id);
      toast.dismiss(loadingToast);
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
      if (result.success) {
        toast.success('Contest ended successfully');
        // Notify all users
        addNotification({
          type: 'contest',
          title: 'Contest Ended',
          message: `"${contest.name}" has been completed. Check the results!`,
          link: '/contests',
          dedupeKey: `contest-ended-${contest.id}`,
          audience: 'self',
        });
        addNotification({
          type: 'contest',
          title: 'Contest Ended',
          message: `"${contest.name}" has been completed. View final results and standings.`,
          link: '/contests',
          dedupeKey: `contest-ended-mgr-${contest.id}`,
          audience: 'team',
        });
      } else {
        toast.error(result.error || 'Failed to end contest');
      }
    } catch (err) {
      console.error('Error ending contest:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to end contest');
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
    }
  };

  const handleArchiveContest = async (contestId, contestName) => {
    if (!user?.id) return;
    setConfirmModal({
      isOpen: true,
      type: 'archive',
      contest: { id: contestId, name: contestName },
      isLoading: false
    });
  };

  const confirmArchiveContest = async () => {
    const { contest } = confirmModal;
    if (!contest) return;
    
    setConfirmModal(prev => ({ ...prev, isLoading: true }));
    const loadingToast = toast.loading(`Archiving "${contest.name}"...`);
    try {
      const result = await archiveContest(contest.id);
      toast.dismiss(loadingToast);
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
      if (result.success) {
        toast.success('Contest archived successfully');
      } else {
        toast.error(result.error || 'Failed to archive contest');
      }
    } catch (err) {
      console.error('Error archiving contest:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to archive contest');
      setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false });
    }
  };

  const myActiveContest = data?.active?.find((contest) => contest.is_user_enrolled);
  const totalActive = data?.active?.length || 0;
  const totalUpcoming = data?.upcoming?.length || 0;
  const totalCompleted = data?.completed?.length || 0;
  const totalArchived = data?.archived?.length || 0;
  const totalEnrolled = [...(data?.active || []), ...(data?.upcoming || [])].filter(c => c.is_user_enrolled).length;

  const allContests = React.useMemo(() => [...(data?.active || []), ...(data?.upcoming || []), ...(data?.completed || []), ...(data?.archived || [])], [data]);

  const analytics = React.useMemo(() => {
    if (allContests.length === 0) {
      return {
        avgParticipants: 0,
        completionRate: 0,
        mostPopularKpi: 'N/A',
        topContest: null,
      };
    }
    const totalParticipants = allContests.reduce((sum, c) => sum + (c.participant_count || 0), 0);
    const avgParticipants = Math.round(totalParticipants / Math.max(1, allContests.length));
    const completionRate = Math.round((totalCompleted / Math.max(1, allContests.length)) * 100);
    const kpiCounts = allContests.reduce((acc, c) => {
      const key = c.kpi_key || 'unknown';
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const mostPopularKpi = Object.entries(kpiCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'N/A';
    const topContest = allContests.reduce((best, c) =>
      (!best || (c.participant_count || 0) > (best.participant_count || 0)) ? c : best
    , null);
    return { avgParticipants, completionRate, mostPopularKpi, topContest };
  }, [allContests, totalCompleted]);

  const applyFilters = (list) => {
    const now = new Date();
    return [...list]
      .filter((c) => {
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          if (!String(c.name || '').toLowerCase().includes(q) && !String(c.description || '').toLowerCase().includes(q)) {
            return false;
          }
        }
        if (kpiFilter !== 'all' && c.kpi_key !== kpiFilter) return false;
        if (rewardFilter !== 'all' && c.reward_type !== rewardFilter) return false;
        if (participantFilter !== 'all' && c.participant_type !== participantFilter) return false;
        if (enrollmentFilter === 'enrolled' && !c.is_user_enrolled) return false;
        if (enrollmentFilter === 'not_enrolled' && c.is_user_enrolled) return false;
        if (dateFilter !== 'all') {
          const start = new Date(c.start_date);
          if (dateFilter === 'this_month') {
            if (start.getMonth() !== now.getMonth() || start.getFullYear() !== now.getFullYear()) return false;
          }
          if (dateFilter === 'last_30') {
            const diff = now.getTime() - start.getTime();
            if (diff > 30 * 24 * 60 * 60 * 1000) return false;
          }
          if (dateFilter === 'next_30') {
            const diff = start.getTime() - now.getTime();
            if (diff < 0 || diff > 30 * 24 * 60 * 60 * 1000) return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (sortKey === 'participants') return (b.participant_count || 0) - (a.participant_count || 0);
        if (sortKey === 'end_date') return new Date(a.end_date).getTime() - new Date(b.end_date).getTime();
        return new Date(b.start_date).getTime() - new Date(a.start_date).getTime();
      });
  };

  const filteredActive = applyFilters(data.active || []);
  const filteredUpcoming = applyFilters(data.upcoming || []);
  const filteredCompleted = applyFilters(data.completed || []);
  const filteredArchived = applyFilters(data.archived || []);

  const uniqueKpiKeys = Array.from(new Set(allContests.map(c => c.kpi_key).filter(Boolean)));
  const uniqueRewardTypes = Array.from(new Set(allContests.map(c => c.reward_type).filter(Boolean)));

  const handleEnrollment = async (contestId, isEnrolled) => {
    if (!user?.id) return;
    
    const contest = allContests.find(c => c.id === contestId);
    const contestName = contest?.name || 'contest';
    const loadingToast = toast.loading(isEnrolled ? 'Withdrawing from contest...' : 'Enrolling in contest...');
    
    try {
      const result = isEnrolled 
        ? await withdrawFromContest(contestId, user.id)
        : await enrollInContest(contestId, user.id);
      
      toast.dismiss(loadingToast);
      
      if (!result.success) {
        toast.error(result.error || 'Failed to update enrollment');
      } else {
        toast.success(isEnrolled ? 'Successfully withdrawn from contest' : 'Successfully enrolled in contest!');
        
        // Notification for the user
        const userName = `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email;
        if (isEnrolled) {
          addNotification({
            type: 'contest',
            title: 'Withdrew from Contest',
            message: `You withdrew from "${contestName}".`,
            link: '/contests',
            dedupeKey: `contest-withdraw-${contestId}-${Date.now()}`,
            audience: 'self',
          });
          // Notification visible to managers
          addNotification({
            type: 'contest',
            title: 'Contest Withdrawal',
            message: `${userName} withdrew from "${contestName}".`,
            link: '/contests',
            dedupeKey: `contest-withdraw-mgr-${contestId}-${Date.now()}`,
            audience: 'team',
          });
        } else {
          addNotification({
            type: 'contest',
            title: 'Joined Contest',
            message: `You joined "${contestName}". Good luck!`,
            link: '/contests',
            dedupeKey: `contest-join-${contestId}-${Date.now()}`,
            audience: 'self',
          });
          // Notification visible to managers
          addNotification({
            type: 'contest',
            title: 'Contest Enrollment',
            message: `${userName} joined "${contestName}".`,
            link: '/contests',
            dedupeKey: `contest-join-mgr-${contestId}-${Date.now()}`,
            audience: 'team',
          });
        }
      }
    } catch (err) {
      console.error('Error handling enrollment:', err);
      toast.dismiss(loadingToast);
      toast.error('Failed to update enrollment');
    }
  };

  // Global search functionality (org-scoped)
  const handleGlobalSearch = async (query) => {
    if (!query || query.trim().length < 2) {
      setGlobalSearchResults([]);
      setShowGlobalSearchResults(false);
      return;
    }

    setGlobalSearching(true);
    setShowGlobalSearchResults(true);
    const results = [];

    try {
      const searchTerm = query.trim().toLowerCase();

      // Search profiles/users (org-scoped)
      let profilesSearch = supabase
        .from('profiles')
        .select('id, first_name, last_name, email, role')
        .or(`first_name.ilike.%${searchTerm}%,last_name.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
        .limit(5);
      if (orgId) profilesSearch = profilesSearch.eq('organization_id', orgId);
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

      // Search contests
      let contestsQ = supabase
        .from('active_contests')
        .select('id, name, description')
        .ilike('name', `%${searchTerm}%`)
        .limit(5);
      if (orgId) contestsQ = contestsQ.eq('organization_id', orgId);
      const { data: contests } = await contestsQ;

      if (contests) {
        contests.forEach((contest) => {
          results.push({
            type: 'Contest',
            title: contest.name,
            subtitle: contest.description,
            link: '/contests',
            icon: '🎯'
          });
        });
      }

      // Search badges (global table — no org filter needed)
      const { data: badges } = await supabase
        .from('badge_definitions')
        .select('id, badge_name, badge_description')
        .ilike('badge_name', `%${searchTerm}%`)
        .limit(5);

      if (badges) {
        badges.forEach((badge) => {
          results.push({
            type: 'Badge',
            title: badge.badge_name,
            subtitle: badge.badge_description,
            link: '/profile',
            icon: '🎖️'
          });
        });
      }

      setGlobalSearchResults(results);
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed. Please try again.');
    } finally {
      setGlobalSearching(false);
    }
  };

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (globalSearchQuery) {
        handleGlobalSearch(globalSearchQuery);
      }
    }, 300);
    return () => clearTimeout(timeoutId);
  }, [globalSearchQuery]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } catch (err) {
      console.error('Error refreshing:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatKpiKey = (key) =>
    key ? key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '';

  const formatDateShort = (iso) => {
    if (!iso) return '';
    return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const renderContest = (contest) => (
    <div key={contest.id} className="bg-white rounded-lg p-6 shadow-sm transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">{contest.name}</h3>
            {contest.is_user_enrolled && (
              <span className="text-xs bg-apptivia-coral-tone-50 text-apptivia-coral px-2 py-1 rounded">Enrolled</span>
            )}
          </div>
          <p className="text-sm text-apptivia-carbon-600 mt-1">{contest.description}</p>
          <div className="flex items-center gap-4 mt-2 text-xs text-apptivia-carbon-500">
            <span>👥 {contest.participant_count} participants</span>
            {contest.days_remaining !== null && (
              <span>⏰ {formatDaysRemaining(contest.days_remaining, contest.status)}</span>
            )}
          </div>
        </div>
        <div className="text-right ml-4">
          <div className={`text-xs font-semibold ${getStatusColor(contest.status)}`}>
            {getStatusLabel(contest.status)}
          </div>
          {contest.status === 'completed' && contest.winner_name && (
            <div className="mt-0.5">
              <span className="inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-100">
                <CheckCircle size={8} /> Auto-awarded
              </span>
            </div>
          )}
          {contest.winner_name && (
            <>
              <div className="text-sm font-bold mt-2">{contest.winner_score}</div>
              <div className="text-xs text-apptivia-carbon-500">{contest.winner_name}</div>
            </>
          )}
          {contest.reward_value && (
            <div className={`text-xs font-semibold mt-1 ${
              contest.status === 'completed' ? 'text-yellow-600' : 'text-green-600'
            }`}>
              {contest.reward_value}
            </div>
          )}
        </div>
      </div>

      {/* User's Current Position */}
      {contest.is_user_enrolled && contest.user_rank && (
        <div className="mt-3 p-3 bg-apptivia-coral-tone-50 rounded-lg">
          <div className="flex justify-between items-center text-sm">
            <span className="font-semibold text-apptivia-coral-tone-700">Your Position:</span>
            <div className="flex items-center gap-2">
              <span className="text-apptivia-coral">Rank #{contest.user_rank}</span>
              <span className="text-apptivia-coral-tone-700 font-bold">{contest.user_score}</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Buttons */}
      <div className="mt-4 flex items-center justify-between gap-3">
        {/* Bottom-left contextual info */}
        <div className="text-xs text-apptivia-carbon-500">
          <div className="flex flex-col gap-1">
            {(contest.status === 'completed' || contest.status === 'archived') && contest.winner_name && (
              <div className="flex items-center gap-1.5">
                <Trophy size={14} className="text-yellow-500" />
                <span className="font-semibold text-apptivia-ink">{contest.winner_name}</span>
                <span className="text-apptivia-carbon-300">·</span>
                <span>{contest.winner_score}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <span>{formatDateShort(contest.start_date)} – {formatDateShort(contest.end_date)}</span>
              {contest.kpi_key && (
                <span className="px-2 py-0.5 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-full font-medium">
                  {formatKpiKey(contest.kpi_key)}
                </span>
              )}
            </div>
          </div>
        </div>

        {contest.status === 'active' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => openLeaderboard(contest)}
              className="p-2 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
              title="View Leaderboard"
            >
              <BarChart2 size={16} />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Leaderboard</span>
            </button>
            <button
              onClick={() => handleEnrollment(contest.id, contest.is_user_enrolled)}
              className={`p-2 rounded-lg transition-all duration-200 hover:scale-105 flex items-center justify-center group relative ${
                contest.is_user_enrolled
                  ? 'bg-apptivia-carbon-100 text-apptivia-carbon-600 hover:bg-apptivia-carbon-200'
                  : 'bg-green-500 text-white hover:bg-green-600'
              }`}
              title={contest.is_user_enrolled ? 'Withdraw' : 'Join Contest'}
            >
              {contest.is_user_enrolled ? <LogOut size={16} /> : <UserPlus size={16} />}
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">{contest.is_user_enrolled ? 'Withdraw' : 'Join'}</span>
            </button>
            {canShareResults && (
              <button
                onClick={() => openShareResults(contest)}
                className="p-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg hover:bg-apptivia-carbon-200 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Share Results"
              >
                <Share2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Share</span>
              </button>
            )}
            {(isAdmin || isManager) && (
              <button
                onClick={() => setAddMembersModal({ isOpen: true, contest })}
                className="p-2 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg hover:bg-apptivia-carbon-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Add Team Members"
              >
                <Users size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Add Members</span>
              </button>
            )}
            {canEditContest(contest) && (
              <button
                onClick={() => handleEndContest(contest.id, contest.name)}
                className="p-2 bg-orange-50 text-orange-600 rounded-lg hover:bg-orange-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="End Contest"
              >
                <StopCircle size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">End</span>
              </button>
            )}
            {canEditContest(contest) && (
              <button
                onClick={() => handleEditContest(contest)}
                className="p-2 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Edit Contest"
              >
                <Edit2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Edit</span>
              </button>
            )}
            {canDeleteContest(contest) && (
              <button
                onClick={() => handleDeleteContest(contest.id, contest.name)}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Delete Contest"
              >
                <Trash2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Delete</span>
              </button>
            )}
          </div>
        )}
        {contest.status === 'upcoming' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <div className="px-3 py-1.5 bg-apptivia-paper rounded-lg text-xs text-apptivia-carbon-400 font-medium">
              Coming Soon
            </div>
            {(isAdmin || isManager) && (
              <button
                onClick={() => setAddMembersModal({ isOpen: true, contest })}
                className="p-2 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg hover:bg-apptivia-carbon-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Add Team Members"
              >
                <Users size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Add Members</span>
              </button>
            )}
            {canEditContest(contest) && (
              <button
                onClick={() => handleEditContest(contest)}
                className="p-2 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Edit Contest"
              >
                <Edit2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Edit</span>
              </button>
            )}
            {canDeleteContest(contest) && (
              <button
                onClick={() => handleDeleteContest(contest.id, contest.name)}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Delete Contest"
              >
                <Trash2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Delete</span>
              </button>
            )}
          </div>
        )}
        {contest.status === 'completed' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => openLeaderboard(contest)}
              className="p-2 bg-yellow-50 text-yellow-700 rounded-lg hover:bg-yellow-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
              title="View Results"
            >
              <Trophy size={16} />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Results</span>
            </button>
            {canShareResults && (
              <button
                onClick={() => openShareResults(contest)}
                className="p-2 bg-apptivia-carbon-100 text-apptivia-carbon-700 rounded-lg hover:bg-apptivia-carbon-200 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Share Results"
              >
                <Share2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Share</span>
              </button>
            )}
            {canEditContest(contest) && (
              <button
                onClick={() => handleArchiveContest(contest.id, contest.name)}
                className="p-2 bg-apptivia-carbon-100 text-apptivia-ink rounded-lg hover:bg-apptivia-carbon-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Archive Contest"
              >
                <Archive size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Archive</span>
              </button>
            )}
            {canEditContest(contest) && (
              <button
                onClick={() => handleEditContest(contest)}
                className="p-2 bg-apptivia-coral-tone-50 text-apptivia-coral rounded-lg hover:bg-apptivia-coral-tone-50 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Edit Contest"
              >
                <Edit2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Edit</span>
              </button>
            )}
            {canDeleteContest(contest) && (
              <button
                onClick={() => handleDeleteContest(contest.id, contest.name)}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Delete Contest"
              >
                <Trash2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Delete</span>
              </button>
            )}
          </div>
        )}
        {contest.status === 'archived' && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              onClick={() => openLeaderboard(contest)}
              className="p-2 bg-apptivia-paper text-apptivia-carbon-600 rounded-lg hover:bg-apptivia-carbon-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
              title="View Results"
            >
              <Trophy size={16} />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Results</span>
            </button>
            {canDeleteContest(contest) && (
              <button
                onClick={() => handleDeleteContest(contest.id, contest.name)}
                className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100 transition-all duration-200 hover:scale-105 flex items-center justify-center group relative"
                title="Delete Contest"
              >
                <Trash2 size={16} />
                <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 px-2 py-1 bg-apptivia-ink text-white text-[10px] rounded opacity-0 pointer-events-none group-hover:opacity-100 whitespace-nowrap transition-opacity z-10">Delete</span>
              </button>
            )}
          </div>
        )}
      </div>
      {contest.status === 'completed' && contest.leaderboard?.length > 0 && (
        <div className="mt-4 bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg p-3">
          <div className="text-xs text-apptivia-carbon-500 mb-2">Top 3 Results</div>
          <div className="space-y-1 text-sm text-apptivia-carbon-700">
            {contest.leaderboard.slice(0, 3).map((entry) => (
              <div key={entry.profile_id} className="flex items-center justify-between">
                <div className="font-semibold">#{entry.rank} {entry.profile_name}</div>
                <div className="text-apptivia-carbon-500">{entry.score}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  const getConfirmModalProps = () => {
    const { type, contest } = confirmModal;
    switch (type) {
      case 'delete':
        return {
          title: 'Delete Contest?',
          message: `Are you sure you want to delete "${contest?.name}"? This action cannot be undone.`,
          confirmText: 'Delete',
          variant: 'danger',
          onConfirm: confirmDeleteContest,
        };
      case 'end':
        return {
          title: 'End Contest?',
          message: `Are you sure you want to end "${contest?.name}"? This will mark it as completed and finalize all results.`,
          confirmText: 'End Contest',
          variant: 'warning',
          onConfirm: confirmEndContest,
        };
      case 'archive':
        return {
          title: 'Archive Contest?',
          message: `Archive "${contest?.name}"? It will be moved to the Archived tab and hidden from active contests.`,
          confirmText: 'Archive',
          variant: 'warning',
          onConfirm: confirmArchiveContest,
        };
      default:
        return {};
    }
  };

  return (
    <DashboardLayout>
      {/* Confirm Modal */}
      <ConfirmModal
        isOpen={confirmModal.isOpen}
        onClose={() => setConfirmModal({ isOpen: false, type: null, contest: null, isLoading: false })}
        isLoading={confirmModal.isLoading}
        {...getConfirmModalProps()}
      />
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-apptivia-coral mb-1 flex items-center gap-2">Sales Contests <InfoTooltip text="Create and manage sales contests to gamify performance, track KPIs, and drive results across your team." /></h1>
            <p className="text-apptivia-carbon-500 text-sm">Gamify performance and drive results</p>
          </div>
          <div className="flex gap-2 items-center">
            {/* Search Bar */}
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-apptivia-carbon-400" />
              <input
                type="text"
                placeholder="Search..."
                value={globalSearchQuery}
                onChange={(e) => setGlobalSearchQuery(e.target.value)}
                onFocus={() => globalSearchQuery && setShowGlobalSearchResults(true)}
                className="w-64 pl-9 pr-8 py-2 text-sm border border-apptivia-carbon-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
              />
              {globalSearchQuery && (
                <button
                  onClick={() => {
                    setGlobalSearchQuery('');
                    setGlobalSearchResults([]);
                    setShowGlobalSearchResults(false);
                  }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-apptivia-carbon-400 hover:text-apptivia-carbon-600"
                >
                  <X size={14} />
                </button>
              )}
              {/* Search Results Dropdown */}
              {showGlobalSearchResults && globalSearchResults.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-50">
                  {globalSearchResults.map((result, idx) => (
                    <button
                      key={idx}
                      onClick={() => {
                        navigate(result.link);
                        setGlobalSearchQuery('');
                        setGlobalSearchResults([]);
                        setShowGlobalSearchResults(false);
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
              {showGlobalSearchResults && globalSearchQuery && globalSearchResults.length === 0 && !globalSearching && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-apptivia-carbon-200 rounded-lg shadow-lg p-4 z-50">
                  <div className="text-sm text-apptivia-carbon-500 text-center">No results found</div>
                </div>
              )}
              {globalSearching && (
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
              onConfigureClick={() => { if (canConfigure) setConfigPanelOpen(true); }}
              onNotificationsClick={openPanel}
              configureDisabled={!canConfigure}
              notificationBadge={unreadCount}
              actions={[
                {
                  label: 'Export Report',
                  onClick: () => setShowExportModal(true),
                  disabled: !canExport,
                },
                {
                  label: 'Schedule Report',
                  onClick: () => setShowScheduleReportModal(true),
                  disabled: !canExport,
                },
                {
                  label: 'Create Contest',
                  onClick: () => { if (canCreateContests) setShowCreateModal(true); },
                  disabled: !canCreateContests,
                },
              ]}
            />
          </div>
        </div>
      <BadgeModal
        isOpen={badgeModal.isOpen}
        onClose={() => setBadgeModal({ isOpen: false, badge: null })}
        badge={badgeModal.badge}
        profileName={user ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : ''}
      />
      <BadgeAssignmentModal
        isOpen={badgeAssignmentModal.isOpen}
        onClose={() => setBadgeAssignmentModal({ isOpen: false, badge: null })}
        badge={badgeAssignmentModal.badge}
      />
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
        title="Contest Filters"
        subtitle="Filter contests"
        showReset
        onReset={() => {
          setSearchQuery('');
          setKpiFilter('all');
          setRewardFilter('all');
          setParticipantFilter('all');
          setEnrollmentFilter('all');
          setDateFilter('all');
          setSortKey('recent');
        }}
      >
        <div className="space-y-3">
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Search</label>
            <SearchWithHistory
              value={searchQuery}
              onChange={setSearchQuery}
              placeholder="Search contests"
              context="contests"
              inputClassName="text-xs"
            />
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">KPI</label>
            <select
              value={kpiFilter}
              onChange={(e) => setKpiFilter(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="all">All KPIs</option>
              {uniqueKpiKeys.map((k) => (
                <option key={k} value={k}>{getKpiDisplayName(k)}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Reward Type</label>
            <select
              value={rewardFilter}
              onChange={(e) => setRewardFilter(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Rewards</option>
              {uniqueRewardTypes.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Participants</label>
            <select
              value={participantFilter}
              onChange={(e) => setParticipantFilter(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Types</option>
              <option value="individual">Individual</option>
              <option value="team">Team</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Enrollment</label>
            <select
              value={enrollmentFilter}
              onChange={(e) => setEnrollmentFilter(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="all">All</option>
              <option value="enrolled">Enrolled</option>
              <option value="not_enrolled">Not Enrolled</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Date Range</label>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="all">All Dates</option>
              <option value="this_month">This Month</option>
              <option value="last_30">Last 30 Days</option>
              <option value="next_30">Next 30 Days</option>
            </select>
          </div>
          <div>
            <label className="block text-xs text-apptivia-carbon-500 mb-1">Sort By</label>
            <select
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value)}
              className="w-full border border-apptivia-carbon-200 rounded px-2 py-1 text-xs"
            >
              <option value="recent">Most Recent</option>
              <option value="participants">Participants</option>
              <option value="end_date">Ending Soon</option>
            </select>
          </div>
        </div>
      </RightFilterPanel>
        {loading && (
          <div className="text-center py-12">
            <div className="text-apptivia-carbon-500">Loading contests...</div>
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
            <div className="font-semibold mb-1">Failed to load contests</div>
            <div className="text-sm">{error}</div>
          </div>
        )}

        {!loading && !error && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg p-4 shadow-sm border border-apptivia-carbon-100">
              <div className="flex items-center justify-between gap-3 mb-3">
                <div>
                  <div className="text-xs text-apptivia-carbon-500">Contest Analytics</div>
                  <div className="text-base font-semibold text-apptivia-ink flex items-center gap-2">Performance snapshot across contests <InfoTooltip text="Aggregated statistics across all your contests including active, upcoming, and completed." /></div>
                </div>
                {analytics.topContest && (
                  <div className="text-xs text-apptivia-carbon-500">
                    Most popular: <span className="font-semibold text-apptivia-carbon-700">{analytics.topContest.name}</span>
                  </div>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-apptivia-paper rounded-lg p-3">
                  <div className="text-xs text-apptivia-carbon-500">Avg Participants</div>
                  <div className="text-lg font-bold text-apptivia-coral">{analytics.avgParticipants}</div>
                </div>
                <div className="bg-apptivia-paper rounded-lg p-3">
                  <div className="text-xs text-apptivia-carbon-500">Completion Rate</div>
                  <div className="text-lg font-bold text-emerald-600">{analytics.completionRate}%</div>
                </div>
                <div className="bg-apptivia-paper rounded-lg p-3">
                  <div className="text-xs text-apptivia-carbon-500">Most Popular KPI</div>
                  <div className="text-sm font-semibold text-apptivia-carbon-700">{getKpiDisplayName(analytics.mostPopularKpi)}</div>
                </div>
                <div className="bg-apptivia-paper rounded-lg p-3">
                  <div className="text-xs text-apptivia-carbon-500">Total Contests</div>
                  <div className="text-lg font-bold text-apptivia-carbon-700">{allContests.length}</div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {[
                { key: 'all', label: 'All' },
                { key: 'active', label: `Active (${totalActive})` },
                { key: 'upcoming', label: `Upcoming (${totalUpcoming})` },
                { key: 'completed', label: `Completed (${totalCompleted})` },
                { key: 'archived', label: `Archived (${totalArchived})` },
                { key: 'badges', label: '🎖️ Badge Leaderboard' },
                { key: 'analytics', label: '📊 Analytics' },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusTab(tab.key)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                    statusTab === tab.key
                      ? 'bg-apptivia-coral text-white shadow-sm'
                      : 'bg-white text-apptivia-carbon-600 border border-apptivia-carbon-200 hover:bg-apptivia-paper'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
              {canCreateContests && (
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="ml-auto px-4 py-1.5 rounded-lg text-xs font-semibold bg-apptivia-coral text-white hover:bg-apptivia-coral transition-colors shadow-sm"
                >
                  + Create Contest
                </button>
              )}
            </div>

            {myActiveContest && statusTab !== 'completed' && (
              <div className="bg-white rounded-lg p-4 shadow-sm border border-apptivia-coral-tone-100">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <div className="text-xs text-apptivia-coral font-semibold">My Active Contest</div>
                    <div className="text-base font-semibold text-apptivia-ink">{myActiveContest.name}</div>
                  </div>
                  <button
                    onClick={() => openLeaderboard(myActiveContest)}
                    className="px-3 py-1.5 rounded-md text-xs font-semibold bg-apptivia-coral-tone-50 text-apptivia-coral hover:bg-apptivia-coral-tone-50"
                  >
                    View Leaderboard
                  </button>
                </div>
                <div className="text-xs text-apptivia-carbon-600 mb-2">{myActiveContest.description}</div>
                <div className="flex items-center gap-4 text-xs text-apptivia-carbon-500">
                  <span>👥 {myActiveContest.participant_count} participants</span>
                  {myActiveContest.days_remaining !== null && (
                    <span>⏰ {formatDaysRemaining(myActiveContest.days_remaining, myActiveContest.status)}</span>
                  )}
                  {myActiveContest.user_rank && (
                    <span className="text-apptivia-coral font-semibold">Rank #{myActiveContest.user_rank}</span>
                  )}
                </div>
              </div>
            )}

            {/* Active Contests */}
            {(statusTab === 'all' || statusTab === 'active') && filteredActive.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-apptivia-carbon-700 mb-3 flex items-center gap-2">🔥 Active Contests <InfoTooltip text="Contests currently in progress. Join, view leaderboards, and track your ranking." /></h2>
                <div className="space-y-4">
                  {filteredActive.map(renderContest)}
                </div>
              </div>
            )}

            {/* Upcoming Contests */}
            {(statusTab === 'all' || statusTab === 'upcoming') && filteredUpcoming.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-apptivia-carbon-700 mb-3 flex items-center gap-2">📅 Upcoming Contests <InfoTooltip text="Contests that haven't started yet. They will become active on their start date." /></h2>
                <div className="space-y-4">
                  {filteredUpcoming.map(renderContest)}
                </div>
              </div>
            )}

            {/* Completed Contests */}
            {(statusTab === 'all' || statusTab === 'completed') && filteredCompleted.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-apptivia-carbon-700 mb-3 flex items-center gap-2">🏆 Completed Contests <InfoTooltip text="Finished contests with final results. Share results or archive them." /></h2>
                <div className="space-y-4">
                  {filteredCompleted.map(renderContest)}
                </div>
              </div>
            )}

            {/* Archived Contests */}
            {(statusTab === 'all' || statusTab === 'archived') && filteredArchived.length > 0 && (
              <div>
                <h2 className="text-lg font-semibold text-apptivia-carbon-700 mb-3 flex items-center gap-2">📦 Archived Contests <InfoTooltip text="Historical contests preserved for reference. Includes winners, stats, and leaderboard history." /></h2>
                <div className="space-y-4">
                  {filteredArchived.map(renderContest)}
                </div>
              </div>
            )}

            {/* Badge Leaderboard */}
            {statusTab === 'badges' && (
              <div>
                <h2 className="text-lg font-semibold text-apptivia-carbon-700 mb-4 flex items-center gap-2">🎖️ Badge Leaderboard</h2>
                {badgeLeaderboardLoading ? (
                  <div className="text-center py-8 text-apptivia-carbon-400 text-sm">Loading...</div>
                ) : badgeLeaderboard.length === 0 ? (
                  <div className="text-center py-8 text-apptivia-carbon-400 text-sm">No badges earned yet.</div>
                ) : (
                  <div className="bg-white rounded-lg border border-apptivia-carbon-200 overflow-hidden">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-apptivia-paper border-b border-apptivia-carbon-200">
                          <th className="text-left px-4 py-3 font-semibold text-apptivia-carbon-600 w-10">#</th>
                          <th className="text-left px-4 py-3 font-semibold text-apptivia-carbon-600">Rep</th>
                          <th className="text-center px-4 py-3 font-semibold text-apptivia-carbon-600">Total</th>
                          <th className="text-center px-4 py-3 font-semibold text-yellow-600">👑 Legendary</th>
                          <th className="text-center px-4 py-3 font-semibold text-apptivia-ink">💜 Epic</th>
                          <th className="text-center px-4 py-3 font-semibold text-apptivia-coral">💙 Rare</th>
                          <th className="text-right px-4 py-3 font-semibold text-apptivia-carbon-600">Latest</th>
                        </tr>
                      </thead>
                      <tbody>
                        {badgeLeaderboard.map((rep, i) => (
                          <tr key={rep.id} className={`border-b border-apptivia-carbon-100 ${i < 3 ? 'bg-amber-50/40' : 'hover:bg-apptivia-paper'}`}>
                            <td className="px-4 py-3 text-apptivia-carbon-500 font-medium">
                              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}
                            </td>
                            <td className="px-4 py-3 font-semibold text-apptivia-ink">{rep.name}</td>
                            <td className="px-4 py-3 text-center font-bold text-apptivia-ink">{rep.count}</td>
                            <td className="px-4 py-3 text-center text-yellow-700 font-medium">{rep.legendary || '—'}</td>
                            <td className="px-4 py-3 text-center text-apptivia-ink font-medium">{rep.epic || '—'}</td>
                            <td className="px-4 py-3 text-center text-apptivia-coral font-medium">{rep.rare || '—'}</td>
                            <td className="px-4 py-3 text-right text-apptivia-carbon-400 text-xs">{new Date(rep.latest).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Contest Analytics */}
            {statusTab === 'analytics' && (() => {
              const all = [...(data.active || []), ...(data.upcoming || []), ...(data.completed || []), ...(data.archived || [])];
              const completed = data.completed || [];
              const avgDuration = completed.length > 0
                ? Math.round(completed.reduce((sum, c) => sum + Math.max(1, Math.ceil((new Date(c.end_date).getTime() - new Date(c.start_date).getTime()) / (1000 * 60 * 60 * 24))), 0) / completed.length)
                : 0;
              const kpiCounts = {};
              all.forEach(c => { kpiCounts[c.kpi_key] = (kpiCounts[c.kpi_key] || 0) + 1; });
              const topKpi = Object.entries(kpiCounts).sort((a, b) => b[1] - a[1])[0];
              const avgParticipants = all.length > 0
                ? Math.round(all.reduce((sum, c) => sum + (c.participant_count || 0), 0) / all.length)
                : 0;
              const winnerCounts = {};
              completed.forEach(c => { if (c.winner_name) winnerCounts[c.winner_name] = (winnerCounts[c.winner_name] || 0) + 1; });
              const topWinners = Object.entries(winnerCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

              return (
                <div className="space-y-6">
                  <h2 className="text-lg font-semibold text-apptivia-carbon-700 flex items-center gap-2">📊 Contest Analytics</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4 text-center">
                      <div className="text-2xl font-bold text-apptivia-coral">{all.length}</div>
                      <div className="text-xs text-apptivia-carbon-500">Total Contests</div>
                    </div>
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4 text-center">
                      <div className="text-2xl font-bold text-emerald-600">{completed.length}</div>
                      <div className="text-xs text-apptivia-carbon-500">Completed</div>
                    </div>
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4 text-center">
                      <div className="text-2xl font-bold text-apptivia-ink">{avgDuration}d</div>
                      <div className="text-xs text-apptivia-carbon-500">Avg Duration</div>
                    </div>
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4 text-center">
                      <div className="text-2xl font-bold text-amber-600">{avgParticipants}</div>
                      <div className="text-xs text-apptivia-carbon-500">Avg Participants</div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Most Popular KPI */}
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4">
                      <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Most Popular KPIs</h3>
                      {Object.entries(kpiCounts).sort((a, b) => b[1] - a[1]).map(([kpi, count]) => (
                        <div key={kpi} className="flex items-center justify-between py-1.5 border-b border-apptivia-carbon-100 last:border-0">
                          <span className="text-sm text-apptivia-carbon-600">{getKpiDisplayName(kpi)}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-24 bg-apptivia-carbon-100 rounded-full h-2">
                              <div className="bg-apptivia-coral rounded-full h-2" style={{ width: `${(count / all.length) * 100}%` }} />
                            </div>
                            <span className="text-xs text-apptivia-carbon-400 w-6 text-right">{count}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Top Winners */}
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4">
                      <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Top Winners</h3>
                      {topWinners.length === 0 ? (
                        <p className="text-sm text-apptivia-carbon-400 py-4 text-center">No completed contests yet</p>
                      ) : topWinners.map(([name, wins], i) => (
                        <div key={name} className="flex items-center justify-between py-1.5 border-b border-apptivia-carbon-100 last:border-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</span>
                            <span className="text-sm text-apptivia-carbon-700">{name}</span>
                          </div>
                          <span className="text-xs font-semibold text-apptivia-coral">{wins} win{wins !== 1 ? 's' : ''}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Export section */}
                  {completed.length > 0 && (
                    <div className="bg-white rounded-lg border border-apptivia-carbon-200 p-4">
                      <h3 className="text-sm font-semibold text-apptivia-carbon-700 mb-3">Export Results</h3>
                      <div className="flex flex-wrap gap-2">
                        {completed.map(c => (
                          <button
                            key={c.id}
                            onClick={() => exportContestResultsToCSV(c)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-apptivia-carbon-600 bg-apptivia-paper border border-apptivia-carbon-200 rounded-lg hover:bg-apptivia-carbon-100 transition-colors"
                          >
                            <Download size={12} /> {c.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            {statusTab === 'all' && filteredActive.length === 0 && filteredUpcoming.length === 0 && filteredCompleted.length === 0 && filteredArchived.length === 0 && (
              <div className="text-center py-16">
                <Trophy size={48} className="mx-auto text-apptivia-carbon-300 mb-3" />
                <div className="text-apptivia-carbon-500 text-lg font-medium mb-1">No contests yet</div>
                <p className="text-apptivia-carbon-400 text-sm mb-4">Contests drive friendly competition and boost team performance.</p>
                {(isAdmin || isManager) && (
                  <button onClick={() => setShowCreateModal(true)} className="px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm font-medium hover:bg-apptivia-coral transition-colors">
                    Create Your First Contest
                  </button>
                )}
              </div>
            )}
            {statusTab !== 'all' && statusTab !== 'badges' && statusTab !== 'analytics' && (
              (statusTab === 'active' && filteredActive.length === 0) ||
              (statusTab === 'upcoming' && filteredUpcoming.length === 0) ||
              (statusTab === 'completed' && filteredCompleted.length === 0) ||
              (statusTab === 'archived' && filteredArchived.length === 0)
            ) && (
              <div className="text-center py-8 bg-apptivia-paper rounded-lg">
                <div className="text-apptivia-carbon-400 text-sm">No contests in this view.</div>
                <div className="text-xs text-apptivia-carbon-500">Try another tab or create a new contest.</div>
              </div>
            )}
          </div>
        )}
      </div>
      <ContestCreationModal
        isOpen={showCreateModal}
        onClose={handleCloseModal}
        currentUserId={user?.id}
        organizationId={orgId}
        contestToEdit={contestToEdit}
      />
      <LeaderboardModal
        isOpen={leaderboardModal.isOpen}
        onClose={closeLeaderboard}
        contestName={leaderboardModal.contest?.name || ''}
        leaderboard={leaderboardModal.contest?.leaderboard || []}
        participants={leaderboardModal.contest?.participants || []}
        currentUserId={user?.id}
        status={leaderboardModal.contest?.status}
      />
      {shareModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 overflow-y-auto" onClick={closeShareResults}>
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full my-4 max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-apptivia-carbon-200 flex-shrink-0">
              <h2 className="text-xl font-bold text-apptivia-ink flex items-center gap-2">
                <span>🏆</span>
                Share Contest Results
              </h2>
              <button onClick={closeShareResults} className="p-2 hover:bg-apptivia-carbon-100 rounded-lg transition-colors">
                <X size={20} className="text-apptivia-carbon-500" />
              </button>
            </div>

            {/* Results Preview (Downloadable) */}
            <div className="flex-1 overflow-y-auto p-4 bg-apptivia-paper min-h-0">
              <div ref={sharePreviewRef} className="bg-gradient-to-br from-blue-500 via-purple-500 to-pink-500 rounded-xl p-6 text-white shadow-2xl">
                {/* Contest Header */}
                <div className="mb-4">
                  <h3 className="text-xl font-bold">{shareModal.contest?.name}</h3>
                  <p className="text-white/80 text-sm mt-1">Apptivia Platform</p>
                  {shareModal.contest?.start_date && shareModal.contest?.end_date && (
                    <p className="text-white/70 text-xs mt-1">
                      {new Date(shareModal.contest.start_date).toLocaleDateString()} – {new Date(shareModal.contest.end_date).toLocaleDateString()}
                    </p>
                  )}
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <div className="text-2xl font-bold mb-0.5">{shareModal.contest?.participant_count || 0}</div>
                    <div className="text-white/80 text-xs">Participants</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <div className="text-2xl font-bold mb-0.5">{shareModal.contest?.winner_score || 'N/A'}</div>
                    <div className="text-white/80 text-xs">Winning Score</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <div className="text-2xl font-bold mb-0.5 truncate">{shareModal.contest?.winner_name || 'N/A'}</div>
                    <div className="text-white/80 text-xs">Winner</div>
                  </div>
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <div className="text-2xl font-bold mb-0.5">{shareModal.contest?.reward_value || '—'}</div>
                    <div className="text-white/80 text-xs">Reward</div>
                  </div>
                </div>

                {/* Top 3 Leaderboard */}
                {shareModal.contest?.leaderboard?.length > 0 && (
                  <div>
                    <h4 className="text-base font-semibold mb-2 flex items-center gap-2">
                      <span>🏅</span>
                      Top Performers
                    </h4>
                    <div className="space-y-2">
                      {shareModal.contest.leaderboard.slice(0, 3).map((entry, idx) => (
                        <div key={entry.profile_id} className="bg-white/10 backdrop-blur-sm rounded-lg p-2.5 border border-white/20 flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-lg">{idx === 0 ? '🥇' : idx === 1 ? '🥈' : '🥉'}</span>
                            <span className="text-sm font-medium">{entry.profile_name}</span>
                          </div>
                          <span className="text-sm font-bold">{entry.score}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Writeup */}
                {shareNotes.trim() && (
                  <div className="mt-4 bg-white/10 backdrop-blur-sm rounded-lg p-3 border border-white/20">
                    <div className="text-xs text-white/70 mb-1">Notes</div>
                    <div className="text-sm text-white/90">{shareNotes}</div>
                  </div>
                )}

                {/* Footer Branding */}
                <div className="mt-4 pt-3 border-t border-white/20 text-center">
                  <p className="text-white/60 text-xs">Generated on {new Date().toLocaleDateString()}</p>
                  <p className="text-white/80 text-sm font-medium mt-0.5">apptivia.app</p>
                </div>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="border-t border-apptivia-carbon-200 p-4 bg-white flex-shrink-0">
              {!showEmailForm ? (
                <>
                  {/* Writeup textarea */}
                  <div className="mb-3">
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1">Writeup (optional)</label>
                    <textarea
                      value={shareNotes}
                      onChange={(e) => setShareNotes(e.target.value)}
                      rows={2}
                      placeholder="Add a brief summary and next steps for the team."
                      className="w-full border border-apptivia-carbon-200 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-apptivia-coral"
                    />
                  </div>
                  <div className="flex flex-wrap gap-2 justify-center">
                    <button
                      onClick={handleDownloadResults}
                      disabled={downloadingResults}
                      className="flex items-center gap-1.5 px-4 py-2 bg-apptivia-coral text-white rounded-lg text-sm font-medium hover:bg-apptivia-coral transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Download size={16} />
                      {downloadingResults ? 'Downloading...' : 'Download PNG'}
                    </button>
                    <button
                      onClick={() => setShowEmailForm(true)}
                      className="flex items-center gap-1.5 px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700 transition-colors"
                    >
                      <Mail size={16} />
                      Email Results
                    </button>
                  </div>
                  <p className="text-center text-xs text-apptivia-carbon-500 mt-2">
                    Download as an image or email results to your team
                  </p>
                </>
              ) : (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-apptivia-carbon-700 mb-1.5">
                      Recipients (comma-separated emails)
                    </label>
                    <input
                      type="text"
                      value={shareRecipients}
                      onChange={(e) => setShareRecipients(e.target.value)}
                      placeholder="rep@company.com, rep2@company.com"
                      className="w-full px-3 py-2 text-sm border border-apptivia-carbon-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                    {shareRecipients.split(',').filter(r => r.trim()).length > 50 && (
                      <p className="text-xs text-red-500 mt-1">Maximum 50 recipients per email. Only the first 50 will receive the message.</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={handleShareResults}
                      disabled={!shareRecipients.trim() || sendingResults}
                      className={`flex-1 flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                        shareRecipients.trim() && !sendingResults
                          ? 'bg-apptivia-coral hover:bg-apptivia-coral text-white'
                          : 'bg-apptivia-carbon-300 text-apptivia-carbon-500 cursor-not-allowed'
                      }`}
                    >
                      <Mail size={16} />
                      {sendingResults ? 'Sending...' : 'Send Email'}
                    </button>
                    <button
                      onClick={() => setShowEmailForm(false)}
                      className="px-4 py-2 bg-apptivia-carbon-200 text-apptivia-carbon-700 rounded-lg text-sm font-medium hover:bg-apptivia-carbon-300 transition-colors"
                    >
                      Back
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <AddTeamMembersModal
        isOpen={addMembersModal.isOpen}
        onClose={() => setAddMembersModal({ isOpen: false, contest: null })}
        contestId={addMembersModal.contest?.id || ''}
        contestName={addMembersModal.contest?.name || ''}
        existingParticipantIds={(addMembersModal.contest?.participants || []).map(p => p.profile_id)}
        onMembersAdded={async () => {
          await refetch();
          const contestName = addMembersModal.contest?.name || 'contest';
          addNotification({
            type: 'contest',
            title: 'Team Members Added',
            message: `New members were added to "${contestName}".`,
            link: '/contests',
            dedupeKey: `contest-members-added-${addMembersModal.contest?.id}-${Date.now()}`,
            audience: 'team',
          });
        }}
      />
      <ExportReportModal
        isOpen={showExportModal}
        onClose={() => setShowExportModal(false)}
        onSelectFormat={(format) => {
          const allContests = [...(data.active || []), ...(data.completed || [])];
          const target = allContests.find(c => c.leaderboard?.length > 0) || allContests[0];
          if (!target) return;
          if (format === 'csv') exportContestResultsToCSV(target);
          else if (format === 'pdf') exportContestToPDF(target);
        }}
        title="Export Contest Report"
      />
      <ScheduleReportModal
        isOpen={showScheduleReportModal}
        onClose={() => setShowScheduleReportModal(false)}
        onSuccess={() => {
          if (addNotification) addNotification({ type: 'success', title: 'Report Scheduled', message: 'Your report has been scheduled. Manage it in Settings → Reports.', dedupeKey: 'report-scheduled' });
        }}
      />
    </DashboardLayout>
  );
}
