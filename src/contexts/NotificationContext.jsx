import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../AuthContext';

const NotificationContext = createContext(null);

const STORAGE_KEY_PREFIX = 'apptivia.notifications.';

function loadStoredNotifications(key) {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    return [];
  }
}

function saveNotifications(key, list) {
  try {
    window.localStorage.setItem(key, JSON.stringify(list));
  } catch (e) {}
}

export function NotificationProvider({ children }) {
  const { user, role } = useAuth();
  const storageKey = `${STORAGE_KEY_PREFIX}${user?.id || 'anonymous'}`;
  const [notifications, setNotifications] = useState(() => (typeof window !== 'undefined' ? loadStoredNotifications(storageKey) : []));
  const [panelOpen, setPanelOpen] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      saveNotifications(storageKey, notifications);
    }
  }, [notifications, storageKey]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setNotifications(loadStoredNotifications(storageKey));
    }
  }, [storageKey]);

  const addNotification = (notification) => {
    setNotifications((prev) => {
      const dedupeKey = notification.dedupeKey || notification.id;
      if (dedupeKey && prev.some(n => n.dedupeKey === dedupeKey || n.id === dedupeKey)) {
        return prev;
      }
      const resolvedOwnerName =
        notification.repName ||
        notification.ownerName ||
        notification.rep ||
        user?.name ||
        user?.email ||
        null;
      const entry = {
        id: notification.id || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
        type: notification.type || 'info',
        title: notification.title || 'Notification',
        message: notification.message || '',
        link: notification.link || null,
        createdAt: notification.createdAt || new Date().toISOString(),
        read: Boolean(notification.read),
        dedupeKey: dedupeKey || null,
        ownerId: notification.ownerId || user?.id || null,
        audience: notification.audience || 'self',
        scopeRole: notification.scopeRole || role || null,
        repName: notification.repName || resolvedOwnerName,
        ownerName: resolvedOwnerName,
      };
      return [entry, ...prev].slice(0, 100);
    });
  };

  const markRead = (id) => {
    setNotifications((prev) => prev.map(n => (n.id === id ? { ...n, read: true } : n)));
  };

  const markAllRead = () => {
    setNotifications((prev) => prev.map(n => ({ ...n, read: true })));
  };

  const removeNotification = (id) => {
    setNotifications((prev) => prev.filter(n => n.id !== id));
  };

  const clearAll = () => setNotifications([]);

  const visibleNotifications = useMemo(() => {
    if (!user?.id) return [];
    if (role === 'admin') return notifications;
    return notifications.filter((n) => {
      if (n.audience === 'self') {
        return String(n.ownerId) === String(user.id);
      }
      if (n.audience === 'team') {
        return role === 'manager' || role === 'coach';
      }
      return false;
    });
  }, [notifications, role, user?.id]);

  const unreadCount = useMemo(() => visibleNotifications.filter(n => !n.read).length, [visibleNotifications]);

  const value = {
    notifications: visibleNotifications,
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
