// supabase/functions/engage-research/index.ts
// Supabase Edge Function — Full company/prospect research pipeline
// Apollo enrichment → Tavily web search → Claude AI brief
export {};

declare const Deno: {
  serve(handler: (req: Request) => Promise<Response> | Response): void;
  env: { get(key: string): string | undefined };
};

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

async function fetchJson(url: string, options: RequestInit = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ── External API helpers ─────────────────────────────────────

const APOLLO_BASE = 'https://api.apollo.io/v1';

async function apolloEnrichCompany(domain: string) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  return fetchJson(`${APOLLO_BASE}/organizations/enrich`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify({ domain }),
  });
}

async function apolloSearchPeople(filters: any) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const perPage = Math.min(filters.per_page || 25, 25);

  const body: any = {
    page: filters.page || 1,
    per_page: perPage,
  };
  if (filters.titles?.length) body.person_titles = filters.titles;
  if (filters.seniority?.length) body.person_seniorities = filters.seniority;
  if (filters.domains?.length) body.q_organization_domains_list = filters.domains;
  if (filters.locations?.length) body.person_locations = filters.locations;
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;

  // Technology-based search: find people at companies USING this software
  if (filters.technology) {
    const techUid = filters.technology.trim().toLowerCase().replace(/[\s.]+/g, '_');
    body.currently_using_any_of_technology_uids = [techUid];
  }
  // Keyword search (general)
  if (filters.keywords) body.q_keywords = filters.keywords;

  // Request contact reveals inline with search (uses 1 credit per person returned)
  body.reveal_personal_emails = true;
  body.reveal_phone_number = true;

  const searchResult = await fetchJson(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });

  // If inline reveals didn't populate contacts, enrich individually by Apollo ID
  const people = searchResult?.people || [];
  const needsEnrich = people.length > 0 && people.some((p: any) => !p.email);
  if (needsEnrich) {
    searchResult.people = await enrichPeopleBatch(key, people);
  }

  return searchResult;
}

/** Search Apollo for companies matching a name/domain */
async function apolloSearchOrganizations(query: string) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  // Try domain-style first, or keyword
  const isDomain = query.includes('.') && !query.includes(' ');
  const body: any = {
    page: 1,
    per_page: 10,
  };
  if (isDomain) {
    body.q_organization_domains_list = [query.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')];
  } else {
    body.q_organization_keyword_tags = [query];
  }

  const result = await fetchJson(`${APOLLO_BASE}/mixed_companies/search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });
  return result?.organizations || result?.accounts || [];
}

/** Enrich people via Apollo people/match to get email + phone.
 *  Uses apollo_id as primary key, plus name+org as fallback signals. */
async function enrichPeopleBatch(apiKey: string, people: any[]) {
  const enrichPromises = people.map(person => {
    // Build the match payload with as many identifiers as possible
    const matchBody: any = {
      reveal_personal_emails: true,
      reveal_phone_number: true,
    };
    // Apollo ID is the best identifier for a direct lookup
    if (person.id) matchBody.id = person.id;
    // Fallback signals improve match confidence
    if (person.first_name) matchBody.first_name = person.first_name;
    if (person.last_name) matchBody.last_name = person.last_name;
    if (person.organization?.name) matchBody.organization_name = person.organization.name;
    if (person.organization?.primary_domain) matchBody.domain = person.organization.primary_domain;
    if (person.linkedin_url) matchBody.linkedin_url = person.linkedin_url;

    return fetchJson(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: JSON.stringify(matchBody),
    }).catch((err: any) => {
      console.warn(`Enrichment failed for ${person.id} (${person.first_name} ${person.last_name}):`, err.message);
      return { person };
    });
  });

  const results = await Promise.all(enrichPromises);

  return people.map((person, i) => {
    const enriched = results[i]?.person || {};
    const firstName = enriched.first_name || person.first_name || '';
    const lastName = enriched.last_name || person.last_name || '';
    const email = enriched.email || person.email || null;
    const phones = enriched.phone_numbers?.length ? enriched.phone_numbers
      : person.phone_numbers?.length ? person.phone_numbers : [];
    const sanitizedPhone = enriched.sanitized_phone || enriched.phone_number || person.sanitized_phone || person.phone_number || null;
    return {
      ...person,
      ...enriched,
      first_name: firstName,
      last_name: lastName,
      name: enriched.name || person.name || `${firstName} ${lastName}`.trim(),
      email,
      phone_numbers: phones,
      phone_number: sanitizedPhone,
      organization: enriched.organization || person.organization || {},
      linkedin_url: enriched.linkedin_url || person.linkedin_url || '',
    };
  });
}

async function apolloEnrichPerson(email: string) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');
  return fetchJson(`${APOLLO_BASE}/people/match`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify({ email }),
  });
}

async function pdlEnrichPerson(params: { email?: string; linkedin_url?: string }) {
  const key = Deno.env.get('PDL_API_KEY');
  if (!key) throw new Error('PDL_API_KEY not configured');
  const qs = new URLSearchParams();
  if (params.email) qs.set('email', params.email);
  if (params.linkedin_url) qs.set('profile', params.linkedin_url);
  qs.set('min_likelihood', '5');
  return fetchJson(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
    headers: { 'X-Api-Key': key },
  });
}

async function tavilySearch(query: string, options: any = {}) {
  const key = Deno.env.get('TAVILY_API_KEY');
  if (!key) throw new Error('TAVILY_API_KEY not configured');
  return fetchJson('https://api.tavily.com/search', {
    method: 'POST',
    body: JSON.stringify({
      api_key: key,
      query,
      search_depth: options.depth || 'advanced',
      include_answer: true,
      include_raw_content: false,
      max_results: options.max_results || 5,
      topic: options.topic || 'general',
    }),
  });
}

// ── Claude API call ──────────────────────────────────────────

async function callClaude(systemPrompt: string, userMessage: string, maxTokens = 2000) {
  const key = Deno.env.get('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': key,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Anthropic API error ${res.status}: ${errText}`);
  }

  const message = await res.json();
  let text = message.content?.[0]?.text || '{}';
  // Strip markdown code fences that Claude often wraps JSON in
  text = text.replace(/^```(?:json)?\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();
  const tokensUsed = (message.usage?.input_tokens || 0) + (message.usage?.output_tokens || 0);
  return { text, tokensUsed };
}

// ── Company research ─────────────────────────────────────────

async function researchCompany(domain: string) {
  const steps: any = { apollo: null, tavily: null, brief: null };

  try { steps.apollo = await apolloEnrichCompany(domain); }
  catch (err: any) { steps.apollo = { error: err.message }; }

  try {
    const companyName = steps.apollo?.organization?.name || domain;
    steps.tavily = await tavilySearch(
      `${companyName} company news funding tech stack 2024 2025 2026`,
      { depth: 'advanced', max_results: 8 }
    );
  } catch (err: any) { steps.tavily = { error: err.message }; }

  try {
    const systemPrompt = `You are an expert sales intelligence analyst for Apptivia Engage.
Given company data and recent web search results, produce a structured JSON company brief.

Return ONLY valid JSON with this exact shape:
{
  "summary": "2-3 sentence executive summary",
  "key_findings": ["finding 1", "finding 2"],
  "tech_stack": ["tech1", "tech2"],
  "recent_news": [{"headline": "...", "date": "...", "url": "..."}],
  "funding_history": [{"round": "...", "amount": "...", "date": "...", "investors": ["..."]}],
  "competitors": ["competitor1", "competitor2"],
  "talking_points": ["point 1", "point 2"],
  "risk_factors": ["risk 1"],
  "icp_fit_score": 75,
  "icp_reasoning": "Why this company is/isn't a good fit"
}`;

    const userMessage = `Company data:\n${JSON.stringify(steps.apollo?.organization || { domain }, null, 2)}\n\nWeb search results:\n${JSON.stringify(steps.tavily?.results || [], null, 2)}`;
    const { text, tokensUsed } = await callClaude(systemPrompt, userMessage);
    try {
      steps.brief = { content: JSON.parse(text), tokens_used: tokensUsed };
    } catch {
      steps.brief = { content: { summary: text }, tokens_used: tokensUsed };
    }
  } catch (err: any) { steps.brief = { error: err.message }; }

  return {
    company: steps.apollo?.organization || null,
    web_results: steps.tavily?.results || [],
    brief: steps.brief?.content || null,
    tokens_used: steps.brief?.tokens_used || 0,
    data_sources: [
      steps.apollo?.error ? null : 'apollo',
      steps.tavily?.error ? null : 'tavily',
      steps.brief?.error ? null : 'claude',
    ].filter(Boolean),
    errors: Object.entries(steps)
      .filter(([, v]: any) => v?.error)
      .map(([k, v]: any) => ({ step: k, error: v.error })),
  };
}

// ── Prospect research ────────────────────────────────────────

async function researchProspect(identifier: any) {
  const steps: any = { enrich: null, tavily: null, brief: null };

  try {
    if (identifier.email) {
      steps.enrich = await apolloEnrichPerson(identifier.email);
    } else if (identifier.linkedin_url) {
      steps.enrich = await pdlEnrichPerson({ linkedin_url: identifier.linkedin_url });
    }
  } catch (err: any) { steps.enrich = { error: err.message }; }

  const person = steps.enrich?.person || steps.enrich?.data || identifier;

  try {
    const name = person.name || `${identifier.first_name || ''} ${identifier.last_name || ''}`.trim();
    const company = person.organization?.name || identifier.company_name || '';
    steps.tavily = await tavilySearch(
      `${name} ${company} ${person.title || ''} professional`,
      { max_results: 5 }
    );
  } catch (err: any) { steps.tavily = { error: err.message }; }

  try {
    const systemPrompt = `You are an expert sales intelligence analyst for Apptivia Engage.
Given a prospect's profile, their company data, and web search results, produce a structured JSON prospect brief.

Return ONLY valid JSON with this shape:
{
  "summary": "2-3 sentence overview of the prospect and their role",
  "professional_background": "Career trajectory and experience",
  "recent_activity": ["activity 1", "activity 2"],
  "shared_connections": "Potential common ground or mutual interests",
  "talking_points": ["personalised point 1", "point 2"],
  "outreach_angles": ["angle 1", "angle 2"],
  "best_channel": "email|linkedin|phone",
  "best_time_to_reach": "Suggested timing",
  "fit_score": 80,
  "fit_reasoning": "Why this prospect is a good/poor fit"
}`;

    const userMessage = `Prospect:\n${JSON.stringify(person, null, 2)}\n\nCompany:\n${JSON.stringify(person.organization || {}, null, 2)}\n\nWeb results:\n${JSON.stringify(steps.tavily?.results || [], null, 2)}`;
    const { text, tokensUsed } = await callClaude(systemPrompt, userMessage);
    try {
      steps.brief = { content: JSON.parse(text), tokens_used: tokensUsed };
    } catch {
      steps.brief = { content: { summary: text }, tokens_used: tokensUsed };
    }
  } catch (err: any) { steps.brief = { error: err.message }; }

  return {
    prospect: person,
    web_results: steps.tavily?.results || [],
    brief: steps.brief?.content || null,
    tokens_used: steps.brief?.tokens_used || 0,
    data_sources: [
      steps.enrich?.error ? null : 'apollo',
      steps.tavily?.error ? null : 'tavily',
      steps.brief?.error ? null : 'claude',
    ].filter(Boolean),
    errors: Object.entries(steps)
      .filter(([, v]: any) => v?.error)
      .map(([k, v]: any) => ({ step: k, error: v.error })),
  };
}

// ── Route handler ────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return jsonResp({ error: 'POST required' }, 405);
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'company';
    const body = await req.json();

    if (action === 'company') {
      const { domain } = body;
      if (!domain) return jsonResp({ error: 'domain is required' }, 400);
      const result = await researchCompany(domain);
      return jsonResp({ ok: true, ...result });
    }

    if (action === 'prospect') {
      const result = await researchProspect(body);
      return jsonResp({ ok: true, ...result });
    }

    if (action === 'search_people') {
      const data = await apolloSearchPeople(body);
      return jsonResp({ ok: true, data });
    }

    if (action === 'company_search') {
      // Disambiguation: return a list of matching companies
      const { query } = body;
      if (!query) return jsonResp({ error: 'query is required' }, 400);
      const companies = await apolloSearchOrganizations(query);
      return jsonResp({ ok: true, companies });
    }

    if (action === 'find_people_at_company') {
      // Find people at a specific company by domain + relevant titles
      const DEFAULT_TITLES = [
        'VP Sales', 'VP of Sales', 'Vice President Sales',
        'Director of Sales', 'Director Sales', 'Head of Sales',
        'Sales Manager', 'Regional Sales Manager', 'Area Sales Manager',
        'CRO', 'Chief Revenue Officer', 'VP Revenue Operations',
        'Head of Revenue Operations', 'Director Revenue Operations',
        'Business Development Manager', 'Director of Business Development',
        'VP Business Development', 'Head of Business Development',
        'Account Executive', 'Senior Account Executive', 'Enterprise Account Executive',
        'SDR Manager', 'BDR Manager', 'Sales Development Manager',
        'Head of Sales Enablement', 'Director of Sales Enablement',
        'VP of Sales Operations', 'Director Sales Operations',
        'GTM Leader', 'VP of Growth', 'Head of Growth',
      ];
      const DEFAULT_SENIORITY = ['owner', 'founder', 'c_suite', 'partner', 'vp', 'head', 'director', 'manager', 'senior'];

      const domain = body.domain;
      if (!domain) return jsonResp({ error: 'domain is required' }, 400);

      const filters: any = {
        domains: [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')],
        titles: body.titles || DEFAULT_TITLES,
        seniority: body.seniority || DEFAULT_SENIORITY,
        per_page: Math.min(body.per_page || 25, 25),
      };

      const data = await apolloSearchPeople(filters);
      return jsonResp({ ok: true, data });
    }

    if (action === 'suggested_contacts') {
      // After company research, suggest people to reach out to
      const domain = body.domain;
      if (!domain) return jsonResp({ error: 'domain is required' }, 400);

      const SUGGESTION_TITLES = [
        'VP Sales', 'Director of Sales', 'Head of Sales',
        'CRO', 'VP Revenue Operations', 'Sales Manager',
        'Business Development Manager', 'VP Business Development',
      ];

      const filters: any = {
        domains: [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')],
        titles: SUGGESTION_TITLES,
        seniority: ['vp', 'head', 'director', 'manager', 'c_suite'],
        per_page: 5,
      };

      const data = await apolloSearchPeople(filters);
      return jsonResp({ ok: true, data });
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Research failed';
    console.error('engage-research error:', err);
    return jsonResp({ error: message }, 500);
  }
});
