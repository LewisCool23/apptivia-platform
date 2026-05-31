import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../supabaseClient';
import { SalesDnaConfig, DEFAULT_SALES_DNA } from '../constants/salesDna';
import { backendFetch } from '../utils/backendFetch';

interface UseSalesDnaReturn {
  salesDna: SalesDnaConfig;
  loading: boolean;
  error: string | null;
  updateSalesDna: (updates: Partial<SalesDnaConfig>) => Promise<void>;
  saveSalesDna: (config: SalesDnaConfig) => Promise<void>;
  refetch: () => void;
}

export function useSalesDna(organizationId: string | null | undefined): UseSalesDnaReturn {
  const [salesDna, setSalesDna] = useState<SalesDnaConfig>(DEFAULT_SALES_DNA);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    if (!organizationId) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    async function fetchSalesDna() {
      setLoading(true);
      setError(null);
      try {
        const { data, error: fetchError } = await supabase
          .from('organizations')
          .select('sales_dna')
          .eq('id', organizationId)
          .single();

        if (fetchError) throw fetchError;
        if (!cancelled) {
          const raw = data?.sales_dna;
          if (raw && typeof raw === 'object' && Object.keys(raw).length > 0) {
            setSalesDna({ ...DEFAULT_SALES_DNA, ...raw });
          } else {
            setSalesDna(DEFAULT_SALES_DNA);
          }
        }
      } catch (err: any) {
        if (!cancelled) setError(err.message || 'Failed to load Sales DNA');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchSalesDna();
    return () => { cancelled = true; };
  }, [organizationId, refreshKey]);

  const saveSalesDna = useCallback(async (config: SalesDnaConfig) => {
    if (!organizationId) throw new Error('No organization ID');
    const { error: updateError } = await supabase
      .from('organizations')
      .update({ sales_dna: config })
      .eq('id', organizationId);
    if (updateError) throw updateError;
    setSalesDna(config);
    // Invalidate backend Sales DNA cache so Aaron picks up changes immediately
    backendFetch('/api/admin/clear-sales-dna-cache', { method: 'POST' }).catch(() => {});
  }, [organizationId]);

  const updateSalesDna = useCallback(async (updates: Partial<SalesDnaConfig>) => {
    const merged = { ...salesDna, ...updates };
    await saveSalesDna(merged);
  }, [salesDna, saveSalesDna]);

  const refetch = useCallback(() => setRefreshKey(k => k + 1), []);

  return { salesDna, loading, error, updateSalesDna, saveSalesDna, refetch };
}
