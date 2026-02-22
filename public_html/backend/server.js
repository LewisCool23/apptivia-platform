require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const rateLimit = require('express-rate-limit');
const crypto = require('crypto');
const { sendEmail, verifyConnection } = require('./emailService');
const engage = require('./engageService');

// Supabase admin client for signal persistence
let _supabaseAdmin = null;
function getSupabaseAdmin() {
  if (!_supabaseAdmin) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return null;
    _supabaseAdmin = createClient(url, key);
  }
  return _supabaseAdmin;
}

const app = express();
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
  methods: ['GET', 'POST'],
}));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));

// ── Authentication middleware ───────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Authentication required' });
  }
  const sb = getSupabaseAdmin();
  if (!sb) {
    // If Supabase admin isn't configured, log a warning but let requests through
    // (avoids locking out dev environments with incomplete config)
    console.warn('[auth] Supabase admin not configured — skipping token verification');
    return next();
  }
  const { data: { user }, error } = await sb.auth.getUser(token);
  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
  req.user = user;
  next();
}

// Apply auth to all /api routes. Status/health endpoints stay public.
app.use('/api', (req, res, next) => {
  const isPublic =
    req.method === 'GET' &&
    (req.path === '/email-status' || req.path === '/engage/status');
  return isPublic ? next() : requireAuth(req, res, next);
});

// ── Rate limiters ──────────────────────────────────────────
// General API: 200 req / 15 min per IP
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: 'Too many requests. Please slow down.' }),
});
app.use('/api', generalLimiter);

// AI endpoints: 20 req / 5 min per authenticated user
const aiLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 20,
  keyGenerator: (req) => req.user?.id || req.ip,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) =>
    res.status(429).json({ error: 'AI request limit reached. Please wait a few minutes.' }),
});

// ── Role-based authorization ───────────────────────────────
const ROLE_LEVEL = { admin: 4, manager: 3, coach: 2, power_user: 1 };

function normalizeRole(role) {
  if (!role) return 'power_user';
  const r = String(role).trim().toLowerCase();
  if (r === 'admin' || r === 'administrator') return 'admin';
  if (r === 'manager') return 'manager';
  if (r === 'coach') return 'coach';
  return 'power_user';
}

// Fetches the caller's profile and attaches it as req.userProfile
async function loadProfile(req, res, next) {
  if (!req.user?.id) return res.status(401).json({ error: 'Authentication required' });
  const sb = getSupabaseAdmin();
  if (!sb) {
    // Dev mode — skip role enforcement
    req.userProfile = { role: 'admin', organization_id: null };
    return next();
  }
  const { data, error } = await sb
    .from('profiles')
    .select('role, organization_id')
    .eq('id', req.user.id)
    .single();
  if (error || !data) return res.status(403).json({ error: 'User profile not found' });
  req.userProfile = data;
  next();
}

// Middleware factory: blocks callers below the required role level
function requireMinRole(minRole) {
  return (req, res, next) => {
    const role = normalizeRole(req.userProfile?.role);
    if ((ROLE_LEVEL[role] || 0) < (ROLE_LEVEL[minRole] || 0)) {
      return res.status(403).json({ error: `This action requires ${minRole} access or higher.` });
    }
    next();
  };
}

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: process.env.CORS_ORIGIN || 'http://localhost:3001',
    methods: ['GET', 'POST']
  }
});

// Anthropic client (lazy init)
let anthropic = null;
function getAnthropic() {
  if (!anthropic) {
    const key = process.env.ANTHROPIC_API_KEY;
    if (!key) throw new Error('ANTHROPIC_API_KEY is not configured in .env');
    anthropic = new Anthropic({ apiKey: key });
  }
  return anthropic;
}

// AI Draft endpoint for coaching plan fields (coach+ access, AI rate limited)
app.post('/api/ai-draft', aiLimiter, loadProfile, requireMinRole('coach'), async (req, res) => {
  try {
    const { field, planName, focusKpis, existingGoals, existingActions, existingMetrics, notes } = req.body || {};
    if (!field) return res.status(400).json({ error: 'field is required' });

    const kpiList = (focusKpis || []).filter(Boolean).map(k => k.replace(/_/g, ' ')).join(', ');

    const contextParts = [
      `You are an expert sales coaching assistant for Apptivia, a sales performance platform.`,
      planName ? `The coaching plan is called: "${planName}"` : '',
      kpiList ? `Focus KPIs: ${kpiList}` : '',
      existingGoals?.length ? `Existing goals: ${existingGoals.join('; ')}` : '',
      existingActions?.length ? `Existing action items: ${existingActions.join('; ')}` : '',
      existingMetrics?.length ? `Existing success metrics: ${existingMetrics.join('; ')}` : '',
      notes ? `Manager notes: ${notes}` : '',
    ].filter(Boolean).join('\n');

    const fieldPrompts = {
      goals: 'Generate 1-3 specific, measurable coaching goals for a sales rep. Each goal should be achievable within 1-2 weeks. Return ONLY the goals as a JSON array of strings, no other text.',
      action_items: 'Generate 3-5 specific, actionable coaching action items for a sales rep. Be prescriptive with daily/weekly activities. Return ONLY the action items as a JSON array of strings, no other text.',
      success_metrics: 'Generate 2-4 measurable success metrics to track coaching plan effectiveness. Include specific numbers/percentages where possible. Return ONLY the metrics as a JSON array of strings, no other text.',
      notes: 'Write a brief 2-3 sentence coaching note from a manager to a sales rep, providing context and encouragement for this coaching plan. Return ONLY the note text, no JSON wrapping.',
      name: 'Suggest a short, descriptive coaching plan name (3-6 words) based on the context. Return ONLY the plan name text, no quotes or JSON.',
    };

    const prompt = fieldPrompts[field];
    if (!prompt) return res.status(400).json({ error: `Unknown field: ${field}` });

    const client = getAnthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 512,
      messages: [
        { role: 'user', content: `${contextParts}\n\n${prompt}` }
      ]
    });

    const text = message.content[0]?.text || '';

    // Parse response based on field type
    if (field === 'notes' || field === 'name') {
      return res.json({ result: text.trim() });
    }

    // For array fields, parse JSON
    try {
      const parsed = JSON.parse(text);
      if (Array.isArray(parsed)) {
        return res.json({ result: parsed });
      }
    } catch (_) {
      // Fallback: split by newlines and clean up
      const lines = text.split('\n').map(l => l.replace(/^[\d\-\*\.\)]+\s*/, '').trim()).filter(Boolean);
      return res.json({ result: lines });
    }

    return res.json({ result: text.trim() });
  } catch (err) {
    console.error('AI draft error:', err);
    return res.status(500).json({ error: err.message || 'AI draft failed' });
  }
});

// Example route
app.get('/', (req, res) => {
  res.send('Apptivia Backend Running');
});

app.post('/api/send-coaching-plan', async (req, res) => {
  try {
    const { recipients, subject, body } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required.' });
    }
    if (recipients.length > 50) return res.status(400).json({ error: 'Maximum 50 recipients per email.' });
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required.' });
    }
    if (typeof subject !== 'string' || subject.length > 500) return res.status(400).json({ error: 'Invalid subject.' });

    const result = await sendEmail({ recipients, subject, text: body });
    console.log('Coaching plan email sent:', result.messageId);
    return res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error('Email send failed:', err.message, err.code || '', err.responseCode || '');
    return res.status(500).json({ 
      error: 'Failed to send coaching plan email.',
      detail: err.message,
      code: err.code || err.responseCode || undefined
    });
  }
});

app.post('/api/send-contest-results', async (req, res) => {
  try {
    const { recipients, subject, body } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required.' });
    }
    if (recipients.length > 50) return res.status(400).json({ error: 'Maximum 50 recipients per email.' });
    if (!subject || !body) {
      return res.status(400).json({ error: 'Subject and body are required.' });
    }

    const result = await sendEmail({ recipients, subject, text: body });
    console.log('Contest results email sent:', result.messageId);
    return res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error('Contest results email failed:', err.message, err.code || '', err.responseCode || '');
    return res.status(500).json({ 
      error: 'Failed to send contest results email.',
      detail: err.message,
      code: err.code || err.responseCode || undefined
    });
  }
});

app.post('/api/send-snapshot', async (req, res) => {
  try {
    const { recipients, subject, html, text } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required.' });
    }
    if (recipients.length > 50) return res.status(400).json({ error: 'Maximum 50 recipients per email.' });
    if (!subject || (!html && !text)) {
      return res.status(400).json({ error: 'Subject and content are required.' });
    }

    const result = await sendEmail({ recipients, subject, html, text });
    console.log('Snapshot email sent:', result.messageId);
    return res.json({ ok: true, messageId: result.messageId });
  } catch (err) {
    console.error('Snapshot email failed:', err.message, err.code || '', err.responseCode || '');
    return res.status(500).json({ 
      error: 'Failed to send snapshot email.',
      detail: err.message,
      code: err.code || err.responseCode || undefined
    });
  }
});

// Health check for email service
app.get('/api/email-status', async (req, res) => {
  try {
    const isConnected = await verifyConnection();
    return res.json({ ok: isConnected, smtp_host: process.env.SMTP_HOST || 'not configured' });
  } catch (err) {
    return res.json({ ok: false, error: err.message });
  }
});

// ── Apptivia Engage API Routes ─────────────────────────────

// Search prospects via Apollo
app.post('/api/engage/search/prospects', async (req, res) => {
  try {
    const data = await engage.apolloSearchPeople(req.body);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Engage prospect search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Search companies via Apollo
app.post('/api/engage/search/companies', async (req, res) => {
  try {
    const data = await engage.apolloSearchCompanies(req.body);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Engage company search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Full company research pipeline (enrich + web search + AI brief)
app.post('/api/engage/research/company', aiLimiter, async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain is required' });
    const result = await engage.researchCompany(domain);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Engage company research error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Full prospect research pipeline
app.post('/api/engage/research/prospect', aiLimiter, async (req, res) => {
  try {
    const result = await engage.researchProspect(req.body);
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Engage prospect research error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Generate AI outreach draft
app.post('/api/engage/outreach/draft', aiLimiter, async (req, res) => {
  try {
    const { prospect, company_brief, channel, tone } = req.body;
    if (!prospect) return res.status(400).json({ error: 'prospect data is required' });
    const result = await engage.generateOutreachDraft(prospect, company_brief || {}, { channel, tone });
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('Engage outreach draft error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// AI web search (general purpose)
app.post('/api/engage/search/web', async (req, res) => {
  try {
    const { query, max_results, depth } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const data = await engage.tavilySearch(query, { max_results, depth });
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Engage web search error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Engage health check — which providers are configured
app.get('/api/engage/status', (req, res) => {
  return res.json({
    ok: true,
    providers: {
      apollo: !!process.env.APOLLO_API_KEY,
      tavily: !!process.env.TAVILY_API_KEY,
      pdl: !!process.env.PDL_API_KEY,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
    },
  });
});

// ── Phase 1 Workflow Routes ─────────────────────────────────

// Pipeline Operator — AI Forecast Generation (streaming SSE, coach+ access, AI rate limited)
app.post('/api/engage/pipeline/forecast', aiLimiter, loadProfile, requireMinRole('coach'), async (req, res) => {
  try {
    const { deals, summary } = req.body;
    if (!deals || !summary) return res.status(400).json({ error: 'deals and summary are required' });
    if (!Array.isArray(deals) || deals.length > 200) return res.status(400).json({ error: 'deals must be an array of max 200 items' });

    const client = getAnthropic();
    const systemPrompt = `You are a senior sales operations analyst embedded in Apptivia, a sales performance platform.
Given a pipeline snapshot, produce a concise but actionable forecast.

Structure your response as:

**Pipeline Health Summary**
A 2-3 sentence overview of the current pipeline state.

**High Probability Deals (Likely to Close This Month)**
List deals most likely to close, with brief reasoning.

**At-Risk Deals (Action Required)**
List at-risk deals (inactive >7 days, high value) with specific recommended actions.

**Deals Likely to Slip to Next Quarter**
List deals that may roll, with reasoning.

**Forecast Confidence**
Your confidence level (High/Medium/Low) with a brief explanation.

Be direct, data-driven, and specific. Reference deal names and values. Keep the total response under 500 words.`;

    const userMessage = `Pipeline Summary:
- Total Pipeline Value: $${summary.totalValue?.toLocaleString()}
- Weighted Value: $${summary.weightedValue?.toLocaleString()}
- Deal Count: ${summary.dealCount}
- At Risk: ${summary.atRiskCount} deals ($${summary.atRiskValue?.toLocaleString()})
- Closing This Month: ${summary.closingThisMonth} deals ($${summary.closingThisMonthValue?.toLocaleString()})
- Commit: $${summary.commitValue?.toLocaleString()}
- Best Case: $${summary.bestCaseValue?.toLocaleString()}

Active Deals:
${deals.map(d => `- ${d.deal_name}: $${d.deal_value?.toLocaleString()} | Stage: ${d.stage} | Prob: ${d.probability}% | Close: ${d.close_date || 'TBD'} | Inactive: ${d.days_inactive}d | Owner: ${d.owner_name} | Forecast: ${d.forecast_category}${d.is_at_risk ? ' ⚠️ AT RISK' : ''}`).join('\n')}`;

    // Set up SSE — stream tokens as they arrive instead of waiting for the full response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    let fullText = '';

    const stream = client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: systemPrompt,
      messages: [{ role: 'user', content: userMessage }],
    });

    stream.on('text', (text) => {
      fullText += text;
      res.write(`data: ${JSON.stringify({ text })}\n\n`);
    });

    stream.on('finalMessage', () => {
      res.write(`data: ${JSON.stringify({ done: true, full: fullText })}\n\n`);
      res.end();
    });

    stream.on('error', (err) => {
      console.error('Pipeline forecast stream error:', err.message);
      res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
      res.end();
    });

    // If client disconnects mid-stream, abort the Claude request
    req.on('close', () => stream.abort());
  } catch (err) {
    console.error('Pipeline forecast error:', err.message);
    // If headers not sent yet, return JSON error; otherwise close the stream
    if (!res.headersSent) {
      return res.status(500).json({ error: err.message });
    }
    res.write(`data: ${JSON.stringify({ error: err.message })}\n\n`);
    res.end();
  }
});

// Signal-Based Prospecting — AI Signal Scan (manager+ access, AI rate limited)
app.post('/api/engage/signals/scan', aiLimiter, loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const { organization_id, user_id, config } = req.body;
    if (!config?.competitors?.length) return res.status(400).json({ error: 'At least one competitor is required' });
    if (config.competitors.length > 5) return res.status(400).json({ error: 'Maximum 5 competitors per scan' });
    for (const c of config.competitors) {
      if (typeof c !== 'string' || c.trim().length === 0 || c.length > 100)
        return res.status(400).json({ error: 'Each competitor name must be a non-empty string under 100 characters' });
    }

    const signals = [];
    const errors = [];

    // Step 1: Run all Tavily searches in parallel (was serial — now ~5x faster)
    const competitorTasks = config.competitors.slice(0, 5).map(async (competitor) => {
      const queries = [
        `"${competitor}" new partnership OR funding OR acquisition 2025 2026`,
        `"${competitor}" hiring VP sales OR head of revenue OR CRO`,
        `"${competitor}" customer complaint OR switching from OR alternative to`,
      ];
      const queryResults = await Promise.all(
        queries.map(async (query) => {
          try {
            return { competitor, query, data: await engage.tavilySearch(query, { max_results: 3, depth: 'basic' }) };
          } catch (err) {
            return { competitor, query, error: err.message };
          }
        })
      );
      return queryResults;
    });

    const allQueryResults = (await Promise.all(competitorTasks)).flat();

    for (const { competitor, query, data, error } of allQueryResults) {
      if (error) { errors.push({ competitor, query, error }); continue; }
      if (!data?.results) continue;
      for (const result of data.results) {
        let signalType = 'competitor_engagement';
        let strength = 'medium';
        let score = 50;

        const text = (result.title + ' ' + (result.content || '')).toLowerCase();
        if (text.includes('funding') || text.includes('raised') || text.includes('series')) {
          signalType = 'funding'; strength = 'high'; score = 75;
        } else if (text.includes('hiring') || text.includes('job') || text.includes('new role')) {
          signalType = 'hiring'; strength = 'medium'; score = 60;
        } else if (text.includes('switch') || text.includes('alternative') || text.includes('complaint') || text.includes('leaving')) {
          signalType = 'competitor_engagement'; strength = 'very_high'; score = 85;
        } else if (text.includes('partnership') || text.includes('acquisition')) {
          signalType = 'tech_adoption'; strength = 'high'; score = 70;
        }

        signals.push({
          organization_id,
          signal_type: signalType,
          signal_strength: strength,
          signal_score: score,
          title: result.title?.substring(0, 200) || 'Untitled Signal',
          description: result.content?.substring(0, 500),
          source_url: result.url,
          source_platform: 'web',
          company_name: competitor,
          detected_at: new Date().toISOString(),
          status: 'new',
          raw_data: { tavily_result: result },
        });
      }
    }

    // Step 2: Enrich top signals with AI analysis (top 10)
    const topSignals = signals.sort((a, b) => b.signal_score - a.signal_score).slice(0, 10);

    if (topSignals.length > 0) {
      try {
        const client = getAnthropic();
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 2000,
          system: `You are an expert sales intelligence analyst. For each intent signal, provide:
1. A brief AI summary (1-2 sentences)
2. A recommended action for the sales team
3. A suggested outreach angle

Return ONLY valid JSON array with objects having keys: ai_summary, ai_recommended_action, ai_outreach_angle`,
          messages: [{
            role: 'user',
            content: `Analyze these ${topSignals.length} intent signals and provide guidance for each:\n${topSignals.map((s, i) => `${i + 1}. [${s.signal_type}] ${s.title}\n   Company: ${s.company_name}\n   ${s.description?.substring(0, 200)}`).join('\n\n')}`,
          }],
        });

        const text = response.content[0]?.text || '[]';
        try {
          const analyses = JSON.parse(text);
          if (Array.isArray(analyses)) {
            analyses.forEach((analysis, i) => {
              if (topSignals[i]) {
                topSignals[i].ai_summary = analysis.ai_summary;
                topSignals[i].ai_recommended_action = analysis.ai_recommended_action;
                topSignals[i].ai_outreach_angle = analysis.ai_outreach_angle;
              }
            });
          }
        } catch { /* AI enrichment is optional */ }
      } catch { /* AI enrichment is optional */ }
    }

    // Step 3: Persist signals to database
    let signalsSaved = 0;
    const savedSignals = [];
    const sb = getSupabaseAdmin();
    if (sb && signals.length > 0) {
      try {
        // Deduplicate by source_url within this org
        const sourceUrls = signals.map(s => s.source_url).filter(Boolean);
        let existingUrls = new Set();
        if (sourceUrls.length > 0) {
          const { data: existing } = await sb
            .from('engage_intent_signals')
            .select('source_url')
            .eq('organization_id', organization_id)
            .in('source_url', sourceUrls);
          existingUrls = new Set((existing || []).map(r => r.source_url));
        }
        const newSignals = signals.filter(s => !s.source_url || !existingUrls.has(s.source_url));
        if (newSignals.length > 0) {
          const { data: inserted, error: insertErr } = await sb
            .from('engage_intent_signals')
            .insert(newSignals)
            .select();
          if (insertErr) {
            console.error('Signal insert error:', insertErr.message);
          } else {
            signalsSaved = inserted?.length || 0;
            savedSignals.push(...(inserted || []));
          }
        }
      } catch (dbErr) {
        console.error('Signal DB persistence error:', dbErr.message);
      }
    }

    return res.json({
      ok: true,
      signals_found: signals.length,
      signals_saved: signalsSaved || signals.length,
      signals: savedSignals.length > 0 ? savedSignals : signals,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (err) {
    console.error('Signal scan error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// KPI Watchdog — AI Analysis for anomalies (manager+ access, AI rate limited)
app.post('/api/engage/watchdog/analyze', aiLimiter, loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const { anomalies } = req.body;
    if (!anomalies?.length) return res.status(400).json({ error: 'anomalies array is required' });
    if (anomalies.length > 50) return res.status(400).json({ error: 'Maximum 50 anomalies per request' });

    const client = getAnthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an expert sales coach in Apptivia, a sales performance platform.
For each KPI anomaly, provide:
1. A brief analysis explaining the likely cause of the drop/spike (1-2 sentences)
2. A specific coaching recommendation the manager should implement (1-2 sentences)

Return ONLY valid JSON array with objects having keys: analysis, recommendation`,
      messages: [{
        role: 'user',
        content: `Analyze these ${anomalies.length} KPI anomalies:\n${anomalies.map((a, i) => 
          `${i + 1}. Rep: ${a.profile_name} | KPI: ${a.kpi_name} | Type: ${a.anomaly_type} | Severity: ${a.severity}\n   Current: ${a.current_value} | Rolling Avg: ${a.rolling_avg} | Deviation: ${a.deviation_pct}%`
        ).join('\n\n')}`,
      }],
    });

    const text = response.content[0]?.text || '[]';
    try {
      const analyses = JSON.parse(text);
      return res.json({ ok: true, analyses: Array.isArray(analyses) ? analyses : [] });
    } catch {
      return res.json({ ok: true, analyses: [] });
    }
  } catch (err) {
    console.error('Watchdog analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Account Intelligence — AI Account Analysis
app.post('/api/engage/accounts/analyze', aiLimiter, async (req, res) => {
  try {
    const { account } = req.body;
    if (!account?.account_name) return res.status(400).json({ error: 'account data is required' });

    const client = getAnthropic();

    // Optionally enrich with web search
    let webContext = '';
    try {
      const searchResults = await engage.tavilySearch(`"${account.account_name}" ${account.domain || ''} company news`, { max_results: 3 });
      if (searchResults?.results?.length) {
        webContext = `\n\nRecent web intelligence:\n${searchResults.results.map(r => `- ${r.title}: ${r.content?.substring(0, 200)}`).join('\n')}`;
      }
    } catch { /* Web enrichment is optional */ }

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1500,
      system: `You are a strategic account analyst for an enterprise sales team.
Analyze the target account and provide actionable intelligence.

Return ONLY valid JSON with these keys:
- summary: 2-3 sentence account overview
- strategy: Recommended engagement strategy (2-3 sentences)
- risk_factors: Array of risk factors (strings)
- opportunities: Array of opportunity areas (strings)
- recommended_tier: "tier_1", "tier_2", or "tier_3"
- intent_score: Estimated intent score (0-100)
- engagement_score: Estimated engagement score (0-100)`,
      messages: [{
        role: 'user',
        content: `Analyze this target account:
Name: ${account.account_name}
Domain: ${account.domain || 'Unknown'}
Industry: ${account.industry || 'Unknown'}
Employee Count: ${account.employee_count || 'Unknown'}
Current Tier: ${account.tier || 'untiered'}
Current Status: ${account.status || 'active'}
Buying Committee: ${account.buying_committee?.length || 0} members mapped
Signals Count: ${account.signals_count || 0}
${webContext}`,
      }],
    });

    const text = response.content[0]?.text || '{}';
    try {
      const analysis = JSON.parse(text);
      return res.json({ ok: true, ...analysis });
    } catch {
      return res.json({ ok: true, summary: text, strategy: '', risk_factors: [], opportunities: [] });
    }
  } catch (err) {
    console.error('Account analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Account Intelligence — Bulk Score Accounts (manager+ access, AI rate limited)
app.post('/api/engage/accounts/score', aiLimiter, loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const { accounts } = req.body;
    if (!accounts?.length) return res.status(400).json({ error: 'accounts array is required' });
    if (accounts.length > 20) return res.status(400).json({ error: 'Maximum 20 accounts per scoring request' });

    const client = getAnthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2000,
      system: `You are an account scoring engine. Score each account on three dimensions (0-100):
- account_score: Overall account quality/fit
- intent_score: Likelihood of purchase intent
- engagement_score: Current engagement level

Consider company size, industry, buying committee coverage, and signal activity.

Return ONLY a valid JSON array with objects having: account_name, account_score, intent_score, engagement_score, recommended_tier ("tier_1"/"tier_2"/"tier_3")`,
      messages: [{
        role: 'user',
        content: `Score these ${accounts.length} accounts:\n${accounts.map((a, i) => 
          `${i + 1}. ${a.account_name} | Domain: ${a.domain || '?'} | Industry: ${a.industry || '?'} | Committee: ${a.buying_committee?.length || 0} | Signals: ${a.signals_count || 0} | Status: ${a.status || 'active'}`
        ).join('\n')}`,
      }],
    });

    const text = response.content[0]?.text || '[]';
    try {
      const scores = JSON.parse(text);
      return res.json({ ok: true, scores: Array.isArray(scores) ? scores : [] });
    } catch {
      return res.json({ ok: true, scores: [] });
    }
  } catch (err) {
    console.error('Account scoring error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Playbook Builder — AI Playbook Generation
app.post('/api/engage/playbooks/generate', aiLimiter, async (req, res) => {
  try {
    const { scenario, target_role, industry } = req.body;
    if (!scenario) return res.status(400).json({ error: 'scenario is required' });

    const client = getAnthropic();
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 2500,
      system: `You are an expert sales strategist who builds structured sales playbooks.
Given a sales scenario, generate a complete playbook with:
- A clear name and description
- An appropriate trigger type (one of: new_lead, signal_detected, deal_stage_change, score_threshold, manual, time_based, account_tier_change)
- 5-8 actionable steps, each with: action (short title), description, expected_output, tool (optional)
- Tags for categorization

Return ONLY valid JSON with keys:
- name: Playbook name
- description: 1-2 sentence description
- trigger_type: One of the trigger types above
- steps: Array of step objects with {action, description, expected_output, tool, condition}
- tags: Array of tag strings
- estimated_duration_days: Number`,
      messages: [{
        role: 'user',
        content: `Generate a sales playbook for this scenario:
${scenario}
${target_role ? `Target role: ${target_role}` : ''}
${industry ? `Industry: ${industry}` : ''}`,
      }],
    });

    const text = response.content[0]?.text || '{}';
    try {
      const playbook = JSON.parse(text);
      return res.json({ ok: true, ...playbook });
    } catch {
      return res.json({ ok: true, name: 'Generated Playbook', description: text, steps: [], tags: [] });
    }
  } catch (err) {
    console.error('Playbook generation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Deal Risk Notifications ───────────────────────────────────────────────
//
// Scans engage_pipeline_deals for inactive high-value deals and fires
// notifications to their owners. Runs automatically once per day and is
// also available as a manual trigger for managers.
//
// Thresholds (configurable via env):
//   DEAL_RISK_DAYS_INACTIVE  – days without activity before flagging (default 7)
//   DEAL_RISK_MIN_VALUE      – minimum deal value to flag (default 0 = all deals)

const DEAL_RISK_DAYS_INACTIVE = parseInt(process.env.DEAL_RISK_DAYS_INACTIVE || '7', 10);
const DEAL_RISK_MIN_VALUE     = parseFloat(process.env.DEAL_RISK_MIN_VALUE   || '0');

async function runDealRiskCheck() {
  const sb = getSupabaseAdmin();
  if (!sb) return { checked: 0, notified: 0 };

  try {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - DEAL_RISK_DAYS_INACTIVE);

    // Find at-risk deals: inactive + value threshold, excluding terminal stages
    const { data: riskyDeals, error } = await sb
      .from('engage_pipeline_deals')
      .select('id, organization_id, owner_id, deal_name, deal_value, stage, last_activity_at')
      .not('stage', 'in', '("closed_won","closed_lost")')
      .or(`last_activity_at.lt.${cutoff.toISOString()},last_activity_at.is.null`)
      .gte('deal_value', DEAL_RISK_MIN_VALUE)
      .not('owner_id', 'is', null);

    if (error) {
      console.error('[deal-risk] Query error:', error.message);
      return { checked: 0, notified: 0 };
    }

    if (!riskyDeals || riskyDeals.length === 0) {
      return { checked: 0, notified: 0 };
    }

    // Current ISO week for dedupe key (prevents re-notifying same deal same week)
    const now = new Date();
    const weekNum = Math.ceil(now.getDate() / 7);
    const weekKey = `${now.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;

    let notified = 0;
    for (const deal of riskyDeals) {
      const daysSince = deal.last_activity_at
        ? Math.floor((Date.now() - new Date(deal.last_activity_at).getTime()) / 86400000)
        : null;

      const dedupeKey = `deal_risk:${deal.id}:${weekKey}`;
      const value = deal.deal_value
        ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(deal.deal_value)
        : null;

      const { error: notifErr } = await sb.from('notifications').insert({
        profile_id:  deal.owner_id,
        type:        'deal_risk',
        title:       'Deal At Risk — No Recent Activity',
        message:     [
          `"${deal.deal_name}"`,
          value ? `(${value})` : '',
          daysSince != null
            ? `has had no activity for ${daysSince} day${daysSince !== 1 ? 's' : ''}.`
            : 'has had no recorded activity.',
          'Update the deal or log a touchpoint to keep it progressing.',
        ].filter(Boolean).join(' '),
        icon:        '⚠️',
        color:       '#f59e0b',
        action_url:  '/engage?tab=pipeline',
        priority:    8,
        dedupe_key:  dedupeKey,
        expires_at:  new Date(Date.now() + 7 * 86400000).toISOString(),
      });

      if (!notifErr) notified++;
    }

    console.log(`[deal-risk] Checked ${riskyDeals.length} at-risk deals, notified ${notified} owners`);
    return { checked: riskyDeals.length, notified };
  } catch (err) {
    console.error('[deal-risk] Error:', err.message);
    return { checked: 0, notified: 0 };
  }
}

// Manual trigger endpoint — managers can call this from the UI
app.post('/api/engage/deals/check-risk', loadProfile, requireMinRole('manager'), async (req, res) => {
  const result = await runDealRiskCheck();
  return res.json({ ...result, message: `Checked ${result.checked} deals, sent ${result.notified} notifications.` });
});

// Auto-run daily (24h interval) — starts 60s after server boots to let DB connections settle
setTimeout(() => {
  runDealRiskCheck();
  setInterval(runDealRiskCheck, 24 * 60 * 60 * 1000);
}, 60 * 1000);

// ── Conversation Intelligence ──────────────────────────────────────────────
app.post('/api/engage/calls/analyze', aiLimiter, loadProfile, requireMinRole('coach'), async (req, res) => {
  try {
    const { notes, contact_name, deal_name } = req.body || {};
    if (!notes || notes.trim().length < 20) {
      return res.status(400).json({ error: 'notes must be at least 20 characters' });
    }

    const client = getAnthropic();
    const contextParts = [
      contact_name ? `Contact: ${contact_name}` : '',
      deal_name    ? `Deal: ${deal_name}`        : '',
    ].filter(Boolean).join('\n');

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: `You are an expert sales conversation analyst. Extract key intelligence from call notes or transcripts.
Return ONLY valid JSON with exactly these keys:
- sentiment: one of "positive", "neutral", "negative"
- deal_stage_signal: one of "advancing", "stalled", "at_risk", "unclear"
- summary: concise 2-3 sentence summary of the call
- next_steps: array of specific, actionable next steps mentioned or implied (up to 5 strings)
- objections: array of prospect objections raised (up to 5 strings, empty array if none)
- competitor_mentions: array of competitor names mentioned (up to 5 strings, empty array if none)`,
      messages: [{
        role: 'user',
        content: `${contextParts ? contextParts + '\n\n' : ''}Call notes:\n${notes.trim()}`,
      }],
    });

    const raw = response.content[0]?.text || '{}';
    let analysis;
    try {
      analysis = JSON.parse(raw);
    } catch (_) {
      // Strip markdown fences if present
      const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
      analysis = JSON.parse(stripped);
    }

    return res.json({ analysis });
  } catch (err) {
    console.error('Call analysis error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Outreach.io Webhook Ingest ─────────────────────────────────────────────
//
// Configure in Outreach: Settings → Webhooks → POST to https://yourhost/api/webhooks/outreach
// Set OUTREACH_WEBHOOK_SECRET in env to enable HMAC-SHA256 signature verification.
//
// Supported events → KPI mapping:
//   prospects.called         → call_connects (+1)
//   calls.completed          → call_connects (+1) + talk_time_minutes (+duration)
//   meetings.booked          → meetings (+1)
//   opportunities.created    → sourced_opps (+1)
//   opportunities.stageChange→ stage2_opps (+1, when new stage is "2" or "Stage 2")
//   email.replied            → sequence_replies (+1)

const OUTREACH_KPI_MAP = {
  'prospects.called':          [{ key: 'call_connects',     increment: 1 }],
  'calls.completed':           [{ key: 'call_connects',     increment: 1 }, { key: 'talk_time_minutes', fromAttr: 'duration' }],
  'meetings.booked':           [{ key: 'meetings',          increment: 1 }],
  'meetings.created':          [{ key: 'meetings',          increment: 1 }],
  'opportunities.created':     [{ key: 'sourced_opps',      increment: 1 }],
  'opportunities.stageChange': [{ key: 'stage2_opps',       increment: 1, condition: 'stage2' }],
  'email.replied':             [{ key: 'sequence_replies',  increment: 1 }],
  'prospects.emailReplied':    [{ key: 'sequence_replies',  increment: 1 }],
};

app.post('/api/webhooks/outreach', async (req, res) => {
  // Always respond 200 quickly so Outreach doesn't retry
  res.status(200).json({ received: true });

  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;

    // ── 1. Signature verification ─────────────────────────────────────────
    const secret = process.env.OUTREACH_WEBHOOK_SECRET;
    if (secret) {
      const sig = req.headers['x-outreach-webhook-signature'] || '';
      const expected = 'sha256=' + crypto
        .createHmac('sha256', secret)
        .update(req.rawBody || JSON.stringify(req.body))
        .digest('hex');
      const sigBuf = Buffer.from(sig.padEnd(expected.length));
      const expBuf = Buffer.from(expected);
      if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
        console.warn('[webhook/outreach] Invalid signature — ignoring event');
        return;
      }
    }

    // ── 2. Parse event ────────────────────────────────────────────────────
    const payload = req.body;
    const eventName = payload?.meta?.eventName || payload?.event || '';
    const eventId   = payload?.meta?.requestId || payload?.id || null;
    const attrs     = payload?.data?.attributes || {};
    const rels      = payload?.data?.relationships || {};

    if (!eventName) return;

    // ── 3. Map event → KPI updates ────────────────────────────────────────
    const kpiUpdates = OUTREACH_KPI_MAP[eventName];
    if (!kpiUpdates || kpiUpdates.length === 0) return;

    // ── 4. Identify the Outreach user → Apptivia profile ─────────────────
    const outreachUserEmail = rels?.owner?.data?.attributes?.email
      || attrs?.userEmail
      || payload?.userEmail
      || null;

    if (!outreachUserEmail) {
      console.warn('[webhook/outreach] No user email in payload for event:', eventName);
      return;
    }

    const { data: profile } = await sb
      .from('profiles')
      .select('id, organization_id')
      .ilike('email', outreachUserEmail)
      .single();

    if (!profile) {
      console.warn('[webhook/outreach] No profile found for email:', outreachUserEmail);
      return;
    }

    // ── 5. Compute current week period (Mon → Sun) ────────────────────────
    const now = new Date();
    const dayOfWeek = now.getUTCDay(); // 0 = Sun
    const daysToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setUTCDate(now.getUTCDate() + daysToMon);
    const periodStart = monday.toISOString().slice(0, 10);
    const sunday = new Date(monday);
    sunday.setUTCDate(monday.getUTCDate() + 6);
    const periodEnd = sunday.toISOString().slice(0, 10);

    // ── 6. Fetch KPI metric IDs ───────────────────────────────────────────
    const kpiKeys = [...new Set(kpiUpdates.map(u => u.key))];
    const { data: metrics } = await sb
      .from('kpi_metrics')
      .select('id, key')
      .in('key', kpiKeys);

    const metricMap = Object.fromEntries((metrics || []).map(m => [m.key, m.id]));

    // ── 7. Check for stage 2 condition ────────────────────────────────────
    const newStage = attrs?.stageName || attrs?.stage || '';
    const isStage2 = /stage\s*2|s2/i.test(newStage) || newStage === '2';

    // ── 8. Insert kpi_values rows (one per KPI, dedup by external_event_id) ──
    const kpisUpdated = [];
    for (const update of kpiUpdates) {
      if (update.condition === 'stage2' && !isStage2) continue;

      const metricId = metricMap[update.key];
      if (!metricId) continue;

      let increment = update.increment || 1;
      if (update.fromAttr === 'duration') {
        // Outreach stores call duration in seconds
        const durationSec = parseInt(attrs?.duration || attrs?.talkTimeSecs || 0, 10);
        if (!durationSec) continue;
        increment = Math.round(durationSec / 60) || 1;
      }

      const externalId = eventId ? `outreach:${eventId}:${update.key}` : null;

      const { error: insertErr } = await sb.from('kpi_values').insert({
        kpi_id:            metricId,
        profile_id:        profile.id,
        value:             increment,
        period_start:      periodStart,
        period_end:        periodEnd,
        source:            'outreach',
        external_event_id: externalId,
      });

      if (insertErr && insertErr.code === '23505') {
        // Unique violation = already processed this event, skip silently
        continue;
      }
      if (insertErr) {
        console.error('[webhook/outreach] Insert error:', insertErr.message);
        continue;
      }
      kpisUpdated.push(update.key);
    }

    // ── 9. Write audit log ────────────────────────────────────────────────
    await sb.from('webhook_events').insert({
      source:          'outreach',
      event_type:      eventName,
      external_id:     eventId,
      organization_id: profile.organization_id,
      profile_id:      profile.id,
      payload:         payload,
      processed:       true,
      kpis_updated:    kpisUpdated,
    });

    if (kpisUpdated.length > 0) {
      console.log(`[webhook/outreach] ${eventName} → KPIs updated: ${kpisUpdated.join(', ')} for ${outreachUserEmail}`);
    }
  } catch (err) {
    console.error('[webhook/outreach] Unhandled error:', err.message);
  }
});

// Socket.io connection and Aaron AI chatbot handling
io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);
  socket.authenticated = false;
  // Conversation history for this socket connection (enables Aaron to remember context)
  socket.chatHistory = [];

  // Handle user joining a room — verifies the Supabase JWT passed by the client
  socket.on('join', async (data) => {
    if (data?.token) {
      try {
        const sb = getSupabaseAdmin();
        if (sb) {
          const { data: { user }, error } = await sb.auth.getUser(data.token);
          if (!error && user) {
            socket.authenticated = true;
            socket.authUser = user;
          }
        } else {
          // No admin client configured (dev) — allow without verification
          socket.authenticated = true;
        }
      } catch (err) {
        console.warn('[socket] Token verification failed:', err.message);
      }
    }
    if (data?.userId) {
      socket.join(`user_${data.userId}`);
      console.log(`User ${data.userName || data.userId} joined (role: ${data.role || 'unknown'}, auth: ${socket.authenticated})`);
    }
  });

  // Handle chat messages from the frontend
  socket.on('chat_message', async (data) => {
    if (!socket.authenticated) {
      socket.emit('aaron_message', { message: 'Please sign in to chat with Aaron.' });
      return;
    }

    const { userId, message, role, permissions, context } = data || {};

    if (!message || !message.trim()) return;

    try {
      // Emit typing indicator
      socket.emit('aaron_typing');

      const client = getAnthropic();
      
      const systemPrompt = `You are Aaron, an AI sales productivity coach embedded in the Apptivia platform. You help sales reps, managers, and admins improve their performance.

Key context:
- User: ${context?.userName || 'User'} (Role: ${role || 'power_user'})
- Current page: ${context?.page || 'unknown'}
- Apptivia features: Scorecard (KPI tracking), Coach (skill development), Contests (sales competitions), Analytics, Badges & Achievements
- Apptivia Levels: Developing → Intermediate → Proficient → Elite → Master (based on cumulative points)
- Skillsets: Conversationalist, Call Conqueror, Email Warrior, Pipeline Guru, Task Master, Scorecard Master

Guidelines:
- Be concise, encouraging, and actionable
- Reference Apptivia features when relevant
- If the user asks about admin/team features they may not have access to, guide them appropriately based on their role
- Never share sensitive data or make up specific performance numbers
- Keep responses under 3-4 sentences unless detail is needed`;

      // Build messages array with conversation history (max last 20 messages = 10 exchanges)
      const historyWindow = socket.chatHistory.slice(-20);
      const response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          ...historyWindow,
          { role: 'user', content: message }
        ]
      });

      const responseText = response.content[0]?.text || "I'm sorry, I couldn't process that. Could you try rephrasing?";

      // Update conversation history for this socket
      socket.chatHistory.push({ role: 'user', content: message });
      socket.chatHistory.push({ role: 'assistant', content: responseText });

      socket.emit('aaron_message', { message: responseText });
    } catch (err) {
      console.error('Aaron AI error:', err.message);
      
      // If Anthropic is not configured, send a helpful fallback
      if (err.message?.includes('ANTHROPIC_API_KEY')) {
        socket.emit('aaron_message', { 
          message: "I'm currently running in limited mode. I can still help you navigate the platform! Ask me about your scorecard, coaching, contests, or any Apptivia feature." 
        });
      } else {
        socket.emit('aaron_message', { 
          message: "I'm having trouble right now. Please try again in a moment!" 
        });
      }
    }
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Verify SMTP connection on startup
  try {
    const emailOk = await verifyConnection();
    if (emailOk) {
      console.log(`✓ Email service connected (SMTP: ${process.env.SMTP_HOST}:${process.env.SMTP_PORT})`);
    } else {
      console.warn('⚠ Email service verification failed — check SMTP configuration');
    }
  } catch (err) {
    console.warn('⚠ Email service not configured:', err.message);
  }
});
