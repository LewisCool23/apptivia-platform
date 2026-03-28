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
      throw new Error(`${res.status}: ${text.substring(0, 100)}`);
    }
    return res.json();
  } finally {
    clearTimeout(timer);
  }
}

async function apolloSearchCompanies(filters: any = {}) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  const body: any = { page: 1, per_page: 5 };
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;
  if (filters.keywords)               body.q_organization_keyword_tags = [filters.keywords];
  if (filters.locations?.length)      body.organization_locations = filters.locations;
  if (filters.technologies?.length) {
    body.currently_using_any_of_technology_uids = filters.technologies.map((t: string) =>
      t.trim().toLowerCase().replace(/[\s.\-]+/g, '_')
    );
  }
  return fetchWithTimeout('https://api.apollo.io/v1/mixed_companies/search', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Api-Key': key },
    body: JSON.stringify(body),
  }, 12000);
}

async function apolloSearchPeople(filters: any = {}) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  const body: any = { page: 1, per_page: 3, reveal_personal_emails: true };
  if (filters.domains?.length)   body.q_organization_domains_list = filters.domains;
  if (filters.titles?.length)    body.person_titles = filters.titles;
  return fetchWithTimeout('https://api.apollo.io/v1/mixed_people/api_search', {
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

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return jsonResp({ error: 'POST required' }, 405);

  try {
    const { organization_id, config } = await req.json();
    if (!organization_id) return jsonResp({ error: 'organization_id is required' }, 400);
    if (!config)          return jsonResp({ error: 'config is required' }, 400);

    const errors: any[] = [];

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
    ];

    // Subset passed to Claude — library-aligned keys only, no legacy duplicates
    const SIGNAL_TYPE_CHOICES = VALID_SIGNAL_TYPES.filter((k: string) => ![
      'funding', 'expansion', 'layoffs', 'job_change', 'hiring',
      'review_sentiment', 'icp_job_posting', 'reddit_signal', 'glassdoor_sentiment',
      'website_visit',
    ].includes(k));

    // ── Step 1: Apollo ICP Company Discovery (max 5) ─────────────────────────
    const apolloFilters: any = {};

    if (config.icp_employee_range) {
      const parts = config.icp_employee_range.split('-').map((s: string) => parseInt(s) || 0);
      const minH = parts[0] || 0, maxH = parts[1] || 999999;
      const RANGES = [
        [1,10,'1,10'],[11,20,'11,20'],[21,50,'21,50'],[51,200,'51,200'],
        [201,500,'201,500'],[501,1000,'501,1000'],[1001,2000,'1001,2000'],
        [2001,5000,'2001,5000'],[5001,10000,'5001,10000'],[10001,999999,'10001,'],
      ];
      const ranges = RANGES.filter(([lo,hi]: any) => hi >= minH && lo <= maxH).map((r: any) => r[2]);
      if (ranges.length) apolloFilters.employee_ranges = ranges;
    }

    if (config.tech_stack_positive?.length) apolloFilters.technologies = config.tech_stack_positive;
    if (config.solution_keywords?.length)   apolloFilters.keywords     = config.solution_keywords[0];
    if (config.icp_regions?.length)         apolloFilters.locations    = config.icp_regions;

    let companies: any[] = [];
    try {
      const result = await apolloSearchCompanies(apolloFilters);
      companies = (result?.organizations || result?.accounts || []).slice(0, 5);
    } catch (err: any) {
      errors.push({ step: 'apollo_company_discovery', error: err.message });
    }

    if (companies.length === 0) {
      return jsonResp({
        ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: 'No ICP companies found — adjust your signal config filters.',
      });
    }

    // ── Step 2: Wipe existing signals ────────────────────────────────────────
    const sb = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );
    await sb.from('engage_intent_signals').delete().eq('organization_id', organization_id);

    // ── Step 3: Per-company Tavily queries (3 per company, all parallel) ─────
    const rawResults: any[] = [];

    await Promise.all(companies.map(async (co: any) => {
      const name   = co.name || co.organization_name || '';
      const domain = (co.website_url || co.primary_domain || '')
        .replace(/^https?:\/\//, '').replace(/\/.*/, '').trim();
      if (!name) return;

      const queries = [
        { q: `"${name}" funding OR raised OR acquisition OR "series A" OR "series B" 2025 2026`, hint: 'funding' },
        { q: `"${name}" "new VP" OR "new CRO" OR "new CEO" OR "appointed" OR "joins as" 2025 2026`, hint: 'leadership_change' },
        // G2 reviews (dedicated query — separated from competitor_complaint)
        { q: `"${name}" site:g2.com review OR reviews OR "star rating" OR "easy to use" OR "lacks"`, hint: 'g2_review' },
        // Reddit subtypes
        { q: `"${name}" site:reddit.com "looking for" OR "recommend" OR "best tool" OR "switching to" OR "should I buy"`, hint: 'reddit_buying_intent' },
        { q: `"${name}" site:reddit.com "frustrated with" OR "hate" OR "leaving" OR "switching from" OR "canceling"`, hint: 'reddit_churn_risk' },
        // Product Hunt
        { q: `"${name}" site:producthunt.com OR "Product Hunt" launch 2025 2026`, hint: 'product_hunt_launch' },
        // Hiring velocity
        { q: `"${name}" "scaling team" OR "rapid growth" OR "aggressively hiring" hiring 2025 2026 site:linkedin.com`, hint: 'hiring_velocity' },
        // Capterra reviews
        { q: `"${name}" site:capterra.com review OR reviews OR "star rating" OR "easy to use" OR "lacks"`, hint: 'capterra_review' },
        // Glassdoor — employee sentiment
        { q: `"${name}" site:glassdoor.com reviews OR "management" OR "leadership" OR "culture" OR "rating"`, hint: 'glassdoor_leadership_concern' },
      ];

      await Promise.all(queries.map(async ({ q, hint }) => {
        try {
          const data = await tavilySearch(q);
          (data?.results || []).forEach((r: any) =>
            rawResults.push({ title: r.title, content: r.content, url: r.url, hint, company: name, domain })
          );
        } catch { /* ignore individual query failures */ }
      }));
    }));

    if (rawResults.length === 0) {
      return jsonResp({ ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: 'No search results returned.' });
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

    if (ANTHROPIC_KEY && deduped.length > 0) {
      const batch = deduped.slice(0, 15);
      try {
        const res = await fetchWithTimeout('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({
            model: 'claude-haiku-4-5-20251001',
            max_tokens: 4000,
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
For glassdoor signals, also return signal_subtype with a brief description of the feedback theme.
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
        }, 30000);

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

    // ── Step 6: Persist ───────────────────────────────────────────────────────
    let signalsSaved = 0;
    const savedSignals: any[] = [];
    if (signals.length > 0) {
      const { data: inserted, error: insertErr } = await sb
        .from('engage_intent_signals').insert(signals).select();
      if (insertErr) errors.push({ step: 'db_insert', error: insertErr.message });
      else { signalsSaved = inserted?.length || 0; savedSignals.push(...(inserted || [])); }
    }

    return jsonResp({
      ok: true,
      companies_scanned: companies.length,
      signals_found: signals.length,
      signals_saved: signalsSaved || signals.length,
      signals: savedSignals.length > 0 ? savedSignals : signals,
      errors: errors.length > 0 ? errors : undefined,
    });

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : 'Signal scan failed';
    return jsonResp({ error: msg }, 500);
  }
});
