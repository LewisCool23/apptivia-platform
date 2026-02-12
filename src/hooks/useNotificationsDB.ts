// =============================================================================
// useNotificationsDB.ts - Database-backed notifications hook
// =============================================================================
// Enhanced notification hook that uses Supabase for persistence
// Usage: Replace import in NotificationContext.jsx after migration 024
// =============================================================================

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import type { RealtimeChannel } from '@supabase/supabase-js';

export interface Notification {
  id: string;
  profile_id: string;
  type: string;
  title: string;
  message: string;
  icon?: string;
  color?: string;
  action_url?: string;
  priority: number;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  achievement_id?: string;
  badge_id?: string;
  contest_id?: string;
  skillset_id?: string;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  error: string | null;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  deleteNotification: (id: string) => Promise<void>;
  clearAll: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useNotificationsDB(profileId?: string): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch notifications from database
  const fetchNotifications = useCallback(async () => {
    if (!profileId) {
      setNotifications([]);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error: fetchError } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', profileId)
        .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(50); // Limit to most recent 50

      if (fetchError) throw fetchError;
      
      setNotifications(data || []);
      setError(null);
    } catch (err) {
      console.error('Error fetching notifications:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch notifications');
    } finally {
      setLoading(false);
    }
  }, [profileId]);

  // Mark single notification as read
  const markRead = useCallback(async (id: string) => {
    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('id', id);

      if (updateError) throw updateError;

      // Update local state
      setNotifications(prev => 
        prev.map(n => n.id === id ? { ...n, is_read: true, read_at: new Date().toISOString() } : n)
      );
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  }, []);

  // Mark all notifications as read
  const markAllRead = useCallback(async () => {
    if (!profileId) return;

    try {
      const { error: updateError } = await supabase
        .from('notifications')
        .update({ is_read: true, read_at: new Date().toISOString() })
        .eq('profile_id', profileId)
        .eq('is_read', false);

      if (updateError) throw updateError;

      // Update local state
      setNotifications(prev => 
        prev.map(n => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch (err) {
      console.error('Error marking all notifications as read:', err);
    }
  }, [profileId]);

  // Delete single notification
  const deleteNotification = useCallback(async (id: string) => {
    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('id', id);

      if (deleteError) throw deleteError;

      // Update local state
      setNotifications(prev => prev.filter(n => n.id !== id));
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  }, []);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!profileId) return;

    try {
      const { error: deleteError } = await supabase
        .from('notifications')
        .delete()
        .eq('profile_id', profileId);

      if (deleteError) throw deleteError;

      setNotifications([]);
    } catch (err) {
      console.error('Error clearing all notifications:', err);
    }
  }, [profileId]);

  // Initial fetch
  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Set up realtime subscription for new notifications
  useEffect(() => {
    if (!profileId) return;

    let channel: RealtimeChannel;

    const setupRealtimeSubscription = async () => {
      channel = supabase
        .channel(`notifications:${profileId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${profileId}`,
          },
          (payload: any) => {
            console.log('New notification received:', payload);
            const newNotification = payload.new as Notification;
            setNotifications(prev => [newNotification, ...prev]);
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${profileId}`,
          },
          (payload: any) => {
            console.log('Notification updated:', payload);
            const updated = payload.new as Notification;
            setNotifications(prev => 
              prev.map(n => n.id === updated.id ? updated : n)
            );
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'DELETE',
            schema: 'public',
            table: 'notifications',
            filter: `profile_id=eq.${profileId}`,
          },
          (payload: any) => {
            console.log('Notification deleted:', payload);
            const deletedId = (payload.old as Notification).id;
            setNotifications(prev => prev.filter(n => n.id !== deletedId));
          }
        )
        .subscribe();
    };

    setupRealtimeSubscription();

    return () => {
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, [profileId]);

  // Calculate unread count
  const unreadCount = notifications.filter(n => !n.is_read).length;

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markRead,
    markAllRead,
    deleteNotification,
    clearAll,
    refresh: fetchNotifications,
  };
}

// Export utility function to create notifications from frontend
export async function createNotification(
  profileId: string,
  type: string,
  title: string,
  message: string,
  options?: {
    icon?: string;
    color?: string;
    action_url?: string;
    priority?: number;
    dedupe_key?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('create_notification', {
      p_profile_id: profileId,
      p_type: type,
      p_title: title,
      p_message: message,
      p_icon: options?.icon || null,
      p_color: options?.color || null,
      p_action_url: options?.action_url || null,
      p_priority: options?.priority || 5,
      p_dedupe_key: options?.dedupe_key || null,
    });

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error('Error creating notification:', err);
    return {
      success: false,
      error: err instanceof Error ? err.message : 'Failed to create notification',
    };
  }
}
