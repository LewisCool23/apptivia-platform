import { useState, useCallback, useEffect } from 'react';
import { backendFetch } from '../utils/backendFetch';

export interface IcpProfile {
  id: string | null;
  organization_id?: string;
  name: string;
  description?: string | null;
  icp_config: Record<string, any>;
  signal_config: Record<string, any>;
  is_default: boolean;
  sort_order: number;
  created_at?: string;
  updated_at?: string;
  _legacy?: boolean;
}

export function useIcpProfiles(organizationId: string | null) {
  const [profiles, setProfiles] = useState<IcpProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);

  const fetchProfiles = useCallback(async () => {
    if (!organizationId) return;
    setLoading(true);
    try {
      const res = await backendFetch<{ ok: boolean; profiles: IcpProfile[] }>(
        '/api/engage/icp-profiles',
        undefined,
        'GET',
      );
      const fetched = res.profiles || [];
      setProfiles(fetched);
      // Auto-select default profile if none active
      if (!activeProfileId) {
        const def = fetched.find(p => p.is_default);
        if (def?.id) setActiveProfileId(def.id);
        else if (fetched[0]?.id) setActiveProfileId(fetched[0].id);
      }
    } catch (err) {
      console.error('Failed to fetch ICP profiles:', err);
    } finally {
      setLoading(false);
    }
  }, [organizationId, activeProfileId]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const createProfile = useCallback(async (data: Partial<IcpProfile>) => {
    const res = await backendFetch<{ ok: boolean; profile: IcpProfile }>(
      '/api/engage/icp-profiles',
      data as Record<string, any>,
    );
    await fetchProfiles();
    return res.profile;
  }, [fetchProfiles]);

  const updateProfile = useCallback(async (id: string, data: Partial<IcpProfile>) => {
    const res = await backendFetch<{ ok: boolean; profile: IcpProfile }>(
      `/api/engage/icp-profiles/${id}`,
      data as Record<string, any>,
      'PATCH',
    );
    await fetchProfiles();
    return res.profile;
  }, [fetchProfiles]);

  const deleteProfile = useCallback(async (id: string) => {
    await backendFetch(`/api/engage/icp-profiles/${id}`, {}, 'DELETE');
    await fetchProfiles();
  }, [fetchProfiles]);

  const activeProfile = profiles.find(p => p.id === activeProfileId)
    || profiles.find(p => p.is_default)
    || profiles[0]
    || null;
  const defaultProfile = profiles.find(p => p.is_default) || null;

  return {
    profiles,
    loading,
    activeProfile,
    activeProfileId,
    setActiveProfileId,
    defaultProfile,
    createProfile,
    updateProfile,
    deleteProfile,
    fetchProfiles,
  };
}
