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
const { SONNET_MODEL } = require('./modelConstants');

// ── Anti-AI-Slop Style Rule ──────────────────────────────────
const AI_STYLE_RULE = `\nSTYLE RULE: Write in plain, direct business language. Never use these words or phrases: "delve", "unleash", "game-changer", "transformative", "unlock potential", "leverage" (as a verb), "cutting-edge", "revolutionary", "paradigm shift", "synergy", "elevate", "empower", "holistic", "robust", "seamless", "streamline", "harness". Be specific and concrete — not vague or generic.`;

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

// ── Enrichment Logging ───────────────────────────────────────

/**
 * Non-blocking enrichment log writer.
 * Never throws — a logging failure must never affect the enrichment pipeline.
 */
async function logEnrichment({ supabase, organizationId, domain, prospectEmail, enrichmentType, provider, hit, fieldsFilled = [], errorMessage = null, fromCache = false }) {
  if (!supabase) return; // supabase client is optional — skip if not passed
  try {
    await supabase.from('engage_enrichment_log').insert({
      organization_id: organizationId || null,
      domain:          domain         || null,
      prospect_email:  prospectEmail  || null,
      enrichment_type: enrichmentType,
      provider,
      hit,
      fields_filled:   fieldsFilled,
      error_message:   errorMessage   || null,
      from_cache:      fromCache,
    });
  } catch (err) {
    console.warn('[enrichment_log] write failed:', err.message);
  }
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

async function apolloSearchPeople(filters = {}, opts = {}) {
  const key = opts.apiKeyOverride || env('APOLLO_API_KEY');
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
  const hasWebhook = !!env('APOLLO_WEBHOOK_URL');
  const enrichPromises = people.map(person => {
    const matchBody = {
      reveal_personal_emails: true,
    };
    if (hasWebhook) matchBody.reveal_phone_number = true;
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

async function apolloEnrichPerson(identifier) {
  const key = env('APOLLO_API_KEY');
  if (!key) throw new Error('APOLLO_API_KEY not configured');

  const body = {
    reveal_personal_emails: true,
  };
  if (env('APOLLO_WEBHOOK_URL')) body.reveal_phone_number = true;
  if (typeof identifier === 'string') {
    body.email = identifier;
  } else {
    if (identifier.email) body.email = identifier.email;
    if (identifier.first_name) body.first_name = identifier.first_name;
    if (identifier.last_name) body.last_name = identifier.last_name;
    if (identifier.organization_name) body.organization_name = identifier.organization_name;
    if (identifier.linkedin_url) body.linkedin_url = identifier.linkedin_url;
  }

  return fetchJson(`${APOLLO_BASE}/people/match`, {
    method: 'POST',
    headers: { 'X-Api-Key': key },
    body: JSON.stringify(body),
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

async function generateCompanyBrief(companyData, webResults, icpContext) {
  const client = getAnthropicClient();

  const icpInjection = icpContext ? `\n${icpContext}\n\nUse this ICP profile to assess how well this company fits the ideal customer profile. Mention specific ICP criteria matches in your analysis.\n` : '';

  const systemPrompt = `${icpInjection}You are an expert sales intelligence analyst for Apptivia Engage.
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
}` + AI_STYLE_RULE;

  const userMessage = `Company data:\n${JSON.stringify(companyData, null, 2)}\n\nWeb search results:\n${JSON.stringify(webResults, null, 2)}`;

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: SONNET_MODEL,
    };
  } catch {
    return { content: { summary: text }, tokens_used: 0, model_used: SONNET_MODEL };
  }
}

async function generateProspectBrief(prospectData, companyData, webResults, icpContext) {
  const client = getAnthropicClient();

  const icpInjection = icpContext ? `\n${icpContext}\n\nUse this ICP profile to assess how this prospect's role and company align with the ideal buyer persona. Tailor outreach angles to the ICP pain points.\n` : '';

  const systemPrompt = `${icpInjection}You are an expert sales intelligence analyst for Apptivia Engage.
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
}` + AI_STYLE_RULE;

  const userMessage = `Prospect:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany:\n${JSON.stringify(companyData, null, 2)}\n\nWeb results:\n${JSON.stringify(webResults, null, 2)}`;

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 2000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: SONNET_MODEL,
    };
  } catch {
    return { content: { summary: text }, tokens_used: 0, model_used: SONNET_MODEL };
  }
}

async function generateOutreachDraft(prospectData, companyBrief, options = {}) {
  const client = getAnthropicClient();

  const channel = options.channel || 'email';
  const tone = options.tone || 'professional';
  const salesDna = options.sales_dna || '';
  const icpCtx = options.icp_context || '';

  // If a prompt template was selected, use its prompts with variable substitution
  let systemPrompt, userMessage;

  if (options.template_system_prompt || options.template_user_prompt) {
    const prospectName = prospectData?.name || `${prospectData?.first_name || ''} ${prospectData?.last_name || ''}`.trim() || 'the prospect';
    const companyName = prospectData?.organization?.name || prospectData?.company_name || companyBrief?.company?.name || 'the company';
    const vars = {
      COMPANY: companyName,
      PROSPECT: prospectName,
      SELECTED_ANGLE: options.selected_angle || '',
      TONE: tone,
      CHANNEL: channel,
    };
    const replaceVars = (str) => str.replace(/\{\{(\w+)\}\}/g, (_, k) => vars[k] || '');

    systemPrompt = (options.template_system_prompt
      ? replaceVars(options.template_system_prompt)
      : `You are an expert sales copywriter.`) + '\n\n' +
      `Return ONLY valid JSON. The JSON structure depends on the task.\nIMPORTANT: Do NOT include any email closing, sign-off, or signature in the body — the user\'s signature is appended separately.` +
      (salesDna ? `\n\n${salesDna}\nUse this organization's value propositions, methodology, and terminology in your outreach. Align messaging with their sales approach.` : '') +
      (icpCtx ? `\n\n${icpCtx}\nUse this ICP profile to tailor outreach angles to the prospect's pain points and buyer persona.` : '') +
      AI_STYLE_RULE;

    userMessage = options.template_user_prompt
      ? replaceVars(options.template_user_prompt) +
        `\n\nProspect data:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany brief:\n${JSON.stringify(companyBrief, null, 2)}\n\nTone: ${tone}\nChannel: ${channel}`
      : `Prospect:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany brief:\n${JSON.stringify(companyBrief, null, 2)}\n\nTone: ${tone}\nChannel: ${channel}`;
  } else {
    systemPrompt = `You are an expert sales copywriter for Apptivia Engage.
Write a personalised ${channel} outreach message with a ${tone} tone.

Rules:
- Use specific details from the prospect's profile and company research
- Keep it concise (${channel === 'linkedin' ? '300 chars max for connection request, 1500 for InMail' : '150 words max for email'})
- Include a clear, low-friction CTA
- Do NOT be generic or salesy
- Reference something specific and recent about their company or role
- Do NOT include any email closing, sign-off, or signature (e.g. "Best regards", "Best, [Name]") — the user's signature is appended separately
${salesDna ? `\n${salesDna}\nUse this organization's value propositions, methodology, and terminology in your outreach. Align messaging with their sales approach.` : ''}
${icpCtx ? `\n${icpCtx}\nUse this ICP profile to tailor outreach angles to the prospect's pain points and buyer persona.` : ''}
Return ONLY valid JSON:
{
  "subject": "Email subject line (omit for LinkedIn)",
  "body": "The message body",
  "personalization_points": ["detail 1 used", "detail 2 used"],
  "cta_type": "meeting|resource|question|intro"
}` + AI_STYLE_RULE;

    userMessage = `Prospect:\n${JSON.stringify(prospectData, null, 2)}\n\nCompany brief:\n${JSON.stringify(companyBrief, null, 2)}\n\nTone: ${tone}\nChannel: ${channel}`;
  }

  const response = await client.messages.create({
    model: SONNET_MODEL,
    max_tokens: 1000,
    system: systemPrompt,
    messages: [{ role: 'user', content: userMessage }],
  });

  const text = response.content[0]?.text || '{}';
  try {
    return {
      content: JSON.parse(text),
      tokens_used: response.usage?.input_tokens + response.usage?.output_tokens || 0,
      model_used: SONNET_MODEL,
    };
  } catch {
    return { content: { body: text }, tokens_used: 0, model_used: SONNET_MODEL };
  }
}

// ── Composite Orchestration Functions ────────────────────────

/**
 * Returns an object describing which key company fields are present vs missing.
 * Used to determine enrichment sufficiency and decide whether additional providers are needed.
 *
 * @param {object} company — merged company object (Apollo + any prior enrichment)
 * @returns {{ sufficient: boolean, missing: string[], present: string[] }}
 */
function checkCompanySufficiency(company = {}) {
  const KEY_FIELDS = [
    { key: 'industry',        check: v => !!v },
    { key: 'employee_count',  check: v => v != null },
    { key: 'annual_revenue',  check: v => !!v },
    { key: 'technologies',    check: v => Array.isArray(v) && v.length > 0 },
    { key: 'total_funding',   check: v => v != null },
    { key: 'founded_year',    check: v => v != null },
    { key: 'linkedin_url',    check: v => !!v },
  ];

  const present = [];
  const missing = [];

  for (const { key, check } of KEY_FIELDS) {
    if (check(company[key])) {
      present.push(key);
    } else {
      missing.push(key);
    }
  }

  return {
    sufficient: missing.length === 0,
    missing,
    present,
  };
}

/**
 * Full company research pipeline:
 * 1. Enrich from Apollo
 * 2. AI web search via Tavily
 * 3. Generate AI brief
 */
async function researchCompany(domain, context = {}) {
  const steps = { apollo: null, pdl: null, tavily: null, brief: null };

  // Step 1: Apollo enrichment
  try {
    steps.apollo = await apolloEnrichCompany(domain);
  } catch (err) {
    steps.apollo = { error: err.message };
  }

  await logEnrichment({
    supabase:       context.supabase,
    organizationId: context.organizationId,
    domain,
    enrichmentType: 'company',
    provider:       'apollo',
    hit:            !steps.apollo?.error && !!steps.apollo?.organization,
    fieldsFilled:   steps.apollo?.organization
      ? Object.keys(steps.apollo.organization).filter(k => steps.apollo.organization[k] != null)
      : [],
    errorMessage:   steps.apollo?.error || null,
  });

  // Step 2: PDL company enrichment — always fires as a complement to Apollo
  const apolloOrg = steps.apollo?.organization || {};

  if (process.env.PDL_API_KEY) {
    try {
      steps.pdl = await pdlEnrichCompany(domain);
    } catch (err) {
      steps.pdl = { error: err.message }; // non-blocking
    }
  }

  await logEnrichment({
    supabase:       context.supabase,
    organizationId: context.organizationId,
    domain,
    enrichmentType: 'company',
    provider:       'pdl',
    hit:            !steps.pdl?.error && !!steps.pdl?.data,
    fieldsFilled:   steps.pdl?.data
      ? Object.keys(steps.pdl.data).filter(k => steps.pdl.data[k] != null)
      : [],
    errorMessage:   steps.pdl?.error || null,
  });

  // Merge: Apollo fields take precedence, PDL fills gaps
  const pdlData = steps.pdl?.data || {};
  const mergedCompany = {
    ...apolloOrg,
    industry:        apolloOrg.industry               || pdlData.industry             || null,
    employee_count:  apolloOrg.num_employees          || pdlData.employee_count       || null,
    annual_revenue:  apolloOrg.annual_revenue_printed || pdlData.annual_revenue       || null,
    technologies:    apolloOrg.technologies?.length
                       ? apolloOrg.technologies
                       : (pdlData.technologies || []),
    tech_categories: pdlData.tech_category            || null,
    total_funding:   apolloOrg.total_funding          || pdlData.total_funding_raised || null,
    founded_year:    apolloOrg.founded_year           || pdlData.founded              || null,
    linkedin_url:    apolloOrg.linkedin_url           || pdlData.linkedin_url         || null,
    pdl_enriched:    !!steps.pdl?.data,
  };

  // Step 3: Web search
  try {
    const companyName = mergedCompany.name || domain;
    steps.tavily = await tavilySearch(
      `${companyName} company news funding tech stack ${new Date().getFullYear() - 1} ${new Date().getFullYear()}`,
      { depth: 'advanced', max_results: 8 }
    );
  } catch (err) {
    steps.tavily = { error: err.message };
  }

  // Step 4: AI brief — receives merged Apollo + PDL data + ICP context
  try {
    steps.brief = await generateCompanyBrief(
      mergedCompany,
      steps.tavily?.results || [],
      context.icpContext || null
    );
  } catch (err) {
    steps.brief = { error: err.message };
  }

  return {
    company: mergedCompany,
    sufficiency: checkCompanySufficiency(mergedCompany),
    web_results: steps.tavily?.results || [],
    brief: steps.brief?.content || null,
    tokens_used: steps.brief?.tokens_used || 0,
    data_sources: [
      steps.apollo?.error ? null : 'apollo',
      steps.pdl?.data     ? 'pdl' : null,
      steps.tavily?.error ? null : 'tavily',
      steps.brief?.error  ? null : 'claude',
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
async function researchProspect(identifier, context = {}) {
  const steps = { enrich: null, tavily: null, brief: null };

  // Step 1: Enrich — Apollo for email/name, PDL for LinkedIn
  try {
    if (identifier.email) {
      steps.enrich = await apolloEnrichPerson(identifier);
    } else if (identifier.linkedin_url) {
      steps.enrich = await pdlEnrichPerson({ linkedin_url: identifier.linkedin_url });
    } else if (identifier.first_name && identifier.last_name) {
      steps.enrich = await apolloEnrichPerson(identifier);
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

  // Hunter.io email fallback — runs if email still missing after Apollo + PDL
  if (!person.email && process.env.HUNTER_API_KEY) {
    const domain = person.organization?.primary_domain
      || (person.organization?.website_url || '').replace(/^https?:\/\//, '').split('/')[0]
      || '';
    if (domain && (person.first_name || identifier.first_name)) {
      try {
        const hunterResult = await hunterEnrichPeople(domain, [person]);
        if (hunterResult?.[0]?.email) person = { ...person, email: hunterResult[0].email };
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

  // Step 3: AI brief (with optional ICP context)
  try {
    steps.brief = await generateProspectBrief(
      person,
      person.organization || {},
      steps.tavily?.results || [],
      context.icpContext || null
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

  // Logging & analysis
  logEnrichment,
  checkCompanySufficiency,

  // High-level orchestration
  researchCompany,
  researchProspect,
};
