// supabase/functions/engage-signals/index.ts
// Signal-based prospecting — Apollo ICP discovery → company-specific Tavily scan → Claude classify → contacts
export {};

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResp(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 6000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`${res.status}: ${text.substring(0, 200)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function apolloSearchCompanies(filters: any = {}) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  const body: any = { page: 1, per_page: 50 };
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;
  if (filters.keywords) body.q_organization_keyword_tags = Array.isArray(filters.keywords) ? filters.keywords : [filters.keywords];
  if (filters.locations?.length)      body.organization_locations = filters.locations;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 12000);
  try {
    const res = await fetch('https://api.apollo.io/api/v1/mixed_companies/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const rawText = await res.text();
    let parsed: any;
    try { parsed = JSON.parse(rawText); } catch { parsed = { _raw: rawText.substring(0, 500) }; }
    // Attach diagnostics
    parsed._requestBody = body;
    parsed._status = res.status;
    parsed._topKeys = Object.keys(parsed).filter(k => !k.startsWith('_'));
    return parsed;
  } finally {
    clearTimeout(timer);
  }
}

async function apolloSearchPeople(filters: any = {}) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  const body: any = { page: 1, per_page: 3, reveal_personal_emails: true };
  if (filters.domains?.length)   body.q_organization_domains_list = filters.domains;
  if (filters.titles?.length)    body.person_titles = filters.titles;
  return fetchWithTimeout('https://api.apollo.io/api/v1/mixed_people/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
    body: JSON.stringify(body),
  }, 8000);
}

async function tavilySearch(query: string) {
  const key = Deno.env.get('TAVILY_API_KEY');
  if (!key) throw new Error('TAVILY_API_KEY not configured');
  return fetchWithTimeout('https://api.tavily.com/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ api_key: key, query, search_depth: 'basic', max_results: 3 }),
  }, 6000);
}

// ── Helper: build Apollo employee range filters from headcount_min/max ───────
function buildEmployeeRanges(minH: number, maxH: number): string[] {
  const RANGES: [number, number, string][] = [
    [1,10,'1,10'],[11,20,'11,20'],[21,50,'21,50'],[51,200,'51,200'],
    [201,500,'201,500'],[501,1000,'501,1000'],[1001,2000,'1001,2000'],
    [2001,5000,'2001,5000'],[5001,10000,'5001,10000'],[10001,999999,'10001,'],
  ];
  return RANGES.filter(([lo, hi]) => hi >= minH && lo <= maxH).map(r => r[2]);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp({ error: 'POST required' }, 405);

  try {
    const { organization_id, config } = await req.json();
    if (!organization_id) return jsonResp({ error: 'organization_id is required' }, 400);
    if (!config)          return jsonResp({ error: 'config is required' }, 400);

    console.log(`[engage-signals] Config keys received:`, Object.keys(config));
    console.log(`[engage-signals] icp_industries:`, config.icp_industries);
    console.log(`[engage-signals] exclude_industries:`, config.exclude_industries);

    const errors: any[] = [];

    // ── Supabase client (used for DB reads + writes throughout) ───────────────
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // ── Read org's custom signals from DB ─────────────────────────────────────
    let customSignals: any[] = [];
    try {
      const { data } = await sb.from('engage_org_signal_configs')
        .select('signal_key, signal_name, category, description')
        .eq('organization_id', organization_id)
        .is('signal_definition_id', null)
        .eq('is_enabled', true);
      customSignals = data || [];
    } catch { /* proceed without custom signals */ }

    const customSignalKeys = customSignals.map((s: any) => s.signal_key).filter(Boolean);

    // Keys Claude can output — aligned 1:1 with engage_signal_definitions signal_key values.
    const VALID_SIGNAL_TYPES = [
      // ── Buyer Intent ──────────────────────────────────────────────────────────
      'rfp_issuance', 'pricing_page_research', 'demo_request_competitor',
      'category_keyword_search', 'case_study_consumption',
      'reddit_buying_intent', 'reddit_churn_risk',
      'solution_search', 'pain_point', 'competitor_comparison',
      'competitor_complaint', 'competitor_engagement',
      // ── Company Events ────────────────────────────────────────────────────────
      'funding_round', 'leadership_change', 'sales_leadership_hire', 'executive_departure',
      'ma_activity', 'ipo_or_spac', 'private_equity_investment',
      'layoffs_restructuring', 'company_expansion', 'key_contact_job_change',
      'headcount_growth', 'sales_team_expansion', 'sales_enablement_hire', 'high_employee_growth',
      'product_launch', 'product_hunt_launch', 'hiring_velocity', 'dept_expansion',
      'strategic_partnership', 'new_market_entry', 'rebranding',
      'government_contract_win', 'revenue_milestone', 'cost_reduction_initiative', 'board_change',
      'contract_win',
      // ── Interest ──────────────────────────────────────────────────────────────
      'g2_review', 'capterra_review', 'review_site_activity',
      'reddit_competitor_mention', 'job_posting_ops',
      'crm_adoption', 'tech_stack_change', 'tech_stack_expansion',
      'cloud_migration', 'digital_transformation',
      'content_engagement', 'event_sponsorship', 'news_mention',
      'analyst_report_mention', 'operations_hire',
      'tech_adoption', 'tech_stack_churn', 'event_participation', 'press_release',
      // ── Glassdoor (library defs added in migration 049) ───────────────────────
      'glassdoor_leadership_concern', 'glassdoor_culture_issue', 'glassdoor_rating_decline',
      // ── Runtime (no library definition) ──────────────────────────────────────
      'sec_filing', 'website_visit',
      // ── Legacy fallbacks — keep for backward compat with existing DB rows ─────
      'funding', 'expansion', 'layoffs', 'job_change', 'hiring',
      'review_sentiment', 'icp_job_posting', 'reddit_signal', 'glassdoor_sentiment',
      // ── Org custom signals (loaded from engage_org_signal_configs) ─────────────
      ...customSignalKeys,
    ];

    // Subset passed to Claude — library-aligned keys only, no legacy duplicates
    const SIGNAL_TYPE_CHOICES = VALID_SIGNAL_TYPES.filter((k: string) => ![
      'funding', 'expansion', 'layoffs', 'job_change', 'hiring',
      'review_sentiment', 'icp_job_posting', 'reddit_signal', 'glassdoor_sentiment',
      'website_visit',
    ].includes(k));

    // ── Step 1: Apollo ICP Company Discovery ──────────────────────────────────
    // Support both old key names (icp_employee_range, tech_stack_positive, icp_regions)
    // AND current schema key names (headcount_min/max, target_technologies, target_countries)
    const apolloFilters: any = {};

    // Employee range: prefer headcount_min/max (current schema), fall back to icp_employee_range (legacy)
    if (config.headcount_min || config.headcount_max) {
      const minH = config.headcount_min || 1;
      const maxH = config.headcount_max || 999999;
      const ranges = buildEmployeeRanges(minH, maxH);
      if (ranges.length) apolloFilters.employee_ranges = ranges;
    } else if (config.icp_employee_range) {
      const parts = config.icp_employee_range.split('-').map((s: string) => parseInt(s) || 0);
      const ranges = buildEmployeeRanges(parts[0] || 1, parts[1] || 999999);
      if (ranges.length) apolloFilters.employee_ranges = ranges;
    }

    // Keywords for Apollo company discovery:
    // 1. icp_industries — describes target market (e.g. "B2B SaaS", "Financial Services")
    //    Use as-is, no generic filter — these ARE the targeting criteria.
    // 2. keywords — general additional keywords from config
    //    Apply generic filter to avoid overly broad matches.
    // NEVER use solution_keywords — those describe what the org SELLS, finding competitors.
    const industryKws = (config.icp_industries || config.target_industries || [])
      .map((k: string) => k.trim()).filter(Boolean);
    const GENERIC_KEYWORDS = /^(b2b|saas|software|technology|b2b saas|saas software)$/i;
    const generalKws = (config.keywords || config.target_keywords || [])
      .map((k: string) => k.trim()).filter((k: string) => k && !GENERIC_KEYWORDS.test(k));
    const uniqueKeywords = [...new Set([...industryKws, ...generalKws])];
    if (uniqueKeywords.length) apolloFilters.keywords = uniqueKeywords;

    // Locations: prefer target_countries (current), fall back to icp_regions (legacy)
    // Apollo expects country names, not region names — expand regions to countries
    const REGION_TO_COUNTRIES: Record<string, string[]> = {
      'North America': ['United States', 'Canada'],
      'EMEA': ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Ireland'],
      'APAC': ['Australia', 'Japan', 'Singapore', 'India'],
      'Latin America': ['Brazil', 'Mexico', 'Colombia', 'Argentina'],
      'Europe': ['United Kingdom', 'Germany', 'France', 'Netherlands', 'Ireland', 'Sweden', 'Spain'],
    };
    const rawLocations = config.target_countries || config.icp_regions;
    if (rawLocations?.length) {
      const expanded: string[] = [];
      for (const loc of rawLocations) {
        const mapped = REGION_TO_COUNTRIES[loc];
        if (mapped) expanded.push(...mapped);
        else expanded.push(loc); // already a country name
      }
      if (expanded.length) apolloFilters.locations = [...new Set(expanded)];
    }

    // ── Progressive filter relaxation ──────────────────────────────────────
    // Apollo returns 0 when filters combine too aggressively. Try with all
    // filters first, then progressively drop the most restrictive ones.
    let companies: any[] = [];
    let apolloAttempts: any[] = [];

    const filterCombinations = [
      // Attempt 1: all filters
      { ...apolloFilters },
      // Attempt 2: drop locations (often the most restrictive)
      { ...apolloFilters, locations: undefined },
      // Attempt 3: drop employee ranges too (keywords only)
      { keywords: apolloFilters.keywords },
      // Attempt 4: just keyword tags, no other filters
      ...(apolloFilters.keywords ? [{ keywords: apolloFilters.keywords }] : [{}]),
    ];
    // Deduplicate attempts (e.g. if no locations were set, attempt 1 == attempt 2)
    const seen = new Set<string>();
    const uniqueCombinations = filterCombinations.filter(f => {
      const key = JSON.stringify(f);
      if (seen.has(key)) return false;
      seen.add(key); return true;
    });

    const MIN_COMPANIES = 5; // Keep relaxing until we have at least 5
    for (const filters of uniqueCombinations) {
      // Remove undefined keys
      const clean: any = {};
      for (const [k, v] of Object.entries(filters)) {
        if (v !== undefined) clean[k] = v;
      }
      try {
        const result = await apolloSearchCompanies(clean);
        // Check ALL possible response keys — Apollo might use different key names
        const found = (
          result?.organizations || result?.accounts || result?.companies ||
          result?.mixed_companies || result?.data || []
        ).slice(0, 25);
        apolloAttempts.push({
          filters: result._requestBody || clean,
          count: found.length,
          status: result._status,
          topKeys: result._topKeys,
          pagination: result?.pagination,
          raw_preview: found.length === 0 ? (result?._raw || JSON.stringify(result).substring(0, 300)) : undefined,
        });
        if (found.length > 0) {
          // Keep the best (most results) — but prefer more specific filters if they meet the minimum
          if (found.length >= MIN_COMPANIES) { companies = found; break; }
          if (found.length > companies.length) companies = found; // Best so far, but keep trying
        }
      } catch (err: any) {
        apolloAttempts.push({ filters: clean, count: 0, error: err.message });
        errors.push({ step: 'apollo_company_discovery', error: err.message });
      }
    }

    // ── Industry exclusion — filter out companies in excluded industries ──────
    // This runs BEFORE Tavily/Claude to save API spend on companies we don't want.
    // Checks BOTH Apollo's industry field AND company name as fallback (some companies
    // have blank industry but their name reveals they're staffing/recruiting/etc.).
    let excludedCount = 0;
    if (config.exclude_industries?.length && companies.length > 0) {
      const excludeLower = config.exclude_industries.map((e: string) => e.toLowerCase().trim());
      const before = companies.length;
      companies = companies.filter((co: any) => {
        const ind = (co.industry || '').toLowerCase();
        const name = (co.name || '').toLowerCase();
        const matchesIndustry = ind && excludeLower.some((ex: string) => ind.includes(ex) || ex.includes(ind));
        const matchesName = excludeLower.some((ex: string) => name.includes(ex));
        return !matchesIndustry && !matchesName;
      });
      excludedCount = before - companies.length;
      console.log(`[engage-signals] Industry filter: Apollo returned ${before}, ${before - excludedCount} survived, ${excludedCount} excluded. Exclusion list: ${config.exclude_industries.join(', ')}`);
    }

    if (companies.length === 0) {
      return jsonResp({
        ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: excludedCount > 0
          ? `Apollo found ${excludedCount} companies but all were in excluded industries.`
          : 'No ICP companies found — see debug for Apollo response details.',
        debug: {
          apollo_key_present: !!Deno.env.get('APOLLO_API_KEY'),
          apollo_key_length: Deno.env.get('APOLLO_API_KEY')?.length || 0,
          apollo_attempts: apolloAttempts,
          excluded_by_industry: excludedCount,
          exclude_industries: config.exclude_industries || [],
          config_received: {
            headcount_min: config.headcount_min,
            headcount_max: config.headcount_max,
            icp_employee_range: config.icp_employee_range,
            solution_keywords: config.solution_keywords?.slice(0, 3),
            target_keywords: config.target_keywords?.slice(0, 3),
            target_countries: config.target_countries,
            icp_regions: config.icp_regions,
          },
        },
      });
    }

    // ── Step 2: Merge strategy — keep existing signals, dedup new ones ────────
    // Load ALL existing signals for this org (URLs + company names + statuses)
    const { data: existingRows } = await sb.from('engage_intent_signals')
      .select('id, source_url, company_name, status, detected_at')
      .eq('organization_id', organization_id);
    const existingSignals = existingRows || [];

    // Track dismissed URLs so we don't recreate signals the user already dismissed
    const dismissedUrls = new Set(
      existingSignals.filter((r: any) => r.status === 'dismissed').map((r: any) => r.source_url).filter(Boolean)
    );
    // Track ALL existing source URLs to avoid duplicates
    const existingUrls = new Set(
      existingSignals.map((r: any) => r.source_url).filter(Boolean)
    );
    // Track existing company names for logging
    const existingCompanyNames = new Set(
      existingSignals.map((r: any) => r.company_name).filter(Boolean)
    );

    // Clean up truly stale signals: older than 30 days AND status is still 'new' (no user interaction)
    const STALE_CUTOFF_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
    const staleCutoff = new Date(Date.now() - STALE_CUTOFF_MS).toISOString();
    const staleIds = existingSignals
      .filter((r: any) => r.status === 'new' && r.detected_at < staleCutoff)
      .map((r: any) => r.id);
    if (staleIds.length > 0) {
      await sb.from('engage_intent_signals').delete().in('id', staleIds);
    }

    // ── Step 3: Per-company Tavily queries (batched with time budget) ──────────
    const rawResults: any[] = [];
    const tavilyErrors: string[] = [];
    const tavilyStartTime = Date.now();
    const TAVILY_TIME_BUDGET_MS = 40000; // 40s for Tavily, leave ~20s for Claude + DB + contacts

    // Cap companies to process — no point fetching 25 if we can only process ~10
    const companiesToProcess = companies.slice(0, 10);

    // Build custom signal Tavily queries from org's custom signal configs
    const customQueries: { terms: string; hint: string }[] = customSignals.map((s: any) => {
      const words = (s.signal_name || '').replace(/[\/\-]/g, ' ').split(/\s+/).filter(Boolean);
      const phrase = words.slice(0, 3).join(' ');
      const extras = words.slice(3).filter((w: string) => w.length > 3);
      const terms = extras.length > 0
        ? `"${phrase}" ${extras.map((w: string) => `OR "${w}"`).join(' ')}`
        : `"${phrase}"`;
      return { terms, hint: s.signal_key };
    }).filter((q: any) => q.terms.length > 5);

    // Build negative search terms if staffing-related industries are excluded
    const hasStaffingExclusion = config.exclude_industries?.some((e: string) =>
      /staffing|recruiting|human resources|talent acquisition|outsourcing/i.test(e)
    );
    const antiStaffingTerms = hasStaffingExclusion
      ? ' -staffing -"staffing agency" -"recruitment firm" -recruiter -"talent acquisition"'
      : '';

    // Process companies in batches of 3 (= 9-15 parallel Tavily calls per batch, under rate limits)
    const BATCH_SIZE = 3;
    let companiesProcessed = 0;
    for (let batchStart = 0; batchStart < companiesToProcess.length; batchStart += BATCH_SIZE) {
      // Time check — stop if we've used too much of the budget
      if (Date.now() - tavilyStartTime > TAVILY_TIME_BUDGET_MS) break;

      const batch = companiesToProcess.slice(batchStart, batchStart + BATCH_SIZE);

      await Promise.all(batch.map(async (co: any) => {
        const name   = co.name || co.organization_name || '';
        const domain = (co.website_url || co.primary_domain || '')
          .replace(/^https?:\/\//, '').replace(/\/.*/, '').trim();
        if (!name) return;
        companiesProcessed++;

        const queries = [
          // ── 3 consolidated queries (was 5 — saves ~40% time per company) ────────
          { q: `"${name}" funding OR raised OR acquisition OR "new VP" OR "new CRO" OR "joins as" 2025 2026`, hint: 'funding' },
          { q: `"${name}" site:reddit.com OR site:g2.com OR site:capterra.com review OR "looking for" OR switching`, hint: 'reddit_buying_intent' },
          { q: `"${name}" expansion OR "product launch" OR partnership OR "rapid growth" OR hiring 2025 2026${antiStaffingTerms}`, hint: 'hiring_velocity' },
          // ── Org custom signal queries (limit to 2) ─────────────────────────────
          ...customQueries.slice(0, 2).map(cq => ({
            q: `"${name}" ${cq.terms} 2025 2026`,
            hint: cq.hint,
          })),
        ];

        await Promise.all(queries.map(async ({ q, hint }) => {
          try {
            const data = await tavilySearch(q);
            (data?.results || []).forEach((r: any) =>
              rawResults.push({ title: r.title, content: r.content, url: r.url, hint, company: name, domain })
            );
          } catch (e: any) { if (tavilyErrors.length < 5) tavilyErrors.push(e.message || 'unknown'); }
        }));
      }));
    }

    if (rawResults.length === 0) {
      return jsonResp({ ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: 'Apollo found companies but Tavily returned 0 search results.',
        debug: {
          companies_found: companies.length,
          company_names: companies.slice(0, 5).map((c: any) => c.name || c.organization_name || '?'),
          tavily_key_present: !!Deno.env.get('TAVILY_API_KEY'),
          anthropic_key_present: !!Deno.env.get('ANTHROPIC_API_KEY'),
          tavily_errors: tavilyErrors.slice(0, 5),
        },
      });
    }

    // Deduplicate by URL
    const seenUrls = new Set<string>();
    const deduped = rawResults.filter((r: any) => {
      if (!r.url || seenUrls.has(r.url)) return false;
      seenUrls.add(r.url); return true;
    });

    // ── Step 4: Claude classify ───────────────────────────────────────────────
    let signals: any[] = [];
    const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY');

    // Build custom signal descriptions for Claude
    const customSignalBlock = customSignals.length > 0
      ? '\nOrg-specific custom signal types (use these when results match):\n' +
        customSignals.map((s: any) => `- ${s.signal_key}: ${s.signal_name} — ${(s.description || '').substring(0, 120)}`).join('\n')
      : '';

    if (ANTHROPIC_KEY && deduped.length > 0) {
      const batch = deduped.slice(0, 25);
      try {
        const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 6000,
            system: `B2B sales analyst. Classify buyer intent signals.
Types: ${SIGNAL_TYPE_CHOICES.join(', ')}
Disambiguation — use the MOST SPECIFIC type:
- product_hunt_launch: Product Hunt listings ONLY. Use product_launch for all other product announcements.
- sales_leadership_hire: VP Sales/CRO/Head of Sales hires ONLY. Use leadership_change for other C-suite changes. Use executive_departure for departures.
- hiring_velocity: company-wide aggressive surge. Use sales_team_expansion for sales-specific growth. Use headcount_growth for general/moderate growth.
- g2_review: G2 only. capterra_review: Capterra only. review_site_activity: all other review platforms.
- funding_round: all VC/angel funding. Use ipo_or_spac for IPO/SPAC. Use private_equity_investment for PE buyouts.
For sec_filing signals, also return signal_subtype (one of: acquisition, ai_investment, leadership_change, restructuring, ipo_prep, pe_investment, annual_report, quarterly_report).
For reddit types, also return signal_subtype describing the specific topic (e.g. "seeking CRM alternative").
For glassdoor signals, also return signal_subtype with a brief description of the feedback theme.${customSignalBlock}
${config.exclude_industries?.length ? `IMPORTANT: If a result is clearly from a company in an excluded industry (staffing agency, recruitment firm, RPO provider, talent acquisition vendor, etc.), set signal_score to 0 — exclude it entirely. These are vendors, not buyers.\nExcluded industries: ${config.exclude_industries.join(', ')}` : ''}
ICP pain points — score signals matching these themes 10 points higher:
${config.pain_points?.length ? config.pain_points.slice(0, 8).map((p: string) => `- ${p}`).join('\n') : '(none set)'}
Org competitors — treat any mention of these as competitor_complaint, competitor_engagement, or competitor_comparison:
${config.competitors?.length ? config.competitors.slice(0, 12).join(', ') : '(none set)'}
Score 1-100 (omit <40). Return ONLY a JSON array.`,
            messages: [{
              role: 'user',
              content: `Classify ${batch.length} results:
${batch.map((r: any, i: number) => `[${i}] ${r.company}|${r.hint}|${(r.title||'').substring(0,60)}|${(r.content||'').substring(0,150)}`).join('\n')}

Return: [{"index":N,"signal_type":"...","signal_subtype":"..."(optional),"signal_strength":"very_high|high|medium|low","signal_score":N,"buying_stage_indicator":"awareness|consideration|decision|null","title":"...","description":"...","ai_summary":"...","ai_recommended_action":"...","ai_outreach_angle":"..."}]`,
            }],
          }),
        }, 50000);

        let raw = res.content?.[0]?.text || '[]';
        raw = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        const analyses = JSON.parse(raw);
        if (Array.isArray(analyses)) {
          for (const a of analyses) {
            const src = batch[a.index];
            if (!src || a.signal_score < 40) continue;
            signals.push({
              organization_id,
              signal_type: VALID_SIGNAL_TYPES.includes(a.signal_type) ? a.signal_type : (src.hint || 'competitor_engagement'),
              signal_strength: ['very_high','high','medium','low'].includes(a.signal_strength) ? a.signal_strength : 'medium',
              signal_score: Math.max(1, Math.min(100, parseInt(a.signal_score) || 50)),
              buying_stage_indicator: ['awareness','consideration','decision'].includes(a.buying_stage_indicator) ? a.buying_stage_indicator : null,
              title: (a.title || src.title || 'Untitled').substring(0, 200),
              description: (a.description || src.content || '').substring(0, 500),
              source_url: src.url,
              source_platform: src.url?.includes('reddit.com') ? 'reddit'
                             : src.url?.includes('glassdoor.com') ? 'glassdoor'
                             : src.url?.includes('g2.com') ? 'g2'
                             : src.url?.includes('capterra.com') ? 'capterra'
                             : src.url?.includes('sec.gov') ? 'sec_edgar'
                             : src.url?.includes('linkedin.com') ? 'linkedin'
                             : src.url?.includes('producthunt.com') ? 'product_hunt'
                             : 'web',
              company_name: src.company,
              detected_at: new Date().toISOString(),
              status: 'new',
              ai_summary: a.ai_summary || null,
              ai_recommended_action: a.ai_recommended_action || null,
              ai_outreach_angle: a.ai_outreach_angle || null,
              raw_data: {
                url: src.url,
                hint: src.hint,
                domain: src.domain,
                ...(src.sec_form_type ? { sec_form_type: src.sec_form_type } : {}),
                ...(a.signal_subtype ? { signal_subtype: a.signal_subtype } : {}),
              },
            });
          }
        }
      } catch (err: any) {
        errors.push({ step: 'claude_classification', error: err.message });
      }
    }

    // ── Step 5: Contact discovery per company (parallel, fast) ───────────────
    const signalCompanies = [...new Set(signals.map((s: any) => s.company_name).filter(Boolean))];
    const domainMap: Record<string,string> = {};
    rawResults.forEach((r: any) => { if (r.company && r.domain) domainMap[r.company] = r.domain; });

    const contactMap: Record<string,any[]> = {};
    await Promise.all(signalCompanies.map(async (name: any) => {
      const domain = domainMap[name];
      if (!domain) return;
      try {
        const peopleFilters: any = { domains: [domain] };
        if (config.job_titles_to_track?.length) peopleFilters.titles = config.job_titles_to_track;
        const result = await apolloSearchPeople(peopleFilters);
        const contacts = (result?.people || []).map((p: any) => ({
          name: [p.first_name, p.last_name].filter(Boolean).join(' '),
          title: p.title || null,
          email: p.email || null,
          linkedin_url: p.linkedin_url || null,
          company: name,
        })).filter((c: any) => c.name);
        if (contacts.length) contactMap[name] = contacts;
      } catch { /* ignore */ }
    }));

    signals = signals.map((s: any) => ({
      ...s,
      raw_data: { ...s.raw_data, suggested_contacts: contactMap[s.company_name] || [] },
    }));

    // ── Step 6: Persist — merge new signals, skip dismissed + existing URLs ──
    // Filter out signals whose source_url was already dismissed or already exists
    const beforeDedup = signals.length;
    signals = signals.filter((s: any) => {
      if (dismissedUrls.has(s.source_url)) return false; // User dismissed this
      if (existingUrls.has(s.source_url)) return false;  // Already in DB from previous scan
      return true;
    });
    const dedupSkipped = beforeDedup - signals.length;

    let signalsSaved = 0;
    const savedSignals: any[] = [];
    if (signals.length > 0) {
      const { data: inserted, error: insertErr } = await sb
        .from('engage_intent_signals').insert(signals).select();
      if (insertErr) errors.push({ step: 'db_insert', error: insertErr.message });
      else { signalsSaved = inserted?.length || 0; savedSignals.push(...(inserted || [])); }
    }

    // Build company-level summary for transparency
    const signalCompanySet = new Set(signals.map((s: any) => s.company_name));
    const companyBreakdown = companiesToProcess.map((co: any) => {
      const name = co.name || co.organization_name || '?';
      return { name, had_signals: signalCompanySet.has(name), already_tracked: existingCompanyNames.has(name) };
    });

    return jsonResp({
      ok: true,
      companies_scanned: companiesProcessed,
      apollo_total: companies.length,
      excluded_by_industry: excludedCount,
      signals_found: signals.length,
      signals_saved: signalsSaved || signals.length,
      signals: savedSignals.length > 0 ? savedSignals : signals,
      existing_signals_kept: existingSignals.filter((r: any) => r.status !== 'dismissed').length,
      dismissed_preserved: dismissedUrls.size,
      duplicates_skipped: dedupSkipped,
      stale_removed: staleIds.length,
      companies: companyBreakdown,
      keywords_used: uniqueKeywords,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signal scan failed';
    return jsonResp({ error: msg }, 500);
  }
});
