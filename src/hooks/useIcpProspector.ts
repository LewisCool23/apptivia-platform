import { useState, useCallback, useEffect, useRef } from 'react';
import { supabase } from '../supabaseClient';
import { engageApi } from '../utils/engageApi';
import { backendFetch } from '../utils/backendFetch';

// ---------------------------------------------------------------------------
// Apollo headcount bucket mapping
// ---------------------------------------------------------------------------
const APOLLO_HEADCOUNT_RANGES = [
  { label: '1,10',       min: 1,     max: 10     },
  { label: '11,20',      min: 11,    max: 20     },
  { label: '21,50',      min: 21,    max: 50     },
  { label: '51,200',     min: 51,    max: 200    },
  { label: '201,500',    min: 201,   max: 500    },
  { label: '501,1000',   min: 501,   max: 1000   },
  { label: '1001,2000',  min: 1001,  max: 2000   },
  { label: '2001,5000',  min: 2001,  max: 5000   },
  { label: '5001,10000', min: 5001,  max: 10000  },
  { label: '10001,',     min: 10001, max: Infinity },
] as const;

export function mapHeadcountToApolloRanges(min: number, max: number): string[] {
  const lo = min || 0;
  const hi = max || Infinity;
  return APOLLO_HEADCOUNT_RANGES
    .filter(r => r.max >= lo && r.min <= hi)
    .map(r => r.label);
}

// ---------------------------------------------------------------------------
// ICP fit scoring for Apollo company shape
// Adapted from AccountIntelligence.jsx computeIcpScore
// ---------------------------------------------------------------------------
// Apollo uses its own industry taxonomy — build a fuzzy keyword map
// Apollo's actual industry taxonomy labels (from company.industry field in search results)
const APOLLO_INDUSTRY_KEYWORDS: Record<string, string[]> = {
  software:     ['computer software', 'software', 'saas', 'internet', 'information technology and services', 'it services', 'tech'],
  saas:         ['computer software', 'software', 'saas', 'internet', 'cloud', 'information technology and services'],
  technology:   ['information technology and services', 'computer software', 'internet', 'technology', 'it services', 'computer', 'tech'],
  'b2b software': ['computer software', 'software', 'saas', 'internet', 'information technology and services'],
  'b2b saas':   ['computer software', 'software', 'saas', 'internet', 'information technology and services'],
  healthcare:   ['health', 'medical', 'hospital', 'pharmaceuticals', 'biotechnology', 'life sciences', 'medical devices'],
  finance:      ['financial services', 'banking', 'insurance', 'fintech', 'investment management', 'accounting'],
  retail:       ['retail', 'e-commerce', 'consumer goods', 'wholesale', 'apparel & fashion'],
  manufacturing: ['manufacturing', 'industrial automation', 'machinery', 'automotive', 'aerospace'],
  real_estate:  ['real estate', 'commercial real estate', 'construction'],
  education:    ['education management', 'e-learning', 'higher education', 'professional training & coaching'],
  marketing:    ['marketing and advertising', 'online media', 'public relations and communications', 'digital marketing'],
  consulting:   ['management consulting', 'professional services', 'business consulting'],
  staffing:     ['staffing and recruiting', 'human resources', 'outsourcing/offshoring'],
  'financial services': ['financial services', 'banking', 'investment management', 'insurance', 'accounting'],
  'professional services': ['management consulting', 'professional services', 'legal services', 'accounting'],
  'business services': ['management consulting', 'professional services', 'outsourcing/offshoring', 'facilities services'],
  telecommunications: ['telecommunications', 'wireless', 'broadband'],
  insurance:        ['insurance', 'financial services', 'risk management'],
  'real estate':    ['real estate', 'commercial real estate', 'construction', 'property management'],
  'b2b sales':      ['computer software', 'software', 'saas', 'internet', 'information technology and services', 'sales', 'b2b'],
  'marketing and advertising': ['marketing and advertising', 'online media', 'public relations and communications', 'digital marketing', 'advertising'],
  'e-learning':     ['e-learning', 'education management', 'higher education', 'professional training & coaching', 'online learning'],
  'human resources': ['human resources', 'staffing and recruiting', 'outsourcing/offshoring', 'hr technology'],
  'venture capital and private equity': ['venture capital & private equity', 'investment management', 'financial services', 'capital markets'],
  'business supplies and equipment': ['business supplies and equipment', 'wholesale', 'office supplies', 'commercial equipment'],
};

function industryFuzzyMatch(apolloIndustry: string, icpIndustries: string[]): boolean {
  const ind = apolloIndustry.toLowerCase();
  return icpIndustries.some(target => {
    const t = target.toLowerCase();
    // Direct substring match
    if (ind.includes(t) || t.includes(ind)) return true;
    // Keyword expansion match
    const keywords = APOLLO_INDUSTRY_KEYWORDS[t] ?? [];
    return keywords.some(kw => ind.includes(kw));
  });
}

export function computeIcpScoreForApolloCompany(
  company: ApolloCompany,
  icpConfig: any,
): number | null {
  if (!icpConfig?.enabled) return null;

  // Hard exclude — if company matches an excluded industry, return 0 (filtered out)
  if (icpConfig.exclude_industries?.length) {
    const ind = company.industry || '';
    if (ind && industryFuzzyMatch(ind, icpConfig.exclude_industries as string[])) return 0;
  }

  const w = icpConfig.weights ?? {
    industry: 20, headcount: 20, revenue: 15, technology: 15,
    geography: 15, company_age: 10, keywords: 5,
  };
  let score = 0;
  let maxScore = 0;

  // 1. Industry — fuzzy match against Apollo's taxonomy
  if (icpConfig.target_industries?.length) {
    const wt = w.industry ?? 20;
    const ind = company.industry || '';
    if (ind) {
      maxScore += wt;
      if (industryFuzzyMatch(ind, icpConfig.target_industries as string[])) score += wt;
    }
  }

  // 2. Headcount — Apollo search may use either field name
  if (icpConfig.headcount_min || icpConfig.headcount_max) {
    const wt = w.headcount ?? 20;
    const emp = company.estimated_num_employees || company.num_employees || 0;
    if (emp) {
      maxScore += wt;
      const hcMin = icpConfig.headcount_min || 0;
      const hcMax = icpConfig.headcount_max || Infinity;
      if (emp >= hcMin && emp <= hcMax) score += wt;
      else if (emp >= hcMin * 0.5 && emp <= hcMax * 2) score += wt * 0.5;
    }
  }

  // 3. Revenue — enriched via Apollo /organizations/enrich
  if (icpConfig.revenue_min_m || icpConfig.revenue_max_m) {
    const wt = w.revenue ?? 15;
    const revStr = company.annual_revenue_printed || '';
    const revNum = company.annual_revenue || 0;
    let revM = 0;
    if (revStr) {
      const raw = parseFloat(revStr.replace(/[^0-9.]/g, '')) || 0;
      revM = /b/i.test(revStr) ? raw * 1000 : /k/i.test(revStr) ? raw / 1000 : raw;
    } else if (revNum) {
      revM = revNum / 1_000_000;
    }
    if (revM) {
      maxScore += wt;
      const revMin = icpConfig.revenue_min_m || 0;
      const revMax = icpConfig.revenue_max_m || Infinity;
      if (revM >= revMin && revM <= revMax) score += wt;
      else if (revM >= revMin * 0.5 && revM <= revMax * 2) score += wt * 0.5;
    }
  }

  // 4. Technology — enriched via Apollo /organizations/enrich
  if (icpConfig.target_technologies?.length) {
    const wt = w.technology ?? 15;
    const techNames = (company.technologies || []).map((t: any) =>
      (typeof t === 'string' ? t : t?.name || '').toLowerCase(),
    );
    if (techNames.length) {
      maxScore += wt;
      const match = (icpConfig.target_technologies as string[]).some(tech =>
        techNames.some((t: string) => t.includes(tech.toLowerCase())),
      );
      if (match) score += wt;
    }
  }

  // 5. Geography — country from search results
  if (icpConfig.target_countries?.length) {
    const wt = w.geography ?? 15;
    const companyCountry = (company.country || '').toLowerCase();
    if (companyCountry) {
      maxScore += wt;
      const match = (icpConfig.target_countries as string[]).some(c =>
        companyCountry.includes(c.toLowerCase()) || c.toLowerCase().includes(companyCountry),
      );
      if (match) score += wt;
    }
  }

  // 6. Company Age — founded_year from search results
  if (icpConfig.company_age_min !== undefined || icpConfig.company_age_max !== undefined) {
    const wt = w.company_age ?? 10;
    const foundedYear = company.founded_year;
    if (foundedYear) {
      maxScore += wt;
      const age = new Date().getFullYear() - foundedYear;
      const ageMin = icpConfig.company_age_min ?? 0;
      const ageMax = icpConfig.company_age_max ?? 100;
      if (age >= ageMin && age <= ageMax) score += wt;
      else if (age >= Math.max(0, ageMin - 2) && age <= ageMax + 5) score += wt * 0.5;
    }
  }

  // 7. Keywords — matched against Apollo company keyword tags
  if (icpConfig.target_keywords?.length) {
    const wt = w.keywords ?? 5;
    const companyKeywords = (company.keywords || []).map((k: string) => k.toLowerCase());
    if (companyKeywords.length) {
      maxScore += wt;
      const matches = (icpConfig.target_keywords as string[]).filter(kw =>
        companyKeywords.some(ck => ck.includes(kw.toLowerCase())),
      ).length;
      if (matches > 0) score += wt * Math.min(matches / 2, 1); // 2+ matches = full weight
    }
  }

  // If no dimensions were configured/applicable, return null (no score possible)
  if (maxScore === 0) return null;
  // Percentage is based only on applicable weights (dimensions the org configured)
  return Math.min(100, Math.round((score / maxScore) * 100));
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export interface ApolloCompany {
  id?: string;
  name: string;
  website_url?: string;
  primary_domain?: string;
  industry?: string;
  estimated_num_employees?: number;
  num_employees?: number;
  annual_revenue_printed?: string;
  annual_revenue?: number;
  technologies?: ({ name: string } | string)[];
  founded_year?: number;
  keywords?: string[];
  short_description?: string;
  logo_url?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  country?: string;
}

// Normalize Apollo's response fields to our ApolloCompany interface.
// Apollo mixed_companies/search returns field names like organization_revenue,
// organization_country, etc. that differ from our expected shape.
function normalizeApolloCompany(raw: any): ApolloCompany {
  return {
    id: raw.id,
    name: raw.name,
    website_url: raw.website_url,
    primary_domain: raw.primary_domain || raw.domain,
    industry: raw.industry,
    estimated_num_employees: raw.estimated_num_employees || raw.num_employees || undefined,
    annual_revenue_printed: raw.annual_revenue_printed || raw.organization_revenue_printed || undefined,
    annual_revenue: raw.annual_revenue || raw.organization_revenue || undefined,
    technologies: raw.technologies,
    founded_year: raw.founded_year,
    keywords: raw.keywords,
    short_description: raw.short_description,
    logo_url: raw.logo_url,
    linkedin_url: raw.linkedin_url,
    city: raw.city || raw.organization_city,
    state: raw.state || raw.organization_state,
    country: raw.country || raw.organization_country,
  };
}

export interface IcpProspectorFilters {
  keywords: string;
  locations: string[];
  useIndustryKeywords: boolean;
}

type IcpStatus = 'ready' | 'no_config' | 'not_enabled' | 'no_dimensions';

interface IcpProspectorState {
  results: ApolloCompany[];
  icpScores: Record<string, number | null>;
  loading: boolean;
  loadingMore: boolean;
  error: string | null;
  currentPage: number;
  hasMore: boolean;
  totalResults: number;
  filters: IcpProspectorFilters;
  existingAccountKeys: Set<string>;
  existingAccountMap: Record<string, string>;
  companyContacts: Record<string, any[]>;
  enrichingCompanies: string[];
  icpStatus: IcpStatus;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------
const PAGE_SIZE = 10;

export function useIcpProspector(organizationId: string, icpConfig: any, signalConfig?: any, profileId?: string) {
  // Diagnose ICP config status
  const getIcpStatus = useCallback((cfg: any): IcpStatus => {
    if (!cfg) return 'no_config';
    if (!cfg.enabled) return 'not_enabled';
    const hasDimensions = !!(
      cfg.target_industries?.length ||
      cfg.headcount_min || cfg.headcount_max ||
      cfg.revenue_min_m || cfg.revenue_max_m ||
      cfg.target_technologies?.length ||
      cfg.target_countries?.length ||
      cfg.company_age_min || cfg.company_age_max ||
      cfg.target_keywords?.length
    );
    if (!hasDimensions) return 'no_dimensions';
    return 'ready';
  }, []);

  // Resolved ICP config — may come from a specific profile or the org-level config
  const [resolvedIcpConfig, setResolvedIcpConfig] = useState<any>(icpConfig);

  const [state, setState] = useState<IcpProspectorState>({
    results: [],
    icpScores: {},
    loading: false,
    loadingMore: false,
    error: null,
    currentPage: 1,
    hasMore: false,
    totalResults: 0,
    filters: { keywords: '', locations: [], useIndustryKeywords: true },
    existingAccountKeys: new Set(),
    existingAccountMap: {},
    companyContacts: {},
    enrichingCompanies: [],
    icpStatus: 'no_config',
  });

  const enrichingRef = useRef<Set<string>>(new Set());

  const patch = useCallback(
    (p: Partial<IcpProspectorState>) => setState(prev => ({ ...prev, ...p })),
    [],
  );

  // When profileId is provided, fetch that profile's icp_config and use it for scoring.
  // Falls back to the org-level icpConfig if no profile found or fetch fails.
  useEffect(() => {
    if (!profileId || !organizationId) {
      setResolvedIcpConfig(icpConfig);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await backendFetch<{ ok: boolean; profiles: any[] }>(
          '/api/engage/icp-profiles',
          undefined,
          'GET',
        );
        if (cancelled) return;
        const profiles = res?.profiles || [];
        const match = profiles.find((p: any) => p.id === profileId);
        if (match?.icp_config && Object.keys(match.icp_config).length > 0) {
          setResolvedIcpConfig(match.icp_config);
        } else {
          // Profile not found or has empty config — fall back to org-level
          setResolvedIcpConfig(icpConfig);
        }
      } catch {
        if (!cancelled) setResolvedIcpConfig(icpConfig);
      }
    })();
    return () => { cancelled = true; };
  }, [profileId, organizationId, icpConfig]);

  // Seed locations + compute ICP status when resolved config loads
  useEffect(() => {
    const status = getIcpStatus(resolvedIcpConfig);
    setState(prev => ({
      ...prev,
      icpStatus: status,
      ...(resolvedIcpConfig?.icp_regions?.length ? { filters: { ...prev.filters, locations: resolvedIcpConfig.icp_regions } } : {}),
    }));
  }, [resolvedIcpConfig, getIcpStatus]);

  // Load existing accounts to flag "already added" companies
  const loadExistingAccounts = useCallback(async () => {
    if (!organizationId) return;
    const { data } = await supabase
      .from('engage_accounts')
      .select('id, account_name, domain')
      .eq('organization_id', organizationId);
    if (!data) return;
    const keys = new Set<string>();
    const map: Record<string, string> = {};
    data.forEach((a: any) => {
      if (a.domain) {
        const k = a.domain.toLowerCase();
        keys.add(k);
        map[k] = a.id;
      }
      if (a.account_name) {
        const k = a.account_name.toLowerCase();
        keys.add(k);
        map[k] = a.id;
      }
    });
    patch({ existingAccountKeys: keys, existingAccountMap: map });
  }, [organizationId, patch]);

  useEffect(() => {
    loadExistingAccounts();
  }, [loadExistingAccounts]);

  // Build Apollo search body from icp_config + user filters
  // Translate ICP industry names → Apollo taxonomy labels for better keyword matching.
  // Apollo stores company.industry as labels like "computer software", "information technology
  // and services" — using these as keyword_tags filters much more precisely than "SaaS".
  const expandToApolloTerms = useCallback((icpIndustries: string[]): string[] => {
    const seen = new Set<string>();
    const terms: string[] = [];
    for (const industry of icpIndustries) {
      const t = industry.toLowerCase();
      const expansions = APOLLO_INDUSTRY_KEYWORDS[t];
      const sources = expansions?.length ? expansions.slice(0, 2) : [t];
      for (const kw of sources) {
        if (!seen.has(kw)) { seen.add(kw); terms.push(kw); }
      }
      if (terms.length >= 5) break;
    }
    return terms;
  }, []);

  const buildApolloFilters = useCallback(
    (page: number, currentFilters: IcpProspectorFilters) => {
      const f: Record<string, any> = { page, per_page: PAGE_SIZE };
      if (resolvedIcpConfig) {
        const ranges = mapHeadcountToApolloRanges(
          resolvedIcpConfig.headcount_min || 0,
          resolvedIcpConfig.headcount_max || 99999,
        );
        if (ranges.length) f.employee_ranges = ranges;
        // Translate ICP industries to Apollo taxonomy terms for precise filtering
        if (currentFilters.useIndustryKeywords && resolvedIcpConfig.target_industries?.length) {
          const apolloTerms = expandToApolloTerms(resolvedIcpConfig.target_industries as string[]);
          f.keyword_tags = currentFilters.keywords
            ? [currentFilters.keywords, ...apolloTerms].slice(0, 5)
            : apolloTerms.slice(0, 5);
        } else if (currentFilters.keywords) {
          f.keyword_tags = [currentFilters.keywords];
        }
      } else if (currentFilters.keywords) {
        f.keyword_tags = [currentFilters.keywords];
      }
      if (currentFilters.locations?.length) f.locations = currentFilters.locations;
      // Pass exclusion list so the edge function can post-filter
      const excludeList = signalConfig?.exclude_industries || resolvedIcpConfig?.exclude_industries || [];
      if (excludeList.length) f.exclude_industries = excludeList;
      return f;
    },
    [resolvedIcpConfig, signalConfig, expandToApolloTerms],
  );

  const scoreResults = useCallback(
    (companies: ApolloCompany[]) => {
      const scores: Record<string, number | null> = {};
      companies.forEach(c => {
        const key = c.primary_domain || c.name;
        scores[key] = computeIcpScoreForApolloCompany(c, resolvedIcpConfig);
      });
      return scores;
    },
    [resolvedIcpConfig],
  );

  const sortByScore = useCallback(
    (companies: ApolloCompany[], scores: Record<string, number | null>) =>
      [...companies].sort((a, b) => {
        const ka = a.primary_domain || a.name;
        const kb = b.primary_domain || b.name;
        return (scores[kb] ?? -1) - (scores[ka] ?? -1);
      }),
    [],
  );

  // Enrich a batch of companies in the background to get tech stack, revenue,
  // founded_year, and keywords — then re-score and re-sort results.
  const enrichInBackground = useCallback(async (companies: ApolloCompany[]) => {
    const domains = companies.filter(c => c.primary_domain).map(c => c.primary_domain as string);
    if (!domains.length || !resolvedIcpConfig) return;
    try {
      const resp = await engageApi.batchEnrichCompanies(domains);
      const enrichedMap: Record<string, any> = {};
      (resp?.data || []).forEach((item: any) => {
        if (item.domain && item.data) enrichedMap[item.domain] = item.data;
      });
      if (!Object.keys(enrichedMap).length) return;
      setState(prev => {
        const updated = prev.results.map(c => {
          const e = enrichedMap[c.primary_domain || ''];
          if (!e) return c;
          return {
            ...c,
            technologies:           e.technologies?.length      ? e.technologies           : c.technologies,
            annual_revenue_printed: e.annual_revenue_printed    || c.annual_revenue_printed,
            annual_revenue:         e.annual_revenue            || c.annual_revenue,
            founded_year:           e.founded_year              || c.founded_year,
            keywords:               e.keywords?.length          ? e.keywords               : c.keywords,
          };
        });
        const newScores: Record<string, number | null> = {};
        updated.forEach(c => {
          const key = c.primary_domain || c.name;
          newScores[key] = computeIcpScoreForApolloCompany(c, resolvedIcpConfig);
        });
        // Filter out companies with 0 or null ICP Fit after re-scoring
        const passing = updated.filter(c => {
          const key = c.primary_domain || c.name;
          return (newScores[key] ?? 0) > 0;
        });
        return { ...prev, results: sortByScore(passing, newScores), icpScores: newScores };
      });
    } catch (err) {
      console.warn('[ICP Prospector] Background enrichment failed:', err);
    }
  }, [resolvedIcpConfig, sortByScore]);

  // Fresh search (page 1, replaces results)
  const search = useCallback(
    async (overrideFilters?: Partial<IcpProspectorFilters>) => {
      const currentFilters = overrideFilters
        ? { ...state.filters, ...overrideFilters }
        : state.filters;
      // Validate ICP config before searching
      const status = getIcpStatus(resolvedIcpConfig);
      if (status === 'no_config') {
        patch({ loading: false, error: 'ICP profile not configured. Go to Org Settings → ICP to set up your Ideal Customer Profile.', icpStatus: status });
        return;
      }
      if (status === 'not_enabled') {
        patch({ loading: false, error: 'ICP profile is disabled. Enable it in Org Settings → ICP.', icpStatus: status });
        return;
      }
      if (status === 'no_dimensions') {
        patch({ loading: false, error: 'ICP profile has no targeting criteria. Add at least one dimension (industries, headcount, revenue, etc.) in Org Settings → ICP.', icpStatus: status });
        return;
      }
      patch({ loading: true, error: null, results: [], currentPage: 1, hasMore: false, icpScores: {}, icpStatus: status });
      try {
        const apolloFilters = buildApolloFilters(1, currentFilters);
        const resp = await engageApi.searchCompanies(apolloFilters as any);
        // Apollo returns results in both 'accounts' and 'organizations' arrays — merge and normalize
        const rawOrgs = resp?.data?.organizations ?? resp?.data?.companies ?? [];
        const rawAccts = resp?.data?.accounts ?? [];
        const companies: ApolloCompany[] = [...rawOrgs, ...rawAccts].map(normalizeApolloCompany);
        const total = resp?.data?.pagination?.total_entries ?? companies.length;
        const scores = scoreResults(companies);
        // Filter out companies with 0 or null ICP Fit — they don't match the ICP
        const passing = companies.filter(c => {
          const key = c.primary_domain || c.name;
          return (scores[key] ?? 0) > 0;
        });
        const sorted = sortByScore(passing, scores);
        patch({
          results: sorted,
          icpScores: scores,
          loading: false,
          currentPage: 1,
          hasMore: companies.length === PAGE_SIZE,
          totalResults: total,
          filters: currentFilters,
          // If Apollo returned results but all were filtered out, surface that
          error: companies.length > 0 && passing.length === 0
            ? `Found ${companies.length} companies but none matched your ICP criteria. Try adjusting your ICP filters.`
            : null,
        });
        enrichInBackground(companies);
      } catch (err: any) {
        patch({ loading: false, error: err.message });
      }
    },
    [state.filters, buildApolloFilters, scoreResults, enrichInBackground, patch],
  );

  // Load next page (appends to results)
  const loadMore = useCallback(async () => {
    if (state.loadingMore || !state.hasMore) return;
    const nextPage = state.currentPage + 1;
    patch({ loadingMore: true });
    try {
      const apolloFilters = buildApolloFilters(nextPage, state.filters);
      const resp = await engageApi.searchCompanies(apolloFilters as any);
      const rawOrgs = resp?.data?.organizations ?? resp?.data?.companies ?? [];
      const rawAccts = resp?.data?.accounts ?? [];
      const companies: ApolloCompany[] = [...rawOrgs, ...rawAccts].map(normalizeApolloCompany);
      const newScores = scoreResults(companies);
      setState(prev => {
        const allScores = { ...prev.icpScores, ...newScores };
        // Filter out companies with 0 or null ICP Fit
        const merged = [...prev.results, ...companies].filter(c => {
          const key = c.primary_domain || c.name;
          return (allScores[key] ?? 0) > 0;
        });
        const allResults = sortByScore(merged, allScores);
        return {
          ...prev,
          results: allResults,
          icpScores: allScores,
          loadingMore: false,
          currentPage: nextPage,
          hasMore: companies.length === PAGE_SIZE,
        };
      });
      enrichInBackground(companies);
    } catch (err: any) {
      patch({ loadingMore: false, error: err.message });
    }
  }, [state, buildApolloFilters, scoreResults, enrichInBackground, patch]);

  const setFilters = useCallback(
    (f: Partial<IcpProspectorFilters>) =>
      setState(prev => ({ ...prev, filters: { ...prev.filters, ...f } })),
    [],
  );

  // Enrich contacts for a given company (same Apollo /search/prospects pattern)
  const enrichCompanyContacts = useCallback(
    async (company: ApolloCompany) => {
      const key = company.primary_domain || company.name;
      if (state.companyContacts[key] !== undefined) return state.companyContacts[key];
      if (enrichingRef.current.has(key)) return [];
      enrichingRef.current.add(key);
      patch({ enrichingCompanies: Array.from(enrichingRef.current) });
      try {
        const domain = company.primary_domain || '';
        const resp = await engageApi.searchProspects({
          domains: domain ? [domain] : [],
          per_page: 3,
        });
        const people: any[] = resp?.data?.people ?? [];
        const contacts = people.slice(0, 3).map((p: any) => ({
          id: p.id,
          name: p.name || `${p.first_name || ''} ${p.last_name || ''}`.trim(),
          first_name: p.first_name,
          last_name: p.last_name,
          title: p.title || '',
          email: p.email || '',
          phone: p.phone_numbers?.[0]?.sanitized_number || p.sanitized_phone || '',
          linkedin_url: p.linkedin_url || '',
        }));
        enrichingRef.current.delete(key);
        setState(prev => ({
          ...prev,
          companyContacts: { ...prev.companyContacts, [key]: contacts },
          enrichingCompanies: Array.from(enrichingRef.current),
        }));
        return contacts;
      } catch {
        enrichingRef.current.delete(key);
        patch({ enrichingCompanies: Array.from(enrichingRef.current) });
        return [];
      }
    },
    [state.companyContacts, patch],
  );

  // Add company to engage_accounts with source = 'icp_prospector'
  const addToAccounts = useCallback(
    async (company: ApolloCompany): Promise<string | null> => {
      try {
        const key = (company.primary_domain || company.name).toLowerCase();
        if (state.existingAccountKeys.has(key)) {
          return state.existingAccountMap[key] ?? null;
        }
        const icpScore = state.icpScores[company.primary_domain || company.name];
        const { data: account, error } = await supabase
          .from('engage_accounts')
          .insert({
            organization_id: organizationId,
            account_name: company.name,
            domain: company.primary_domain ?? company.website_url?.replace(/^https?:\/\//, '').replace(/\/.*$/, '') ?? null,
            industry: company.industry ?? null,
            employee_count: company.estimated_num_employees ?? null,
            account_score: icpScore ?? 0,
            source: 'icp_prospector',
            status: 'active',
            metadata: {
              apollo_data: {
                logo_url: company.logo_url,
                linkedin_url: company.linkedin_url,
                short_description: company.short_description,
                city: company.city,
                state: company.state,
                country: company.country,
              },
            },
          })
          .select()
          .single();
        if (error) throw error;
        setState(prev => ({
          ...prev,
          existingAccountKeys: new Set([...prev.existingAccountKeys, key]),
          existingAccountMap: { ...prev.existingAccountMap, [key]: account.id },
        }));
        return account.id;
      } catch (err: any) {
        patch({ error: err.message });
        return null;
      }
    },
    [organizationId, state, patch],
  );

  // Auto-enrich first ~10 ICP companies when results load
  const autoEnrichedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (!state.results.length || state.loading) return;
    const toEnrich = state.results.slice(0, 10).filter(c => {
      const key = c.primary_domain || c.name;
      return key && !autoEnrichedRef.current.has(key) && state.companyContacts[key] === undefined;
    });
    if (!toEnrich.length) return;
    toEnrich.forEach(c => autoEnrichedRef.current.add(c.primary_domain || c.name));
    // Fire enrichment calls in parallel (non-blocking)
    toEnrich.forEach(c => enrichCompanyContacts(c));
  }, [state.results, state.loading, state.companyContacts, enrichCompanyContacts]);

  return {
    ...state,
    search,
    loadMore,
    setFilters,
    enrichCompanyContacts,
    addToAccounts,
    loadExistingAccounts,
  };
}
