import React, { createContext, useContext, useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useAuth } from '../AuthContext';
import { supabase } from '../supabaseClient';
import { ROLES } from '../constants/roles';

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const { user, profile, role } = useAuth();
  const profileId = profile?.id || null;
  const organizationId = profile?.organization_id || null;
  const [notifications, setNotifications] = useState([]);
  const [panelOpen, setPanelOpen] = useState(false);
  const [dbReady, setDbReady] = useState(false);
  const channelRef = useRef(null);

  // ── Fetch from DB ──────────────────────────────────────────
  const fetchNotifications = useCallback(async () => {
    if (!profileId) { setNotifications([]); return; }
    try {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', profileId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(100);
      if (!error) {
        setNotifications(data || []);
        setDbReady(true);
      } else {
        console.error('Notification fetch error:', error.message);
        setDbReady(false);
      }
    } catch (err) {
      console.error('Notification fetch failed:', err);
      setDbReady(false);
    }
  }, [profileId]);

  useEffect(() => { fetchNotifications(); }, [fetchNotifications]);

  // ── Realtime subscription ──────────────────────────────────
  useEffect(() => {
    if (!profileId) return;
    const channel = supabase
      .channel(`notifications:${profileId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` },
        (payload) => { setNotifications(prev => [payload.new, ...prev]); })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` },
        (payload) => { setNotifications(prev => prev.map(n => n.id === payload.new.id ? payload.new : n)); })
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notifications', filter: `profile_id=eq.${profileId}` },
        (payload) => { setNotifications(prev => prev.filter(n => n.id !== payload.old.id)); })
      .subscribe();
    channelRef.current = channel;
    return () => { supabase.removeChannel(channel); channelRef.current = null; };
  }, [profileId]);

  // ── Map legacy type strings to DB enum values ───────────
  const mapTypeToEnum = (t) => {
    const map = {
      info: 'general_info',
      coaching: 'coaching_suggestion',
      contest: 'contest_started',
      achievement: 'achievement_earned',
      badge: 'badge_earned',
      trend: 'momentum_gained',
      streak: 'streak_milestone',
      integration: 'integration_sync',
      performance: 'top_performer',
    };
    return map[t] || t || 'general_info';
  };

  // ── Add notification (writes to DB) ────────────────────────
  const addNotification = useCallback(async (notification) => {
    if (!profileId) return;
    const dedupeKey = notification.dedupeKey || null;

    // Check local dedup first
    if (dedupeKey) {
      const exists = notifications.some(n => n.dedupe_key === dedupeKey || n.id === dedupeKey);
      if (exists) return;
    }

    const row = {
      profile_id: notification.ownerId || profileId,
      organization_id: notification.organizationId || organizationId,
      type: mapTypeToEnum(notification.type),
      title: notification.title || 'Notification',
      message: notification.message || '',
      action_url: notification.link || null,
      is_read: Boolean(notification.read),
      dedupe_key: dedupeKey,
      priority: notification.priority || 5,
    };

    const { error } = await supabase.from('notifications').insert(row);
    if (error) {
      console.error('Failed to insert notification:', error.message);
      // Fallback: add to local state so user still sees it
      setNotifications(prev => [{
        ...row,
        id: `local-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        created_at: new Date().toISOString(),
        // Preserve legacy fields for panel rendering
        audience: notification.audience || 'self',
        rep_name: notification.repName || notification.ownerName || null,
        owner_name: notification.ownerName || null,
      }, ...prev].slice(0, 100));
    }
    // If DB insert succeeded, realtime subscription will add it to state
  }, [profileId, notifications]);

  // ── Mark read ──────────────────────────────────────────────
  const markRead = useCallback(async (id) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, is_read: true } : n));
    if (dbReady) {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('id', id);
    }
  }, [dbReady]);

  const markAllRead = useCallback(async () => {
    setNotifications(prev => prev.map(n => ({ ...n, is_read: true })));
    if (dbReady && profileId) {
      await supabase.from('notifications').update({ is_read: true, read_at: new Date().toISOString() }).eq('profile_id', profileId).eq('is_read', false);
    }
  }, [dbReady, profileId]);

  // ── Remove / Clear (deletes from DB) ──────────────────────
  const removeNotification = useCallback(async (id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
    if (dbReady) {
      await supabase.from('notifications').delete().eq('id', id);
    }
  }, [dbReady]);

  const clearAll = useCallback(async () => {
    setNotifications([]);
    if (dbReady && profileId) {
      await supabase.from('notifications').delete().eq('profile_id', profileId);
    }
  }, [dbReady, profileId]);

  // DB rows use profile_id; legacy localStorage used ownerId. Support both.
  const visibleNotifications = useMemo(() => {
    if (!profileId) return [];
    if (role === ROLES.ADMIN) return notifications;
    return notifications.filter((n) => {
      const nOwner = n.profile_id || n.ownerId;
      if (n.audience === 'self') {
        return String(nOwner) === String(profileId);
      }
      if (n.audience === 'team') {
        return role === ROLES.MANAGER || role === ROLES.COACH;
      }
      return true; // DB rows for this profileId are already scoped
    });
  }, [notifications, role, profileId]);

  // Group related notifications (e.g., multiple coaching alerts become one grouped entry)
  const groupedNotifications = useMemo(() => {
    const groups = {};
    const result = [];

    visibleNotifications.forEach(n => {
      const groupKey =
        ((n.type === 'coaching' || n.type === 'coaching_suggestion') && n.audience === 'team') ? 'group-coaching-team' :
        ((n.type === 'contest' || n.type === 'contest_started') && n.title === 'Rank change') ? 'group-contest-rank' :
        ((n.type === 'achievement' || n.type === 'achievement_earned')) ? 'group-achievements' :
        null;

      // Normalize DB field names for the panel (read/createdAt/link/message compat)
      const normalized = {
        ...n,
        read: n.is_read ?? n.read ?? false,
        createdAt: n.created_at || n.createdAt,
        link: n.action_url || n.link || null,
        ownerId: n.profile_id || n.ownerId,
        repName: n.rep_name || n.repName,
        ownerName: n.owner_name || n.ownerName,
      };

      if (groupKey) {
        if (!groups[groupKey]) {
          groups[groupKey] = {
            ...normalized,
            id: `grouped-${groupKey}`,
            _groupedItems: [normalized],
            _isGrouped: true,
          };
          result.push(groups[groupKey]);
        } else {
          groups[groupKey]._groupedItems.push(normalized);
          const count = groups[groupKey]._groupedItems.length;
          const groupMessages = {
            'group-coaching-team': `${count} coaching alerts this period`,
            'group-contest-rank': `${count} contest rank changes`,
            'group-achievements': `${count} achievements earned`,
          };
          groups[groupKey].message = groupMessages[groupKey] || `${count} notifications`;
          groups[groupKey].read = groups[groupKey]._groupedItems.every(item => item.read);
          if (normalized.createdAt > groups[groupKey].createdAt) {
            groups[groupKey].createdAt = normalized.createdAt;
          }
        }
      } else {
        result.push(normalized);
      }
    });

    return result;
  }, [visibleNotifications]);

  const unreadCount = useMemo(() => groupedNotifications.filter(n => !n.read).length, [groupedNotifications]);

  const value = {
    notifications: groupedNotifications,
    addNotification,
    markRead,
    markAllRead,
    removeNotification,
    clearAll,
    unreadCount,
    panelOpen,
    openPanel: () => setPanelOpen(true),
    closePanel: () => setPanelOpen(false),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
}
