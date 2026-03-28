require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const socketIo = require('socket.io');
const nodemailer = require('nodemailer');
const Anthropic = require('@anthropic-ai/sdk');
const { createClient } = require('@supabase/supabase-js');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');
const crypto = require('crypto');
const { sendEmail, verifyConnection } = require('./emailService');
const { generateReport, computeNextScheduledAt } = require('./reportTemplates');
const engage = require('./engageService');
const integrations = require('./integrationService');

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
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:3001')
  .split(',').map(o => o.trim());
app.use(cors({
  origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
}));
app.use(express.json({ verify: (req, _res, buf) => { req.rawBody = buf; } }));
app.use(express.urlencoded({ extended: false })); // Twilio webhooks send form-encoded POST data
app.set('trust proxy', 1); // Trust Apache reverse proxy X-Forwarded-For headers

// ── Authentication middleware ───────────────────────────────
async function requireAuth(req, res, next) {
  const authHeader = req.headers['authorization'] || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : (req.query?.token || null);
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
// TwiML webhook is also public — Twilio calls it server-to-server with no user token.
app.use('/api', (req, res, next) => {
  const isPublic =
    (req.method === 'GET' && (req.path === '/email-status' || req.path === '/engage/status')) ||
    (req.method === 'POST' && req.path === '/engage/calls/twiml') ||
    (req.method === 'GET' && req.path.startsWith('/integrations/oauth/') && req.path.endsWith('/callback')) ||
    (req.method === 'POST' && req.path.startsWith('/webhooks/'));
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
  keyGenerator: (req) => req.user?.id || ipKeyGenerator(req),
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

// Convert app-internal role names back to DB enum values (roles_enum).
// Enum values: 'admin', 'manager', 'coach', 'power user' (space, not underscore).
function toDbRole(internalRole) {
  const map = { power_user: 'power user', admin: 'admin', manager: 'manager', coach: 'coach' };
  return map[internalRole] || 'power user';
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
    .select('id, role, organization_id')
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

const fs = require('fs');
const https = require('https');

// Use HTTPS if Let's Encrypt certs exist, otherwise fall back to HTTP
let server;
const certPath = `/etc/letsencrypt/live/${process.env.CERT_DOMAIN || (process.env.CORS_ORIGIN || '').split(',')[0].replace(/^https?:\/\//, '').split(':')[0] || 'apptivia.app'}`;
const keyFile  = `${certPath}/privkey.pem`;
const certFile = `${certPath}/fullchain.pem`;

if (!process.env.NODE_HTTP_ONLY && fs.existsSync(keyFile) && fs.existsSync(certFile)) {
  server = https.createServer({ key: fs.readFileSync(keyFile), cert: fs.readFileSync(certFile) }, app);
  console.log('HTTPS mode: using Let\'s Encrypt certs from', certPath);
} else {
  server = http.createServer(app);
  console.log('HTTP mode (SSL terminated by upstream proxy)');
}
const io = socketIo(server, {
  cors: {
    origin: (origin, cb) => cb(null, !origin || allowedOrigins.includes(origin)),
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

// AI Coaching Plan Generation endpoint
app.post('/api/ai/coaching-plan', aiLimiter, loadProfile, requireMinRole('power_user'), async (req, res) => {
  try {
    const { audienceLabel, currentScore, laggingKpis, onTrackCount, exceedingCount, prioritySkillsets, playbookInsights, mode } = req.body || {};
    const isRepMode = mode === 'rep_self_coaching';

    // Build tier-grouped lagging KPI details for the prompt
    const kpisByTier = {};
    (laggingKpis || []).forEach(k => {
      const tier = k.tier || 4;
      const tierLabel = k.tierLabel || 'Other';
      if (!kpisByTier[tier]) kpisByTier[tier] = { label: tierLabel, kpis: [] };
      kpisByTier[tier].kpis.push(k);
    });

    let laggingDetails = '';
    const tierOrder = [1, 2, 3, 4];
    tierOrder.forEach(t => {
      if (kpisByTier[t]?.kpis.length > 0) {
        laggingDetails += `\n  [${kpisByTier[t].label}]: ${kpisByTier[t].kpis.map(k => `${k.label} (${k.percentage}%)`).join(', ')}`;
      }
    });
    if (!laggingDetails) laggingDetails = 'None';

    const skillsetDetails = (prioritySkillsets || [])
      .map(s => `${s.name}: ${s.progress}% mastery`)
      .join(', ');

    // Build playbook trend context from the 5-week analysis
    const insights = playbookInsights || {};
    let trendContext = '';

    if (insights.teamTrend) {
      const t = insights.teamTrend;
      trendContext += `\n${isRepMode ? 'YOUR' : 'TEAM'} TREND (${t.weeks}-week): ${t.oldest}% → ${t.current}% (${t.delta >= 0 ? '+' : ''}${t.delta}% overall)\n`;
    }

    if (insights.teamWeaknesses?.length > 0) {
      trendContext += `\n${isRepMode ? 'YOUR WEAKEST KPIs' : 'PERSISTENT TEAM WEAKNESSES'} (prioritized by impact tier):\n`;
      insights.teamWeaknesses.forEach(w => {
        const tierTag = w.tierLabel ? `[${w.tierLabel}] ` : '';
        const diagNote = w.diagnosis ? ` — Root cause: ${w.diagnosis}` : '';
        trendContext += isRepMode
          ? `- ${tierTag}${w.label}: ${w.avgPct}% avg attainment${diagNote}\n`
          : `- ${tierTag}${w.label}: ${w.avgPct}% avg, ${w.belowCount}/${w.totalReps} reps below target${diagNote}\n`;
      });
    }

    if (!isRepMode && insights.repsNeedingCoaching?.length > 0) {
      trendContext += '\nREPS NEEDING COACHING (declining or consistently underperforming):\n';
      insights.repsNeedingCoaching.forEach(r => {
        const weakest = r.weakestKpi ? ` | Weakest KPI: ${r.weakestKpi.label} (${r.weakestKpi.pct}%)` : '';
        const peer = r.peerComparison
          ? ` | vs Team Avg: ${r.peerComparison.deltaVsTeam >= 0 ? '+' : ''}${r.peerComparison.deltaVsTeam}%, Top Performer: ${r.peerComparison.topPerformerPct}%`
          : '';
        trendContext += `- ${r.name}: current ${r.recent}%, 5-wk avg ${r.avg5w}%, trend ${r.trendDelta >= 0 ? '+' : ''}${r.trendDelta}%${weakest}${peer}\n`;
      });
    }

    // Build list of valid KPI keys from lagging KPIs for focus_kpis field
    const validKpiKeys = (laggingKpis || []).map(k => k.key || k.label?.toLowerCase().replace(/\s+/g, '_')).filter(Boolean);

    // Build tier priority context for the AI
    let tierPriorityContext = '\n=== KPI PRIORITY TIERS (address in this order) ===\n';
    tierPriorityContext += 'Tier 1 — Scorecard Priority: These are the org\'s designated top KPIs that drive the overall score. Address these FIRST in your goals and action items.\n';
    tierPriorityContext += 'Tier 2 — Core Skills: Pipeline Guru, Task Master, Call Conqueror, Conversationalist KPIs. Address after Tier 1.\n';
    tierPriorityContext += 'Tier 3 — Engage Adoption: Engage Pro tool-adoption KPIs (sequences, signals, research). Address last.\n';

    const promptLines = isRepMode ? [
      'You are a personal AI sales coach for Apptivia, a sales performance platform.',
      'Generate a personalized improvement plan for this sales rep based on their individual performance data and 5-week trends.',
      'Address the rep directly using "you" and "your". Be encouraging but specific.',
      '',
      '=== YOUR CURRENT PERFORMANCE ===',
      `Current Scorecard Score: ${currentScore}%`,
      `Lagging KPIs (below 80%, grouped by priority tier): ${laggingDetails || 'None — great job!'}`,
      `On Track KPIs: ${onTrackCount || 0}`,
      `Exceeding KPIs: ${exceedingCount || 0}`,
      `Skillset Mastery (areas to grow): ${skillsetDetails || 'None'}`,
      '',
      tierPriorityContext,
      '',
      '=== YOUR 5-WEEK TREND ===',
      trendContext || 'No trend data available yet.',
      '',
      validKpiKeys.length > 0 ? `Available KPI keys for focus_kpis (use these exact keys): ${validKpiKeys.join(', ')}` : '',
      '',
      'Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):',
      '{',
      '  "name": "Short improvement plan name (3-6 words)",',
      '  "goals": ["Goal 1", "Goal 2"],',
      '  "focus_kpis": ["kpi_key_1", "kpi_key_2"],',
      '  "action_items": ["Action 1", "Action 2", "Action 3"],',
      '  "success_metrics": ["Metric 1", "Metric 2"],',
      '  "notes": "2-3 sentence encouraging note addressing the rep directly"',
      '}',
      '',
      'Rules:',
      '- CRITICAL: Prioritize KPIs by tier. Scorecard Priority KPIs MUST be addressed first in goals, focus_kpis, and action_items. Then Core Skills. Then Engage Adoption.',
      '- goals: 1-3 specific, achievable goals for this week — Tier 1 KPIs should dominate if any are lagging',
      '- focus_kpis: 2-3 KPI keys from the available list, prioritized by tier (Scorecard Priority first)',
      '- action_items: 3-5 specific daily actions. Be highly prescriptive: include specific quantities, time blocks, and techniques. Reference the root cause diagnosis when available.',
      '- success_metrics: 2-3 measurable targets with specific numbers based on current attainment and realistic improvement targets',
      '- notes: Address the rep directly. Reference their trend data and the specific tier of KPIs they need to focus on. Be motivating and specific.',
      '- Focus on what the rep can CONTROL — daily habits, call blocks, outreach cadence.',
      '- Base recommendations on TREND data, not just this week\'s snapshot.',
    ] : [
      'You are an expert sales coaching assistant for Apptivia, a sales performance platform.',
      'Generate a structured coaching plan based on the following team data and 5-week trend analysis.',
      '',
      '=== CURRENT SNAPSHOT ===',
      `Audience: ${audienceLabel || 'Team'}`,
      `Current Scorecard Score: ${currentScore}%`,
      `Lagging KPIs (below 80%, grouped by priority tier): ${laggingDetails || 'None'}`,
      `On Track KPIs: ${onTrackCount || 0}`,
      `Exceeding KPIs: ${exceedingCount || 0}`,
      `Priority Skillsets (lowest mastery): ${skillsetDetails || 'None'}`,
      '',
      tierPriorityContext,
      '',
      '=== 5-WEEK TREND ANALYSIS (from Manager Coaching Playbook) ===',
      trendContext || 'No trend data available yet.',
      '',
      validKpiKeys.length > 0 ? `Available KPI keys for focus_kpis (use these exact keys): ${validKpiKeys.join(', ')}` : '',
      '',
      'Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):',
      '{',
      '  "name": "Short plan name (3-6 words)",',
      '  "goals": ["Goal 1", "Goal 2", "Goal 3"],',
      '  "focus_kpis": ["kpi_key_1", "kpi_key_2"],',
      '  "action_items": ["Action 1", "Action 2", "Action 3", "Action 4", "Action 5"],',
      '  "success_metrics": ["Metric 1", "Metric 2", "Metric 3"],',
      '  "notes": "2-3 sentence coaching note with encouragement and context"',
      '}',
      '',
      'Rules:',
      '- CRITICAL: Prioritize KPIs by tier. Scorecard Priority KPIs MUST be addressed first in goals, focus_kpis, and action_items. Then Core Skill KPIs. Then Engage Adoption KPIs.',
      '- goals: 1-3 specific, measurable goals achievable in 1-2 weeks — lead with Tier 1 (Scorecard Priority) KPI improvements',
      '- focus_kpis: 2-4 KPI keys from the available list, ordered by tier priority (Scorecard Priority first)',
      '- action_items: 3-5 prescriptive daily/weekly coaching activities. Be highly specific: include quantities, time blocks, meeting formats, and coaching techniques. Reference root cause diagnoses provided above.',
      '- success_metrics: 2-4 measurable metrics with specific numbers and timelines based on current attainment data',
      '- notes: Reference specific trends, tier priorities, and data points. Explain WHY certain KPIs are prioritized. Be encouraging but data-driven.',
      '- Base recommendations on TREND data, not just this week\'s snapshot.',
      '- Be specific with numbers, timelines, and coaching meeting cadences.',
    ];

    const prompt = promptLines.filter(Boolean).join('\n');

    const client = getAnthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = (message.content[0]?.text || '').trim();
    // Strip markdown code fences if present
    text = text.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

    try {
      const parsed = JSON.parse(text);
      const plan = {
        name: parsed.name || 'AI Coaching Plan',
        goals: Array.isArray(parsed.goals) ? parsed.goals : [''],
        focus_kpis: Array.isArray(parsed.focus_kpis) ? parsed.focus_kpis : validKpiKeys.slice(0, 3),
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [''],
        success_metrics: Array.isArray(parsed.success_metrics) ? parsed.success_metrics : [''],
        notes: parsed.notes || '',
      };
      return res.json({ plan });
    } catch (parseErr) {
      console.error('Failed to parse AI JSON response, returning raw text:', parseErr);
      // Fallback: return a structured plan with the raw text as notes
      return res.json({
        plan: {
          name: `AI Coaching Plan — ${audienceLabel || 'Team'}`,
          goals: ['Review AI-generated coaching recommendations'],
          focus_kpis: validKpiKeys.slice(0, 3),
          action_items: ['Review the coaching notes below and create specific action items'],
          success_metrics: ['Implement coaching plan within 1 week'],
          notes: text,
        }
      });
    }
  } catch (err) {
    console.error('AI coaching plan error:', err);
    return res.status(500).json({ error: err.message || 'AI coaching plan generation failed' });
  }
});

// ── AI: Generate IDP (Individual Development Plan) ──
app.post('/api/ai/idp-plan', aiLimiter, loadProfile, requireMinRole('power_user'), async (req, res) => {
  try {
    const { repName, repScore, laggingKpis, onTrackCount, exceedingCount, skillsets, planType, periodStart, periodEnd, trendData } = req.body || {};

    // Build KPI context with trend data
    let kpiDetails = '';
    if (laggingKpis?.length > 0) {
      kpiDetails = laggingKpis.map(k => {
        let detail = `${k.label}: ${k.percentage}% attainment (goal: ${k.goal || 'N/A'})`;
        if (k.avg5wPct) detail += ` — 5-week avg: ${k.avg5wPct}%`;
        if (k.trendDelta !== undefined) detail += `, trend: ${k.trendDelta >= 0 ? '+' : ''}${k.trendDelta}%`;
        if (k.tierLabel) detail += ` [${k.tierLabel}]`;
        return detail;
      }).join('\n  ');
    } else {
      kpiDetails = 'No lagging KPIs — rep is performing well across the board.';
    }

    const skillsetDetails = (skillsets || []).map(s => `${s.name}: Level ${s.level}, ${s.xp} XP, ${s.mastery}`).join('\n  ');

    const durationLabel = planType === 'annual' ? '12 months' : planType === 'quarterly' ? '3 months' : 'custom period';

    // Build 5-week trend context
    let trendContext = '';
    if (trendData) {
      trendContext = `\n=== 5-WEEK TREND ANALYSIS ===\n`;
      trendContext += `Overall Trend: ${trendData.oldestScore}% → ${trendData.currentScore}% (${trendData.trendDelta >= 0 ? '+' : ''}${trendData.trendDelta}% over 5 weeks)\n`;
      trendContext += `5-Week Average: ${trendData.avg5w}%\n`;
      if (trendData.weeklyScores?.length > 0) {
        trendContext += `Weekly Scores: ${trendData.weeklyScores.map(w => `${w.week}: ${w.score}%`).join(', ')}\n`;
      }
      if (trendData.trendDelta < -5) {
        trendContext += `⚠ DECLINING PERFORMANCE: Rep has dropped ${Math.abs(trendData.trendDelta)}% over 5 weeks. Focus on reversing this trend.\n`;
      } else if (trendData.trendDelta > 5) {
        trendContext += `✓ IMPROVING: Rep is trending upward (+${trendData.trendDelta}%). Build on this momentum.\n`;
      } else {
        trendContext += `→ STABLE: Score has been relatively flat. Focus on breaking through plateaus.\n`;
      }
    }

    const prompt = [
      'You are an expert sales development coach for Apptivia, a sales performance platform.',
      `Generate a comprehensive Individual Development Plan (IDP) for a sales rep based on their 5-week performance trend data.`,
      '',
      '=== REP PROFILE ===',
      `Name: ${repName || 'Sales Rep'}`,
      `Current Scorecard Score: ${repScore || 'N/A'}%`,
      `On Track KPIs: ${onTrackCount || 0}`,
      `Exceeding KPIs: ${exceedingCount || 0}`,
      `Lagging KPIs (with 5-week trend):\n  ${kpiDetails}`,
      skillsetDetails ? `Skillset Mastery:\n  ${skillsetDetails}` : '',
      trendContext,
      `=== PLAN PARAMETERS ===`,
      `Plan Type: ${planType || 'quarterly'} (${durationLabel})`,
      `Period: ${periodStart || 'TBD'} to ${periodEnd || 'TBD'}`,
      '',
      'Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):',
      '{',
      '  "name": "Short plan name (3-6 words)",',
      '  "description": "2-3 sentence overview of this development plan",',
      '  "career_goals": [{"goal": "Goal description", "timeframe": "Q1 2026"}],',
      '  "development_areas": [{"area": "Area name", "current_level": "beginner|intermediate|proficient|advanced", "target_level": "intermediate|proficient|advanced"}],',
      '  "milestones": [{"title": "Milestone title", "target_date_offset_days": 30, "notes": "Brief description"}],',
      '  "action_items": [{"action": "Specific action", "category": "training|on_the_job|practice|coaching|habit"}],',
      '  "resources": [{"title": "Resource name", "type": "course|book|guide|mentoring|methodology"}],',
      '  "success_criteria": [{"criterion": "Measurable success criterion"}],',
      '  "focus_kpis": ["kpi_key_1", "kpi_key_2"],',
      '  "notes": "2-3 sentence coaching note for the manager"',
      '}',
      '',
      'Rules:',
      '- career_goals: 2-4 specific career development goals with realistic timeframes. Focus on skill gaps and growth opportunities.',
      '- development_areas: 2-4 areas with honest current_level and ambitious but achievable target_level assessments.',
      '- milestones: 4-6 concrete milestones spread across the plan period. Use target_date_offset_days (days from today). Each should be measurable.',
      '- action_items: 4-6 specific, prescriptive actions with appropriate categories (training, on_the_job, practice, coaching, habit).',
      '- resources: 2-4 relevant learning resources. Be specific with names of methodologies, frameworks, or training types.',
      '- success_criteria: 3-5 measurable criteria with specific numbers tied to their KPI data.',
      '- focus_kpis: 2-4 KPI keys that this plan focuses on improving. Use the lagging KPI keys provided.',
      '- CRITICAL: Base recommendations on 5-WEEK TREND DATA, not just the current snapshot. Reference specific trend patterns (improving, declining, flat) when setting goals and milestones.',
      '- If KPIs are declining over 5 weeks, prioritize those in development areas and action items with urgency.',
      '- If KPIs are improving, set stretch goals that build on the momentum.',
      '- Reference the 5-week average vs current score to identify true weak areas vs one-off dips.',
    ].filter(Boolean).join('\n');

    const client = getAnthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = (message.content[0]?.text || '').trim();
    text = text.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

    try {
      const parsed = JSON.parse(text);
      return res.json({ plan: {
        name: parsed.name || 'AI Development Plan',
        description: parsed.description || '',
        career_goals: Array.isArray(parsed.career_goals) ? parsed.career_goals : [],
        development_areas: Array.isArray(parsed.development_areas) ? parsed.development_areas : [],
        milestones: Array.isArray(parsed.milestones) ? parsed.milestones : [],
        action_items: Array.isArray(parsed.action_items) ? parsed.action_items : [],
        resources: Array.isArray(parsed.resources) ? parsed.resources : [],
        success_criteria: Array.isArray(parsed.success_criteria) ? parsed.success_criteria : [],
        focus_kpis: Array.isArray(parsed.focus_kpis) ? parsed.focus_kpis : [],
        notes: parsed.notes || '',
      }});
    } catch (parseErr) {
      console.error('Failed to parse IDP AI JSON:', parseErr);
      return res.json({ plan: {
        name: `Development Plan — ${repName || 'Rep'}`,
        description: text,
        career_goals: [], development_areas: [], milestones: [],
        action_items: [], resources: [], success_criteria: [],
        focus_kpis: (laggingKpis || []).map(k => k.key).filter(Boolean).slice(0, 3),
        notes: 'AI response could not be parsed. Please review the description and create items manually.',
      }});
    }
  } catch (err) {
    console.error('AI IDP plan error:', err);
    return res.status(500).json({ error: err.message || 'AI IDP generation failed' });
  }
});

// ── AI: Generate Performance Review Manager Draft ──
app.post('/api/ai/review-draft', aiLimiter, loadProfile, requireMinRole('power_user'), async (req, res) => {
  try {
    const { repName, reviewType, periodStart, periodEnd, scorecardSummary, kpiAttainment, skillsetProgress, achievementsEarned, badgesEarned, coachingPlansSummary, idpsSummary, selfAssessment, trendData } = req.body || {};

    // Build scorecard context
    let scorecardCtx = 'No scorecard data available.';
    if (scorecardSummary?.length > 0) {
      const avg = Math.round(scorecardSummary.reduce((s, w) => s + w.score, 0) / scorecardSummary.length);
      const trend = scorecardSummary.length >= 2
        ? scorecardSummary[scorecardSummary.length - 1].score - scorecardSummary[0].score
        : 0;
      scorecardCtx = `Average Score: ${avg}% over ${scorecardSummary.length} weeks. Trend: ${trend >= 0 ? '+' : ''}${trend}%.`;
      scorecardCtx += `\nWeekly scores: ${scorecardSummary.map(w => `${w.score}%`).join(', ')}`;
    }

    // Build KPI context
    let kpiCtx = 'No KPI attainment data.';
    if (kpiAttainment?.length > 0) {
      const exceeding = kpiAttainment.filter(k => k.attainment_pct >= 100);
      const lagging = kpiAttainment.filter(k => k.attainment_pct < 80);
      const onTrack = kpiAttainment.filter(k => k.attainment_pct >= 80 && k.attainment_pct < 100);
      kpiCtx = `Exceeding (${exceeding.length}): ${exceeding.map(k => `${k.name || k.key} ${k.attainment_pct}%`).join(', ') || 'None'}`;
      kpiCtx += `\nOn Track (${onTrack.length}): ${onTrack.map(k => `${k.name || k.key} ${k.attainment_pct}%`).join(', ') || 'None'}`;
      kpiCtx += `\nLagging (${lagging.length}): ${lagging.map(k => `${k.name || k.key} ${k.attainment_pct}%`).join(', ') || 'None'}`;
    }

    // Build skills context
    const skillCtx = skillsetProgress?.length > 0
      ? skillsetProgress.map(s => `${(s.skillset_key || '').replace(/_/g, ' ')}: Level ${s.level} (${s.mastery_label})`).join(', ')
      : 'No skillset data';

    // Build achievements context
    const achCtx = achievementsEarned?.length > 0
      ? `${achievementsEarned.length} achievements earned during this period`
      : 'No achievements earned during this period';

    const badgeCtx = badgesEarned?.length > 0
      ? `${badgesEarned.length} badges earned`
      : 'No badges earned';

    // Coaching plans context
    const coachCtx = coachingPlansSummary?.length > 0
      ? coachingPlansSummary.map(p => `${p.name}: ${p.status}`).join(', ')
      : 'No coaching plans during period';

    // Self-assessment context
    let selfCtx = '';
    if (selfAssessment) {
      selfCtx = `\n=== REP SELF-ASSESSMENT ===\n`;
      selfCtx += selfAssessment.rep_self_assessment ? `Overall: ${selfAssessment.rep_self_assessment}\n` : '';
      if (selfAssessment.rep_accomplishments?.length > 0) {
        selfCtx += `Accomplishments: ${selfAssessment.rep_accomplishments.map(a => a.text).join('; ')}\n`;
      }
      if (selfAssessment.rep_challenges?.length > 0) {
        selfCtx += `Challenges: ${selfAssessment.rep_challenges.map(c => c.text).join('; ')}\n`;
      }
      if (selfAssessment.rep_goals_next_period?.length > 0) {
        selfCtx += `Rep Goals: ${selfAssessment.rep_goals_next_period.map(g => g.text).join('; ')}\n`;
      }
    }

    // Build 5-week trend context
    let trendCtx = '';
    if (trendData) {
      trendCtx = `\n=== 5-WEEK TREND ANALYSIS (Most Recent) ===\n`;
      trendCtx += `Overall Score Trend: ${trendData.oldestScore}% → ${trendData.currentScore}% (${trendData.trendDelta >= 0 ? '+' : ''}${trendData.trendDelta}% over 5 weeks)\n`;
      trendCtx += `5-Week Average: ${trendData.avg5w}%\n`;
      if (trendData.weeklyScores?.length > 0) {
        trendCtx += `Weekly Scores: ${trendData.weeklyScores.map(w => `${w.week}: ${w.score}%`).join(', ')}\n`;
      }
      if (trendData.laggingKpis?.length > 0) {
        trendCtx += `Currently Lagging KPIs (with 5-week trend):\n`;
        trendData.laggingKpis.forEach(k => {
          trendCtx += `  - ${k.label}: ${k.percentage}% current, 5-week avg ${k.avg5wPct}%, trend ${k.trendDelta >= 0 ? '+' : ''}${k.trendDelta}% [${k.tierLabel}]\n`;
        });
      }
      if (trendData.trendDelta < -5) {
        trendCtx += `⚠ DECLINING: Performance has dropped significantly over the past 5 weeks.\n`;
      } else if (trendData.trendDelta > 5) {
        trendCtx += `✓ IMPROVING: Rep is on an upward trajectory.\n`;
      }
    }

    const prompt = [
      'You are an expert sales performance reviewer for Apptivia, a sales performance platform.',
      `Generate a comprehensive manager assessment for a ${reviewType === 'annual' ? 'Annual' : 'Mid-Year'} Performance Review.`,
      '',
      '=== REVIEW DETAILS ===',
      `Rep: ${repName || 'Sales Rep'}`,
      `Period: ${periodStart || 'N/A'} to ${periodEnd || 'N/A'}`,
      `Review Type: ${reviewType === 'annual' ? 'Annual Review' : 'Mid-Year Review'}`,
      '',
      '=== HISTORICAL PERFORMANCE DATA (Review Period) ===',
      `Scorecard: ${scorecardCtx}`,
      `KPI Attainment:\n${kpiCtx}`,
      `Skillsets: ${skillCtx}`,
      `Achievements: ${achCtx}`,
      `Badges: ${badgeCtx}`,
      `Coaching Plans: ${coachCtx}`,
      trendCtx,
      selfCtx,
      '',
      'Return a JSON object with this EXACT structure (no markdown, no code fences, just raw JSON):',
      '{',
      '  "manager_summary": "2-4 paragraph overall assessment addressing performance, growth, and areas for development",',
      '  "strengths": ["Strength 1", "Strength 2", "Strength 3"],',
      '  "areas_for_improvement": ["Area 1", "Area 2"],',
      '  "goals_next_period": ["Goal 1", "Goal 2", "Goal 3"],',
      '  "suggested_rating": 3,',
      '  "final_summary": "1-2 sentence concluding summary",',
      '  "comments": "Additional coaching notes"',
      '}',
      '',
      'Rules:',
      '- manager_summary: Write a thorough 2-4 paragraph assessment. Reference specific KPI data, 5-week scorecard trends, and achievements. Be balanced — acknowledge strengths while being honest about areas needing improvement. ALWAYS reference the 5-week trend direction (improving/declining/stable) and specific weekly score changes.',
      '- strengths: 3-5 specific strengths backed by data (e.g., "Consistently exceeds email outreach targets at 120% attainment, with a 5-week upward trend of +8%").',
      '- areas_for_improvement: 2-4 specific, constructive areas. Reference lagging KPIs, their 5-week trends, and skill gaps. Prioritize KPIs that have been declining over 5 weeks.',
      '- goals_next_period: 3-5 specific, measurable goals. Include target numbers based on 5-week averages and realistic improvement expectations.',
      '- suggested_rating: 1-5 based on overall performance. Use BOTH the review period average AND the 5-week trend: <60%=1, 60-70%=2, 70-85%=3, 85-95%=4, >95%=5. Improve rating by 0.5 if 5-week trend is strongly positive (>+10%). Reduce by 0.5 if strongly negative (<-10%). Round to nearest integer.',
      '- If a self-assessment was provided, reference and respond to the rep\'s own reflections in your summary.',
      '- Be professional, constructive, and data-driven. Avoid generic platitudes. Reference specific numbers from the trend data.',
    ].filter(Boolean).join('\n');

    const client = getAnthropic();
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 2000,
      messages: [{ role: 'user', content: prompt }]
    });

    let text = (message.content[0]?.text || '').trim();
    text = text.replace(/^```(?:json|JSON)?\s*\n?/m, '').replace(/\n?```\s*$/m, '').trim();

    try {
      const parsed = JSON.parse(text);
      return res.json({ draft: {
        manager_summary: parsed.manager_summary || '',
        strengths: Array.isArray(parsed.strengths) ? parsed.strengths.map(s => ({ text: s })) : [],
        areas_for_improvement: Array.isArray(parsed.areas_for_improvement) ? parsed.areas_for_improvement.map(s => ({ text: s })) : [],
        goals_next_period: Array.isArray(parsed.goals_next_period) ? parsed.goals_next_period.map(s => ({ text: s })) : [],
        suggested_rating: parsed.suggested_rating || 3,
        final_summary: parsed.final_summary || '',
        comments: parsed.comments || '',
      }});
    } catch (parseErr) {
      console.error('Failed to parse review AI JSON:', parseErr);
      return res.json({ draft: {
        manager_summary: text,
        strengths: [], areas_for_improvement: [],
        goals_next_period: [], suggested_rating: 3,
        final_summary: '', comments: 'AI response could not be parsed. Please review the summary above and edit as needed.',
      }});
    }
  } catch (err) {
    console.error('AI review draft error:', err);
    return res.status(500).json({ error: err.message || 'AI review draft generation failed' });
  }
});

// ── Performance Review — state machine transition ──────────────────────
// Validates the transition, sets timestamps, returns updated review.
app.post('/api/reviews/:id/transition', loadProfile, requireMinRole('power_user'), async (req, res) => {
  try {
    const { id } = req.params;
    const { newStatus, extraData = {} } = req.body || {};
    const userId = req.profile?.id;

    if (!id || !newStatus) return res.status(400).json({ error: 'id and newStatus are required' });

    // Fetch current review
    const { data: review, error: fetchErr } = await supabase
      .from('performance_reviews')
      .select('id, status, profile_id, manager_id, title')
      .eq('id', id)
      .single();
    if (fetchErr || !review) return res.status(404).json({ error: 'Review not found' });

    // Validate state machine
    const transitions = {
      draft:                     { allowed: ['pending_self_assessment'], actor: 'manager' },
      pending_self_assessment:   { allowed: ['self_assessment_submitted'], actor: 'rep' },
      self_assessment_submitted: { allowed: ['manager_review'], actor: 'manager' },
      manager_review:            { allowed: ['finalized'], actor: 'manager' },
      finalized:                 { allowed: ['acknowledged', 'reopened'], actor: null },
      reopened:                  { allowed: ['manager_review'], actor: 'manager' },
      acknowledged:              { allowed: [], actor: null },
    };

    const currentTransition = transitions[review.status];
    if (!currentTransition || !currentTransition.allowed.includes(newStatus)) {
      return res.status(400).json({ error: `Cannot transition from "${review.status}" to "${newStatus}"` });
    }

    // Validate actor
    if (currentTransition.actor === 'manager' && userId !== review.manager_id) {
      return res.status(403).json({ error: 'Only the assigned manager can perform this transition' });
    }
    if (currentTransition.actor === 'rep' && userId !== review.profile_id) {
      return res.status(403).json({ error: 'Only the assigned rep can perform this transition' });
    }
    if (review.status === 'finalized') {
      if (newStatus === 'acknowledged' && userId !== review.profile_id) {
        return res.status(403).json({ error: 'Only the rep can acknowledge' });
      }
      if (newStatus === 'reopened' && userId !== review.manager_id) {
        return res.status(403).json({ error: 'Only the manager can reopen' });
      }
    }

    // Build update payload
    const updates = { status: newStatus, updated_at: new Date().toISOString(), ...extraData };
    if (newStatus === 'pending_self_assessment') updates.sent_for_assessment_at = new Date().toISOString();
    if (newStatus === 'self_assessment_submitted') updates.self_assessment_submitted_at = new Date().toISOString();
    if (newStatus === 'manager_review') updates.manager_review_started_at = new Date().toISOString();
    if (newStatus === 'finalized') updates.finalized_at = new Date().toISOString();
    if (newStatus === 'reopened') updates.reopened_at = new Date().toISOString();
    if (newStatus === 'acknowledged') updates.acknowledged_at = new Date().toISOString();

    const { error: updateErr } = await supabase
      .from('performance_reviews')
      .update(updates)
      .eq('id', id);
    if (updateErr) throw updateErr;

    console.log(`[ReviewTransition] Review ${id}: ${review.status} → ${newStatus} by ${userId}`);

    // Send notifications based on transition
    const reviewTitle = review.title || 'Performance Review';
    try {
      if (newStatus === 'pending_self_assessment') {
        // Notify rep: review is ready for self-assessment
        await supabase.from('notifications').insert({
          profile_id: review.profile_id,
          type: 'coaching_suggestion',
          title: 'Self-Assessment Required',
          message: `Your manager has sent "${reviewTitle}" for your self-assessment. Please complete it at your earliest convenience.`,
          icon: '📝',
          color: '#3b82f6',
          action_url: '/coaching-plans?tab=reviews',
          priority: 8,
          dedupe_key: `review-self-assess-${id}`,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (newStatus === 'self_assessment_submitted') {
        // Notify manager: rep submitted self-assessment
        await supabase.from('notifications').insert({
          profile_id: review.manager_id,
          type: 'general_info',
          title: 'Self-Assessment Submitted',
          message: `A self-assessment has been submitted for "${reviewTitle}". You can now begin your manager review.`,
          icon: '✅',
          color: '#10b981',
          action_url: '/coaching-plans?tab=reviews',
          priority: 7,
          dedupe_key: `review-submitted-${id}`,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (newStatus === 'finalized') {
        // Notify rep: review has been finalized
        await supabase.from('notifications').insert({
          profile_id: review.profile_id,
          type: 'coaching_suggestion',
          title: 'Review Finalized',
          message: `Your performance review "${reviewTitle}" has been finalized by your manager. Please review and acknowledge it.`,
          icon: '📋',
          color: '#8b5cf6',
          action_url: '/coaching-plans?tab=reviews',
          priority: 8,
          dedupe_key: `review-finalized-${id}`,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      } else if (newStatus === 'acknowledged') {
        // Notify manager: rep acknowledged the review
        await supabase.from('notifications').insert({
          profile_id: review.manager_id,
          type: 'general_info',
          title: 'Review Acknowledged',
          message: `The performance review "${reviewTitle}" has been acknowledged by the rep.`,
          icon: '🤝',
          color: '#10b981',
          action_url: '/coaching-plans?tab=reviews',
          priority: 6,
          dedupe_key: `review-ack-${id}`,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });
      }
    } catch (notifErr) {
      console.error('[ReviewTransition] Notification error (non-blocking):', notifErr.message);
    }

    return res.json({ ok: true, previousStatus: review.status, newStatus });
  } catch (err) {
    console.error('Review transition error:', err);
    return res.status(500).json({ error: err.message || 'Transition failed' });
  }
});

// Example route
app.get('/', (req, res) => {
  res.send('Apptivia Backend Running');
});

app.post('/api/send-coaching-plan', async (req, res) => {
  try {
    const { recipients, subject, body, html, text } = req.body || {};
    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Recipients are required.' });
    }
    if (recipients.length > 50) return res.status(400).json({ error: 'Maximum 50 recipients per email.' });
    // backward compat: old callers send `body` (plain text), new callers send `html` + `text`
    const emailText = text || body;
    const emailHtml = html || null;
    if (!subject || (!emailHtml && !emailText)) {
      return res.status(400).json({ error: 'Subject and content are required.' });
    }
    if (typeof subject !== 'string' || subject.length > 500) return res.status(400).json({ error: 'Invalid subject.' });

    const result = await sendEmail({ recipients, subject, text: emailText, html: emailHtml });
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

app.post('/api/contests/refresh-leaderboards', async (req, res) => {
  try {
    const result = await runLeaderboardRefresh();
    return res.json({ ok: true, ...result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
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

// ── Scheduled Reports CRUD ────────────────────────────────

// GET /api/scheduled-reports — list org's reports
app.get('/api/scheduled-reports', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Database unavailable' });
    const orgId = req.userProfile.organization_id;
    if (!orgId) return res.status(400).json({ error: 'No organization found' });

    const { data, error } = await sb
      .from('scheduled_reports')
      .select('*')
      .eq('organization_id', orgId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    res.json({ reports: data || [] });
  } catch (err) {
    console.error('[scheduled-reports:list] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scheduled-reports — create a new scheduled report
app.post('/api/scheduled-reports', loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Database unavailable' });
    const orgId = req.userProfile.organization_id;
    const userId = req.userProfile.id;
    if (!orgId) return res.status(400).json({ error: 'No organization found' });

    const { report_type, frequency, day_of_week, time, recipients, include_charts, include_summary } = req.body;

    // Validate required fields
    if (!report_type || !frequency || !time || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'Missing required fields: report_type, frequency, time, recipients (array)' });
    }

    const validTypes = ['scorecard', 'analytics', 'coach', 'contests', 'team_performance'];
    if (!validTypes.includes(report_type)) {
      return res.status(400).json({ error: `Invalid report_type. Must be one of: ${validTypes.join(', ')}` });
    }

    const validFreqs = ['daily', 'weekly', 'monthly'];
    if (!validFreqs.includes(frequency)) {
      return res.status(400).json({ error: 'Invalid frequency. Must be daily, weekly, or monthly.' });
    }

    if (recipients.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 recipients per report' });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalid = recipients.filter(e => !emailRegex.test(e));
    if (invalid.length > 0) {
      return res.status(400).json({ error: `Invalid emails: ${invalid.join(', ')}` });
    }

    const dedupedRecipients = [...new Set(recipients)];

    const nextAt = computeNextScheduledAt({ frequency, day_of_week });

    const { data, error } = await sb
      .from('scheduled_reports')
      .insert({
        report_type,
        frequency,
        day_of_week: frequency === 'weekly' ? day_of_week : null,
        time,
        recipients: dedupedRecipients,
        include_charts: include_charts !== false,
        include_summary: include_summary !== false,
        active: true,
        organization_id: orgId,
        created_by: userId,
        next_scheduled_at: nextAt,
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`[scheduled-reports:create] Created ${report_type} report for org ${orgId}`);
    res.json({ report: data });
  } catch (err) {
    console.error('[scheduled-reports:create] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/scheduled-reports/:id — update a report
app.patch('/api/scheduled-reports/:id', loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Database unavailable' });
    const orgId = req.userProfile.organization_id;
    const { id } = req.params;

    // Verify ownership
    const { data: existing } = await sb
      .from('scheduled_reports')
      .select('id, organization_id, frequency, day_of_week')
      .eq('id', id)
      .single();

    if (!existing || existing.organization_id !== orgId) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const allowedFields = ['report_type', 'frequency', 'day_of_week', 'time', 'recipients', 'include_charts', 'include_summary', 'active'];
    const updates = {};
    for (const key of allowedFields) {
      if (req.body[key] !== undefined) updates[key] = req.body[key];
    }

    // Validate recipients if provided
    if (updates.recipients) {
      if (!Array.isArray(updates.recipients) || updates.recipients.length === 0) {
        return res.status(400).json({ error: 'recipients must be a non-empty array' });
      }
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      const invalid = updates.recipients.filter(e => !emailRegex.test(e));
      if (invalid.length > 0) {
        return res.status(400).json({ error: `Invalid emails: ${invalid.join(', ')}` });
      }
      updates.recipients = [...new Set(updates.recipients)];
    }

    // Recompute next_scheduled_at if schedule changed or re-activating
    if (updates.frequency || updates.day_of_week || updates.active === true) {
      const freq = updates.frequency || existing.frequency;
      const dow = updates.day_of_week !== undefined ? updates.day_of_week : existing.day_of_week;
      updates.next_scheduled_at = computeNextScheduledAt({ frequency: freq, day_of_week: dow });
    }

    // Clear day_of_week for non-weekly
    if (updates.frequency && updates.frequency !== 'weekly') {
      updates.day_of_week = null;
    }

    const { data, error } = await sb
      .from('scheduled_reports')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    res.json({ report: data });
  } catch (err) {
    console.error('[scheduled-reports:update] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/scheduled-reports/:id — delete a report
app.delete('/api/scheduled-reports/:id', loadProfile, requireMinRole('manager'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Database unavailable' });
    const orgId = req.userProfile.organization_id;
    const { id } = req.params;

    const { data: existing } = await sb
      .from('scheduled_reports')
      .select('id, organization_id')
      .eq('id', id)
      .single();

    if (!existing || existing.organization_id !== orgId) {
      return res.status(404).json({ error: 'Report not found' });
    }

    const { error } = await sb
      .from('scheduled_reports')
      .delete()
      .eq('id', id);

    if (error) throw error;
    res.json({ ok: true });
  } catch (err) {
    console.error('[scheduled-reports:delete] Error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/scheduled-reports/:id/send-now — send immediately (admin only)
app.post('/api/scheduled-reports/:id/send-now', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(500).json({ error: 'Database unavailable' });
    const orgId = req.userProfile.organization_id;
    const { id } = req.params;

    const { data: report } = await sb
      .from('scheduled_reports')
      .select('*')
      .eq('id', id)
      .eq('organization_id', orgId)
      .single();

    if (!report) return res.status(404).json({ error: 'Report not found' });

    const { html, text, subject } = await generateReport(sb, report);
    await sendEmail({ recipients: report.recipients, subject, html, text });

    await sb
      .from('scheduled_reports')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('id', id);

    console.log(`[scheduled-reports:send-now] Sent ${report.report_type} to ${report.recipients.length} recipient(s)`);
    res.json({ ok: true, subject });
  } catch (err) {
    console.error('[scheduled-reports:send-now] Error:', err.message);
    res.status(500).json({ error: err.message });
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

// Find people at a specific company by domain (fallback for engage-research edge fn)
app.post('/api/engage/search/people-at-company', async (req, res) => {
  try {
    const { domain, titles, seniority, per_page } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain is required' });

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

    const filters = {
      domains: [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')],
      titles: titles || DEFAULT_TITLES,
      seniority: seniority || DEFAULT_SENIORITY,
      per_page: Math.min(per_page || 25, 25),
    };

    const data = await engage.apolloSearchPeople(filters);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Engage people-at-company error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Suggested contacts for a company after research (fallback for engage-research edge fn)
app.post('/api/engage/search/suggested-contacts', async (req, res) => {
  try {
    const { domain } = req.body;
    if (!domain) return res.status(400).json({ error: 'domain is required' });

    const SUGGESTION_TITLES = [
      'VP Sales', 'Director of Sales', 'Head of Sales',
      'CRO', 'VP Revenue Operations', 'Sales Manager',
      'Business Development Manager', 'VP Business Development',
    ];

    const filters = {
      domains: [domain.replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/.*$/, '')],
      titles: SUGGESTION_TITLES,
      seniority: ['vp', 'head', 'director', 'manager', 'c_suite'],
      per_page: 5,
    };

    const data = await engage.apolloSearchPeople(filters);
    return res.json({ ok: true, data });
  } catch (err) {
    console.error('Engage suggested-contacts error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Company disambiguation search (fallback for engage-research edge fn)
app.post('/api/engage/search/organizations', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ error: 'query is required' });
    const companies = await engage.apolloSearchOrganizations(query);
    return res.json({ ok: true, companies });
  } catch (err) {
    console.error('Engage organizations search error:', err.message);
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
    if (!organization_id) return res.status(400).json({ error: 'organization_id is required' });
    if (!config) return res.status(400).json({ error: 'config is required' });

    const errors = [];

    // Keys Claude can output — aligned 1:1 with engage_signal_definitions signal_key values.
    // Legacy keys (funding, expansion, etc.) kept at end as validation fallbacks for any
    // existing DB rows but are NOT passed to Claude in the prompt (see SIGNAL_TYPE_CHOICES below).
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
    const SIGNAL_TYPE_CHOICES = VALID_SIGNAL_TYPES.filter(k => ![
      'funding', 'expansion', 'layoffs', 'job_change', 'hiring',
      'review_sentiment', 'icp_job_posting', 'reddit_signal', 'glassdoor_sentiment',
      'website_visit',
    ].includes(k));

    // ── Step 1: Apollo ICP Company Discovery ─────────────────────────────────
    const apolloFilters = { per_page: 25 };

    // Map icp_employee_range "50-5000" → Apollo ranges array
    if (config.icp_employee_range) {
      const [minStr, maxStr] = config.icp_employee_range.split('-').map(s => parseInt(s.trim()) || 0);
      const APOLLO_RANGES = [
        [1,10,'1,10'], [11,20,'11,20'], [21,50,'21,50'], [51,200,'51,200'],
        [201,500,'201,500'], [501,1000,'501,1000'], [1001,2000,'1001,2000'],
        [2001,5000,'2001,5000'], [5001,10000,'5001,10000'], [10001,999999,'10001,'],
      ];
      const ranges = APOLLO_RANGES.filter(([lo, hi]) => hi >= minStr && lo <= maxStr).map(r => r[2]);
      if (ranges.length) apolloFilters.employee_ranges = ranges;
    }

    // Technologies from tech_stack_positive (what buyers use = good fit signal)
    if (config.tech_stack_positive?.length) apolloFilters.technologies = config.tech_stack_positive;

    // Use first solution keyword as company keyword filter
    if (config.solution_keywords?.length)  apolloFilters.keywords  = config.solution_keywords[0];
    if (config.locations?.length)          apolloFilters.locations = config.locations;
    if (config.icp_regions?.length)        apolloFilters.locations = config.icp_regions;

    let companies = [];
    try {
      const apolloResult = await engage.apolloSearchCompanies(apolloFilters);
      companies = (apolloResult?.organizations || apolloResult?.accounts || []).slice(0, 25);
    } catch (apolloErr) {
      errors.push({ step: 'apollo_company_discovery', error: apolloErr.message });
    }

    if (companies.length === 0) {
      return res.json({
        ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: 'No ICP companies found — adjust Apollo filters in your signal config.',
      });
    }

    // ── Step 2: Wipe existing signals for this org ───────────────────────────
    const sb = getSupabaseAdmin();
    if (sb) {
      await sb.from('engage_intent_signals').delete().eq('organization_id', organization_id);
    }

    // ── Step 3: Per-company Tavily queries + SEC Edgar ────────────────────────
    const rawResults = [];

    await Promise.all(companies.map(async (co) => {
      const name   = co.name || co.organization_name || '';
      const domain = (co.website_url || co.primary_domain || '')
        .replace(/^https?:\/\//, '').replace(/\/.*/, '').trim();
      if (!name) return;

      const queries = [
        { q: `"${name}" funding OR raised OR acquisition OR "series A" OR "series B" 2025 2026`, hint: 'funding' },
        { q: `"${name}" "new VP" OR "new CRO" OR "new CEO" OR "appointed" OR "joins as" 2025 2026`, hint: 'leadership_change' },
        { q: `"${name}" layoffs OR restructuring OR "laid off" OR "workforce reduction" 2025 2026`, hint: 'layoffs' },
        { q: `"${name}" "new customer" OR "contract award" OR "selected by" OR "signs with" 2025 2026`, hint: 'contract_win' },
        { q: `"${name}" product launch OR "new feature" OR "general availability" OR partnership 2025 2026`, hint: 'product_launch' },
        { q: `"${name}" hiring OR "job opening" OR "we're hiring" site:linkedin.com OR site:greenhouse.io 2025 2026`, hint: 'icp_job_posting' },
        // G2 reviews (dedicated query — separated from competitor_complaint)
        { q: `"${name}" site:g2.com review OR reviews OR "star rating" OR "easy to use" OR "lacks"`, hint: 'g2_review' },
        // Reddit subtypes (three focused queries replacing old combined one)
        { q: `"${name}" site:reddit.com "looking for" OR "recommend" OR "best tool" OR "switching to" OR "should I buy"`, hint: 'reddit_buying_intent' },
        { q: `"${name}" site:reddit.com "frustrated with" OR "hate" OR "leaving" OR "switching from" OR "canceling" OR "churn"`, hint: 'reddit_churn_risk' },
        { q: `"${name}" site:reddit.com competitor OR "vs " OR "alternative to" OR "compared to"`, hint: 'reddit_competitor_mention' },
        // Product Hunt
        { q: `"${name}" site:producthunt.com OR "Product Hunt" launch 2025 2026`, hint: 'product_hunt_launch' },
        // Hiring velocity — surge/acceleration signal
        { q: `"${name}" "scaling team" OR "rapid growth" OR "aggressively hiring" OR "50 new roles" hiring 2025 2026`, hint: 'hiring_velocity' },
        // Department-level expansion
        { q: `"${name}" "expanding sales team" OR "building out marketing" OR "growing engineering" OR "VP of" 2025 2026`, hint: 'dept_expansion' },
        // Capterra reviews
        { q: `"${name}" site:capterra.com review OR reviews OR "star rating" OR "easy to use" OR "lacks"`, hint: 'capterra_review' },
        // Glassdoor — employee sentiment with subtype classification
        { q: `"${name}" site:glassdoor.com reviews OR "management" OR "leadership" OR "culture" OR "rating"`, hint: 'glassdoor_leadership_concern' },
      ];

      await Promise.all(queries.map(async ({ q, hint }) => {
        try {
          const data = await engage.tavilySearch(q, { max_results: 3, depth: 'basic' });
          (data?.results || []).forEach(r =>
            rawResults.push({ title: r.title, content: r.content, url: r.url, hint, company: name, domain })
          );
        } catch (err) {
          errors.push({ company: name, query: q.substring(0, 60), error: err.message });
        }
      }));

      // SEC Edgar — expanded to 8-K, 10-Q, 10-K, 20-F (best-effort, free API)
      try {
        const secUrl = `https://efts.sec.gov/LATEST/search-index?q=${encodeURIComponent(`"${name}"`)}&dateRange=custom&startdt=2024-01-01&forms=8-K,10-Q,10-K,20-F`;
        const secResp = await fetch(secUrl, { signal: AbortSignal.timeout(8000) });
        if (secResp.ok) {
          const secData = await secResp.json();
          (secData?.hits?.hits || []).slice(0, 3).forEach(hit => {
            const s = hit._source || {};
            const formType = s.form_type || '8-K';
            const formContext = formType === '10-K'
              ? 'Annual report — review for AI investment, acquisitions, restructuring, or strategic initiatives.'
              : formType === '20-F'
              ? 'Foreign private issuer annual report — signals international expansion or major capital deployment.'
              : formType === '10-Q'
              ? 'Quarterly report — check for material changes, litigation, restructuring, or revenue impact.'
              : 'Form 8-K — immediate event disclosure: M&A, leadership change, financing, or major contract.';
            rawResults.push({
              title: `${name} — SEC ${formType} Filing (${s.display_date_filed || ''})`,
              content: `${name} filed a ${formType} with the SEC on ${s.display_date_filed || 'recent date'}. ${formContext}`,
              url: `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&company=${encodeURIComponent(name)}&type=${formType}`,
              hint: 'sec_filing', company: name, domain,
              sec_form_type: formType,
            });
          });
        }
      } catch { /* SEC is best-effort */ }
    }));

    if (rawResults.length === 0) {
      return res.json({
        ok: true, signals_found: 0, signals_saved: 0, signals: [], errors,
        message: 'No search results returned. Check Tavily API key.',
      });
    }

    // Deduplicate by URL
    const seenUrls = new Set();
    const dedupedResults = rawResults.filter(r => {
      if (!r.url) return true;
      if (seenUrls.has(r.url)) return false;
      seenUrls.add(r.url);
      return true;
    });

    // ── Step 4: Claude batch-classify — company_name ALWAYS from src.company ──
    let signals = [];
    const BATCH_SIZE = 25;
    const client = getAnthropic();

    for (let i = 0; i < dedupedResults.length; i += BATCH_SIZE) {
      const batch = dedupedResults.slice(i, i + BATCH_SIZE);
      try {
        const response = await client.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 4000,
          system: `You are a B2B sales intelligence analyst. Classify each search result as a buyer intent signal.

Valid signal_types: ${SIGNAL_TYPE_CHOICES.join(', ')}

Disambiguation — use the MOST SPECIFIC type:
- product_hunt_launch: Product Hunt listings ONLY. Use product_launch for all other product announcements.
- sales_leadership_hire: VP Sales / CRO / Head of Sales / Sales Director hires ONLY. Use leadership_change for other C-suite/VP changes. Use executive_departure for departures.
- hiring_velocity: company-wide aggressive hiring surge. Use sales_team_expansion for sales-specific growth. Use headcount_growth for general/moderate growth.
- g2_review: G2 platform only. capterra_review: Capterra only. review_site_activity: all other review platforms.
- funding_round: all VC/angel funding. Use ipo_or_spac for IPO/SPAC specifically. Use private_equity_investment for PE buyouts/majority stakes.
- layoffs_restructuring: workforce reductions. Use cost_reduction_initiative for non-headcount efficiency drives.

For sec_filing signals, also return signal_subtype (one of: acquisition, ai_investment, leadership_change, restructuring, ipo_prep, pe_investment, annual_report, quarterly_report).
For reddit types, also return signal_subtype describing the specific topic (e.g. "seeking CRM alternative", "frustrated with pricing").
For glassdoor signals, also return signal_subtype with a brief description of the specific feedback theme.

ICP pain points — score signals matching these themes 10 points higher:
${config.pain_points?.length ? config.pain_points.slice(0, 8).map(p => `- ${p}`).join('\n') : '(none set)'}

Org competitors — treat any mention of these as competitor_complaint, competitor_engagement, or competitor_comparison:
${config.competitors?.length ? config.competitors.slice(0, 12).join(', ') : '(none set)'}

signal_score (1-100, buyer intent):
90-100: Direct purchase intent or major executive change
75-89: Strong (competitor complaint, funding, leadership change, contract win)
60-74: Moderate (pain point, product launch, significant hiring)
40-59: Weak (press release, general news)
< 40: Omit entirely.

buying_stage_indicator:
- decision: Active purchase intent, comparing specific tools, pricing discussions
- consideration: Evaluating options, pain points, competitor comparisons
- awareness: Early research, general interest

Return ONLY a valid JSON array. Do NOT include a company_name field — it is set from metadata.`,
          messages: [{
            role: 'user',
            content: `Classify these ${batch.length} results. For each return:
{ "index": N, "signal_type": "...", "signal_subtype": "..." (optional — use for sec_filing and reddit types), "signal_strength": "very_high|high|medium|low", "signal_score": 1-100, "buying_stage_indicator": "awareness|consideration|decision|null", "title": "concise title max 100 chars", "description": "sales-relevant context max 300 chars", "ai_summary": "1-2 sentence insight", "ai_recommended_action": "specific rep next action", "ai_outreach_angle": "conversation opener" }

Results:
${batch.map((r, idx) => `[${idx}] COMPANY:${r.company} HINT:${r.hint}\nTITLE: ${(r.title || '').substring(0, 150)}\nCONTENT: ${(r.content || '').substring(0, 300)}\nURL: ${r.url}`).join('\n\n')}`,
          }],
        });

        const raw = response.content[0]?.text || '[]';
        const cleaned = raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
        try {
          const analyses = JSON.parse(cleaned);
          if (Array.isArray(analyses)) {
            for (const a of analyses) {
              const src = batch[a.index];
              if (!src) continue;
              signals.push({
                organization_id,
                signal_type: VALID_SIGNAL_TYPES.includes(a.signal_type) ? a.signal_type : (src.hint || 'competitor_engagement'),
                signal_strength: ['very_high', 'high', 'medium', 'low'].includes(a.signal_strength) ? a.signal_strength : 'medium',
                signal_score: Math.max(1, Math.min(100, parseInt(a.signal_score) || 50)),
                buying_stage_indicator: ['awareness', 'consideration', 'decision'].includes(a.buying_stage_indicator) ? a.buying_stage_indicator : null,
                title: (a.title || src.title || 'Untitled Signal').substring(0, 200),
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
                // company_name is ALWAYS from the Apollo-discovered company, never from Claude
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
        } catch (parseErr) {
          console.error('Claude parse error:', parseErr.message, raw.substring(0, 200));
        }
      } catch (err) {
        errors.push({ step: 'claude_classification', error: err.message });
      }
    }

    // Filter signals below threshold
    signals = signals.filter(s => s.signal_score >= 40);

    // ── Step 5: Contact discovery per company ────────────────────────────────
    const signalCompanies = [...new Set(signals.map(s => s.company_name).filter(Boolean))];
    const companyDomainMap = {};
    rawResults.forEach(r => { if (r.company && r.domain) companyDomainMap[r.company] = r.domain; });

    const contactMap = {}; // company_name → contacts[]
    await Promise.all(signalCompanies.map(async (compName) => {
      const domain = companyDomainMap[compName];
      if (!domain) return;
      try {
        const peopleFilters = { domains: [domain], per_page: 5 };
        if (config.job_titles_to_track?.length) peopleFilters.titles = config.job_titles_to_track;
        if (config.seniority?.length)           peopleFilters.seniority = config.seniority;
        const result = await engage.apolloSearchPeople(peopleFilters);
        const contacts = (result?.people || []).map(p => ({
          name:         [p.first_name, p.last_name].filter(Boolean).join(' '),
          title:        p.title || null,
          email:        p.email || null,
          linkedin_url: p.linkedin_url || null,
          company:      compName,
        })).filter(c => c.name);
        if (contacts.length > 0) contactMap[compName] = contacts;
      } catch (err) {
        errors.push({ step: 'contact_discovery', company: compName, error: err.message });
      }
    }));

    // Attach contacts to each signal
    signals = signals.map(s => ({
      ...s,
      raw_data: { ...s.raw_data, suggested_contacts: contactMap[s.company_name] || [] },
    }));

    // ── Step 6: Persist to database ──────────────────────────────────────────
    let signalsSaved = 0;
    const savedSignals = [];
    if (sb && signals.length > 0) {
      try {
        // Replace previous scan results — delete all existing signals for this org first.
        // This matches the edge function behavior and prevents accumulation across repeated scans.
        await sb.from('engage_intent_signals').delete().eq('organization_id', organization_id);

        // Pre-filter: remove any signals whose source_url already exists (safety net for
        // concurrent inserts — the unique index on migration 049 is the DB-level guard).
        const signalsToInsert = signals;

        const { data: inserted, error: insertErr } = await sb
          .from('engage_intent_signals')
          .insert(signalsToInsert)
          .select();
        if (insertErr) {
          console.error('Signal insert error:', insertErr.message);
          errors.push({ step: 'db_insert', error: insertErr.message });
        } else {
          signalsSaved = inserted?.length || 0;
          savedSignals.push(...(inserted || []));
        }
      } catch (dbErr) {
        console.error('Signal DB persistence error:', dbErr.message);
        errors.push({ step: 'db_persistence', error: dbErr.message });
      }
    }

    return res.json({
      ok: true,
      companies_scanned: companies.length,
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

// ── Autopilot: Cron thresholds (configurable via env) ─────────────────────
const SIGNAL_MIN_SCORE          = parseInt(process.env.SIGNAL_MIN_SCORE           || '30',  10);
const KPI_ANOMALY_WARNING       = parseFloat(process.env.KPI_ANOMALY_WARNING_THRESHOLD || '-30');
const KPI_ANOMALY_CRITICAL      = parseFloat(process.env.KPI_ANOMALY_CRITICAL_THRESHOLD || '-50');
const ACTION_QUEUE_MAX_PER_ORG  = parseInt(process.env.ACTION_QUEUE_MAX_PER_ORG   || '10',  10);

// ── CronManager ────────────────────────────────────────────────────────────
// Lightweight scheduler that replaces the copy-paste setTimeout/setInterval pattern.
// Each job fires once at boot (after initialDelayMs), then on its interval.
const CronManager = {
  _jobs: [],
  register(name, fn, intervalMs, initialDelayMs = 60_000) {
    this._jobs.push({ name, fn, intervalMs, initialDelayMs });
  },
  start() {
    for (const job of this._jobs) {
      setTimeout(async () => {
        console.log(`[cron:${job.name}] Starting initial run`);
        try {
          const result = await job.fn();
          console.log(`[cron:${job.name}] Initial run complete:`, JSON.stringify(result));
        } catch (err) {
          console.error(`[cron:${job.name}] Initial run error:`, err.message);
        }
        setInterval(async () => {
          console.log(`[cron:${job.name}] Scheduled run`);
          try {
            const result = await job.fn();
            console.log(`[cron:${job.name}] Run complete:`, JSON.stringify(result));
          } catch (err) {
            console.error(`[cron:${job.name}] Run error:`, err.message);
          }
        }, job.intervalMs);
      }, job.initialDelayMs);
    }
    console.log(`[cron] CronManager started ${this._jobs.length} jobs`);
  },
};

// ── Helper: ISO week key (used across multiple cron jobs for dedup) ────────
function getWeekKey(date = new Date()) {
  const weekNum = Math.ceil(date.getDate() / 7);
  return `${date.getFullYear()}-W${String(weekNum).padStart(2, '0')}`;
}

// ── Shared: Point-in-time KPI config resolution ────────────────────────────
// Fetches kpi_metric_history rows covering a date range and returns a resolver
// function. This ensures historical scores use the goals/weights that were
// in effect at that time, not the current config.
async function fetchHistoricalConfig(sb, metricIds, rangeStart, rangeEnd) {
  const { data: historyRows } = await sb
    .from('kpi_metric_history')
    .select('kpi_id, goal, weight, direction, valid_from, valid_to')
    .in('kpi_id', metricIds)
    .lte('valid_from', rangeEnd)
    .or(`valid_to.is.null,valid_to.gte.${rangeStart}`);

  // Returns the config (goal, weight, direction) in effect at `atDate` for `kpiId`.
  // Falls back to `fallbackMetrics` (current kpi_metrics rows) if no history found.
  function getConfigAt(kpiId, atDate, fallbackMetrics) {
    const rows = historyRows || [];
    const dt = typeof atDate === 'string' ? new Date(atDate) : atDate;
    const match = rows.find(h =>
      h.kpi_id === kpiId &&
      new Date(h.valid_from) <= dt &&
      (h.valid_to === null || new Date(h.valid_to) > dt)
    );
    if (match) return { goal: match.goal, weight: match.weight, direction: match.direction || 'higher' };
    const fb = (fallbackMetrics || []).find(m => m.id === kpiId);
    return fb ? { goal: fb.goal, weight: fb.weight, direction: fb.direction || 'higher' } : { goal: 1, weight: 1, direction: 'higher' };
  }

  return { historyRows: historyRows || [], getConfigAt };
}

// ── Autopilot: Auto-Qualification ──────────────────────────────────────────
// Called from runSignalScan. Silently dismisses low-quality signals before
// the action queue builder runs.
async function runAutoQualification(orgId) {
  const sb = getSupabaseAdmin();
  if (!sb) return { dismissed: 0 };

  try {
    // Get org's configured competitors list
    const { data: org } = await sb
      .from('organizations')
      .select('signal_config')
      .eq('id', orgId)
      .single();

    const competitors = (org?.signal_config?.competitors || [])
      .map(c => c.toLowerCase().trim())
      .filter(Boolean);

    // Get all 'new' signals for this org
    const { data: signals } = await sb
      .from('engage_intent_signals')
      .select('id, company_name, signal_score')
      .eq('organization_id', orgId)
      .eq('status', 'new');

    if (!signals || signals.length === 0) return { dismissed: 0 };

    const toDismisSids = signals
      .filter(s => {
        const name = (s.company_name || '').toLowerCase();
        const isCompetitor = competitors.some(c => name.includes(c));
        const isTooWeak = (s.signal_score || 0) < SIGNAL_MIN_SCORE;
        return isCompetitor || isTooWeak;
      })
      .map(s => s.id);

    if (toDismisSids.length === 0) return { dismissed: 0 };

    await sb
      .from('engage_intent_signals')
      .update({ status: 'dismissed' })
      .in('id', toDismisSids);

    return { dismissed: toDismisSids.length };
  } catch (err) {
    console.error(`[auto-qualify:${orgId}] Error:`, err.message);
    return { dismissed: 0 };
  }
}

// ── Autopilot: Action Queue Builder ───────────────────────────────────────
// Called from runSignalScan. For high-intent signals, generates AI-drafted
// outreach and queues it for rep approval.
async function runActionQueueBuilder(orgId) {
  const sb = getSupabaseAdmin();
  const ai = getAnthropic();
  if (!sb || !ai) return { queued: 0 };

  try {
    // Find high-intent signals not yet in the action queue
    const { data: signals } = await sb
      .from('engage_intent_signals')
      .select('id, company_name, signal_type, signal_score, buying_stage_indicator, title, description, ai_outreach_angle, ai_recommended_action')
      .eq('organization_id', orgId)
      .eq('status', 'new')
      .gte('signal_score', 75)
      .in('buying_stage_indicator', ['consideration', 'decision'])
      .limit(ACTION_QUEUE_MAX_PER_ORG);

    if (!signals || signals.length === 0) return { queued: 0 };

    // Get existing action queue entries to avoid duplicates
    const signalIds = signals.map(s => s.id);
    const { data: existing } = await sb
      .from('engage_signal_actions')
      .select('signal_id')
      .in('signal_id', signalIds);
    const alreadyQueued = new Set((existing || []).map(e => e.signal_id));

    let queued = 0;
    for (const signal of signals) {
      if (alreadyQueued.has(signal.id)) continue;

      try {
        const context = [
          `Company: ${signal.company_name}`,
          `Signal: ${signal.signal_type.replace(/_/g, ' ')} — ${signal.title}`,
          `Intent Level: ${signal.buying_stage_indicator} (score: ${signal.signal_score}/100)`,
          signal.description ? `Detail: ${signal.description}` : '',
          signal.ai_outreach_angle ? `Outreach Angle: ${signal.ai_outreach_angle}` : '',
        ].filter(Boolean).join('\n');

        const response = await ai.messages.create({
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 800,
          system: `You are a B2B sales outreach specialist. Write concise, personalized outreach based on a buying signal.
Return ONLY valid JSON with exactly these keys:
- email_subject: compelling subject line (under 60 chars)
- email_body: 3-paragraph email (opening hook, value prop, CTA). Under 200 words total.
- linkedin_message: connection request message under 280 characters`,
          messages: [{ role: 'user', content: context }],
        });

        const raw = response.content[0]?.text || '{}';
        let draft;
        try {
          draft = JSON.parse(raw);
        } catch (_) {
          const stripped = raw.replace(/```json?\n?/gi, '').replace(/```/g, '').trim();
          draft = JSON.parse(stripped);
        }

        await sb.from('engage_signal_actions').insert({
          signal_id:              signal.id,
          org_id:                 orgId,
          draft_email_subject:    draft.email_subject || null,
          draft_email_body:       draft.email_body || null,
          draft_linkedin_message: draft.linkedin_message || null,
          outreach_angle:         signal.ai_outreach_angle || null,
          recommended_action:     signal.ai_recommended_action || null,
          status:                 'pending',
        });

        // Move signal to 'reviewed' so it won't re-qualify next run
        await sb
          .from('engage_intent_signals')
          .update({ status: 'reviewed' })
          .eq('id', signal.id);

        queued++;
      } catch (signalErr) {
        console.error(`[action-queue:${orgId}] Failed signal ${signal.id}:`, signalErr.message);
      }
    }

    return { queued };
  } catch (err) {
    console.error(`[action-queue:${orgId}] Error:`, err.message);
    return { queued: 0 };
  }
}

// ── Autopilot: Signal Scan ─────────────────────────────────────────────────
// Weekly. Triggers the engage-signals edge function per org, then
// runs auto-qualification and action queue building.
async function runSignalScan() {
  const sb = getSupabaseAdmin();
  if (!sb) return { orgsScanned: 0, orgsSkipped: 0 };

  try {
    const { data: orgs } = await sb
      .from('organizations')
      .select('id, last_signal_scan_at, signal_config, icp_config');

    if (!orgs || orgs.length === 0) return { orgsScanned: 0, orgsSkipped: 0 };

    const SIX_DAYS_MS = 6 * 24 * 60 * 60 * 1000;
    let orgsScanned = 0, orgsSkipped = 0;

    for (const org of orgs) {
      // Skip if scanned within the last 6 days
      if (org.last_signal_scan_at) {
        const lastScan = new Date(org.last_signal_scan_at).getTime();
        if (Date.now() - lastScan < SIX_DAYS_MS) {
          orgsSkipped++;
          continue;
        }
      }

      try {
        const supabaseUrl = process.env.SUPABASE_URL;
        const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (supabaseUrl && serviceKey) {
          await fetch(`${supabaseUrl}/functions/v1/engage-signals`, {
            method:  'POST',
            headers: {
              'Authorization': `Bearer ${serviceKey}`,
              'Content-Type':  'application/json',
            },
            body: JSON.stringify({
              organization_id: org.id,
              config: {
                ...(org.signal_config || {}),
                ...(org.icp_config   || {}),
              },
            }),
          });
        }

        // Record scan time
        await sb
          .from('organizations')
          .update({ last_signal_scan_at: new Date().toISOString() })
          .eq('id', org.id);

        // Run qualification and queue building
        await runAutoQualification(org.id);
        await runActionQueueBuilder(org.id);

        orgsScanned++;
      } catch (orgErr) {
        console.error(`[signal-scan:${org.id}] Error:`, orgErr.message);
      }
    }

    return { orgsScanned, orgsSkipped };
  } catch (err) {
    console.error('[signal-scan] Error:', err.message);
    return { orgsScanned: 0, orgsSkipped: 0 };
  }
}

// ── Autopilot: Scorecard Alerts ────────────────────────────────────────────
// Weekly. Computes each rep's Apptivia Score and fires manager notifications
// for reps who are under threshold, trending down, or hitting 100%+.
async function runScorecardAlerts() {
  const sb = getSupabaseAdmin();
  if (!sb) return { orgs: 0, notified: 0 };

  try {
    const now          = new Date();
    const weekKey      = getWeekKey(now);
    const currEnd      = now.toISOString().split('T')[0];
    const currStart    = new Date(now.getTime() - 7  * 86400000).toISOString().split('T')[0];
    const priorEnd     = currStart;
    const priorStart   = new Date(now.getTime() - 14 * 86400000).toISOString().split('T')[0];

    // Get scorecard KPI definitions (current config as fallback)
    const { data: metrics } = await sb
      .from('kpi_metrics')
      .select('id, goal, weight, direction')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);

    if (!metrics || metrics.length === 0) return { orgs: 0, notified: 0 };

    const metricIds = metrics.map(m => m.id);

    // Fetch historical config covering both weeks
    const { getConfigAt } = await fetchHistoricalConfig(sb, metricIds, priorStart, currEnd);

    // Get all rep profiles (exclude admin/manager)
    const { data: reps } = await sb
      .from('profiles')
      .select('id, first_name, last_name, team_id, organization_id')
      .not('role', 'in', '("admin","manager","coach")');

    if (!reps || reps.length === 0) return { orgs: 0, notified: 0 };

    // Get team → manager lookup
    const teamIds = [...new Set(reps.map(r => r.team_id).filter(Boolean))];
    const { data: teams } = await sb
      .from('teams')
      .select('id, manager_id')
      .in('id', teamIds);
    const teamManagerMap = Object.fromEntries((teams || []).map(t => [t.id, t.manager_id]));

    const repIds = reps.map(r => r.id);

    // Fetch KPI values for current and prior week
    const [{ data: currValues }, { data: priorValues }] = await Promise.all([
      sb.from('kpi_values').select('kpi_id, profile_id, value')
        .in('kpi_id', metricIds).in('profile_id', repIds)
        .lte('period_start', currEnd).gte('period_end', currStart),
      sb.from('kpi_values').select('kpi_id, profile_id, value')
        .in('kpi_id', metricIds).in('profile_id', repIds)
        .lte('period_start', priorEnd).gte('period_end', priorStart),
    ]);

    // Sum values per (profile, kpi) for each period
    function sumByProfileKpi(values) {
      const map = {};
      for (const v of (values || [])) {
        const key = `${v.profile_id}:${v.kpi_id}`;
        map[key] = (map[key] || 0) + (v.value || 0);
      }
      return map;
    }
    const currSums  = sumByProfileKpi(currValues);
    const priorSums = sumByProfileKpi(priorValues);

    // Compute score for a profile given a sum map — uses historical config for the given week date
    function computeScore(profileId, sums, weekDate) {
      let score = 0;
      for (const metric of metrics) {
        const cfg  = getConfigAt(metric.id, weekDate, metrics);
        const val  = sums[`${profileId}:${metric.id}`] || 0;
        const goal = cfg.goal || 1;
        const dir  = cfg.direction || 'higher';
        const pct  = dir === 'lower'
          ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
          : (val / goal) * 100;
        score += pct * cfg.weight;
      }
      return Math.round(score);
    }

    let notified = 0;
    for (const rep of reps) {
      const currentScore = computeScore(rep.id, currSums, currStart);
      const priorScore   = computeScore(rep.id, priorSums, priorStart);
      const delta        = currentScore - priorScore;
      const managerId    = rep.team_id ? teamManagerMap[rep.team_id] : null;
      const repName      = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'A rep';

      const notifications = [];

      // Under threshold → coaching suggestion for manager
      if (currentScore < 80 && managerId) {
        notifications.push({
          profile_id:  managerId,
          type:        'coaching_suggestion',
          title:       `${repName} Needs Coaching Attention`,
          message:     `${repName}'s Apptivia Score is ${currentScore} this week — below the 80-point threshold. Review their KPI breakdown and schedule a coaching touchpoint.`,
          icon:        '📋',
          color:       '#f59e0b',
          action_url:  '/scorecard',
          priority:    7,
          dedupe_key:  `scorecard-alert:${rep.id}:${weekKey}:coaching`,
          expires_at:  new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      }

      // Trending down > 15 pts → improvement opportunity for manager
      if (delta < -15 && managerId) {
        notifications.push({
          profile_id:  managerId,
          type:        'improvement_opportunity',
          title:       `${repName}'s Score Dropped ${Math.abs(delta)} Points`,
          message:     `${repName} dropped from ${priorScore} to ${currentScore} this week (−${Math.abs(delta)} pts). Check which KPIs declined and coach accordingly.`,
          icon:        '📉',
          color:       '#ef4444',
          action_url:  '/scorecard',
          priority:    8,
          dedupe_key:  `scorecard-alert:${rep.id}:${weekKey}:trending-down`,
          expires_at:  new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      }

      // At or above 100% → top performer notification to rep themselves
      if (currentScore >= 100) {
        notifications.push({
          profile_id:  rep.id,
          type:        'top_performer',
          title:       `Outstanding Week, ${rep.first_name || 'Rep'}! 🏆`,
          message:     `Your Apptivia Score hit ${currentScore} this week — you're performing at ${currentScore}% of goal. Keep it up!`,
          icon:        '🏆',
          color:       '#10b981',
          action_url:  '/scorecard',
          priority:    6,
          dedupe_key:  `scorecard-alert:${rep.id}:${weekKey}:top-performer`,
          expires_at:  new Date(Date.now() + 7 * 86400000).toISOString(),
        });
      }

      for (const notif of notifications) {
        const { error } = await sb.from('notifications').insert(notif);
        if (!error) notified++;
      }
    }

    return { orgs: new Set(reps.map(r => r.organization_id)).size, notified };
  } catch (err) {
    console.error('[scorecard-alerts] Error:', err.message);
    return { orgs: 0, notified: 0 };
  }
}

// ── Autopilot: Contest Auto-Complete ──────────────────────────────────────
// Daily. Finds expired active contests, sets winner, awards badge.
// The DB trigger trigger_notify_contest_winners handles notification inserts
// automatically when status changes to 'completed'.
async function runContestAutoComplete() {
  const sb = getSupabaseAdmin();
  if (!sb) return { completed: 0, activated: 0 };

  try {
    // Transition upcoming → active when start_date has passed
    const { data: readyContests } = await sb
      .from('active_contests')
      .select('id')
      .eq('status', 'upcoming')
      .lte('start_date', new Date().toISOString());

    let activated = 0;
    if (readyContests && readyContests.length > 0) {
      const ids = readyContests.map(c => c.id);
      await sb.from('active_contests')
        .update({ status: 'active', updated_at: new Date().toISOString() })
        .in('id', ids);
      activated = ids.length;
      console.log(`[contest-complete] Activated ${activated} upcoming contest(s)`);
    }

    // Transition active → completed when end_date has passed
    const { data: expiredContests } = await sb
      .from('active_contests')
      .select('id, name, kpi_key')
      .eq('status', 'active')
      .lt('end_date', new Date().toISOString());

    if (!expiredContests || expiredContests.length === 0) return { completed: 0, activated };

    let completed = 0;
    for (const contest of expiredContests) {
      try {
        // Check if already processed via dedup notification
        const dedupeKey = `contest-complete:${contest.id}`;
        const { data: existing } = await sb
          .from('notifications')
          .select('id')
          .eq('dedupe_key', dedupeKey)
          .limit(1);
        if (existing && existing.length > 0) continue;

        // Get rank-1 leaderboard entry
        const { data: leaderboard } = await sb
          .from('contest_leaderboards')
          .select('profile_id, score, rank')
          .eq('contest_id', contest.id)
          .order('rank', { ascending: true })
          .limit(1);

        const winner = leaderboard?.[0];
        if (!winner) continue;

        // Update contest: status → completed, winner_id set
        await sb
          .from('active_contests')
          .update({ status: 'completed', winner_id: winner.profile_id, updated_at: new Date().toISOString() })
          .eq('id', contest.id);

        // Award winner badge (DB trigger handles contest_winner notification)
        await sb.from('profile_badges').insert({
          profile_id:        winner.profile_id,
          badge_type:        'contest_winner',
          badge_name:        `${contest.name} Winner`,
          badge_description: `Won the ${contest.name} contest`,
          icon:              '🏆',
          color:             '#FFD700',
          contest_id:        contest.id,
        });

        // Insert dedup sentinel so this contest isn't re-processed
        await sb.from('notifications').insert({
          profile_id: winner.profile_id,
          type:       'contest_winner',
          title:      `🏆 You won the ${contest.name} contest!`,
          message:    `Congratulations! You topped the leaderboard with a score of ${winner.score}. Your winner badge has been awarded.`,
          icon:       '🏆',
          color:      '#FFD700',
          action_url: '/contests',
          priority:   9,
          dedupe_key: dedupeKey,
          expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        });

        completed++;
      } catch (contestErr) {
        console.error(`[contest-complete:${contest.id}] Error:`, contestErr.message);
      }
    }

    return { completed, activated };
  } catch (err) {
    console.error('[contest-complete] Error:', err.message);
    return { completed: 0, activated: 0 };
  }
}

// ── Autopilot: Leaderboard Refresh ─────────────────────────────────────────
// Every 6 hours. Calls the DB RPC to recalculate all active contest leaderboards.
async function runLeaderboardRefresh() {
  const sb = getSupabaseAdmin();
  if (!sb) return { updated: 0 };

  try {
    const { error } = await sb.rpc('update_contest_leaderboards');
    if (error) throw error;

    const { data: activeContests } = await sb
      .from('active_contests')
      .select('id')
      .eq('status', 'active');

    const count = activeContests?.length || 0;
    console.log(`[leaderboard-refresh] Updated leaderboards for ${count} active contest(s)`);
    return { updated: count };
  } catch (err) {
    console.error('[leaderboard-refresh] Error:', err.message);
    return { updated: 0 };
  }
}

// ── Autopilot: KPI Anomaly Alerts ─────────────────────────────────────────
// Weekly. Computes rolling 4-week KPI averages per rep and fires
// warning/critical notifications for significant drops.
async function runKpiAnomalyAlerts() {
  const sb = getSupabaseAdmin();
  if (!sb) return { alerts: 0 };

  try {
    const now        = new Date();
    const weekKey    = getWeekKey(now);
    const currEnd    = now.toISOString().split('T')[0];
    const currStart  = new Date(now.getTime() -  7 * 86400000).toISOString().split('T')[0];
    const rollingEnd = currStart;
    const rollingStart = new Date(now.getTime() - 28 * 86400000).toISOString().split('T')[0];

    // Get all active KPI metrics
    const { data: metrics } = await sb
      .from('kpi_metrics')
      .select('id, key, name')
      .eq('is_active', true);

    if (!metrics || metrics.length === 0) return { alerts: 0 };
    const metricIds = metrics.map(m => m.id);
    const metricMap = Object.fromEntries(metrics.map(m => [m.id, m]));

    // Get rep profiles
    const { data: reps } = await sb
      .from('profiles')
      .select('id, first_name, last_name, team_id, organization_id')
      .not('role', 'in', '("admin","manager","coach")');

    if (!reps || reps.length === 0) return { alerts: 0 };

    const repIds = reps.map(r => r.id);

    // Get team → manager lookup
    const teamIds = [...new Set(reps.map(r => r.team_id).filter(Boolean))];
    const { data: teams } = await sb
      .from('teams')
      .select('id, manager_id')
      .in('id', teamIds);
    const teamManagerMap = Object.fromEntries((teams || []).map(t => [t.id, t.manager_id]));

    // Get org → admin lookup
    const orgIds = [...new Set(reps.map(r => r.organization_id).filter(Boolean))];
    const { data: admins } = await sb
      .from('profiles')
      .select('id, organization_id')
      .in('organization_id', orgIds)
      .eq('role', 'admin');
    const orgAdminMap = {};
    for (const a of (admins || [])) {
      if (!orgAdminMap[a.organization_id]) orgAdminMap[a.organization_id] = [];
      orgAdminMap[a.organization_id].push(a.id);
    }

    // Fetch current week and rolling period values
    const [{ data: currValues }, { data: rollingValues }] = await Promise.all([
      sb.from('kpi_values').select('kpi_id, profile_id, value')
        .in('kpi_id', metricIds).in('profile_id', repIds)
        .lte('period_start', currEnd).gte('period_end', currStart),
      sb.from('kpi_values').select('kpi_id, profile_id, value')
        .in('kpi_id', metricIds).in('profile_id', repIds)
        .lte('period_start', rollingEnd).gte('period_end', rollingStart),
    ]);

    // Sum values and compute per-week averages
    function sumMap(values) {
      const m = {};
      for (const v of (values || [])) {
        const k = `${v.profile_id}:${v.kpi_id}`;
        m[k] = (m[k] || 0) + (v.value || 0);
      }
      return m;
    }
    const currSums    = sumMap(currValues);
    const rollingSums = sumMap(rollingValues);

    let alerts = 0;
    for (const rep of reps) {
      const managerId = rep.team_id ? teamManagerMap[rep.team_id] : null;
      const orgAdmins = orgAdminMap[rep.organization_id] || [];
      const repName   = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'A rep';

      for (const metric of metrics) {
        const currVal    = currSums[`${rep.id}:${metric.id}`]    || 0;
        const rollingSum = rollingSums[`${rep.id}:${metric.id}`] || 0;
        const rollingAvg = rollingSum / 4; // 4-week average

        if (rollingAvg <= 0) continue; // Not enough history

        const deviationPct = ((currVal - rollingAvg) / rollingAvg) * 100;

        if (deviationPct >= KPI_ANOMALY_WARNING) continue; // Not anomalous

        const isCritical = deviationPct <= KPI_ANOMALY_CRITICAL;
        const dedupeKey  = `kpi-anomaly:${rep.id}:${metric.key}:${weekKey}`;
        const dropPct    = Math.abs(Math.round(deviationPct));

        const notifBase = {
          type:       'kpi_anomaly',
          title:      `${repName}'s ${metric.name} Down ${dropPct}%`,
          message:    `${repName}'s ${metric.name} this week is ${dropPct}% below their 4-week average${isCritical ? ' — critical drop' : ''}.`,
          icon:       isCritical ? '🚨' : '⚠️',
          color:      isCritical ? '#dc2626' : '#f59e0b',
          action_url: '/analytics',
          priority:   isCritical ? 9 : 7,
          dedupe_key: dedupeKey,
          expires_at: new Date(Date.now() + 7 * 86400000).toISOString(),
        };

        // Notify manager
        if (managerId) {
          await sb.from('notifications').insert({ ...notifBase, profile_id: managerId });
          alerts++;
        }

        // Also notify org admins for critical drops
        if (isCritical) {
          for (const adminId of orgAdmins) {
            if (adminId === managerId) continue; // Don't double-notify if admin is also manager
            await sb.from('notifications').insert({
              ...notifBase,
              profile_id: adminId,
              dedupe_key: `${dedupeKey}:admin:${adminId}`,
            });
            alerts++;
          }
        }
      }
    }

    return { alerts };
  } catch (err) {
    console.error('[kpi-anomaly] Error:', err.message);
    return { alerts: 0 };
  }
}

// ── Autopilot: Scheduled Reports ──────────────────────────────────────────
// Daily. Finds scheduled reports that are due and sends summary emails.
async function runScheduledReports() {
  const sb = getSupabaseAdmin();
  if (!sb) return { sent: 0, errors: 0 };

  try {
    const { data: reports } = await sb
      .from('scheduled_reports')
      .select('id, report_type, frequency, day_of_week, time, recipients, organization_id, include_charts, include_summary, last_sent_at')
      .eq('active', true)
      .lte('next_scheduled_at', new Date().toISOString());

    if (!reports || reports.length === 0) return { sent: 0, errors: 0 };

    let sent = 0;
    let errors = 0;
    for (const report of reports) {
      try {
        // Concurrent run protection: skip if sent within the last hour
        if (report.last_sent_at && (Date.now() - new Date(report.last_sent_at).getTime()) < 3600000) {
          console.log(`[scheduled-reports:${report.id}] Skipped — sent within last hour`);
          continue;
        }

        const { html, text, subject } = await generateReport(sb, report);

        await sendEmail({ recipients: report.recipients, subject, html, text });

        await sb
          .from('scheduled_reports')
          .update({
            last_sent_at:      new Date().toISOString(),
            next_scheduled_at: computeNextScheduledAt(report),
          })
          .eq('id', report.id);

        sent++;
        console.log(`[scheduled-reports:${report.id}] Sent ${report.report_type} to ${report.recipients.length} recipient(s)`);
      } catch (reportErr) {
        errors++;
        console.error(`[scheduled-reports:${report.id}] Error:`, reportErr.message);
      }
    }

    return { sent, errors };
  } catch (err) {
    console.error('[scheduled-reports] Error:', err.message);
    return { sent: 0, errors: 0 };
  }
}

// ── Autopilot: Badge Auto-Award ────────────────────────────────────────────
// Called from runAchievementCheck after achievements are evaluated.
// Awards volume, achievement-milestone, revenue, scorecard-excellence, and
// improvement badges. Fires badge_earned / rare_badge_earned notifications.
async function runBadgeAutoAward() {
  const sb = getSupabaseAdmin();
  if (!sb) return { awarded: 0, notified: 0 };

  try {
    // Badge definitions for icon/color/rarity metadata
    const { data: badgeDefs } = await sb
      .from('badge_definitions')
      .select('badge_name, badge_type, badge_description, icon, color, rarity, points');
    const badgeDefMap = Object.fromEntries((badgeDefs || []).map(b => [b.badge_name, b]));

    // All rep profiles
    const { data: reps } = await sb
      .from('profiles')
      .select('id, first_name, last_name, total_points, created_at')
      .not('role', 'in', '("admin","manager","coach")');
    if (!reps || reps.length === 0) return { awarded: 0, notified: 0 };
    const repIds = reps.map(r => r.id);

    // Already-earned badges → Set for dedup
    const { data: existingBadges } = await sb
      .from('profile_badges')
      .select('profile_id, badge_name')
      .in('profile_id', repIds);
    const badgeSet = new Set((existingBadges || []).map(b => `${b.profile_id}:${b.badge_name}`));

    let awarded = 0;
    let notified = 0;

    // Helper: insert badge row + fire notification
    async function awardBadge(profileId, badgeName) {
      const key = `${profileId}:${badgeName}`;
      if (badgeSet.has(key)) return false;
      const def = badgeDefMap[badgeName];
      if (!def) return false;

      const { error } = await sb.from('profile_badges').insert({
        profile_id:        profileId,
        badge_type:        def.badge_type,
        badge_name:        def.badge_name,
        badge_description: def.badge_description,
        icon:              def.icon,
        color:             def.color,
      });
      if (error) return false;
      badgeSet.add(key);
      awarded++;

      const isRare = def.rarity === 'epic' || def.rarity === 'legendary';
      const priority = def.rarity === 'legendary' ? 9
        : def.rarity === 'epic' ? 8
        : def.rarity === 'rare' ? 7 : 6;
      await sb.from('notifications').insert({
        profile_id:  profileId,
        type:        isRare ? 'rare_badge_earned' : 'badge_earned',
        title:       `Badge Earned: ${def.badge_name}`,
        message:     `${def.badge_description}${def.points ? ` (+${def.points} pts)` : ''}`,
        icon:        def.icon,
        color:       def.color,
        action_url:  '/scorecard',
        priority,
        dedupe_key:  `badge-earned:${profileId}:${def.badge_name}`,
        expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
      });
      notified++;
      return true;
    }

    // ── A. Volume Badges ──────────────────────────────────────────────────
    const volKpiKeys = ['call_connects', 'emails_sent', 'meetings', 'sourced_opps'];
    const { data: kpiMetricsVol } = await sb
      .from('kpi_metrics').select('id, key').in('key', volKpiKeys);
    const volKpiKeyToId = Object.fromEntries((kpiMetricsVol || []).map(m => [m.key, m.id]));

    const { data: volValues } = await sb
      .from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', repIds)
      .in('kpi_id', Object.values(volKpiKeyToId).filter(Boolean));

    const volTotals = {};
    for (const v of (volValues || [])) {
      if (!volTotals[v.profile_id]) volTotals[v.profile_id] = {};
      volTotals[v.profile_id][v.kpi_id] = (volTotals[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
    }

    const volumeBadges = [
      { kpi: 'call_connects', threshold: 50,   badge: 'Call Starter' },
      { kpi: 'call_connects', threshold: 100,  badge: 'Call Pro' },
      { kpi: 'call_connects', threshold: 250,  badge: 'Call Champion' },
      { kpi: 'call_connects', threshold: 500,  badge: 'Call Legend' },
      { kpi: 'call_connects', threshold: 1000, badge: 'Call Deity' },
      { kpi: 'emails_sent',   threshold: 100,  badge: 'Email Starter' },
      { kpi: 'emails_sent',   threshold: 250,  badge: 'Email Pro' },
      { kpi: 'emails_sent',   threshold: 500,  badge: 'Email Champion' },
      { kpi: 'emails_sent',   threshold: 1000, badge: 'Email Legend' },
      { kpi: 'meetings',      threshold: 10,   badge: 'Meeting Starter' },
      { kpi: 'meetings',      threshold: 25,   badge: 'Meeting Pro' },
      { kpi: 'meetings',      threshold: 50,   badge: 'Meeting Champion' },
      { kpi: 'meetings',      threshold: 100,  badge: 'Meeting Legend' },
      { kpi: 'sourced_opps',  threshold: 10,   badge: 'Pipeline Builder' },
      { kpi: 'sourced_opps',  threshold: 25,   badge: 'Pipeline Architect' },
      { kpi: 'sourced_opps',  threshold: 50,   badge: 'Pipeline Master' },
      { kpi: 'sourced_opps',  threshold: 100,  badge: 'Pipeline Titan' },
    ];

    for (const rep of reps) {
      const rt = volTotals[rep.id] || {};
      for (const vb of volumeBadges) {
        const kpiId = volKpiKeyToId[vb.kpi];
        if (!kpiId) continue;
        if ((rt[kpiId] || 0) >= vb.threshold) await awardBadge(rep.id, vb.badge);
      }
    }

    // ── B. Achievement Milestone Badges ───────────────────────────────────
    const { data: achRows } = await sb
      .from('profile_achievements').select('profile_id').in('profile_id', repIds);
    const achCountMap = {};
    for (const a of (achRows || [])) {
      achCountMap[a.profile_id] = (achCountMap[a.profile_id] || 0) + 1;
    }

    const achMilestoneBadges = [
      { threshold: 5,   badge: 'First Steps' },
      { threshold: 15,  badge: 'Rising Achiever' },
      { threshold: 35,  badge: 'Achievement Pro' },
      { threshold: 75,  badge: 'Achievement Elite' },
      { threshold: 100, badge: 'Achievement Master' },
    ];

    for (const rep of reps) {
      const count = achCountMap[rep.id] || 0;
      for (const mb of achMilestoneBadges) {
        if (count >= mb.threshold) await awardBadge(rep.id, mb.badge);
      }
    }

    // ── C. Revenue & Results Badges ───────────────────────────────────────
    const revKpiKeys = ['closed_won', 'closed_won_deals', 'revenue_generated'];
    const { data: kpiMetricsRev } = await sb
      .from('kpi_metrics').select('id, key').in('key', revKpiKeys);
    const revKpiKeyToId = Object.fromEntries((kpiMetricsRev || []).map(m => [m.key, m.id]));
    const closedWonId  = revKpiKeyToId['closed_won'] || revKpiKeyToId['closed_won_deals'];
    const revenueKpiId = revKpiKeyToId['revenue_generated'];

    if (closedWonId || revenueKpiId) {
      const revKpiIds = [closedWonId, revenueKpiId].filter(Boolean);
      const { data: revValues } = await sb
        .from('kpi_values').select('profile_id, kpi_id, value')
        .in('profile_id', repIds).in('kpi_id', revKpiIds);
      const revTotals = {};
      for (const v of (revValues || [])) {
        if (!revTotals[v.profile_id]) revTotals[v.profile_id] = {};
        revTotals[v.profile_id][v.kpi_id] = (revTotals[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
      }
      for (const rep of reps) {
        const rt    = revTotals[rep.id] || {};
        const deals   = closedWonId  ? (rt[closedWonId]  || 0) : 0;
        const revenue = revenueKpiId ? (rt[revenueKpiId] || 0) : 0;
        if (deals   >= 1)      await awardBadge(rep.id, 'First Deal');
        if (deals   >= 5)      await awardBadge(rep.id, 'Deal Maker');
        if (deals   >= 10)     await awardBadge(rep.id, 'Deal Closer');
        if (revenue >= 100000) await awardBadge(rep.id, 'Revenue Driver');
        if (revenue >= 500000) await awardBadge(rep.id, 'Revenue Champion');
      }
    }

    // ── D. Scorecard Excellence Badges ────────────────────────────────────
    // Compute per-week scorecard scores across all historical kpi_values.
    const { data: scMetrics } = await sb
      .from('kpi_metrics').select('id, goal, weight, direction')
      .eq('is_active', true).eq('show_on_scorecard', true);

    if (scMetrics && scMetrics.length > 0) {
      const scMetricIds = scMetrics.map(m => m.id);

      const { data: allScVals } = await sb
        .from('kpi_values').select('profile_id, kpi_id, value, period_start')
        .in('profile_id', repIds).in('kpi_id', scMetricIds);

      // Fetch historical config covering all-time range
      const allWeekStarts = [...new Set((allScVals || []).map(v => v.period_start))].sort();
      const scHistRangeStart = allWeekStarts[0] || new Date().toISOString();
      const scHistRangeEnd = new Date().toISOString();
      const { getConfigAt: scGetConfigAt } = await fetchHistoricalConfig(sb, scMetricIds, scHistRangeStart, scHistRangeEnd);

      // Group: profileId → weekStart → kpiId → summed value
      const weekMap = {};
      for (const v of (allScVals || [])) {
        if (!weekMap[v.profile_id]) weekMap[v.profile_id] = {};
        if (!weekMap[v.profile_id][v.period_start]) weekMap[v.profile_id][v.period_start] = {};
        weekMap[v.profile_id][v.period_start][v.kpi_id] =
          (weekMap[v.profile_id][v.period_start][v.kpi_id] || 0) + (v.value || 0);
      }

      function calcWeekScore(kpiSums, weekDate) {
        let s = 0;
        for (const m of scMetrics) {
          const cfg = scGetConfigAt(m.id, weekDate, scMetrics);
          const val = kpiSums[m.id] || 0;
          const goal = cfg.goal || 1;
          const dir = cfg.direction || 'higher';
          const pct = dir === 'lower'
            ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
            : (val / goal) * 100;
          s += pct * cfg.weight;
        }
        return Math.round(s);
      }

      for (const rep of reps) {
        const weeks  = weekMap[rep.id] || {};
        const scores = Object.keys(weeks).sort().map(w => calcWeekScore(weeks[w], w));
        const perfectCount = scores.filter(s => s >= 100).length;
        let maxStreak = 0, cur = 0;
        for (const s of scores) {
          cur = s >= 100 ? cur + 1 : 0;
          if (cur > maxStreak) maxStreak = cur;
        }
        if (perfectCount >= 1)  await awardBadge(rep.id, 'Perfect Score');
        if (perfectCount >= 5)  await awardBadge(rep.id, 'Consistency Pro');
        if (perfectCount >= 10) await awardBadge(rep.id, 'Consistency Master');
        if (maxStreak   >= 5)   await awardBadge(rep.id, 'Hot Streak');
        if (maxStreak   >= 10)  await awardBadge(rep.id, 'Perfection');
      }

      // ── E. Improvement Badges (current vs prior week) ──────────────────
      const nowB      = new Date();
      const currEndB  = nowB.toISOString().split('T')[0];
      const currStB   = new Date(nowB.getTime() -  7 * 86400000).toISOString().split('T')[0];
      const prevEndB  = currStB;
      const prevStB   = new Date(nowB.getTime() - 14 * 86400000).toISOString().split('T')[0];

      const [{ data: cV }, { data: pV }] = await Promise.all([
        sb.from('kpi_values').select('kpi_id, profile_id, value')
          .in('kpi_id', scMetricIds).in('profile_id', repIds)
          .lte('period_start', currEndB).gte('period_end', currStB),
        sb.from('kpi_values').select('kpi_id, profile_id, value')
          .in('kpi_id', scMetricIds).in('profile_id', repIds)
          .lte('period_start', prevEndB).gte('period_end', prevStB),
      ]);

      function sumPK(vals) {
        const m = {};
        for (const v of (vals || [])) {
          const k = `${v.profile_id}:${v.kpi_id}`;
          m[k] = (m[k] || 0) + (v.value || 0);
        }
        return m;
      }
      const cSums = sumPK(cV);
      const pSums = sumPK(pV);

      function scScore(pid, sums, weekDate) {
        let s = 0;
        for (const m of scMetrics) {
          const cfg = scGetConfigAt(m.id, weekDate, scMetrics);
          const val = sums[`${pid}:${m.id}`] || 0;
          const goal = cfg.goal || 1;
          const dir = cfg.direction || 'higher';
          const pct = dir === 'lower'
            ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
            : (val / goal) * 100;
          s += pct * cfg.weight;
        }
        return Math.round(s);
      }

      for (const rep of reps) {
        const curr = scScore(rep.id, cSums, currStB);
        const prev = scScore(rep.id, pSums, prevStB);
        if (curr >= 150) await awardBadge(rep.id, 'Overachiever');
        if (prev > 0 && curr > 0 && ((curr - prev) / prev) * 100 >= 30) {
          await awardBadge(rep.id, 'Comeback Kid');
        }
      }
    }

    // ── F. Contest Participation & Wins Badges ────────────────────────────
    const { data: contestParts } = await sb
      .from('contest_participants').select('profile_id').in('profile_id', repIds);
    const { data: contestWins } = await sb
      .from('active_contests').select('winner_id')
      .eq('status', 'completed').in('winner_id', repIds);

    const contestCountMap = {};
    for (const cp of (contestParts || [])) {
      contestCountMap[cp.profile_id] = (contestCountMap[cp.profile_id] || 0) + 1;
    }
    const contestWinMap = {};
    for (const cw of (contestWins || [])) {
      if (cw.winner_id) contestWinMap[cw.winner_id] = (contestWinMap[cw.winner_id] || 0) + 1;
    }

    for (const rep of reps) {
      const participated = contestCountMap[rep.id] || 0;
      const wins         = contestWinMap[rep.id]   || 0;
      if (participated >= 1)  await awardBadge(rep.id, 'Contest Rookie');
      if (participated >= 5)  await awardBadge(rep.id, 'Contest Veteran');
      if (participated >= 10) await awardBadge(rep.id, 'Contest Regular');
      if (wins >= 1)          await awardBadge(rep.id, 'Contest Winner');
      if (wins >= 3)          await awardBadge(rep.id, 'Serial Winner');
    }

    // ── G. Momentum Badges (achievement timestamp windowing) ──────────────
    const weekAgoMom  = new Date(Date.now() -  7 * 86400000).toISOString();
    const monthAgoMom = new Date(Date.now() - 30 * 86400000).toISOString();

    const { data: recentAch } = await sb
      .from('profile_achievements').select('profile_id, completed_at')
      .in('profile_id', repIds).gte('completed_at', monthAgoMom);

    const weekAchCount  = {};
    const monthAchCount = {};
    for (const a of (recentAch || [])) {
      monthAchCount[a.profile_id] = (monthAchCount[a.profile_id] || 0) + 1;
      if (a.completed_at >= weekAgoMom) {
        weekAchCount[a.profile_id] = (weekAchCount[a.profile_id] || 0) + 1;
      }
    }

    for (const rep of reps) {
      const wk = weekAchCount[rep.id]  || 0;
      const mo = monthAchCount[rep.id] || 0;
      if (wk >= 5)  await awardBadge(rep.id, 'On Fire');
      if (wk >= 10) await awardBadge(rep.id, 'Speed Demon');
      if (mo >= 20) await awardBadge(rep.id, 'Unstoppable Force');
    }

    // ── H. Combo Badges ───────────────────────────────────────────────────
    // Triple Threat: won 1+ contest + 25+ achievements + 1+ perfect scorecard
    // All-Rounder:   10+ achievements in each of the 6 skillsets
    // Power User:    50+ achievements + 2000+ total points

    const { data: skillAchRows } = await sb
      .from('profile_achievements')
      .select('profile_id, achievements(skillset_id)')
      .in('profile_id', repIds);

    const skillsetAchMap = {};
    for (const row of (skillAchRows || [])) {
      const sId = row.achievements?.skillset_id;
      if (!sId) continue;
      if (!skillsetAchMap[row.profile_id]) skillsetAchMap[row.profile_id] = {};
      skillsetAchMap[row.profile_id][sId] = (skillsetAchMap[row.profile_id][sId] || 0) + 1;
    }

    const { data: allSkillsets } = await sb.from('skillsets').select('id');
    const allSkillsetIds = (allSkillsets || []).map(s => s.id);

    for (const rep of reps) {
      const achCount  = achCountMap[rep.id]    || 0;
      const wins      = contestWinMap[rep.id]  || 0;
      const hasPerfect = badgeSet.has(`${rep.id}:Perfect Score`);

      if (wins >= 1 && achCount >= 25 && hasPerfect) {
        await awardBadge(rep.id, 'Triple Threat');
      }

      const repSkillAchs = skillsetAchMap[rep.id] || {};
      if (allSkillsetIds.length === 6 && allSkillsetIds.every(sId => (repSkillAchs[sId] || 0) >= 10)) {
        await awardBadge(rep.id, 'All-Rounder');
      }

      if (achCount >= 50 && (rep.total_points || 0) >= 2000) {
        await awardBadge(rep.id, 'Power User');
      }
    }

    // ── I. Time Milestone Badges ──────────────────────────────────────────
    const nowMs = Date.now();
    for (const rep of reps) {
      const days = Math.floor((nowMs - new Date(rep.created_at).getTime()) / 86400000);
      if (days >= 1)   await awardBadge(rep.id, 'First Day');
      if (days >= 7)   await awardBadge(rep.id, 'First Week');
      if (days >= 30)  await awardBadge(rep.id, 'First Month');
      if (days >= 100) await awardBadge(rep.id, '100 Days Strong');
      if (days >= 365) await awardBadge(rep.id, 'One Year Anniversary');
    }

    console.log(`[badge-check] Awarded ${awarded} badges, sent ${notified} notifications`);
    return { awarded, notified };
  } catch (err) {
    console.error('[badge-check] Error:', err.message);
    return { awarded: 0, notified: 0 };
  }
}

// ── Autopilot: Sync Engage KPI Values ───────────────────────────────────────
// Aggregates activity from engage_* tables into kpi_values so that
// runAchievementCheck() can evaluate Engage Pro achievements.
// Computes per-rep all-time counts, diffs against existing kpi_values sum,
// and inserts delta rows for the current week to preserve time-series data.
async function syncEngageKpiValues() {
  const sb = getSupabaseAdmin();
  if (!sb) return;

  try {
    // 1. Fetch engage KPI metrics
    const { data: engageMetrics } = await sb
      .from('kpi_metrics').select('id, key').eq('category', 'engage').eq('is_active', true);
    if (!engageMetrics || engageMetrics.length === 0) return;
    const keyToId = Object.fromEntries(engageMetrics.map(m => [m.key, m.id]));

    // 2. Fetch all rep profiles (same filter as achievement check)
    const { data: reps } = await sb
      .from('profiles').select('id, organization_id')
      .not('role', 'in', '("admin","manager","coach")');
    if (!reps || reps.length === 0) return;
    const repIds = reps.map(r => r.id);
    const repOrgMap = Object.fromEntries(reps.map(r => [r.id, r.organization_id]));

    // 3. Current week period for new kpi_values rows
    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);
    monday.setHours(0, 0, 0, 0);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const periodStart = monday.toISOString().split('T')[0];
    const periodEnd = sunday.toISOString().split('T')[0];

    // 4. Existing kpi_values sums for engage KPIs (all-time per profile+kpi)
    const engageKpiIds = engageMetrics.map(m => m.id);
    const { data: existingVals } = await sb
      .from('kpi_values').select('profile_id, kpi_id, value')
      .in('kpi_id', engageKpiIds).in('profile_id', repIds);
    const existingSums = {};
    for (const v of (existingVals || [])) {
      const k = `${v.profile_id}:${v.kpi_id}`;
      existingSums[k] = (existingSums[k] || 0) + (v.value || 0);
    }

    // 5. Query each engage table for per-profile counts
    // All queries use GROUP BY for efficiency (one query per table, not per-rep)
    const counts = {}; // { profileId: { kpiKey: count } }
    const initCounts = (profileId) => {
      if (!counts[profileId]) counts[profileId] = {};
    };

    // sequences_created: engage_sequences grouped by created_by
    const { data: seqs } = await sb
      .from('engage_sequences').select('created_by').in('created_by', repIds);
    const seqGrouped = {};
    for (const s of (seqs || [])) {
      if (s.created_by) seqGrouped[s.created_by] = (seqGrouped[s.created_by] || 0) + 1;
    }
    for (const [pid, cnt] of Object.entries(seqGrouped)) {
      initCounts(pid);
      counts[pid].sequences_created = cnt;
    }

    // prospects_enrolled: engage_sequence_enrollments grouped by enrolled_by
    const { data: enrollments } = await sb
      .from('engage_sequence_enrollments').select('enrolled_by').in('enrolled_by', repIds);
    const enrollGrouped = {};
    for (const e of (enrollments || [])) {
      if (e.enrolled_by) {
        enrollGrouped[e.enrolled_by] = (enrollGrouped[e.enrolled_by] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(enrollGrouped)) {
      initCounts(pid);
      counts[pid].prospects_enrolled = cnt;
    }

    // sequence_replies: engage_sequence_executions WHERE status = 'replied',
    // joined through enrollments to get enrolled_by as the profile
    const { data: replies } = await sb
      .from('engage_sequence_executions').select('enrollment_id, status')
      .eq('status', 'replied');
    if (replies && replies.length > 0) {
      const enrollmentIds = [...new Set(replies.map(r => r.enrollment_id))];
      const { data: enrollLookup } = await sb
        .from('engage_sequence_enrollments').select('id, enrolled_by')
        .in('id', enrollmentIds);
      const enrollMap = Object.fromEntries((enrollLookup || []).map(e => [e.id, e.enrolled_by]));
      for (const r of replies) {
        const pid = enrollMap[r.enrollment_id];
        if (pid && repIds.includes(pid)) {
          initCounts(pid);
          counts[pid].sequence_replies = (counts[pid].sequence_replies || 0) + 1;
        }
      }
    }

    // accounts_researched: engage_accounts grouped by assigned_to
    const { data: accts } = await sb
      .from('engage_accounts').select('assigned_to').in('assigned_to', repIds);
    const acctGrouped = {};
    for (const a of (accts || [])) {
      if (a.assigned_to) {
        acctGrouped[a.assigned_to] = (acctGrouped[a.assigned_to] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(acctGrouped)) {
      initCounts(pid);
      counts[pid].accounts_researched = cnt;
    }

    // playbooks_executed: engage_playbook_executions grouped by executed_by
    const { data: playExecs } = await sb
      .from('engage_playbook_executions').select('executed_by').in('executed_by', repIds);
    const playGrouped = {};
    for (const p of (playExecs || [])) {
      if (p.executed_by) {
        playGrouped[p.executed_by] = (playGrouped[p.executed_by] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(playGrouped)) {
      initCounts(pid);
      counts[pid].playbooks_executed = cnt;
    }

    // outreach_drafts_sent: engage_outreach_drafts WHERE status IN ('approved','sent')
    const { data: drafts } = await sb
      .from('engage_outreach_drafts').select('created_by, status')
      .in('created_by', repIds).in('status', ['approved', 'sent']);
    const draftGrouped = {};
    for (const d of (drafts || [])) {
      if (d.created_by) {
        draftGrouped[d.created_by] = (draftGrouped[d.created_by] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(draftGrouped)) {
      initCounts(pid);
      counts[pid].outreach_drafts_sent = cnt;
    }

    // ai_content_generated: all drafts + research reports created by rep
    const { data: allDrafts } = await sb
      .from('engage_outreach_drafts').select('created_by').in('created_by', repIds);
    const { data: reports } = await sb
      .from('engage_research_reports').select('created_by').in('created_by', repIds);
    const aiGrouped = {};
    for (const d of (allDrafts || [])) {
      if (d.created_by) aiGrouped[d.created_by] = (aiGrouped[d.created_by] || 0) + 1;
    }
    for (const r of (reports || [])) {
      if (r.created_by) aiGrouped[r.created_by] = (aiGrouped[r.created_by] || 0) + 1;
    }
    for (const [pid, cnt] of Object.entries(aiGrouped)) {
      initCounts(pid);
      counts[pid].ai_content_generated = cnt;
    }

    // engage_signals_actioned: engage_intent_signals WHERE actioned_by AND status = 'actioned'
    const { data: signals } = await sb
      .from('engage_intent_signals').select('actioned_by')
      .eq('status', 'actioned').in('actioned_by', repIds);
    const sigGrouped = {};
    for (const s of (signals || [])) {
      if (s.actioned_by) {
        sigGrouped[s.actioned_by] = (sigGrouped[s.actioned_by] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(sigGrouped)) {
      initCounts(pid);
      counts[pid].engage_signals_actioned = cnt;
    }

    // engage_deals_influenced: engage_intent_signals WHERE contributed_to_deal_id IS NOT NULL
    const { data: dealSignals } = await sb
      .from('engage_intent_signals').select('actioned_by')
      .not('contributed_to_deal_id', 'is', null).in('actioned_by', repIds);
    const dealGrouped = {};
    for (const s of (dealSignals || [])) {
      if (s.actioned_by) {
        dealGrouped[s.actioned_by] = (dealGrouped[s.actioned_by] || 0) + 1;
      }
    }
    for (const [pid, cnt] of Object.entries(dealGrouped)) {
      initCounts(pid);
      counts[pid].engage_deals_influenced = cnt;
    }

    // 6. Compute deltas and insert new kpi_values rows
    const inserts = [];
    for (const [profileId, kpiCounts] of Object.entries(counts)) {
      for (const [kpiKey, newTotal] of Object.entries(kpiCounts)) {
        const kpiId = keyToId[kpiKey];
        if (!kpiId) continue;
        const existingTotal = existingSums[`${profileId}:${kpiId}`] || 0;
        const delta = newTotal - existingTotal;
        if (delta > 0) {
          inserts.push({
            kpi_id: kpiId,
            profile_id: profileId,
            team_id: null,
            value: delta,
            period_start: periodStart,
            period_end: periodEnd,
          });
        }
      }
    }

    if (inserts.length > 0) {
      // Batch insert in chunks of 100
      for (let i = 0; i < inserts.length; i += 100) {
        const chunk = inserts.slice(i, i + 100);
        await sb.from('kpi_values').insert(chunk);
      }
    }

    const affectedReps = new Set(inserts.map(i => i.profile_id)).size;
    console.log(`[engage-kpi-sync] Synced engage KPIs: ${inserts.length} new kpi_values rows across ${affectedReps} reps`);
  } catch (err) {
    console.error('[engage-kpi-sync] Error:', err.message);
  }
}

// ── Autopilot: Achievement Check ───────────────────────────────────────────
// Daily. For every rep, evaluates all achievements against cumulative and
// weekly KPI totals, awards newly-qualifying achievements via the DB function,
// fires achievement_earned / level_up / skill_progress notifications, then
// calls runBadgeAutoAward() to keep badges in sync.
async function runAchievementCheck() {
  const sb = getSupabaseAdmin();
  if (!sb) return { reps: 0, achieved: 0, notified: 0 };

  // Sync engage table activity into kpi_values before evaluating achievements
  await syncEngageKpiValues();

  try {
    const now     = new Date();
    const today   = now.toISOString().split('T')[0];
    const weekAgo = new Date(now.getTime() - 7 * 86400000).toISOString().split('T')[0];

    // 1. Rep profiles (exclude admin/manager/coach)
    const { data: reps } = await sb
      .from('profiles')
      .select('id, first_name, last_name, team_id, apptivia_level')
      .not('role', 'in', '("admin","manager","coach")');
    if (!reps || reps.length === 0) return { reps: 0, achieved: 0, notified: 0 };
    const repIds = reps.map(r => r.id);

    // 2. Team → manager lookup
    const teamIds = [...new Set(reps.map(r => r.team_id).filter(Boolean))];
    const { data: teams } = await sb
      .from('teams').select('id, manager_id').in('id', teamIds);
    const teamManagerMap = Object.fromEntries((teams || []).map(t => [t.id, t.manager_id]));

    // 3. All achievements with criteria
    // 3. All achievements with criteria
    const { data: achievements } = await sb
      .from('achievements').select('id, skillset_id, name, description, points, criteria');
    if (!achievements || achievements.length === 0) {
      return { reps: reps.length, achieved: 0, notified: 0 };
    }

    // 4. KPI key → id map
    const { data: kpiMetrics } = await sb
      .from('kpi_metrics').select('id, key').eq('is_active', true);
    const kpiKeyToId = Object.fromEntries((kpiMetrics || []).map(m => [m.key, m.id]));

    // 5. Already-earned achievements → Set
    const { data: earned } = await sb
      .from('profile_achievements').select('profile_id, achievement_id').in('profile_id', repIds);
    const earnedSet = new Set((earned || []).map(e => `${e.profile_id}:${e.achievement_id}`));

    // 6. Cumulative (all-time) KPI totals per profile (period_start also fetched for scorecard stats)
    const { data: allTimeVals } = await sb
      .from('kpi_values').select('profile_id, kpi_id, value, period_start').in('profile_id', repIds);
    const cumTotals = {};
    for (const v of (allTimeVals || [])) {
      if (!cumTotals[v.profile_id]) cumTotals[v.profile_id] = {};
      cumTotals[v.profile_id][v.kpi_id] = (cumTotals[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
    }

    // 6b. Scorecard Master derived stats — compute per-rep weekly scores from historical KPI data
    const { data: scorecardMetrics } = await sb
      .from('kpi_metrics').select('id, goal, weight, direction').eq('is_active', true).eq('show_on_scorecard', true);
    const repScorecardStats = {};
    if (scorecardMetrics && scorecardMetrics.length > 0) {
      const scIds = new Set(scorecardMetrics.map(m => m.id));
      // Group kpi_values by (repId, Monday of the week)
      const weeklyByRep = {};
      for (const v of (allTimeVals || [])) {
        if (!scIds.has(v.kpi_id) || !v.period_start) continue;
        const d   = new Date(v.period_start);
        const mon = new Date(d);
        mon.setDate(d.getDate() - ((d.getDay() || 7) - 1));
        const wk  = mon.toISOString().split('T')[0];
        if (!weeklyByRep[v.profile_id])        weeklyByRep[v.profile_id] = {};
        if (!weeklyByRep[v.profile_id][wk])    weeklyByRep[v.profile_id][wk] = {};
        weeklyByRep[v.profile_id][wk][v.kpi_id] = (weeklyByRep[v.profile_id][wk][v.kpi_id] || 0) + (v.value || 0);
      }

      // Fetch historical config for achievement scoring
      const allAchWeeks = new Set();
      for (const repId of repIds) {
        Object.keys(weeklyByRep[repId] || {}).forEach(wk => allAchWeeks.add(wk));
      }
      const sortedAchWeeks = [...allAchWeeks].sort();
      const achHistStart = sortedAchWeeks[0] || new Date().toISOString();
      const achHistEnd = new Date().toISOString();
      const { getConfigAt: achGetConfigAt } = await fetchHistoricalConfig(sb, scorecardMetrics.map(m => m.id), achHistStart, achHistEnd);

      for (const repId of repIds) {
        const weeks = Object.keys(weeklyByRep[repId] || {}).sort();
        let totalPerfect = 0, maxPerfectStreak = 0, curP = 0;
        let maxAbove90Streak = 0, curA90 = 0;
        let maxAbove80Streak = 0, curA80 = 0;
        let hasAbove80 = 0, maxWeekImprovement = 0, prevScore = null;
        for (const wk of weeks) {
          const sums = weeklyByRep[repId][wk];
          let score = 0;
          for (const m of scorecardMetrics) {
            const cfg = achGetConfigAt(m.id, wk, scorecardMetrics);
            const val = sums[m.id] || 0;
            const goal = cfg.goal || 1;
            const dir = cfg.direction || 'higher';
            const pct = dir === 'lower'
              ? (val > 0 ? Math.min((goal / val) * 100, 200) : 200)
              : (val / goal) * 100;
            score += pct * cfg.weight;
          }
          const s = Math.round(score);
          if (s >= 100) { totalPerfect++; curP++; if (curP > maxPerfectStreak) maxPerfectStreak = curP; } else { curP = 0; }
          if (s >= 90)  { curA90++; if (curA90 > maxAbove90Streak) maxAbove90Streak = curA90; } else { curA90 = 0; }
          if (s >= 80)  { hasAbove80 = 1; curA80++; if (curA80 > maxAbove80Streak) maxAbove80Streak = curA80; } else { curA80 = 0; }
          if (prevScore !== null && s > prevScore) {
            const imp = s - prevScore;
            if (imp > maxWeekImprovement) maxWeekImprovement = imp;
          }
          prevScore = s;
        }
        repScorecardStats[repId] = { totalWeeks: weeks.length, totalPerfect, maxPerfectStreak, maxAbove90Streak, maxAbove80Streak, hasAbove80, maxWeekImprovement };
      }
    }

    // 7. Weekly KPI totals (last 7 days) for cumulative=false achievements
    const { data: weeklyVals } = await sb
      .from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', repIds)
      .lte('period_start', today).gte('period_end', weekAgo);
    const weeklyTotals = {};
    for (const v of (weeklyVals || [])) {
      if (!weeklyTotals[v.profile_id]) weeklyTotals[v.profile_id] = {};
      weeklyTotals[v.profile_id][v.kpi_id] = (weeklyTotals[v.profile_id][v.kpi_id] || 0) + (v.value || 0);
    }

    // 8. Skillset milestone flags BEFORE awarding (to detect new milestones)
    const { data: skillsetsBefore } = await sb
      .from('profile_skillsets')
      .select('profile_id, skillset_id, milestone_25_reached, milestone_50_reached, milestone_75_reached, milestone_100_reached')
      .in('profile_id', repIds);
    const msBefore = new Map((skillsetsBefore || []).map(ps => [`${ps.profile_id}:${ps.skillset_id}`, ps]));

    // 9. Skillset id → { name, color } for notification text
    const { data: skillsets } = await sb.from('skillsets').select('id, name, color');
    const skillsetMap = Object.fromEntries((skillsets || []).map(s => [s.id, s]));

    let totalAchieved = 0;
    let totalNotified = 0;

    for (const rep of reps) {
      const managerId = rep.team_id ? teamManagerMap[rep.team_id] : null;
      const repName   = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'Rep';
      const prevLevel = rep.apptivia_level;
      const repCum    = cumTotals[rep.id]    || {};
      const repWeekly = weeklyTotals[rep.id] || {};

      for (const ach of achievements) {
        const achKey = `${rep.id}:${ach.id}`;
        if (earnedSet.has(achKey)) continue;

        const criteria = ach.criteria;
        if (!criteria || !criteria.kpi || (criteria.operator !== '>=' && criteria.operator !== '<=')) continue;

        // Weekly achievements use _weekly-suffixed KPI key — strip it to find metric
        const isWeekly = criteria.cumulative === false;
        const baseKey  = isWeekly ? criteria.kpi.replace('_weekly', '') : criteria.kpi;
        const kpiId    = kpiKeyToId[baseKey];
        if (!kpiId) {
          // Scorecard Master: derived KPI keys resolved from computed weekly stats
          const scStats = repScorecardStats[rep.id] || {};
          const scValue = {
            scorecards_completed:          scStats.totalWeeks         || 0,
            scorecard_100_percent:         scStats.totalPerfect        || 0,
            scorecard_100_percent_streak:  scStats.maxPerfectStreak    || 0,
            scorecard_above_80_streak:     scStats.maxAbove80Streak    || 0,
            scorecard_above_90_streak:     scStats.maxAbove90Streak    || 0,
            scorecard_first_80:            scStats.hasAbove80          || 0,
            scorecard_week_improvement:    scStats.maxWeekImprovement  || 0,
          }[criteria.kpi];
          if (scValue === undefined || scValue < criteria.threshold) continue;
          const { data: awardResult, error: awardErr } = await sb.rpc('award_achievement', {
            p_profile_id: rep.id, p_achievement_id: ach.id,
          });
          if (awardErr || !awardResult) continue;
          earnedSet.add(achKey);
          totalAchieved++;
          const ss = skillsetMap[ach.skillset_id];
          await sb.from('notifications').insert({
            profile_id:  rep.id,
            type:        'achievement_earned',
            title:       `Achievement Unlocked: ${ach.name}`,
            message:     `${ach.description || ach.name}${ach.points ? ` (+${ach.points} pts)` : ''}`,
            icon:        '🎯',
            color:       ss?.color || '#10b981',
            action_url:  '/scorecard',
            priority:    6,
            dedupe_key:  `achievement-earned:${rep.id}:${ach.id}`,
            expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
          });
          totalNotified++;
          continue;
        }

        const value = (isWeekly ? repWeekly : repCum)[kpiId] || 0;
        const meetsThreshold = criteria.operator === '<='
          ? (value > 0 && value <= criteria.threshold)  // Inverse metrics (e.g. response_time): lower is better, must have data
          : (value >= criteria.threshold);               // Normal metrics: higher is better
        if (!meetsThreshold) continue;

        // Award via DB function (handles points, skillset progress, milestone bonuses, level)
        const { data: awardResult, error: awardErr } = await sb.rpc('award_achievement', {
          p_profile_id:     rep.id,
          p_achievement_id: ach.id,
        });
        if (awardErr || !awardResult) continue;

        earnedSet.add(achKey);
        totalAchieved++;

        const ss = skillsetMap[ach.skillset_id];
        await sb.from('notifications').insert({
          profile_id:  rep.id,
          type:        'achievement_earned',
          title:       `Achievement Unlocked: ${ach.name}`,
          message:     `${ach.description || ach.name}${ach.points ? ` (+${ach.points} pts)` : ''}`,
          icon:        '🎯',
          color:       ss?.color || '#10b981',
          action_url:  '/scorecard',
          priority:    6,
          dedupe_key:  `achievement-earned:${rep.id}:${ach.id}`,
          expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        totalNotified++;
      }

      // Level-up check (re-fetch profile after awards)
      const { data: updatedProfile } = await sb
        .from('profiles').select('apptivia_level').eq('id', rep.id).single();

      if (updatedProfile && updatedProfile.apptivia_level !== prevLevel) {
        const newLevel = updatedProfile.apptivia_level;

        await sb.from('notifications').insert({
          profile_id:  rep.id,
          type:        'level_up',
          title:       `You Leveled Up to ${newLevel}! 🎉`,
          message:     `Congratulations, ${rep.first_name || repName}! Your consistent performance has earned you Apptivia Level: ${newLevel}.`,
          icon:        '⬆️',
          color:       '#8b5cf6',
          action_url:  '/scorecard',
          priority:    8,
          dedupe_key:  `level-up:${rep.id}:${newLevel}`,
          expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
        });
        totalNotified++;

        if (managerId) {
          await sb.from('notifications').insert({
            profile_id:  managerId,
            type:        'level_up',
            title:       `${repName} Leveled Up to ${newLevel}! 🎉`,
            message:     `${repName}'s consistent KPI performance has earned them Apptivia Level: ${newLevel}.`,
            icon:        '⬆️',
            color:       '#8b5cf6',
            action_url:  '/scorecard',
            priority:    6,
            dedupe_key:  `level-up:${rep.id}:${newLevel}:mgr:${managerId}`,
            expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
          });
          totalNotified++;
        }
      }

      // Skillset milestone check (compare before/after milestone flags)
      const { data: skillsetsAfter } = await sb
        .from('profile_skillsets')
        .select('skillset_id, milestone_25_reached, milestone_50_reached, milestone_75_reached, milestone_100_reached')
        .eq('profile_id', rep.id);

      const milestoneSpecs = [
        { flag: 'milestone_25_reached',  pct: 25,  bonus: 250,  icon: '🌟' },
        { flag: 'milestone_50_reached',  pct: 50,  bonus: 500,  icon: '⭐' },
        { flag: 'milestone_75_reached',  pct: 75,  bonus: 750,  icon: '💫' },
        { flag: 'milestone_100_reached', pct: 100, bonus: 1000, icon: '👑' },
      ];

      for (const psAfter of (skillsetsAfter || [])) {
        const psBefore = msBefore.get(`${rep.id}:${psAfter.skillset_id}`);
        const ssName   = skillsetMap[psAfter.skillset_id]?.name  || 'Skillset';
        const ssColor  = skillsetMap[psAfter.skillset_id]?.color || '#6366f1';

        for (const ms of milestoneSpecs) {
          const wasReached = psBefore ? psBefore[ms.flag] : false;
          if (psAfter[ms.flag] && !wasReached) {
            await sb.from('notifications').insert({
              profile_id:  rep.id,
              type:        'skill_progress',
              title:       `${ssName} ${ms.pct}% Mastery Reached! ${ms.icon}`,
              message:     `You've hit ${ms.pct}% mastery in ${ssName}. Milestone bonus: +${ms.bonus} pts!`,
              icon:        ms.icon,
              color:       ssColor,
              action_url:  '/scorecard',
              priority:    7,
              dedupe_key:  `skillset-milestone:${rep.id}:${psAfter.skillset_id}:${ms.pct}`,
              expires_at:  new Date(Date.now() + 30 * 86400000).toISOString(),
            });
            totalNotified++;
          }
        }
      }
    }

    // Badges in sync with updated achievements
    const badgeResult = await runBadgeAutoAward();
    totalNotified += badgeResult.notified;

    console.log(`[achievement-check] ${reps.length} reps checked, ${totalAchieved} achievements awarded, ${totalNotified} notifications sent`);
    return { reps: reps.length, achieved: totalAchieved, notified: totalNotified };
  } catch (err) {
    console.error('[achievement-check] Error:', err.message);
    return { reps: 0, achieved: 0, notified: 0 };
  }
}

// ── Autopilot: Coaching Nudges ────────────────────────────────────────────
// Weekly. Detects Tier 1 (scorecard) KPIs below 80% for 2+ consecutive weeks
// and notifies the rep's manager to create or review a coaching plan.
async function runCoachingNudges() {
  const sb = getSupabaseAdmin();
  if (!sb) return { reps: 0, nudges: 0 };

  try {
    const now     = new Date();
    const weekKey = getWeekKey(now);
    const WEEKS_TO_CHECK = 3; // current + 2 prior
    const CONSECUTIVE_THRESHOLD = 2;
    const KPI_TARGET_PCT = 80;

    // Build week boundaries (most recent first)
    const weekBounds = [];
    for (let w = 0; w < WEEKS_TO_CHECK; w++) {
      const end   = new Date(now.getTime() - w * 7 * 86400000).toISOString().split('T')[0];
      const start = new Date(now.getTime() - (w + 1) * 7 * 86400000).toISOString().split('T')[0];
      weekBounds.push({ start, end });
    }

    // Get scorecard KPI definitions (Tier 1) — current as fallback
    const { data: metrics } = await sb
      .from('kpi_metrics')
      .select('id, key, name, goal, direction')
      .eq('is_active', true)
      .eq('show_on_scorecard', true);

    if (!metrics || metrics.length === 0) return { reps: 0, nudges: 0 };
    const metricIds = metrics.map(m => m.id);

    // Get all reps (exclude admin/manager/coach)
    const { data: reps } = await sb
      .from('profiles')
      .select('id, first_name, last_name, team_id')
      .not('role', 'in', '("admin","manager","coach")');

    if (!reps || reps.length === 0) return { reps: 0, nudges: 0 };

    // Team → manager lookup
    const teamIds = [...new Set(reps.map(r => r.team_id).filter(Boolean))];
    const { data: teams } = await sb
      .from('teams')
      .select('id, manager_id')
      .in('id', teamIds);
    const teamManagerMap = Object.fromEntries((teams || []).map(t => [t.id, t.manager_id]));

    const repIds = reps.map(r => r.id);

    // Fetch KPI values for all weeks at once
    const earliestStart = weekBounds[weekBounds.length - 1].start;
    const latestEnd     = weekBounds[0].end;

    // Fetch historical config covering the 3-week lookback
    const { getConfigAt: nudgeGetConfigAt } = await fetchHistoricalConfig(sb, metricIds, earliestStart, latestEnd);

    const { data: allValues } = await sb
      .from('kpi_values')
      .select('kpi_id, profile_id, value, period_start, period_end')
      .in('kpi_id', metricIds)
      .in('profile_id', repIds)
      .gte('period_start', earliestStart)
      .lte('period_end', latestEnd);

    // Bucket values by week index
    function getWeekIndex(periodStart) {
      for (let w = 0; w < weekBounds.length; w++) {
        if (periodStart >= weekBounds[w].start && periodStart <= weekBounds[w].end) return w;
      }
      return -1;
    }

    // Build: repId → metricId → [weekIdx] → sumValue
    const repMetricWeekVals = {};
    for (const v of (allValues || [])) {
      const wi = getWeekIndex(v.period_start);
      if (wi < 0) continue;
      const key = `${v.profile_id}:${v.kpi_id}`;
      if (!repMetricWeekVals[key]) repMetricWeekVals[key] = new Array(WEEKS_TO_CHECK).fill(0);
      repMetricWeekVals[key][wi] += (v.value || 0);
    }

    let nudges = 0;
    for (const rep of reps) {
      const managerId = rep.team_id ? teamManagerMap[rep.team_id] : null;
      if (!managerId) continue;

      const repName = `${rep.first_name || ''} ${rep.last_name || ''}`.trim() || 'A rep';
      const laggingKpis = [];

      for (const metric of metrics) {
        const vals = repMetricWeekVals[`${rep.id}:${metric.id}`];
        if (!vals) continue;

        // Direction-aware pct helper — uses historical config for each week
        function metricPct(val, weekIdx) {
          const weekDate = weekBounds[weekIdx]?.start || now.toISOString();
          const cfg = nudgeGetConfigAt(metric.id, weekDate, metrics);
          const goal = cfg.goal || 1;
          const dir  = cfg.direction || 'higher';
          return dir === 'lower'
            ? (val > 0 ? Math.min(Math.round((goal / val) * 100), 200) : 200)
            : Math.round((val / goal) * 100);
        }

        // Count consecutive weeks below target (starting from most recent)
        let consecutiveBelow = 0;
        for (let w = 0; w < WEEKS_TO_CHECK; w++) {
          const pct = metricPct(vals[w], w);
          if (pct < KPI_TARGET_PCT) {
            consecutiveBelow++;
          } else {
            break;
          }
        }

        if (consecutiveBelow >= CONSECUTIVE_THRESHOLD) {
          const currentPct = metricPct(vals[0], 0);
          laggingKpis.push({
            name: metric.name || metric.key.replace(/_/g, ' '),
            key: metric.key,
            pct: currentPct,
            weeks: consecutiveBelow,
          });
        }
      }

      if (laggingKpis.length === 0) continue;

      // Build notification — highlight worst KPI
      const worst = laggingKpis.sort((a, b) => a.pct - b.pct)[0];
      const othersCount = laggingKpis.length - 1;
      const othersText = othersCount > 0 ? ` (+${othersCount} other KPI${othersCount > 1 ? 's' : ''})` : '';

      const { error } = await sb.from('notifications').insert({
        profile_id:  managerId,
        type:        'coaching_suggestion',
        title:       `${repName}: ${worst.name} Below Target ${worst.weeks} Weeks`,
        message:     `${repName}'s ${worst.name} has been at ${worst.pct}% for ${worst.weeks} consecutive weeks — below the 80% target.${othersText} Consider creating a coaching plan to address this trend.`,
        icon:        '📊',
        color:       '#f59e0b',
        action_url:  '/coaching-plans',
        priority:    7,
        dedupe_key:  `coaching-nudge:${rep.id}:${worst.key}:${weekKey}`,
        expires_at:  new Date(Date.now() + 7 * 86400000).toISOString(),
      });
      if (!error) nudges++;
    }

    return { reps: reps.length, nudges };
  } catch (err) {
    console.error('[coaching-nudges] Error:', err.message);
    return { reps: 0, nudges: 0 };
  }
}

// ── Startup env validation ─────────────────────────────────────────────────
(function validateEnv() {
  const required = [
    ['SUPABASE_URL',           'Supabase project URL'],
    ['SUPABASE_SERVICE_ROLE_KEY', 'Supabase service role key (Project Settings → API)'],
    ['ANTHROPIC_API_KEY',      'Anthropic API key'],
  ];
  const missing = required.filter(([k]) => !process.env[k]);
  if (missing.length) {
    console.warn('[startup] Missing env vars — some cron jobs will be disabled:');
    missing.forEach(([k, desc]) => console.warn(`  • ${k}  (${desc})`));
  } else {
    const keyPrefix = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').slice(0, 12);
    console.log(`[startup] Env OK — SUPABASE_URL set, service key prefix: ${keyPrefix}...`);
  }
})();

// ── Register and start all cron jobs ──────────────────────────────────────
CronManager.register('deal-risk',          runDealRiskCheck,       24 * 60 * 60 * 1000,  60_000);
CronManager.register('signal-scan',        runSignalScan,           7 * 24 * 60 * 60 * 1000,  90_000);
CronManager.register('scorecard-alerts',   runScorecardAlerts,      7 * 24 * 60 * 60 * 1000, 120_000);
CronManager.register('contest-complete',   runContestAutoComplete, 24 * 60 * 60 * 1000,  75_000);
CronManager.register('kpi-anomaly',        runKpiAnomalyAlerts,     7 * 24 * 60 * 60 * 1000, 150_000);
CronManager.register('scheduled-reports',  runScheduledReports,    24 * 60 * 60 * 1000,  80_000);
CronManager.register('achievement-check',  runAchievementCheck,    24 * 60 * 60 * 1000, 180_000);
CronManager.register('coaching-nudges',    runCoachingNudges,       7 * 24 * 60 * 60 * 1000, 200_000);
CronManager.register('leaderboard-refresh', runLeaderboardRefresh, 6 * 60 * 60 * 1000, 250_000);
CronManager.register('integration-sync',  async () => { const sb = getSupabaseAdmin(); return integrations.runScheduledSyncs(sb); }, 6 * 60 * 60 * 1000, 300_000);
CronManager.start();

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

// ── Website Visitor Tracking ─────────────────────────────
// /track/* routes are PUBLIC and allow any origin (called from clients' websites)

function isResidentialIsp(name) {
  const residential = [
    'comcast', 'verizon', 'at&t', 'spectrum', 'cox', 'charter', 't-mobile',
    'xfinity', 'frontier', 'centurylink', 'residential', 'broadband', 'cable',
    'fiber', 'dsl', 'wisp', 'internet provider', 'isp', 'home', 'wireless',
  ];
  const lower = name.toLowerCase();
  return residential.some((r) => lower.includes(r));
}

const trackLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 600,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(204).end(), // silently ignore — never error on tracking
});

app.post('/track/visit', cors({ origin: '*', methods: ['POST', 'OPTIONS'] }), trackLimiter, async (req, res) => {
  // Always respond immediately — tracking must never slow the client page
  res.status(204).end();

  try {
    const { tracking_key, url: pageUrl, referrer, title, session_id } = req.body || {};
    if (!tracking_key) return;

    const ip = (req.headers['x-forwarded-for'] || '').split(',')[0]?.trim()
      || req.headers['x-real-ip']
      || req.socket?.remoteAddress;
    if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) return;

    const sb = getSupabaseAdmin();
    if (!sb) return;

    // Resolve organization by tracking_key (organization_id)
    const { data: org } = await sb
      .from('organizations')
      .select('id, name')
      .eq('id', tracking_key)
      .single();
    if (!org) return;

    // Resolve IP → company via IPInfo
    let companyName = null;
    let companyDomain = null;
    try {
      const token = process.env.IPINFO_TOKEN;
      const ipUrl = `https://ipinfo.io/${ip}${token ? `?token=${token}` : '/json'}`;
      const ipResp = await fetch(ipUrl, { signal: AbortSignal.timeout(3000) });
      if (ipResp.ok) {
        const ipData = await ipResp.json();
        // org field format: "AS12345 Google LLC" — strip ASN prefix
        if (ipData.org) companyName = ipData.org.replace(/^AS\d+\s+/, '').trim();
        if (ipData.hostname) {
          companyDomain = ipData.hostname.replace(/^[^.]+\./, '');
        }
      }
    } catch { /* IPInfo timeout — skip */ }

    if (!companyName || isResidentialIsp(companyName)) return;

    const now = new Date().toISOString();
    const sessionKey = session_id || `${ip}-${Math.floor(Date.now() / (30 * 60 * 1000))}`;

    // Upsert visitor session (30-min windows)
    await sb.from('website_visitors').upsert(
      {
        organization_id: org.id,
        session_id: sessionKey,
        ip_address: ip,
        company_name: companyName,
        company_domain: companyDomain,
        last_seen_url: pageUrl,
        referrer,
        page_title: title,
        page_views: 1,
        first_seen_at: now,
        last_seen_at: now,
      },
      { onConflict: 'session_id' }
    );

    // Emit one website_visit signal per company per day (not per pageview)
    const today = now.slice(0, 10);
    const { data: existing } = await sb
      .from('engage_intent_signals')
      .select('id')
      .eq('organization_id', org.id)
      .eq('company_name', companyName)
      .eq('signal_type', 'website_visit')
      .gte('detected_at', today)
      .limit(1);

    if (!existing?.length) {
      await sb.from('engage_intent_signals').insert({
        organization_id: org.id,
        company_name: companyName,
        signal_type: 'website_visit',
        title: `${companyName} visited your website`,
        description: `Someone from ${companyName} visited ${pageUrl || 'your site'}${referrer ? ` (via ${referrer})` : ''}`,
        signal_score: 70,
        signal_strength: 'medium',
        buying_stage_indicator: 'consideration',
        source_url: pageUrl,
        source_platform: 'website',
        status: 'new',
        detected_at: now,
        ai_summary: `A visitor from ${companyName} is actively browsing your website.`,
        ai_outreach_angle: `They were on your site today — reach out while the problem is top of mind.`,
        raw_data: { ip, page: pageUrl, referrer, title, session_id: sessionKey },
      });
    }
  } catch (err) {
    console.error('[track/visit]', err.message);
  }
});

// ── Website Visitors list (authenticated) ─────────────────

app.get('/api/track/visitors', async (req, res) => {
  try {
    const { organization_id, days = 7 } = req.query;
    if (!organization_id) return res.status(400).json({ error: 'organization_id required' });
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Database unavailable' });
    const since = new Date(Date.now() - Number(days) * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await sb
      .from('website_visitors')
      .select('company_name, company_domain, last_seen_url, page_title, last_seen_at, page_views')
      .eq('organization_id', organization_id)
      .gte('last_seen_at', since)
      .order('last_seen_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    // Deduplicate by company_name, keep most recent
    const seen = new Set();
    const unique = (data || []).filter((v) => {
      if (seen.has(v.company_name)) return false;
      seen.add(v.company_name);
      return true;
    });
    return res.json({ ok: true, visitors: unique });
  } catch (err) {
    console.error('[track/visitors]', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Twilio Click-to-Call ───────────────────────────────────────────────────

// Generate a short-lived Twilio access token for the frontend Voice SDK Device.
// The frontend uses this token to register a Device and initiate outbound calls.
app.post('/api/engage/calls/token', async (req, res) => {
  try {
    const accountSid  = process.env.TWILIO_ACCOUNT_SID;
    const apiKeySid   = process.env.TWILIO_API_KEY_SID;
    const apiKeySecret = process.env.TWILIO_API_KEY_SECRET;
    const appSid      = process.env.TWILIO_APP_SID;

    if (!accountSid || !apiKeySid || !apiKeySecret || !appSid) {
      return res.status(503).json({ error: 'Twilio not configured on this server (missing API Key)' });
    }

    const twilio = require('twilio');
    const { AccessToken } = twilio.jwt;
    const { VoiceGrant } = AccessToken;

    const identity = req.user?.id || 'anonymous';
    const token = new AccessToken(accountSid, apiKeySid, apiKeySecret, { identity, ttl: 3600 });

    const grant = new VoiceGrant({
      outgoingApplicationSid: appSid,
      incomingAllow: false,
    });
    token.addGrant(grant);

    return res.json({ token: token.toJwt(), identity });
  } catch (err) {
    console.error('[twilio/token]', err.message);
    return res.status(500).json({ error: 'Failed to generate call token' });
  }
});

// TwiML webhook — called by Twilio server-to-server when a call is initiated.
// Returns <Dial> instructions. No auth (Twilio doesn't send a user JWT).
app.post('/api/engage/calls/twiml', (req, res) => {
  const to   = (req.body?.To || '').trim();
  const from = (process.env.TWILIO_PHONE_NUMBER || '').trim();

  const twilio = require('twilio');
  const VoiceResponse = twilio.twiml.VoiceResponse;
  const twiml = new VoiceResponse();

  const e164Pattern = /^\+[1-9]\d{7,14}$/;
  if (!to || !e164Pattern.test(to)) {
    console.warn('[twilio/twiml] Rejected invalid To number:', to);
    twiml.say('Invalid destination number.');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  if (!from) {
    console.error('[twilio/twiml] TWILIO_PHONE_NUMBER not configured');
    twiml.hangup();
    res.type('text/xml');
    return res.send(twiml.toString());
  }

  const dial = twiml.dial({ callerId: from, timeout: 30, record: 'do-not-record' });
  dial.number(to);

  res.type('text/xml');
  return res.send(twiml.toString());
});

// ── Action Queue Endpoints ─────────────────────────────────────────────────

// GET /api/engage/action-queue — list pending action queue items for org
app.get('/api/engage/action-queue', loadProfile, async (req, res) => {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Service unavailable' });

  const orgId = req.userProfile?.organization_id;
  if (!orgId) return res.status(400).json({ error: 'No organization found' });

  const { data, error } = await sb
    .from('engage_signal_actions')
    .select(`
      *,
      signal:signal_id (
        id, company_name, signal_type, signal_score,
        buying_stage_indicator, title, description,
        ai_recommended_action, ai_outreach_angle, status
      )
    `)
    .eq('org_id', orgId)
    .eq('status', 'pending')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true, items: data || [] });
});

// POST /api/engage/action-queue/:id/approve — mark as approved
app.post('/api/engage/action-queue/:id/approve', loadProfile, requireMinRole('manager'), async (req, res) => {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Service unavailable' });

  const orgId = req.userProfile?.organization_id;
  const { id } = req.params;

  const { error } = await sb
    .from('engage_signal_actions')
    .update({ status: 'approved', actioned_at: new Date().toISOString(), actioned_by: req.user.id })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// POST /api/engage/action-queue/:id/dismiss — dismiss a queued action
app.post('/api/engage/action-queue/:id/dismiss', loadProfile, async (req, res) => {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Service unavailable' });

  const orgId = req.userProfile?.organization_id;
  const { id } = req.params;

  const { error } = await sb
    .from('engage_signal_actions')
    .update({ status: 'dismissed', actioned_at: new Date().toISOString(), actioned_by: req.user.id })
    .eq('id', id)
    .eq('org_id', orgId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// POST /api/engage/signals/:id/outcome — record outcome on an actioned signal
app.post('/api/engage/signals/:id/outcome', loadProfile, async (req, res) => {
  const sb = getSupabaseAdmin();
  if (!sb) return res.status(503).json({ error: 'Service unavailable' });

  const orgId = req.userProfile?.organization_id;
  const { id } = req.params;
  const { outcome, deal_id } = req.body || {};

  if (!['won', 'lost', 'pending'].includes(outcome)) {
    return res.status(400).json({ error: 'outcome must be won, lost, or pending' });
  }

  const update = {
    outcome,
    outcome_at: new Date().toISOString(),
    ...(deal_id ? { contributed_to_deal_id: deal_id } : {}),
  };

  const { error } = await sb
    .from('engage_intent_signals')
    .update(update)
    .eq('id', id)
    .eq('organization_id', orgId);

  if (error) return res.status(500).json({ error: error.message });
  return res.json({ ok: true });
});

// Manual trigger for signal scan (admins only)
app.post('/api/engage/signals/trigger-scan', loadProfile, requireMinRole('admin'), async (req, res) => {
  const result = await runSignalScan();
  return res.json({ ...result, message: `Scanned ${result.orgsScanned} orgs, skipped ${result.orgsSkipped}.` });
});

// Manual trigger for scorecard alerts (managers+)
app.post('/api/engage/scorecard/trigger-alerts', loadProfile, requireMinRole('manager'), async (req, res) => {
  const result = await runScorecardAlerts();
  return res.json({ ...result, message: `Sent ${result.notified} scorecard alert(s) across ${result.orgs} org(s).` });
});

// Manual trigger for achievement check (admins only)
app.post('/api/achievements/check-and-award', loadProfile, requireMinRole('admin'), async (req, res) => {
  const result = await runAchievementCheck();
  return res.json({ ...result, message: `Checked ${result.reps} reps, awarded ${result.achieved} achievements, sent ${result.notified} notifications.` });
});

// Manual trigger for badge auto-award (admins only)
app.post('/api/badges/check-and-award', loadProfile, requireMinRole('admin'), async (req, res) => {
  const result = await runBadgeAutoAward();
  return res.json({ ...result, message: `Awarded ${result.awarded} badges, sent ${result.notified} notifications.` });
});

// ── Integration Framework Routes ──────────────────────────────────────────────

// Load provider modules (each registers itself)
try {
  const fs = require('fs');
  const path = require('path');
  const providersDir = path.join(__dirname, 'providers');
  if (fs.existsSync(providersDir)) {
    for (const file of fs.readdirSync(providersDir)) {
      if (file.endsWith('.js')) {
        const provider = require(path.join(providersDir, file));
        if (provider && provider.type) {
          integrations.registerProvider(provider);
          console.log(`[integrations] Registered provider: ${provider.type}`);
        }
      }
    }
  }
} catch (err) {
  console.warn('[integrations] Error loading providers:', err.message);
}

// List all integrations for the user's organization
app.get('/api/integrations', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const data = await integrations.listIntegrations(sb, req.userProfile.organization_id);
    return res.json({ ok: true, integrations: data });
  } catch (err) {
    console.error('[integrations] List error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// List available integration templates
app.get('/api/integrations/templates', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { data, error } = await sb.from('integration_mapping_templates')
      .select('*').eq('is_active', true).order('display_name');
    if (error) throw error;
    return res.json({ ok: true, templates: data || [] });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get a single integration
app.get('/api/integrations/:id', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const data = await integrations.getIntegration(sb, req.params.id, req.userProfile.organization_id);
    return res.json({ ok: true, integration: data });
  } catch (err) {
    return res.status(404).json({ error: 'Integration not found' });
  }
});

// Create integration with credentials (API key providers like Apollo, Marketo)
app.post('/api/integrations', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { integration_type, credentials } = req.body;
    if (!integration_type || !credentials) {
      return res.status(400).json({ error: 'integration_type and credentials are required' });
    }
    const orgId = req.userProfile.organization_id;

    // Encrypt credentials before storing
    const encrypted = integrations.encryptCredentials(credentials);

    // Upsert: if integration already exists for this org+type, update it; otherwise create
    const { data: existing } = await sb.from('integrations')
      .select('id')
      .eq('organization_id', orgId)
      .eq('integration_type', integration_type)
      .maybeSingle();

    if (existing) {
      await sb.from('integrations').update({
        credentials: encrypted,
        status: 'connected',
        is_enabled: true,
        updated_at: new Date().toISOString(),
      }).eq('id', existing.id);
    } else {
      const provider = integrations.getProvider(integration_type);
      await sb.from('integrations').insert({
        organization_id: orgId,
        integration_type,
        display_name: provider?.type || integration_type,
        credentials: encrypted,
        status: 'connected',
        is_enabled: true,
      });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[integrations] Create error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Update integration config (field mappings, sync config)
app.patch('/api/integrations/:id', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { field_mappings, sync_config, display_name } = req.body || {};
    const updates = { updated_at: new Date().toISOString() };
    if (field_mappings) updates.field_mappings = field_mappings;
    if (sync_config) updates.sync_config = sync_config;
    if (display_name) updates.display_name = display_name;
    const { error } = await sb.from('integrations')
      .update(updates)
      .eq('id', req.params.id)
      .eq('organization_id', req.userProfile.organization_id);
    if (error) throw error;
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Disconnect/delete an integration
app.delete('/api/integrations/:id', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    // Verify ownership
    const { data: check } = await sb.from('integrations')
      .select('id').eq('id', req.params.id).eq('organization_id', req.userProfile.organization_id).maybeSingle();
    if (!check) return res.status(404).json({ error: 'Integration not found' });
    await integrations.disconnectIntegration(sb, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Start OAuth flow
app.get('/api/integrations/oauth/:provider/init', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { authUrl } = await integrations.initOAuth(
      sb, req.userProfile.organization_id, req.params.provider, req.user.id
    );
    return res.redirect(authUrl);
  } catch (err) {
    console.error('[oauth] Init error:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/systems?error=${encodeURIComponent(err.message)}`);
  }
});

// OAuth callback (public — no auth required, validated by state param)
app.get('/api/integrations/oauth/:provider/callback', async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).send('Service unavailable');
    const { code, state, error: oauthError } = req.query;
    if (oauthError) {
      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      return res.redirect(`${frontendUrl}/systems?error=${encodeURIComponent(oauthError)}`);
    }
    if (!code || !state) {
      return res.status(400).send('Missing code or state parameter');
    }
    await integrations.handleOAuthCallback(sb, req.params.provider, code, state);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    // Return a small HTML page that sends a message to the opener and closes itself
    return res.send(`<!DOCTYPE html><html><body><script>
      if (window.opener) { window.opener.postMessage({ type: 'oauth-success', provider: '${req.params.provider}' }, '*'); }
      window.close();
    </script><p>Connected! You can close this window.</p></body></html>`);
  } catch (err) {
    console.error('[oauth] Callback error:', err.message);
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
    return res.redirect(`${frontendUrl}/systems?error=${encodeURIComponent(err.message)}`);
  }
});

// Trigger on-demand sync
app.post('/api/integrations/:id/sync', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    // Verify ownership
    const { data: check } = await sb.from('integrations')
      .select('id').eq('id', req.params.id).eq('organization_id', req.userProfile.organization_id).maybeSingle();
    if (!check) return res.status(404).json({ error: 'Integration not found' });
    // Respond immediately, run sync in background
    res.json({ ok: true, message: 'Sync started' });
    integrations.runIntegrationSync(sb, req.params.id, req.body?.entityTypes || null).catch(err => {
      console.error(`[sync] Background sync error for ${req.params.id}:`, err.message);
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Get sync history
app.get('/api/integrations/:id/sync-history', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const data = await integrations.getSyncHistory(sb, req.params.id, parseInt(req.query.limit) || 20);
    return res.json({ ok: true, history: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Generic webhook ingest (provider-specific routing)
app.post('/api/webhooks/:provider', async (req, res) => {
  // Respond 200 immediately (fire-and-forget pattern)
  res.status(200).json({ received: true });
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return;
    await integrations.processWebhook(sb, req.params.provider, req);
  } catch (err) {
    console.error(`[webhook] ${req.params.provider} error:`, err.message);
  }
});

// Calendar events — list
app.get('/api/integrations/:id/calendar/events', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { start, end } = req.query;
    if (!start || !end) return res.status(400).json({ error: 'start and end query params required' });
    const data = await integrations.getCalendarEvents(sb, req.params.id, req.userProfile.organization_id, start, end);
    return res.json({ ok: true, events: data });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// Calendar events — create (push to provider)
app.post('/api/integrations/:id/calendar/events', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const result = await integrations.createCalendarEvent(sb, req.params.id, {
      ...req.body,
      profileId: req.userProfile.id,
    });
    return res.json({ ok: true, event: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Per-User (Personal) Integrations ──────────────────────────────────────

// List current user's personal integrations
app.get('/api/integrations/my', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const data = await integrations.listIntegrations(sb, req.userProfile.organization_id, { profileId: req.userProfile.id });
    return res.json({ ok: true, integrations: data });
  } catch (err) {
    console.error('[integrations/my] List error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Connect a personal integration (API key based)
app.post('/api/integrations/my', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const { integration_type, display_name, credentials } = req.body;
    if (!integration_type) return res.status(400).json({ error: 'integration_type is required' });

    const encrypted = credentials ? integrations.encryptCredentials(credentials) : {};
    const { data, error } = await sb.from('integrations').insert({
      organization_id: req.userProfile.organization_id,
      profile_id: req.userProfile.id,
      integration_type,
      display_name: display_name || integration_type,
      is_enabled: true,
      status: 'connected',
      credentials: encrypted,
      created_by: req.userProfile.id,
    }).select('id, integration_type, display_name, status, profile_id, created_at').single();
    if (error) throw error;
    return res.json({ ok: true, integration: data });
  } catch (err) {
    console.error('[integrations/my] Create error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Disconnect a personal integration (must be owned by the requesting user)
app.delete('/api/integrations/my/:id', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });

    // Verify ownership
    const { data: row, error: fetchErr } = await sb.from('integrations')
      .select('id, profile_id')
      .eq('id', req.params.id)
      .eq('organization_id', req.userProfile.organization_id)
      .single();
    if (fetchErr || !row) return res.status(404).json({ error: 'Integration not found' });
    if (row.profile_id !== req.userProfile.id) return res.status(403).json({ error: 'Cannot disconnect an integration you do not own' });

    await integrations.disconnectIntegration(sb, req.params.id);
    return res.json({ ok: true });
  } catch (err) {
    console.error('[integrations/my] Delete error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// Start OAuth flow for a personal integration
app.get('/api/integrations/oauth/:provider/init-personal', loadProfile, async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });
    const result = await integrations.initOAuth(
      sb,
      req.userProfile.organization_id,
      req.params.provider,
      req.userProfile.id,
      req.userProfile.id  // profileId — marks this as a personal integration
    );
    return res.json({ ok: true, ...result });
  } catch (err) {
    console.error('[integrations/my] OAuth init error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ── Invite Members ────────────────────────────────────────────────────────
app.post('/api/users/invite', loadProfile, requireMinRole('admin'), async (req, res) => {
  try {
    const sb = getSupabaseAdmin();
    if (!sb) return res.status(503).json({ error: 'Service unavailable' });

    const { emails, role = 'power_user', team_id } = req.body;
    if (!Array.isArray(emails) || emails.length === 0) {
      return res.status(400).json({ error: 'emails array is required' });
    }
    if (emails.length > 50) {
      return res.status(400).json({ error: 'Maximum 50 emails per request' });
    }

    const validRoles = ['power_user', 'coach', 'manager', 'admin'];
    if (!validRoles.includes(role)) {
      return res.status(400).json({ error: `Invalid role. Must be one of: ${validRoles.join(', ')}` });
    }

    const orgId = req.userProfile.organization_id;
    if (!orgId) {
      return res.status(400).json({ error: 'Your account is not associated with an organization' });
    }
    const invitedBy = req.user.id; // use req.user.id (set by requireAuth, always valid)

    // Validate team_id exists (if provided). The frontend already scopes teams to the org.
    if (team_id) {
      const { data: team } = await sb.from('teams').select('id').eq('id', team_id).maybeSingle();
      if (!team) return res.status(400).json({ error: 'Invalid team_id' });
    }

    let invited = 0;
    let skipped = 0;
    const errors = [];

    for (const rawEmail of emails) {
      const email = rawEmail.trim().toLowerCase();
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        errors.push(`Invalid email: ${rawEmail}`);
        continue;
      }

      try {
        // Check if already in this org
        const { data: existing, error: lookupErr } = await sb
          .from('profiles')
          .select('id, organization_id')
          .eq('email', email)
          .maybeSingle();

        if (lookupErr) {
          errors.push(`${email}: lookup failed — ${lookupErr.message}`);
          continue;
        }

        if (existing?.organization_id === orgId) {
          skipped++;
          continue;
        }

        if (existing) {
          // User exists in a different org — do not silently reassign
          errors.push(`${email}: user belongs to another organization`);
          continue;
        } else {
          // Invite via Supabase auth (sends magic link email)
          const { data: authData, error: authErr } = await sb.auth.admin.inviteUserByEmail(email, {
            data: { role: toDbRole(role), organization_id: orgId },
            redirectTo: `${process.env.SITE_URL || 'https://apptivia.app'}/account-setup`,
          });
          if (authErr) {
            errors.push(`${email}: ${authErr.message}`);
            continue;
          }
          // Ensure profile row exists
          if (authData?.user) {
            const { error: upsertErr } = await sb.from('profiles').upsert({
              id: authData.user.id,
              email,
              role: toDbRole(role),
              organization_id: orgId,
              ...(team_id ? { team_id } : {}),
            }, { onConflict: 'id' });
            if (upsertErr) {
              console.error(`[invite] Profile upsert failed for ${email}:`, upsertErr.message);
              // Rollback: delete the auth user so they don't get a broken invite
              await sb.auth.admin.deleteUser(authData.user.id).catch(() => {});
              errors.push(`${email}: profile creation failed — ${upsertErr.message}`);
              continue;
            }
          } else {
            console.warn(`[invite] inviteUserByEmail returned no user object for ${email}`);
            errors.push(`${email}: unexpected response from auth service`);
            continue;
          }
          invited++;
        }

        // Record invitation
        const { error: invRecordErr } = await sb.from('invitations').insert({
          organization_id: orgId,
          email,
          role,
          team_id: team_id || null,
          invited_by: invitedBy,
          status: 'pending',
        });
        if (invRecordErr && !invRecordErr.message?.includes('duplicate')) {
          console.error(`[invite] Invitation record insert failed for ${email}:`, invRecordErr.message);
        }

      } catch (err) {
        errors.push(`${email}: ${err.message}`);
      }
    }

    return res.json({ invited, skipped, errors });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
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
