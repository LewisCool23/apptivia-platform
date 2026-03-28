/**
 * Apptivia Engage — Backend Service
 * ----------------------------------
 * Orchestrates external data-provider APIs and AI research generation.
 *
 * Data providers (configured via env vars):
 *   APOLLO_API_KEY    — Apollo.io  (people + company search)
 *   TAVILY_API_KEY    — Tavily     (AI web search)
 *   PDL_API_KEY       — People Data Labs (enrichment fallback)
 *
 * AI:
 *   ANTHROPIC_API_KEY — Claude research report generation
 */

const Anthropic = require('@anthropic-ai/sdk');

// ── Helpers ──────────────────────────────────────────────────

function env(key) {
  return process.env[key] || '';
}

async function fetchJson(url, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...options.headers },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${res.statusText}: ${text}`);
  }
  return res.json();
}

// ── Apollo.io ────────────────────────────────────────────────

const APOLLO_BASE = 'https://api.apollo.io/v1';

/** Hunter.io Email Finder — fills in email + LinkedIn URL when Apollo truncates last names.
 *  Graceful no-op when HUNTER_API_KEY is not set. */
async function hunterEnrichPeople(domain, people) {
  const key = env('HUNTER_API_KEY');
  if (!key || !domain || !people.length) return people;

  const isLastNameTruncated = (ln) =>
    !ln || ln.length <= 2 || /^[A-Z]\.?$/.test(ln.trim());

  const enriched = await Promise.all(
    people.map(async (p) => {
      const needsEmail = !p.email;
      const needsLinkedIn = !p.linkedin_url;
      const nameTruncated = isLastNameTruncated(p.last_name || '');
      if (!needsEmail && !needsLinkedIn && !nameTruncated) return p;

      const firstName = (p.first_name || '').trim();
      const lastName = (p.last_name || '').replace(/\.$/, '').trim();
      if (!firstName || !lastName || lastName.length < 2) return p;

      try {
        const url = `https://api.hunter.io/v2/email-finder?domain=${encodeURIComponent(domain)}&first_name=${encodeURIComponent(firstName)}&last_name=${encodeURIComponent(lastName)}&api_key=${key}`;
        const resp = await fetch(url);
        if (!resp.ok) return p;
        const json = await resp.json();
        const d = json?.data;
        if (!d) return p;

        const fullLastName = d.last_name && d.last_name.length > (lastName?.length || 0) ? d.last_name : p.last_name;
        const fullName = fullLastName !== p.last_name
          ? `${firstName} ${fullLastName}`.trim()
          : (p.name || `${firstName} ${p.last_name || ''}`.trim());

        return {
          ...p,
          last_name: fullLastName || p.last_name,
          name: fullName,
          email: needsEmail && d.email && (d.score || 0) >= 70 ? d.email : p.email,
          linkedin_url: needsLinkedIn && d.linkedin ? d.linkedin : p.linkedin_url,
        };
      } catch {
        return p;
      }
    })
  );
  return enriched;
}

async function apolloSearchPeople(filters = {}) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  // Cap results — we enrich each one individually to get contact info
  const perPage = Math.min(filters.per_page || 25, 25);

  const body = {
    page: filters.page || 1,
    per_page: perPage,
  };
  // Only include params that have values — empty arrays cause 422
  if (filters.titles?.length) body.person_titles = filters.titles;
  if (filters.seniority?.length) body.person_seniorities = filters.seniority;
  if (filters.domains?.length) body.q_organization_domains_list = filters.domains;
  if (filters.locations?.length) body.person_locations = filters.locations;
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;

  // Use technology filter to find people at companies USING this software
  if (filters.keywords) {
    const techUid = filters.keywords.trim().toLowerCase().replace(/[\s.]+/g, '_');
    body.currently_using_any_of_technology_uids = [techUid];
  }

  // Request email reveals inline with search (uses 1 credit per person returned)
  body.reveal_personal_emails = true;

  const searchResult = await fetchJson(`${APOLLO_BASE}/mixed_people/api_search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });

  // If inline reveals didn't populate contacts, enrich individually by Apollo ID
  const people = searchResult?.people || [];
  const needsEnrich = people.length > 0 && people.some(p => !p.email);
  if (needsEnrich) {
    searchResult.people = await enrichPeopleBatch(key, people);
  }

  // Hunter.io fallback: fill in still-missing emails, LinkedIn URLs, and truncated last names
  const domain = filters.domains?.[0] || '';
  if (domain && (searchResult.people || []).length > 0) {
    searchResult.people = await hunterEnrichPeople(domain, searchResult.people);
  }

  // PDL fallback: fill in missing phone numbers
  const pdlKey = process.env.PDL_API_KEY;
  if (pdlKey && (searchResult.people || []).length > 0) {
    searchResult.people = await pdlEnrichPhoneBatch(searchResult.people);
  }

  return searchResult;
}

/** Search Apollo for companies matching a name/domain */
async function apolloSearchOrganizations(query) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const isDomain = query.includes('.') && !query.includes(' ');
  const body = { page: 1, per_page: 10 };
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

/** Enrich people via Apollo people/match to get email + phone */
async function enrichPeopleBatch(apiKey, people) {
  const enrichPromises = people.map(person => {
    const matchBody = {
      reveal_personal_emails: true,
      reveal_phone_number: false,  // phone reveal requires async webhook — disable explicitly
    };
    if (person.id) matchBody.id = person.id;
    if (person.first_name) matchBody.first_name = person.first_name;
    if (person.last_name) matchBody.last_name = person.last_name;
    if (person.organization?.name) matchBody.organization_name = person.organization.name;
    if (person.organization?.primary_domain) matchBody.domain = person.organization.primary_domain;
    if (person.linkedin_url) matchBody.linkedin_url = person.linkedin_url;

    return fetchJson(`${APOLLO_BASE}/people/match`, {
      method: 'POST',
      headers: { 'X-Api-Key': apiKey },
      body: JSON.stringify(matchBody),
    }).catch((err) => {
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

async function apolloSearchCompanies(filters = {}) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const body = {
    page: filters.page || 1,
    per_page: filters.per_page || 25,
  };

  // Only include non-empty arrays — Apollo returns 422 on empty arrays
  if (filters.industries?.length)      body.organization_industry_tag_ids = filters.industries;
  if (filters.employee_ranges?.length) body.organization_num_employees_ranges = filters.employee_ranges;
  if (filters.revenue_ranges?.length)  body.organization_annual_revenue_ranges = filters.revenue_ranges;
  if (filters.keywords)                body.q_organization_keyword_tags = [filters.keywords];
  if (filters.domains?.length)         body.q_organization_domains = filters.domains;
  if (filters.locations?.length)       body.organization_locations = filters.locations;

  // Companies currently using specific technologies (e.g. Salesforce, Outreach, HubSpot)
  if (filters.technologies?.length) {
    const techUids = filters.technologies.map(t =>
      t.trim().toLowerCase().replace(/[\s.\-]+/g, '_')
    );
    body.currently_using_any_of_technology_uids = techUids;
  }

  return fetchJson(`${APOLLO_BASE}/mixed_companies/search`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
  });
}

async function apolloEnrichPerson(email) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  return fetchJson(`${APOLLO_BASE}/people/match`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify({ email }),
  });
}

async function apolloEnrichCompany(domain) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  return fetchJson(`${APOLLO_BASE}/organizations/enrich`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify({ domain }),
  });
}

// ── Tavily (AI Web Search) ──────────────────────────────────

async function tavilySearch(query, options = {}) {
  const key = env('TAVILY_API_KEY');
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

// ── People Data Labs (enrichment fallback) ───────────────────

async function pdlEnrichPerson(params = {}) {
  const key = env('PDL_API_KEY');
  if (!key) throw new Error('PDL_API_KEY not configured');

  const qs = new URLSearchParams();
  if (params.email) qs.set('email', params.email);
  if (params.linkedin_url) qs.set('profile', params.linkedin_url);
  qs.set('min_likelihood', '5');

  return fetchJson(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
    headers: { 'X-Api-Key': key },
  });
}

/** Enrich phone numbers for a batch of people via PDL — skips people who already have a phone */
async function pdlEnrichPhoneBatch(people) {
  const key = process.env.PDL_API_KEY;
  if (!key) return people;

  const results = await Promise.all(people.map(async (person) => {
    const hasPhone = person.phone_numbers?.length || person.sanitized_phone || person.phone_number || person.phone;
    if (hasPhone) return person;

    const email = person.email || '';
    const linkedin = person.linkedin_url || '';
    if (!email && !linkedin) return person;

    try {
      const qs = new URLSearchParams({ min_likelihood: '5' });
      if (email) qs.set('email', email);
      if (linkedin) qs.set('profile', linkedin);
      const data = await fetchJson(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
        headers: { 'X-Api-Key': key },
      });
      const pdlPhone = data?.data?.mobile_phone || data?.data?.phone_numbers?.[0] || null;
      if (pdlPhone) {
        return { ...person, sanitized_phone: pdlPhone, phone_number: pdlPhone };
      }
    } catch {
      // non-blocking — PDL miss is fine
    }
    return person;
  }));

  return results;
}

async function pdlEnrichCompany(domain) {
  const key = env('PDL_API_KEY');
  if (!key) throw new Error('PDL_API_KEY not configured');

  return fetchJson(`https://api.peopledatalabs.com/v5/company/enrich?website=${encodeURIComponent(domain)}`, {
    headers: { 'X-Api-Key': key },
  });
}

// ── AI Research Report Generation ────────────────────────────

function getAnthropicClient() {
  const key = env('ANTHROPIC_API_KEY');
  if (!key) throw new Error('ANTHROPIC_API_KEY not configured');
  return new Anthropic({ apiKey: key });
}

async function generateCompanyBrief(companyData, webResults) {
  const client = getAnthropicClient();

  const systemPrompt = `You are an expert sales intelligence analyst for Apptivia Engage.
Given company data and recent web search results, produce a structured JSON company brief.

Return ONLY valid JSON with this exact shape:
{
  "summary": "2-3 sentence executive summary",
  "key_findings": ["finding 1", "finding 2", ...],
  "tech_stack": ["tech1", "tech2"],
  "recent_news": [{"headline": "...", "date": "...", "url": "..."}],
  "funding_history": [{"round": "...", "amount": "...", "date": "...", "investors": ["..."]}],
  "competitors": ["competitor1", "competitor2"],
  "talking_points": ["point 1", "point 2"],
  "risk_factors": ["risk 1"],
  "icp_fit_score": 75,
  "icp_reasoning": "Why this company is/isn't a good fit"
}`;

  const userMessage = `Company data:\n${JSON.stringify(companyData, null, 2)}\n\nWeb search results:\n${JSON.stringify(webResults, null, 2)}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: 'claude-sonnet-4-20250514',
    };
  } catch {
    return { content: { summary: text }, tokens_used: 0, model_used: 'claude-sonnet-4-20250514' };
  }
}

async function generateProspectBrief(prospectData, companyData, webResults) {
  const client = getAnthropicClient();

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

  const userMessage = `Prospect:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany:\n${JSON.stringify(companyData, null, 2)}\n\nWeb results:\n${JSON.stringify(webResults, null, 2)}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: 'claude-sonnet-4-20250514',
    };
  } catch {
    return { content: { summary: text }, tokens_used: 0, model_used: 'claude-sonnet-4-20250514' };
  }
}

async function generateOutreachDraft(prospectData, companyBrief, options = {}) {
  const client = getAnthropicClient();

  const channel = options.channel || 'email';
  const tone = options.tone || 'professional';

  const systemPrompt = `You are an expert sales copywriter for Apptivia Engage.
Write a personalised ${channel} outreach message with a ${tone} tone.

Rules:
- Use specific details from the prospect's profile and company research
- Keep it concise (${channel === 'linkedin' ? '300 chars max for connection request, 1500 for InMail' : '150 words max for email'})
- Include a clear, low-friction CTA
- Do NOT be generic or salesy
- Reference something specific and recent about their company or role

Return ONLY valid JSON:
{
  "subject": "Email subject line (omit for LinkedIn)",
  "body": "The message body",
  "personalization_points": ["detail 1 used", "detail 2 used"],
  "cta_type": "meeting|resource|question|intro"
}`;

  const userMessage = `Prospect:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany brief:\n${JSON.stringify(companyBrief, null, 2)}\n\nTone: ${tone}\nChannel: ${channel}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: 'claude-sonnet-4-20250514',
    };
  } catch {
    return { content: { body: text }, tokens_used: 0, model_used: 'claude-sonnet-4-20250514' };
  }
}

// ── Composite Orchestration Functions ────────────────────────

/**
 * Full company research pipeline:
 * 1. Enrich from Apollo
 * 2. AI web search via Tavily
 * 3. Generate AI brief
 */
async function researchCompany(domain) {
  const steps = { apollo: null, tavily: null, brief: null };

  // Step 1: Apollo enrichment
  try {
    steps.apollo = await apolloEnrichCompany(domain);
  } catch (err) {
    steps.apollo = { error: err.message };
  }

  // Step 2: Web search
  try {
    const companyName = steps.apollo?.organization?.name || domain;
    steps.tavily = await tavilySearch(
      `${companyName} company news funding tech stack 2024 2025`,
      { depth: 'advanced', max_results: 8 }
    );
  } catch (err) {
    steps.tavily = { error: err.message };
  }

  // Step 3: AI brief
  try {
    steps.brief = await generateCompanyBrief(
      steps.apollo?.organization || { domain },
      steps.tavily?.results || []
    );
  } catch (err) {
    steps.brief = { error: err.message };
  }

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
      .filter(([, v]) => v?.error)
      .map(([k, v]) => ({ step: k, error: v.error })),
  };
}

/**
 * Full prospect research pipeline:
 * 1. Enrich from Apollo (or PDL fallback)
 * 2. AI web search
 * 3. Generate AI brief
 */
async function researchProspect(identifier) {
  const steps = { enrich: null, tavily: null, brief: null };

  // Step 1: Enrich — Apollo for email, PDL for LinkedIn
  try {
    if (identifier.email) {
      steps.enrich = await apolloEnrichPerson(identifier.email);
    } else if (identifier.linkedin_url) {
      steps.enrich = await pdlEnrichPerson({ linkedin_url: identifier.linkedin_url });
    }
  } catch (err) {
    steps.enrich = { error: err.message };
  }

  let person = steps.enrich?.person || steps.enrich?.data || identifier;

  // PDL phone fallback — runs if we have email/linkedin but no phone yet
  const hasPhone = person.phone_numbers?.length || person.sanitized_phone || person.phone_number || person.mobile_phone;
  if (!hasPhone && process.env.PDL_API_KEY) {
    const email = person.email || identifier.email || '';
    const linkedin = person.linkedin_url || identifier.linkedin_url || '';
    if (email || linkedin) {
      try {
        const qs = new URLSearchParams({ min_likelihood: '5' });
        if (email) qs.set('email', email);
        if (linkedin) qs.set('profile', linkedin);
        const pdlData = await fetchJson(`https://api.peopledatalabs.com/v5/person/enrich?${qs}`, {
          headers: { 'X-Api-Key': process.env.PDL_API_KEY },
        });
        const pdlPhone = pdlData?.data?.mobile_phone || pdlData?.data?.phone_numbers?.[0] || null;
        if (pdlPhone) person = { ...person, sanitized_phone: pdlPhone, phone_number: pdlPhone };
        if (!person.email && pdlData?.data?.work_email) person = { ...person, email: pdlData.data.work_email };
      } catch { /* non-blocking */ }
    }
  }

  // Step 2: Web search
  try {
    const name = person.name || `${identifier.first_name || ''} ${identifier.last_name || ''}`.trim();
    const company = person.organization?.name || identifier.company_name || '';
    steps.tavily = await tavilySearch(
      `${name} ${company} ${person.title || ''} professional`,
      { max_results: 5 }
    );
  } catch (err) {
    steps.tavily = { error: err.message };
  }

  // Step 3: AI brief
  try {
    steps.brief = await generateProspectBrief(
      person,
      person.organization || {},
      steps.tavily?.results || []
    );
  } catch (err) {
    steps.brief = { error: err.message };
  }

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
      .filter(([, v]) => v?.error)
      .map(([k, v]) => ({ step: k, error: v.error })),
  };
}

// ── Exports ──────────────────────────────────────────────────

module.exports = {
  // Low-level provider calls
  apolloSearchPeople,
  apolloSearchCompanies,
  apolloSearchOrganizations,
  apolloEnrichPerson,
  apolloEnrichCompany,
  hunterEnrichPeople,
  tavilySearch,
  pdlEnrichPerson,
  pdlEnrichCompany,

  // AI generation
  generateCompanyBrief,
  generateProspectBrief,
  generateOutreachDraft,

  // High-level orchestration
  researchCompany,
  researchProspect,
};
