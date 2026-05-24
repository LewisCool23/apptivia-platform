/**
 * useIntegrations — Hook for managing integration connections, OAuth, and sync.
 */

import { useState, useEffect, useCallback } from 'react';
import { backendFetch, BACKEND_BASE } from '../utils/backendFetch';
import { supabase } from '../supabaseClient';

export interface Integration {
  id: string;
  integration_type: string;
  display_name: string;
  status: 'disconnected' | 'connected' | 'error' | 'syncing';
  is_enabled: boolean;
  last_sync_at: string | null;
  last_sync_status: string | null;
  last_sync_error: string | null;
  instance_url: string | null;
  scopes: string[] | null;
  profile_id: string | null;
  created_at: string;
  updated_at: string;
}

interface UseIntegrationsOptions {
  personal?: boolean;
}

export interface IntegrationTemplate {
  id: string;
  integration_type: string;
  display_name: string;
  icon: string;
  description: string;
  default_field_mappings: Record<string, any>;
  required_fields: string[];
  oauth_config: {
    authorization_url?: string;
    token_url?: string;
    scopes?: string[];
    grant_type?: string;
  } | null;
  documentation_url: string;
  is_active: boolean;
}

export interface SyncHistoryEntry {
  id: string;
  integration_id: string;
  status: 'running' | 'success' | 'failed' | 'partial';
  sync_started_at: string;
  sync_completed_at: string | null;
  records_processed: number;
  records_created: number;
  records_updated: number;
  records_failed: number;
  error_message: string | null;
}

export function useIntegrations({ personal = false }: UseIntegrationsOptions = {}) {
  const basePath = personal ? '/api/integrations/my' : '/api/integrations';
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [templates, setTemplates] = useState<IntegrationTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);
  const [connecting, setConnecting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadIntegrations = useCallback(async (): Promise<Integration[]> => {
    try {
      setError(null);
      const data = await backendFetch<{ integrations: Integration[] }>(basePath, undefined, 'GET');
      const list = data.integrations || [];
      setIntegrations(list);
      return list;
    } catch (err: any) {
      console.error('[useIntegrations] load error:', err);
      setError(err.message);
      return [];
    }
  }, [basePath]);

  const loadTemplates = useCallback(async () => {
    try {
      const data = await backendFetch<{ templates: IntegrationTemplate[] }>('/api/integrations/templates', undefined, 'GET');
      setTemplates(data.templates || []);
    } catch (err: any) {
      console.error('[useIntegrations] templates error:', err);
    }
  }, []);

  const connectOAuth = useCallback(async (provider: string) => {
    if (!BACKEND_BASE) {
      setError('Backend URL not configured');
      return;
    }

    // Get the current session token to pass as query param (window.open can't set headers)
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token || '';
    if (!token) {
      setError('Not authenticated — please sign in again');
      return;
    }

    setConnecting(provider);

    // Open OAuth flow in a popup window.
    // SECURITY NOTE: The auth token is passed as a query parameter because window.open()
    // cannot set Authorization headers. This is acceptable for OAuth init redirects, but
    // the backend MUST consume and discard this token immediately on receipt (do not log
    // it, persist it, or pass it to third parties). The token is short-lived (Supabase JWT)
    // and the URL is opened in a popup that redirects away immediately.
    const width = 600;
    const height = 700;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const oauthPath = personal
      ? `/api/integrations/oauth/${provider}/init-personal`
      : `/api/integrations/oauth/${provider}/init`;
    const popup = window.open(
      `${BACKEND_BASE}${oauthPath}?token=${encodeURIComponent(token)}`,
      'apptivia-oauth',
      `width=${width},height=${height},left=${left},top=${top},toolbar=no,menubar=no`
    );

    // Listen for postMessage from the callback page
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'oauth-success') {
        cleanup();
        loadIntegrations().then(() => setConnecting(null));
      }
    };
    window.addEventListener('message', handleMessage);

    // Fallback: poll for popup close
    const interval = setInterval(() => {
      if (!popup || popup.closed) {
        cleanup();
        loadIntegrations().then(() => setConnecting(null));
      }
    }, 1000);

    // Safety timeout: clean up after 5 minutes if nothing happened
    const timeout = setTimeout(() => {
      cleanup();
      setConnecting(null);
    }, 5 * 60 * 1000);

    function cleanup() {
      clearInterval(interval);
      clearTimeout(timeout);
      window.removeEventListener('message', handleMessage);
    }
  }, [loadIntegrations]);

  const connectCredentials = useCallback(async (provider: string, credentials: Record<string, string>) => {
    // For providers that use client credentials (e.g., Marketo) instead of OAuth popup
    try {
      setError(null);
      await backendFetch(basePath, {
        integration_type: provider,
        credentials,
      });
      await loadIntegrations();
    } catch (err: any) {
      setError(err.message);
    }
  }, [basePath, loadIntegrations]);

  const disconnect = useCallback(async (id: string) => {
    try {
      setError(null);
      const deletePath = personal ? `${basePath}/${id}` : `/api/integrations/${id}`;
      await backendFetch(deletePath, undefined, 'DELETE');
      await loadIntegrations();
    } catch (err: any) {
      setError(err.message);
    }
  }, [basePath, personal, loadIntegrations]);

  const triggerSync = useCallback(async (id: string) => {
    try {
      setError(null);
      setSyncing(id);
      await backendFetch(`/api/integrations/${id}/sync`, {});
      // Poll for sync completion — check every 2s, max 60s
      const startTime = Date.now();
      const poll = async () => {
        const freshList = await loadIntegrations();
        const updated = freshList.find(i => i.id === id);
        if (updated?.status === 'syncing' && Date.now() - startTime < 60000) {
          setTimeout(poll, 2000);
        } else {
          setSyncing(null);
        }
      };
      setTimeout(poll, 2000);
    } catch (err: any) {
      setSyncing(null);
      setError(err.message);
    }
  }, [loadIntegrations]);

  const updateConfig = useCallback(async (id: string, config: {
    field_mappings?: Record<string, any>;
    sync_config?: Record<string, any>;
    display_name?: string;
  }) => {
    try {
      setError(null);
      await backendFetch(`/api/integrations/${id}`, config, 'PATCH');
      await loadIntegrations();
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadIntegrations]);

  const getSyncHistory = useCallback(async (id: string): Promise<SyncHistoryEntry[]> => {
    try {
      const data = await backendFetch<{ history: SyncHistoryEntry[] }>(`/api/integrations/${id}/sync-history`, undefined, 'GET');
      return data.history || [];
    } catch {
      return [];
    }
  }, []);

  useEffect(() => {
    Promise.all([loadIntegrations(), loadTemplates()]).finally(() => setLoading(false));
  }, [loadIntegrations, loadTemplates]);

  return {
    integrations,
    templates,
    loading,
    syncing,
    connecting,
    error,
    connectOAuth,
    connectCredentials,
    disconnect,
    triggerSync,
    updateConfig,
    getSyncHistory,
    refresh: loadIntegrations,
  };
}
