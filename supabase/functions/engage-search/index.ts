// supabase/functions/engage-search/index.ts
// Supabase Edge Function — Engage search (Apollo people/companies, Tavily web, status)
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

// ── Apollo ───────────────────────────────────────────────────

const APOLLO_BASE = 'https://api.apollo.io/v1';

async function apolloSearchPeople(filters: any) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const body: any = {
    page: filters.page || 1,
    per_page: filters.per_page || 25,
  };
  if (filters.titles?.length) body.person_titles = filters.titles;
  if (filters.seniority?.length) body.person_seniorities = filters.seniority;
  if (filters.domains?.length) body.q_organization_domains_list = filters.domains;
  if (filters.locations?.length) body.person_locations = filters.locations;
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;
  if (filters.keywords) body.q_keywords = filters.keywords;

  return fetchJson(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });
}

async function apolloSearchCompanies(filters: any) {
  const key = Deno.env.get('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const body: any = {
    page: filters.page || 1,
    per_page: filters.per_page || 25,
    organization_industry_tag_ids: filters.industries || [],
    organization_num_employees_ranges: filters.employee_ranges || [],
    q_organization_keyword_tags: filters.keywords ? [filters.keywords] : [],
  };
  if (filters.domains?.length) body.q_organization_domains = filters.domains;
  if (filters.locations?.length) body.organization_locations = filters.locations;

  return fetchJson(`${APOLLO_BASE}/mixed_companies/search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });
}

// ── Tavily ───────────────────────────────────────────────────

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

// ── Route handler ────────────────────────────────────────────

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || 'status';

    // GET /engage-search?action=status
    if (action === 'status') {
      return jsonResp({
        ok: true,
        providers: {
          apollo: !!Deno.env.get('APOLLO_API_KEY'),
          tavily: !!Deno.env.get('TAVILY_API_KEY'),
          pdl: !!Deno.env.get('PDL_API_KEY'),
          anthropic: !!Deno.env.get('ANTHROPIC_API_KEY'),
        },
      });
    }

    // All other actions require POST
    if (req.method !== 'POST') {
      return jsonResp({ error: 'POST required' }, 405);
    }

    const body = await req.json();

    if (action === 'prospects') {
      const data = await apolloSearchPeople(body);
      return jsonResp({ ok: true, data });
    }

    if (action === 'companies') {
      const data = await apolloSearchCompanies(body);
      return jsonResp({ ok: true, data });
    }

    if (action === 'web') {
      const { query, max_results, depth } = body;
      if (!query) return jsonResp({ error: 'query is required' }, 400);
      const data = await tavilySearch(query, { max_results, depth });
      return jsonResp({ ok: true, data });
    }

    return jsonResp({ error: `Unknown action: ${action}` }, 400);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Search failed';
    console.error('engage-search error:', err);
    return jsonResp({ error: message }, 500);
  }
});
