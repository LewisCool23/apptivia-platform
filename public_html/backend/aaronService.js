/**
 * aaronService.js — Aaron AI coaching service module
 * Extracted from server.js for maintainability.
 *
 * Call init({ getSupabaseAdmin, getAnthropic }) before using any function.
 */

// ── Dependency injection ─────────────────────────────────────────────────────
let _getSupabaseAdmin;
let _getAnthropic;

function init({ getSupabaseAdmin, getAnthropic }) {
  _getSupabaseAdmin = getSupabaseAdmin;
  _getAnthropic = getAnthropic;
}

// ── Sales DNA helper: fetch org's methodology + qualification context for AI prompts ──
const _salesDnaCache = {};

async function getSalesDnaContext(orgId) {
  if (!orgId) return '';

  const cached = _salesDnaCache[orgId];
  if (cached && (Date.now() - cached.ts) < 300000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    const { data: dna } = await sb
      .from('sales_dna_configs')
      .select('methodology, qualification_framework, custom_stages, coaching_philosophy, key_terminology')
      .eq('organization_id', orgId)
      .maybeSingle();

    if (!dna) {
      _salesDnaCache[orgId] = { data: '', ts: Date.now() };
      return '';
    }

    const parts = ['[SALES DNA — Organization Methodology]'];
    if (dna.methodology) parts.push(`Sales methodology: ${dna.methodology}`);
    if (dna.qualification_framework) parts.push(`Qualification framework: ${dna.qualification_framework}`);
    if (dna.custom_stages?.length) {
      parts.push(`Deal stages: ${dna.custom_stages.map(s => typeof s === 'string' ? s : s.name || s.label || '').filter(Boolean).join(' → ')}`);
    }
    if (dna.coaching_philosophy) parts.push(`Coaching philosophy: ${dna.coaching_philosophy}`);
    if (dna.key_terminology && Object.keys(dna.key_terminology).length) {
      const terms = Object.entries(dna.key_terminology).map(([k, v]) => `${k}: ${v}`).slice(0, 8);
      parts.push(`Key terms:\n  ${terms.join('\n  ')}`);
    }
    parts.push('IMPORTANT: When coaching, use this organization\'s methodology and terminology. Reference their specific stages, qualification criteria, and coaching philosophy when relevant.');

    const result = parts.length > 1 ? parts.join('\n') : '';
    _salesDnaCache[orgId] = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error('getSalesDnaContext error:', err.message);
    return '';
  }
}

// ── AI Style Rule ────────────────────────────────────────────────────────────
const AI_STYLE_RULE = `\nSTYLE RULE: Write in plain, direct business language. Never use these words or phrases: "delve", "unleash", "game-changer", "transformative", "unlock potential", "leverage" (as a verb), "cutting-edge", "revolutionary", "paradigm shift", "synergy", "elevate", "empower", "holistic", "robust", "seamless", "streamline", "harness". Be specific and concrete — not vague or generic.`;

// ── Aaron Coaching Frameworks ────────────────────────────────────────────────
const AARON_FRAMEWORKS = {
  jbarrows: {
    name: 'JBarrows Fill the Funnel',
    category: 'prospecting',
    triggers: ['prospect', 'outbound', 'cold call', 'pipeline', 'fill the funnel', 'opener', 'voicemail', 'email sequence', 'cadence', 'touch pattern', 'response rate', 'connect rate'],
    prompt: `[FRAMEWORK: JBarrows Fill the Funnel]\nCoach on prospecting fundamentals: research-based openers, multi-touch cadences, "What's In It For Them" messaging, voicemail + email combos, pattern interrupt techniques. Reference "Make It About Them" philosophy. Suggest specific opener templates and cadence structures.`,
  },
  sandler: {
    name: 'Sandler Selling System',
    category: 'discovery',
    triggers: ['pain', 'budget', 'decision', 'qualify', 'sandler', 'pain funnel', 'negative reverse', 'upfront contract', 'thermometer', 'bonding rapport'],
    prompt: `[FRAMEWORK: Sandler Selling System]\nCoach on Sandler methodology: Pain Funnel questioning (surface → impact → personal), Upfront Contracts, Budget step, Decision process, Negative Reverse Selling. Help reps move past "happy ears" to real qualification. Reference the Sandler submarine and pain/budget/decision triangle.`,
  },
  meddpicc: {
    name: 'MEDDPICC',
    category: 'qualification',
    triggers: ['meddpicc', 'champion', 'economic buyer', 'decision criteria', 'decision process', 'metrics', 'identify pain', 'paper process', 'competition', 'implicate'],
    prompt: `[FRAMEWORK: MEDDPICC]\nCoach on MEDDPICC qualification: Metrics (quantified value), Economic Buyer (power), Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion (who sells internally), Competition. Help the rep assess deal health by checking each letter. Flag gaps.`,
  },
  spin: {
    name: 'SPIN Selling',
    category: 'discovery',
    triggers: ['spin', 'situation question', 'problem question', 'implication', 'need-payoff', 'discovery call', 'discovery meeting', 'questioning technique', 'open-ended question'],
    prompt: `[FRAMEWORK: SPIN Selling]\nCoach on SPIN question progression: Situation (context), Problem (explicit difficulties), Implication (consequences of inaction), Need-Payoff (value of solving). Help reps craft specific questions for each stage. Emphasize moving beyond Situation to Implication quickly.`,
  },
  challenger: {
    name: 'Challenger Sale',
    category: 'methodology',
    triggers: ['challenger', 'teach', 'tailor', 'take control', 'commercial insight', 'reframe', 'constructive tension', 'insight selling', 'provocative'],
    prompt: `[FRAMEWORK: Challenger Sale]\nCoach on the Challenger approach: Teach (commercial insight that reframes thinking), Tailor (adapt message to stakeholder), Take Control (drive toward decision with constructive tension). Help reps develop provocative insights and push back on status quo without being aggressive.`,
  },
  gapSelling: {
    name: 'Gap Selling',
    category: 'discovery',
    triggers: ['gap', 'current state', 'future state', 'gap selling', 'impact', 'root cause', 'business problem', 'technical problem', 'impact chain'],
    prompt: `[FRAMEWORK: Gap Selling]\nCoach on identifying the gap between current state and desired future state. Help reps map: Current State (what's broken) → Impact (business consequences) → Root Cause → Future State (what good looks like) → Solution (how to bridge). The bigger the gap, the more urgency and budget available.`,
  },
  valueFramework: {
    name: 'Value-Based Selling',
    category: 'negotiation',
    triggers: ['value', 'roi', 'business case', 'pricing', 'discount', 'negotiat', 'cost justify', 'payback period', 'total cost', 'value prop'],
    prompt: `[FRAMEWORK: Value-Based Selling]\nCoach on building and defending value: ROI calculation, business case structure, cost of inaction, payback period analysis. Help reps avoid discounting by anchoring to value delivered. Suggest frameworks for presenting price in context of total value and cost of the problem.`,
  },
  objectionHandling: {
    name: 'Objection Handling',
    category: 'negotiation',
    triggers: ['objection', 'pushback', 'concern', 'not interested', 'too expensive', 'already have', 'think about it', 'no budget', 'timing', 'competitor', 'ghosting', 'gone dark'],
    prompt: `[FRAMEWORK: Objection Handling]\nCoach on structured objection handling: Acknowledge → Clarify → Respond → Confirm. Help reps distinguish between real objections (budget, authority, need, timing) and smokescreens. Provide specific language patterns for common objections. Reference LAER: Listen, Acknowledge, Explore, Respond.`,
  },
  coaching: {
    name: 'Sales Coaching Framework',
    category: 'coaching',
    triggers: ['coach', 'mentor', '1:1', 'one on one', 'performance review', 'feedback', 'develop', 'training', 'skill gap', 'ride along', 'call review', 'pipeline review'],
    prompt: `[FRAMEWORK: Sales Coaching]\nCoach on effective sales coaching: Observe → Diagnose → Prescribe → Follow-up. Help managers identify coachable moments, deliver feedback using SBI (Situation-Behavior-Impact), and create development plans. Focus on one skill at a time. Reference the 70-20-10 development model (experience, exposure, education).`,
  },
  forecastAccuracy: {
    name: 'Forecast & Pipeline',
    category: 'analytics',
    triggers: ['forecast', 'pipeline', 'coverage', 'weighted', 'commit', 'best case', 'upside', 'close date', 'slip', 'push', 'pipeline velocity', 'win rate', 'average deal size', 'sales cycle'],
    prompt: `[FRAMEWORK: Forecast & Pipeline Management]\nCoach on forecast discipline: pipeline coverage ratio (3-4x), stage verification, commit vs best case categories, close date hygiene. Help identify deals that should move stages, stalled opportunities, and pipeline gaps by segment/rep/timeframe. Reference pipeline velocity = (Opportunities × Win Rate × Deal Size) / Sales Cycle.`,
  },
  timeManagement: {
    name: 'Sales Productivity',
    category: 'coaching',
    triggers: ['productivity', 'time management', 'priorit', 'efficiency', 'admin time', 'selling time', 'activity', 'territory', 'planning', 'time block', 'crm hygiene', 'data entry'],
    prompt: `[FRAMEWORK: Sales Productivity]\nCoach on maximizing selling time: time blocking for prospecting/admin/deals, territory planning, A/B/C account prioritization, CRM hygiene habits, meeting preparation. Help reps identify and eliminate time sinks. Reference the "revenue-generating activities" framework — every hour should map to pipeline or deal advancement.`,
  },
  socialSelling: {
    name: 'Social Selling',
    category: 'prospecting',
    triggers: ['linkedin', 'social', 'personal brand', 'content', 'engagement', 'networking', 'thought leader', 'inbound', 'warm intro', 'referral'],
    prompt: `[FRAMEWORK: Social Selling]\nCoach on LinkedIn/social selling strategy: profile optimization, content sharing cadence, engagement tactics (comment-first approach), warm introduction requests, trigger event monitoring. Help reps build a personal brand that drives inbound. Reference SSI (Social Selling Index) improvement tactics.`,
  },
  accountPlanning: {
    name: 'Strategic Account Planning',
    category: 'methodology',
    triggers: ['account plan', 'strategic account', 'land and expand', 'whitespace', 'org chart', 'multi-thread', 'executive sponsor', 'power map', 'influence map', 'buying committee'],
    prompt: `[FRAMEWORK: Strategic Account Planning]\nCoach on account strategy: stakeholder mapping (power/influence grid), multi-threading across the buying committee, land-and-expand plays, whitespace analysis, executive engagement strategy. Help reps build account plans that identify expansion opportunities and reduce single-thread risk.`,
  },
  closingTechniques: {
    name: 'Closing & Negotiation',
    category: 'negotiation',
    triggers: ['close', 'closing', 'proposal', 'contract', 'signature', 'procurement', 'legal review', 'mutual action plan', 'map', 'paper process', 'terms', 'redline'],
    prompt: `[FRAMEWORK: Closing & Negotiation]\nCoach on closing mechanics: Mutual Action Plans (MAP), paper process navigation, procurement/legal readiness, trial close techniques, creating urgency without pressure. Help reps build close plans that account for all stakeholders and internal processes. Reference the "give to get" negotiation principle.`,
  },
};

// ── Preset → Framework mapping ───────────────────────────────────────────────
const PRESET_FRAMEWORK_MAP = {
  'BDR/SDR Coaching': ['jbarrows', 'objectionHandling', 'socialSelling'],
  'AE Deal Strategy': ['meddpicc', 'gapSelling', 'closingTechniques'],
  'Pipeline Review': ['forecastAccuracy', 'meddpicc', 'accountPlanning'],
  'Objection Handling': ['objectionHandling', 'valueFramework', 'challenger'],
  'Call Review': ['spin', 'sandler', 'objectionHandling'],
  'Coaching Session': ['coaching', 'timeManagement', 'forecastAccuracy'],
  'Deal Review': ['meddpicc', 'valueFramework', 'closingTechniques'],
  'Discovery Prep': ['spin', 'gapSelling', 'sandler'],
  'Forecast Accuracy': ['forecastAccuracy', 'meddpicc', 'accountPlanning'],
  'Negotiation Prep': ['closingTechniques', 'valueFramework', 'objectionHandling'],
  'Account Strategy': ['accountPlanning', 'challenger', 'socialSelling'],
  'Motivation & Mindset': ['coaching', 'timeManagement', 'jbarrows'],
  'Onboarding New Rep': ['jbarrows', 'spin', 'timeManagement'],
  'Territory Planning': ['accountPlanning', 'timeManagement', 'forecastAccuracy'],
};

// ── Page → Category boosts ───────────────────────────────────────────────────
const PAGE_CATEGORY_BOOSTS = {
  scorecard: ['analytics', 'coaching'],
  coach: ['coaching', 'methodology'],
  engage: ['prospecting'],
  analytics: ['analytics'],
  contests: ['coaching'],
};

// ── Framework Detection ──────────────────────────────────────────────────────
function detectFrameworks(message, rolePreset, page, history) {
  // 1. Preset mapping takes priority
  if (rolePreset && PRESET_FRAMEWORK_MAP[rolePreset]) {
    const presetFrameworks = PRESET_FRAMEWORK_MAP[rolePreset];
    return presetFrameworks.slice(0, 3);
  }

  // 2. Score each framework by keyword match
  const lower = (message || '').toLowerCase();
  const scores = {};

  for (const [key, fw] of Object.entries(AARON_FRAMEWORKS)) {
    let score = 0;
    for (const trigger of fw.triggers) {
      if (lower.includes(trigger)) score += 2;
    }
    // Check last 3 user messages from history (lower weight)
    if (history && history.length > 0) {
      const recentUserMsgs = history.filter(h => h.role === 'user').slice(-3);
      for (const msg of recentUserMsgs) {
        const histLower = (msg.content || '').toLowerCase();
        for (const trigger of fw.triggers) {
          if (histLower.includes(trigger)) score += 0.5;
        }
      }
    }
    // Page context boost
    if (page) {
      const boostCategories = PAGE_CATEGORY_BOOSTS[page] || [];
      if (boostCategories.includes(fw.category)) score += 1;
    }
    if (score > 0) scores[key] = score;
  }

  // 3. Sort by score descending, cap at 3
  return Object.entries(scores)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([key]) => key);
}

// ── System Prompt Builder ────────────────────────────────────────────────────
function buildFrameworkSystemPrompt(frameworkKeys, salesDnaContext, userContext, liveDataBlock, orgContextBlock, repMemoryBlock) {
  const { userName, role, page } = userContext;

  let prompt = `You are Aaron, an AI sales productivity coach embedded in the Apptivia platform. You are a senior strategist — not a generic AI assistant. You help sales reps, managers, and admins improve their performance with specific, actionable, framework-backed coaching.

Key context:
- User: ${userName || 'User'} (Role: ${role || 'power_user'})
- Current page: ${page || 'unknown'}
- Apptivia features: Scorecard (KPI tracking), Coach (skill development), Contests (sales competitions), Analytics, Engage (signal prospecting, outreach, account intelligence), Badges & Achievements
- Apptivia Levels: Developing → Intermediate → Proficient → Elite → Master (based on cumulative points)
- Skillsets: Conversationalist, Call Conqueror, Email Warrior, Pipeline Guru, Task Master, Scorecard Master`;

  // Add Sales DNA methodology
  if (salesDnaContext) {
    prompt += '\n' + salesDnaContext;
  }

  // Add organization context (name, ICP, CEP pipeline, user title)
  if (orgContextBlock) {
    prompt += '\n\n' + orgContextBlock;

    // Title-specific coaching mode injection
    const titleLower = (orgContextBlock.match(/User's title:\s*(.+?)(?:\n|$)/)?.[1] || '').toLowerCase();
    if (titleLower.includes('bdr') || titleLower.includes('sdr') || titleLower.includes('business development')) {
      prompt += '\n\nCOACHING MODE — BDR/SDR: Focus on activity volume, call quality, and pipeline generation. Coach on prospecting fundamentals — openers, objection handling, email personalization, and meeting-to-opportunity conversion. Be direct and tactical.';
    } else if (titleLower.includes('account executive') || titleLower.includes(' ae') || titleLower === 'ae') {
      prompt += '\n\nCOACHING MODE — AE: Focus on deal strategy, pipeline management, and closing skills. Coach on discovery quality, multi-threading, value selling, executive engagement, and navigating complex deals through stages. Be strategic and consultative.';
    } else if (titleLower.includes('manager') || titleLower.includes('director') || titleLower.includes('vp')) {
      prompt += '\n\nCOACHING MODE — Sales Leader: Focus on team performance patterns, coaching leverage points, and pipeline health. Help identify which reps need attention, suggest 1-on-1 talking points, and recommend team-wide improvements. Be analytical and leadership-oriented.';
    // RevOps coaching mode
    } else if (
      titleLower.includes('revops') ||
      titleLower.includes('revenue operations') ||
      titleLower.includes('rev ops') ||
      titleLower.includes('operations')
    ) {
      prompt += '\n\nCOACHING MODE — RevOps: You are speaking with a Revenue Operations leader. They built the CRM and the dashboards. Their problem is not data — it is that managers do not act on data. Focus on: translating KPI and scorecard data into specific manager actions, identifying which reps need attention and articulating exactly why, and showing how Apptivia closes the loop between data and behavior change. Be analytical and systems-oriented. Do not give rep-facing coaching — give ops-to-management translation.';
    // CRO/VP coaching mode
    } else if (
      titleLower.includes('cro') ||
      titleLower.includes('chief revenue') ||
      titleLower.includes('vp of sales') ||
      titleLower.includes('head of sales') ||
      titleLower.includes('revenue leader')
    ) {
      prompt += '\n\nCOACHING MODE — CRO/VP Sales: You are speaking with a senior revenue leader. They already have tools — Gong, Salesforce, Outreach, or similar. Their problem is that data does not coach anyone. Focus on: quota attainment patterns across the team, which managers are coaching effectively vs by gut, pipeline health at the org level, and how to use Apptivia to create a data-driven coaching culture without adding another tool to the stack. Be strategic and outcome-oriented.';
    }
  }

  // Add rep memory (persistent coaching context)
  if (repMemoryBlock) {
    prompt += '\n\n' + repMemoryBlock;
  }

  // Add live data block
  if (liveDataBlock) {
    prompt += '\n\n' + liveDataBlock;
  }

  // Add framework coaching blocks
  if (frameworkKeys.length > 0) {
    prompt += '\n\n=== ACTIVE COACHING FRAMEWORKS ===';
    for (const key of frameworkKeys) {
      const fw = AARON_FRAMEWORKS[key];
      if (fw) prompt += '\n\n' + fw.prompt;
    }
    if (frameworkKeys.length > 1) {
      prompt += '\n\nIMPORTANT: When multiple frameworks apply, seamlessly weave their principles together in your response. Don\'t list framework names to the user — just apply the coaching naturally and specifically.';
    }
  }

  prompt += `\n\nGuidelines:
- Be concise, encouraging, and actionable. Lead with the most impactful advice.
- Reference specific frameworks, techniques, and step-by-step structures — not generic tips.
- When live data is available, reference the user's actual numbers (e.g., "Your Calls are at 75% — let's focus on improving that").
- Frame coaching in the context of the organization's sales methodology when available.
- If the user asks about admin/team features they may not have access to, guide them appropriately based on their role.
- Never share sensitive data or make up specific performance numbers that aren't in the live data block.
- Keep responses focused and structured. Use bullet points or numbered steps for actionable advice.` + AI_STYLE_RULE;

  return prompt;
}

// ── In-memory caches ─────────────────────────────────────────────────────────
const _aaronDailyLimits = {};
const _aaronLiveCache = {};
const _aaronOrgCache = {};

// ── Fetch live KPI data, anomalies, and signal count for Aaron context ───────
async function fetchAaronLiveContext(userId, organizationId) {
  if (!userId || !organizationId) return '';

  // Check cache (60s TTL)
  const cacheKey = `${userId}_${organizationId}`;
  const cached = _aaronLiveCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    // Run all queries in parallel with 3s timeout
    const timeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);

    const [kpiResult, anomalyResult, signalResult] = await Promise.allSettled([
      // 1. Current week KPIs for this user (join kpi_metrics for name + goal)
      timeout(
        sb.from('kpi_values')
          .select('kpi_id, value, kpi_metrics:kpi_id(name, goal)')
          .eq('profile_id', userId)
          .order('period_start', { ascending: false })
          .limit(10)
      ),
      // 2. Recent anomalies
      timeout(
        sb.from('notifications')
          .select('title, message')
          .eq('profile_id', userId)
          .eq('type', 'kpi_anomaly')
          .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(5)
      ),
      // 3. Signal count for org
      timeout(
        sb.from('engage_intent_signals')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('detected_at', new Date(Date.now() - 7 * 86400000).toISOString())
      ),
    ]);

    const parts = ['[LIVE DATA — This Week]'];

    // KPI values (joined via kpi_metrics)
    if (kpiResult.status === 'fulfilled' && kpiResult.value?.data?.length) {
      const kpis = kpiResult.value.data;
      const kpiLines = kpis
        .filter(k => k.kpi_metrics?.name)
        .map(k => {
          const goal = k.kpi_metrics?.goal || 0;
          const pct = goal > 0 ? Math.round((k.value / goal) * 100) : 0;
          return `  ${k.kpi_metrics.name}: ${k.value}/${goal} (${pct}%)`;
        });
      if (kpiLines.length) parts.push('KPIs:\n' + kpiLines.join('\n'));
    }

    // Anomalies
    if (anomalyResult.status === 'fulfilled' && anomalyResult.value?.data?.length) {
      const alerts = anomalyResult.value.data.map(a => `  ${a.title}${a.message ? ': ' + a.message : ''}`);
      parts.push('KPI Alerts:\n' + alerts.join('\n'));
    }

    // Signal count
    if (signalResult.status === 'fulfilled' && signalResult.value?.count != null) {
      parts.push(`Engage: ${signalResult.value.count} new signals this week`);
    }

    const result = parts.length > 1 ? parts.join('\n') : '';

    // Cache result
    _aaronLiveCache[cacheKey] = { data: result, ts: Date.now() };

    return result;
  } catch (err) {
    console.error('fetchAaronLiveContext error:', err.message);
    return '';
  }
}

// ── Aaron Org Context (5-min cache) ──────────────────────────────────────────
async function fetchAaronOrgContext(organizationId, userId) {
  if (!organizationId) return '';

  const cacheKey = `${organizationId}_${userId || 'anon'}`;
  const cached = _aaronOrgCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < 300000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    const timeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);

    const [orgResult, cepResult, userTitleResult] = await Promise.allSettled([
      timeout(sb.from('organizations').select('name, industry, icp_config').eq('id', organizationId).single()),
      timeout(sb.from('cep_stages').select('stage_name, stage_order, win_probability, expected_days, exit_criteria, role_responsibilities').eq('organization_id', organizationId).eq('is_active', true).order('stage_order', { ascending: true })),
      userId
        ? timeout(sb.from('profiles').select('role, title_id, titles:title_id(title_name, description)').eq('id', userId).single())
        : Promise.resolve({ data: null }),
    ]);

    const parts = ['[ORGANIZATION CONTEXT]'];

    // Org identity + ICP
    if (orgResult.status === 'fulfilled' && orgResult.value?.data) {
      const org = orgResult.value.data;
      parts.push(`Company: ${org.name}${org.industry ? ` (${org.industry})` : ''}`);

      const icp = org.icp_config;
      if (icp?.enabled) {
        const icpParts = [];
        if (icp.target_industries?.length) icpParts.push(`Industries: ${icp.target_industries.slice(0, 5).join(', ')}`);
        if (icp.headcount_min || icp.headcount_max) icpParts.push(`Company size: ${icp.headcount_min || '?'}-${icp.headcount_max || '?'} employees`);
        if (icp.revenue_min_m || icp.revenue_max_m) icpParts.push(`Revenue: $${icp.revenue_min_m || '?'}M-$${icp.revenue_max_m || '?'}M`);
        if (icp.target_technologies?.length) icpParts.push(`Tech signals: ${icp.target_technologies.slice(0, 5).join(', ')}`);
        if (icpParts.length) parts.push(`ICP Profile:\n  ${icpParts.join('\n  ')}`);
      }
    }

    // CEP pipeline stages
    if (cepResult.status === 'fulfilled' && cepResult.value?.data?.length) {
      const stages = cepResult.value.data;
      const stageLines = stages.map(s => {
        let line = `  ${s.stage_order}. ${s.stage_name} (${s.win_probability}% prob`;
        if (s.expected_days) line += `, ~${s.expected_days}d`;
        line += ')';
        const criteria = s.exit_criteria;
        if (Array.isArray(criteria) && criteria.length) {
          line += ` — Exit: ${criteria.slice(0, 3).map(c => typeof c === 'string' ? c : c.label || c.text || '').filter(Boolean).join('; ')}`;
        }
        return line;
      });
      parts.push(`Sales Pipeline (CEP):\n${stageLines.join('\n')}`);
    }

    // User's title + role responsibilities
    if (userTitleResult.status === 'fulfilled' && userTitleResult.value?.data) {
      const profile = userTitleResult.value.data;
      const titleName = profile.titles?.title_name;
      if (titleName) {
        parts.push(`User's title: ${titleName}${profile.titles?.description ? ` (${profile.titles.description})` : ''}`);
        if (cepResult.status === 'fulfilled' && cepResult.value?.data?.length) {
          const responsibilities = cepResult.value.data
            .filter(s => Array.isArray(s.role_responsibilities) && s.role_responsibilities.some(r => r.title === titleName))
            .map(s => {
              const match = s.role_responsibilities.find(r => r.title === titleName);
              return `  ${s.stage_name}: ${match?.responsibility || match?.tasks || ''}`;
            })
            .filter(r => r.trim().length > r.indexOf(':') + 2);
          if (responsibilities.length) parts.push(`Your responsibilities by stage:\n${responsibilities.join('\n')}`);
        }
      }
    }

    const result = parts.length > 1 ? parts.join('\n') : '';
    _aaronOrgCache[cacheKey] = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error('fetchAaronOrgContext error:', err.message);
    return '';
  }
}

// ── Aaron cache eviction (every 10 min) ──────────────────────────────────────
setInterval(() => {
  const now = Date.now();
  let evicted = 0;
  for (const key of Object.keys(_aaronLiveCache)) {
    if (now - _aaronLiveCache[key].ts > 120000) { delete _aaronLiveCache[key]; evicted++; }
  }
  for (const key of Object.keys(_aaronOrgCache)) {
    if (now - _aaronOrgCache[key].ts > 600000) { delete _aaronOrgCache[key]; evicted++; }
  }
  for (const key of Object.keys(_salesDnaCache)) {
    if (now - _salesDnaCache[key].ts > 300000) { delete _salesDnaCache[key]; evicted++; }
  }
  for (const key of Object.keys(_aaronDailyLimits)) {
    const todayKey = new Date().toISOString().slice(0, 10);
    if (_aaronDailyLimits[key].date !== todayKey) { delete _aaronDailyLimits[key]; evicted++; }
  }
  if (evicted > 0) console.log(`[aaron-cache] Evicted ${evicted} stale entries`);
}, 10 * 60 * 1000);

// ── Aaron Rep Memory ─────────────────────────────────────────────────────────
async function fetchAaronRepMemory(userId, organizationId) {
  if (!userId || !organizationId) return { memory: null, block: '' };
  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return { memory: null, block: '' };

    const { data } = await sb
      .from('aaron_rep_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!data) return { memory: null, block: '' };

    const parts = ['[REP MEMORY — Persistent Context]'];
    if (data.summary) parts.push(`Summary: ${data.summary}`);
    if (data.goals?.length) parts.push(`Goals: ${data.goals.join('; ')}`);
    if (data.challenges?.length) parts.push(`Known challenges: ${data.challenges.join('; ')}`);
    if (data.strengths?.length) parts.push(`Strengths: ${data.strengths.join('; ')}`);
    if (data.preferences && Object.keys(data.preferences).length) {
      if (data.preferences.coaching_style) parts.push(`Preferred coaching style: ${data.preferences.coaching_style}`);
    }
    if (data.last_topics?.length) parts.push(`Recent topics: ${data.last_topics.join(', ')}`);
    parts.push('IMPORTANT: Reference this context naturally. Do not say "according to my memory" — just know this about the rep and weave it into coaching.');

    return { memory: data, block: parts.join('\n') };
  } catch (err) {
    console.error('fetchAaronRepMemory error:', err.message);
    return { memory: null, block: '' };
  }
}

async function updateAaronRepMemory(userId, organizationId, chatHistory) {
  try {
    const sb = _getSupabaseAdmin();
    const client = _getAnthropic();
    if (!sb || !client) return;

    const { data: existing } = await sb
      .from('aaron_rep_memory')
      .select('*')
      .eq('user_id', userId)
      .eq('organization_id', organizationId)
      .maybeSingle();

    const current = existing || {};

    const extractionPrompt = `Analyze this sales coaching conversation and extract/update the rep's profile.

EXISTING MEMORY:
${JSON.stringify({ goals: current.goals || [], challenges: current.challenges || [], strengths: current.strengths || [], preferences: current.preferences || {}, summary: current.summary || '' }, null, 2)}

RECENT CONVERSATION (last 10 messages):
${chatHistory.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

Return ONLY valid JSON (no markdown, no code blocks) with these fields. Preserve existing items unless contradicted, add new ones:
{"summary":"1-2 sentence coaching summary","goals":["array"],"challenges":["array"],"strengths":["array"],"preferences":{"coaching_style":"direct|supportive|analytical"},"last_topics":["last 3-5 topics"]}`;

    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 500,
      messages: [{ role: 'user', content: extractionPrompt }],
    });

    const text = (response.content[0]?.text || '').trim();
    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) parsed = JSON.parse(jsonMatch[1].trim());
      else return;
    }

    const memoryData = {
      user_id: userId,
      organization_id: organizationId,
      summary: parsed.summary || current.summary || null,
      goals: (parsed.goals || []).slice(0, 5),
      challenges: (parsed.challenges || []).slice(0, 5),
      strengths: (parsed.strengths || []).slice(0, 5),
      preferences: parsed.preferences || current.preferences || {},
      last_topics: (parsed.last_topics || []).slice(0, 5),
      message_count: (current.message_count || 0) + 5,
      last_updated: new Date().toISOString(),
    };

    await sb.from('aaron_rep_memory').upsert(memoryData, { onConflict: 'user_id,organization_id' });
  } catch (err) {
    console.error('updateAaronRepMemory error:', err.message);
  }
}

// ── Module exports ───────────────────────────────────────────────────────────
module.exports = {
  init,
  getSalesDnaContext,
  AI_STYLE_RULE,
  AARON_FRAMEWORKS,
  PRESET_FRAMEWORK_MAP,
  PAGE_CATEGORY_BOOSTS,
  detectFrameworks,
  buildFrameworkSystemPrompt,
  _aaronDailyLimits,
  _aaronLiveCache,
  _aaronOrgCache,
  fetchAaronLiveContext,
  fetchAaronOrgContext,
  fetchAaronRepMemory,
  updateAaronRepMemory,
};
