import { useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';
import { TITLES } from '../constants/titles';

interface Title {
  id?: string;
  key: string;
  label: string;
}

/**
 * Fetches titles from the DB (global + org-specific).
 * Falls back to the hardcoded TITLES constant if the DB query fails.
 */
export function useTitles(organizationId?: string | null) {
  const [titles, setTitles] = useState<Title[]>(TITLES as unknown as Title[]);

  useEffect(() => {
    let cancelled = false;

    async function fetchTitles() {
      // Fetch global titles (organization_id IS NULL) + org-specific if orgId provided
      let query = supabase
        .from('titles')
        .select('id, title_key, title_name')
        .eq('is_active', true)
        .order('sort_order');

      if (organizationId) {
        // Global OR org-specific
        query = query.or(`organization_id.is.null,organization_id.eq.${organizationId}`);
      } else {
        // Global only
        query = query.is('organization_id', null);
      }

      const { data, error } = await query;

      if (!cancelled && data && !error && data.length > 0) {
        setTitles(data.map((t: any) => ({ id: t.id, key: t.title_key, label: t.title_name })));
      }
      // If error or empty, keep the fallback TITLES constant
    }

    fetchTitles();
    return () => { cancelled = true; };
  }, [organizationId]);

  return titles;
}
