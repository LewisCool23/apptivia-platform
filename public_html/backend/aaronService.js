/**
 * aaronService.js — Aaron AI coaching service module
 * Extracted from server.js for maintainability.
 *
 * Call init({ getSupabaseAdmin, getAnthropic }) before using any function.
 */

// ── Model constants (single source of truth) ─────────────────────────────────
const { SONNET_MODEL, HAIKU_MODEL } = require('./modelConstants');

// ── Dependency injection ─────────────────────────────────────────────────────
let _getSupabaseAdmin;
let _getAnthropic;

function init({ getSupabaseAdmin, getAnthropic }) {
  _getSupabaseAdmin = getSupabaseAdmin;
  _getAnthropic = getAnthropic;
}

// ── Sales DNA helper: fetch org's methodology + qualification context for AI prompts ──
const _salesDnaCache = {};

// Methodology key → display name lookup
const _METHODOLOGY_NAMES = {
  spin_selling: 'SPIN Selling', challenger_sale: 'Challenger Sale',
  sandler_selling: 'Sandler Selling System', solution_selling: 'Solution Selling',
  consultative_selling: 'Consultative Selling', snap_selling: 'SNAP Selling',
  value_selling: 'Value Selling', command_of_message: 'Command of the Message',
  gap_selling: 'Gap Selling', miller_heiman: 'Miller Heiman (Strategic Selling)',
  target_account_selling: 'Target Account Selling', inbound_selling: 'Inbound Selling',
  neat_selling: 'N.E.A.T. Selling', conceptual_selling: 'Conceptual Selling',
};
const _QUAL_NAMES = {
  bant: 'BANT (Budget, Authority, Need, Timeline)',
  meddic: 'MEDDIC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion)',
  meddpicc: 'MEDDPICC (Metrics, Economic Buyer, Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion, Competition)',
};

async function getSalesDnaContext(orgId) {
  if (!orgId) return '';

  const cached = _salesDnaCache[orgId];
  if (cached && (Date.now() - cached.ts) < 300000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    // Read from organizations.sales_dna JSONB (single source of truth)
    const { data: org } = await sb
      .from('organizations')
      .select('sales_dna')
      .eq('id', orgId)
      .maybeSingle();

    const raw = org?.sales_dna;
    if (!raw || typeof raw !== 'object' || Object.keys(raw).length === 0) {
      _salesDnaCache[orgId] = { data: '', ts: Date.now() };
      return '';
    }

    const parts = ['[SALES DNA — Organization Methodology]'];

    // Derive methodology from approach type
    const approach = raw.methodology_approach;
    if (approach === 'custom') {
      const name = raw.custom_methodology_name || 'Custom';
      parts.push(`Sales methodology: ${name} (Proprietary)`);
      if (raw.custom_methodology_principles?.length) {
        parts.push('Core principles:');
        raw.custom_methodology_principles.forEach((p, i) => parts.push(`  ${i + 1}. ${p}`));
      }
    } else if (approach === 'hybrid') {
      const pri = _METHODOLOGY_NAMES[raw.primary_methodology] || raw.primary_methodology;
      const sec = _METHODOLOGY_NAMES[raw.secondary_methodology] || raw.secondary_methodology;
      parts.push(`Sales methodology: Hybrid — Primary: ${pri || 'unset'}, Secondary: ${sec || 'unset'}`);
    } else if (approach === 'single' && raw.primary_methodology) {
      const name = _METHODOLOGY_NAMES[raw.primary_methodology] || raw.primary_methodology;
      parts.push(`Sales methodology: ${name}`);
    }

    // Qualification framework
    if (raw.qualification_framework === 'custom') {
      const qfName = raw.custom_qualification_name || 'Custom Framework';
      parts.push(`Qualification framework: ${qfName}`);
      if (raw.custom_qualification_criteria?.length) {
        parts.push('Qualification criteria:');
        raw.custom_qualification_criteria.forEach(c => {
          parts.push(`  - ${c.label}: ${c.description}`);
        });
      }
      parts.push(`IMPORTANT: When coaching on deal qualification, reference ${qfName} criteria by name. Confirm each criterion is addressed before a deal advances.`);
    } else if (raw.qualification_framework) {
      const qfName = _QUAL_NAMES[raw.qualification_framework] || raw.qualification_framework;
      parts.push(`Qualification framework: ${qfName}`);
    }

    // Custom deal stages (extended field)
    if (raw.custom_stages?.length) {
      parts.push(`Deal stages: ${raw.custom_stages.map(s => typeof s === 'string' ? s : s.name || s.label || '').filter(Boolean).join(' → ')}`);
    }

    // Coaching philosophy (extended field)
    if (raw.coaching_philosophy) {
      parts.push(`Coaching philosophy: ${raw.coaching_philosophy}`);
    }

    // Key terminology (extended field)
    if (raw.key_terminology && typeof raw.key_terminology === 'object' && Object.keys(raw.key_terminology).length) {
      const terms = Object.entries(raw.key_terminology).map(([k, v]) => `${k}: ${v}`).slice(0, 10);
      parts.push(`Key terms:\n  ${terms.join('\n  ')}`);
    }

    parts.push('IMPORTANT: When coaching, use this organization\'s methodology and terminology. Reference their specific stages, qualification criteria, and coaching philosophy when relevant.');

    // Inject org custom playbooks
    try {
      const { data: playbooks } = await sb.from('org_playbooks')
        .select('name, category, framework, tagline, sections')
        .eq('organization_id', orgId).eq('is_active', true).limit(10);
      if (playbooks?.length) {
        parts.push('\n[ORGANIZATION PLAYBOOKS]');
        for (const pb of playbooks) {
          parts.push(`\n--- ${pb.name} (${pb.category}${pb.framework ? ` / ${pb.framework}` : ''}) ---`);
          if (pb.tagline) parts.push(pb.tagline);
          for (const sec of (pb.sections || [])) {
            parts.push(`  ${sec.title}:`);
            for (const item of (sec.items || [])) parts.push(`    - ${item}`);
          }
        }
        parts.push('Reference these playbooks when coaching. Use their specific terminology and frameworks.');
      }
    } catch { /* non-fatal — playbooks are supplementary */ }

    const result = parts.length > 1 ? parts.join('\n') : '';
    _salesDnaCache[orgId] = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error('getSalesDnaContext error:', err.message);
    return '';
  }
}

// ── ICP Profile Context ─────────────────────────────────────────────────────
const _icpProfileCache = {};

async function getIcpProfileContext(orgId, profileId) {
  if (!orgId) return '';

  const cacheKey = `icp_profile_${orgId}_${profileId || 'default'}`;
  const cached = _icpProfileCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < 300000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    let profile = null;

    if (profileId) {
      // Fetch specific ICP profile by id
      const { data } = await sb
        .from('engage_icp_profiles')
        .select('name, description, icp_config, signal_config')
        .eq('id', profileId)
        .maybeSingle();
      profile = data;
    } else {
      // Fetch default ICP profile for the org
      const { data } = await sb
        .from('engage_icp_profiles')
        .select('name, description, icp_config, signal_config')
        .eq('organization_id', orgId)
        .eq('is_default', true)
        .maybeSingle();
      profile = data;
    }

    // Fallback: read from organizations table if no ICP profile found
    if (!profile) {
      const { data: org } = await sb
        .from('organizations')
        .select('icp_config, signal_config')
        .eq('id', orgId)
        .maybeSingle();

      if (!org) {
        _icpProfileCache[cacheKey] = { data: '', ts: Date.now() };
        return '';
      }
      profile = {
        name: 'Organization Default',
        icp_config: org.icp_config,
        signal_config: org.signal_config,
      };
    }

    const icp = profile.icp_config || {};
    const sig = profile.signal_config || {};

    // Only include non-empty fields
    const parts = [`--- ICP PROFILE: ${profile.name || 'Unnamed'} ---`];

    if (Array.isArray(icp.target_industries) && icp.target_industries.length) {
      parts.push(`Target Industries: ${icp.target_industries.join(', ')}`);
    }
    if (icp.headcount_min || icp.headcount_max) {
      parts.push(`Company Size: ${icp.headcount_min || '?'}-${icp.headcount_max || '?'} employees`);
    }
    if (icp.revenue_min_m || icp.revenue_max_m) {
      parts.push(`Revenue Range: $${icp.revenue_min_m || '?'}M - $${icp.revenue_max_m || '?'}M`);
    }
    if (Array.isArray(icp.target_technologies) && icp.target_technologies.length) {
      parts.push(`Target Technologies: ${icp.target_technologies.join(', ')}`);
    }
    if (Array.isArray(sig.job_titles_to_track) && sig.job_titles_to_track.length) {
      parts.push(`Buyer Personas (Job Titles): ${sig.job_titles_to_track.join(', ')}`);
    }
    if (Array.isArray(sig.pain_points) && sig.pain_points.length) {
      parts.push(`Pain Points We Solve: ${sig.pain_points.join(', ')}`);
    }
    if (Array.isArray(sig.solution_keywords) && sig.solution_keywords.length) {
      parts.push(`Solution Keywords: ${sig.solution_keywords.join(', ')}`);
    }
    if (Array.isArray(sig.competitors) && sig.competitors.length) {
      parts.push(`Competitors: ${sig.competitors.join(', ')}`);
    }

    // Only return if we have more than just the header
    const result = parts.length > 1 ? parts.join('\n') : '';
    _icpProfileCache[cacheKey] = { data: result, ts: Date.now() };
    return result;
  } catch (err) {
    console.error('getIcpProfileContext error:', err.message);
    return '';
  }
}

// ── AI Style Rule ────────────────────────────────────────────────────────────
const AI_STYLE_RULE = `\nSTYLE RULE: Write in plain, direct business language. Never use these words or phrases: "delve", "unleash", "game-changer", "transformative", "unlock potential", "leverage" (as a verb), "cutting-edge", "revolutionary", "paradigm shift", "synergy", "elevate", "empower", "holistic", "robust", "seamless", "streamline", "harness". Be specific and concrete — not vague or generic.\n\nBRAND RULE: NEVER reference third-party sales methodology brands by name. Do not say "JBarrows", "Sandler", "MEDDPICC", "MEDDIC", "SPIN Selling", "Challenger Sale", "Gap Selling", "Miller Heiman", "BANT", "Keenan", "Rackham", "Command of the Message", "Force Management", "SNAP Selling", "ValueSelling", "Gong", "Outreach", "SalesLoft", or any other vendor/methodology brand. All coaching frameworks are Apptivia-native. Use the Apptivia framework names provided (e.g. "Apptivia Prospecting Playbook", "Apptivia Deal Qualification"). If a user asks about a specific third-party methodology by name, explain the underlying concepts without attributing them to the brand.`;

// ── Aaron Coaching Frameworks ────────────────────────────────────────────────
const AARON_FRAMEWORKS = {
  jbarrows: {
    name: 'Apptivia Prospecting Playbook',
    category: 'prospecting',
    oneLiner: 'Prospecting fundamentals — research-based openers, multi-touch cadences, voicemail + email combos.',
    triggers: ['prospect', 'outbound', 'cold call', 'pipeline', 'fill the funnel', 'opener', 'voicemail', 'email sequence', 'cadence', 'touch pattern', 'response rate', 'connect rate'],
    fullDefinition: `[FRAMEWORK: Apptivia Prospecting Playbook]\nCoach on prospecting fundamentals: research-based openers, multi-touch cadences, buyer-centric messaging, voicemail + email combos, pattern interrupt techniques. Focus on making outreach about the prospect's challenges, not the product. Suggest specific opener templates and cadence structures.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Prospecting Playbook — Templates & Scripts]

5-TOUCH CADENCE:
Day 1: Personalized email — reference a specific trigger event. Subject line under 6 words.
Day 3: LinkedIn connection request — 1-sentence note referencing the email topic.
Day 5: Phone call — use Research-Based Opener. Leave voicemail if no answer.
Day 8: Value-add email — share a relevant case study or insight. No pitch.
Day 12: Breakup email — "Closing the loop" with a direct CTA.

OPENER SCRIPTS:
- Trigger: "I noticed [company] just [event]. When that happens, teams like yours typically face [challenge]. Is that on your radar?"
- Referral: "I was talking to [similar company], and they mentioned [pain point]. Curious if you're seeing the same thing."
- Insight: "[Industry stat]. Most [title]s I talk to are concerned about [implication]. How is your team handling it?"

VOICEMAIL (30s max): Hook (their name + company detail, 5s) → Relevance (challenge their role faces, 10s) → CTA ("I'll send a quick email," 10s) → Contact Info (5s). Never pitch in voicemail.

EMAIL RULES: Subject 1-6 words, lowercase. Body 3 short paragraphs: about THEM (trigger/pain) → bridge to relevance → single CTA. If you could send it to 10 people unchanged, it's not personalized enough.

PATTERN INTERRUPTS:
- Reversal: "This isn't a sales pitch — I genuinely don't know if we can help yet."
- Permission: "Can I take 27 seconds to explain why I called, and you decide if it's worth continuing?"
- Peer proof: "We just helped [similar company] solve [problem]. Thought it might be relevant."`,
  },
  sandler: {
    name: 'Apptivia Pain Discovery',
    category: 'discovery',
    oneLiner: 'Pain funnel questioning, upfront agreements, Budget/Decision/Pain triangle, reverse selling techniques.',
    triggers: ['pain', 'budget', 'decision', 'qualify', 'pain funnel', 'negative reverse', 'upfront contract', 'thermometer', 'bonding rapport'],
    fullDefinition: `[FRAMEWORK: Apptivia Pain Discovery]\nCoach on structured pain discovery: Pain Funnel questioning (surface → impact → personal), upfront agreements to set expectations, Budget step, Decision process mapping, reverse selling to get honest answers. Help reps move past "happy ears" to real qualification using the pain/budget/decision triangle.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Pain Discovery — Templates & Scripts]

PAIN FUNNEL — 7 QUESTIONS (in order):
1. "Tell me more about that..." (open the door)
2. "Can you be more specific? Give me an example." (vague → concrete)
3. "How long has this been going on?" (duration = severity)
4. "What have you tried to do about it?" (prior attempts = frustration)
5. "Did that work?" (likely no — builds gap acknowledgment)
6. "How much do you think that has cost you?" (quantify in dollars/time)
7. "How do you feel about that?" (personal/emotional impact — urgency lives here)

UPFRONT AGREEMENT SCRIPT: "Here's what I'd like to accomplish today — [agenda]. At the end, one of three things will happen: you'll say yes, you'll say no, or we'll agree on a clear next step. Any of those is fine. Does that work?" Eliminates think-it-overs, sets mutual expectations, gives permission to say no.

BUDGET/DECISION/PAIN TRIANGLE:
- Pain FIRST: Never discuss budget until pain is quantified.
- Budget: "If we could solve [quantified pain], what investment would make sense relative to the [$ cost] you're losing?"
- Decision: "Walk me through how your org has made decisions like this before. Who else would need to weigh in?"
- Red flag: If they can't articulate pain in dollar terms, you haven't gone deep enough.

HAPPY EARS WARNING SIGNS: They say "great" but won't commit to a next step with a date. They agree with everything without pushback. They won't introduce you to other stakeholders. Pain is generic ("need efficiency") without specifics. They keep rescheduling.
Antidote: Negative reverse — "It sounds like this might not be a priority right now. Am I reading that right?"`,
  },
  meddpicc: {
    name: 'Apptivia Deal Qualification',
    category: 'qualification',
    oneLiner: 'B2B deal qualification — Metrics, Economic Buyer, Decision Criteria/Process, Paper Process, Pain, Champion, Competition.',
    triggers: ['champion', 'economic buyer', 'decision criteria', 'decision process', 'metrics', 'identify pain', 'paper process', 'competition', 'implicate', 'qualification'],
    fullDefinition: `[FRAMEWORK: Apptivia Deal Qualification]\nCoach on rigorous deal qualification: Metrics (quantified value), Economic Buyer (power), Decision Criteria, Decision Process, Paper Process, Identify Pain, Champion (who sells internally), Competition. Help the rep assess deal health by checking each element. Flag gaps and coach on how to fill them.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Deal Qualification — Scorecard & Tests]

MEDDPICC SCORECARD (rate each 1-5):
- Metrics: Can they quantify expected outcome? 5=specific numbers agreed. 1=vague "improvement."
- Economic Buyer: Identified AND met the budget authority? 5=direct relationship. 1=unknown.
- Decision Criteria: Know what they'll evaluate? 5=written criteria you helped shape. 1=guessing.
- Decision Process: Know every step to signature? 5=mapped with timeline. 1="they'll let us know."
- Paper Process: Legal, procurement, security mapped? 5=all stakeholders identified. 1=haven't discussed.
- Identify Pain: Pain quantified and personal? 5=champion feels it daily. 1=nice-to-have.
- Champion: Someone selling internally? 5=actively advocating. 1=no internal ally.
- Competition: Know who else they're evaluating? 5=differentiated on key criteria. 1=blind.

CHAMPION VALIDATION — 5 TESTS: (1) Can they get you a meeting with the Economic Buyer? (2) Do others defer to their opinion? (3) Do they personally benefit from this succeeding? (4) Do they share competitive intel and real timelines? (5) Do they tell you how to win, not just what to present? If 3+ answers are no, you have a coach, not a champion.

DEAL HEALTH: Green (35-40)=all covered, forecast as Commit. Yellow (25-34)=1-2 gaps, action plan needed this week, forecast Best Case. Red (<25)=multiple unknowns, do NOT forecast, requires intervention or disqualification. Any deal Yellow 2+ weeks without improvement → Red.`,
  },
  spin: {
    name: 'Apptivia Discovery Method',
    category: 'discovery',
    oneLiner: 'Situation → Problem → Implication → Need-Payoff question progression for discovery calls.',
    triggers: ['situation question', 'problem question', 'implication', 'need-payoff', 'discovery call', 'discovery meeting', 'questioning technique', 'open-ended question'],
    fullDefinition: `[FRAMEWORK: Apptivia Discovery Method]\nCoach on structured question progression: Situation (context), Problem (explicit difficulties), Implication (consequences of inaction), Need-Payoff (value of solving). Help reps craft specific questions for each stage. Emphasize moving beyond context-gathering to uncovering business impact quickly.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Discovery Method — Question Bank & Structure]

SPIN QUESTION BANK:
Situation: "Walk me through how your team currently handles [process]." / "What tools are you using today?" / "How is your team structured?"
Problem: "What's the biggest challenge with that approach?" / "Where does the process break down?" / "What are reps complaining about most?"
Implication: "When that happens, what's the impact on revenue/pipeline?" / "How does that affect hitting quarterly goals?" / "If this doesn't get fixed, what happens in 6 months?"
Need-Payoff: "If you could solve that, what would it mean for [metric]?" / "How would the team's day change if [pain] went away?" / "What would hitting [target] consistently be worth?"

DISCOVERY CALL STRUCTURE (45 min):
0-5: Upfront agreement + agenda. Confirm time, attendees, goal.
5-10: Situation (max 3 questions — pre-call research should cover most context).
10-25: Problem + Implication — spend 60% of time here. This is where value is created.
25-35: Need-Payoff — help them articulate desired future state in their own words.
35-40: Recap pain and desired outcome. Confirm alignment.
40-45: Specific next steps — date, attendees, agenda. Send invite before hanging up.

10-MINUTE RULE: Get through Situation questions in first 10 minutes max. If still asking context questions at minute 15, you're losing the meeting. Pre-call research eliminates most S questions.

DISCOVERY DEBRIEF (fill within 30 min): Confirmed Pain (their exact words), Business Impact ($ or time), Decision Landscape (who/timeline/alternatives), Unknowns (what to validate next), Next Step (action, person, date).`,
  },
  challenger: {
    name: 'Apptivia Insight Selling',
    category: 'methodology',
    oneLiner: 'Teach (commercial insight), Tailor (stakeholder-specific), Take Control (constructive tension toward decision).',
    triggers: ['teach', 'tailor', 'take control', 'commercial insight', 'reframe', 'constructive tension', 'insight selling', 'provocative'],
    fullDefinition: `[FRAMEWORK: Apptivia Insight Selling]\nCoach on the insight-led approach: Teach (share commercial insight that reframes thinking), Tailor (adapt message to each stakeholder), Take Control (drive toward decision with constructive tension). Help reps develop provocative insights and challenge the status quo without being aggressive.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Insight Selling — Teaching Pitch & Tailoring]

TEACHING PITCH — 6 STEPS:
1. Warmer: "Most [title]s I talk to are dealing with [common problem]."
2. Reframe: "What we're finding is that the real issue isn't [what they think] — it's [unexpected root cause]."
3. Rational Drowning: Show 2-3 data points that make the problem feel bigger than they realized.
4. Emotional Impact: "For someone in your role, this means [consequence that affects them directly]."
5. New Way: "The companies getting ahead are doing [approach]." (No product mention yet.)
6. Your Solution: Only now connect your product to the new way.

STAKEHOLDER TAILORING:
- VP Sales/CRO: Lead with quota attainment, pipeline predictability, rep productivity. They care about forecast accuracy and revenue.
- Sales Manager: Lead with coaching efficiency, time savings, rep development visibility. Less admin, better team.
- RevOps/Sales Ops: Lead with data integrity, process consistency, stack consolidation. Fewer tools, better reporting.
- CFO/Finance: Lead with cost per rep, ROI timeline, payback period. Unit economics, not features.
Never present the same deck to different stakeholders.

CONSTRUCTIVE TENSION — 3 LEVELS:
Level 1 (Gentle): "That's a common approach. What we see is it works until [scale]. Have you noticed that?"
Level 2 (Data): "When we looked at [X companies], ones doing it that way had [Y% worse outcome]. What's your experience?"
Level 3 (Direct): "I'd push back on that. Here's why: [evidence]. The risk of staying the current course is [consequence]."
Match tension to relationship depth. Level 1 on first call. Level 3 only after trust.`,
  },
  gapSelling: {
    name: 'Apptivia Gap Analysis',
    category: 'discovery',
    oneLiner: 'Map Current State → Impact → Root Cause → Future State → Solution. Bigger gap = more urgency.',
    triggers: ['gap', 'current state', 'future state', 'impact', 'root cause', 'business problem', 'technical problem', 'impact chain'],
    fullDefinition: `[FRAMEWORK: Apptivia Gap Analysis]\nCoach on identifying the gap between current state and desired future state. Help reps map: Current State (what's broken) → Impact (business consequences) → Root Cause → Future State (what good looks like) → Solution (how to bridge). The bigger the gap, the more urgency and budget available.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Gap Analysis — Mapping & Impact Chain]

CURRENT → FUTURE STATE MAPPING:
Current State: "Describe your sales process step by step today." / "What does a typical rep's day look like?" / "How do you measure rep performance?"
Future State: "Wave a magic wand — what does this look like in 12 months?" / "What metrics would you be hitting?" / "How would workflow change?"
Document both in the prospect's own language. Their words carry more weight in the business case.

IMPACT CHAIN WORKSHEET:
Level 1 — Immediate: "Reps spend 40% of time on admin tasks."
Level 2 — Department: "40% less selling time → pipeline consistently short."
Level 3 — Company: "Pipeline shortage → missed quarterly targets → affects valuation."
Level 4 — Dollar: "20 reps × $150K OTE × 40% unproductive = $1.2M/year wasted."
Always get to Level 4. A gap without a dollar figure is just an opinion.

ROOT CAUSE — ADAPTED 5 WHYS:
Why 1: "Why is pipeline short?" → Reps not prospecting enough.
Why 2: "Why not prospecting?" → Too much admin and CRM work.
Why 3: "Why so much admin?" → No automation, manual data entry.
Why 4: "Why no automation?" → Tools don't integrate, team doesn't trust data.
Why 5: "Why don't they trust data?" → Scoring subjective, no single source of truth.
Now you've found the root cause (data trust) vs the symptom (pipeline).

GAP SIZE = URGENCY: Small gap (current is "okay") = nice-to-have, likely stalls. Medium gap (friction) = important but competes with other priorities, need hard numbers. Large gap (current is failing) = must-fix, budget will be found, compress the timeline.`,
  },
  valueFramework: {
    name: 'Apptivia Value Selling',
    category: 'negotiation',
    oneLiner: 'ROI calculation, business case structure, cost of inaction, payback period — anchor to value not price.',
    triggers: ['value', 'roi', 'business case', 'pricing', 'discount', 'negotiat', 'cost justify', 'payback period', 'total cost', 'value prop'],
    fullDefinition: `[FRAMEWORK: Apptivia Value Selling]\nCoach on building and defending value: ROI calculation, business case structure, cost of inaction, payback period analysis. Help reps avoid discounting by anchoring to value delivered. Suggest approaches for presenting price in context of total value and cost of the problem.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Value Selling — ROI & Business Case]

ROI CALCULATOR — 3 VALUE DRIVERS:
1. Time Savings: Hours saved/rep/week × hourly cost × reps × 52. Example: 5h × $50 × 20 reps × 52 = $260K/yr.
2. Revenue Uplift: Incremental deals/rep/quarter × avg deal size × reps. Example: 2 × $30K × 20 = $1.2M/yr.
3. Cost Avoidance: Tools eliminated + headcount avoided + churn reduced. Example: 3 tools ($15K each) + 1 analyst ($80K) = $125K/yr.
Total Value = sum of all three. Present: "Conservative estimate is [$X]. Investment is [$Y], giving [Z]x return in year one."

BUSINESS CASE STRUCTURE:
Page 1 — Executive Summary: Problem (their words), proposed solution, expected ROI, timeline.
Page 2 — Current State Cost: Quantified pain from discovery. Direct costs AND opportunity costs.
Page 3 — Future State Value: What changes, by how much, over what timeline. Conservative assumptions.
Page 4 — Investment & Payback: Pricing, implementation timeline, payback period (target: under 6 months).
Build it WITH the champion, not FOR them. Co-create in their language.

COST OF INACTION: Monthly bleed × 12 = Annual waste. "You're losing [$X/month]. Over 12 months, that's [$12X] — assuming the problem doesn't get worse." Present cost of inaction BEFORE your price. Anchor to what they're losing, not what you charge.

DISCOUNT DEFENSE:
- "I can adjust scope to fit budget. Which capabilities would you remove?" (reframes discount as scope reduction)
- "At this price, you get [X]x return. Where else can you invest [$price] and get [X]x back?"
- "I can offer a lower rate for annual prepay. Would a 12-month commitment work?"
Never discount without getting something: faster close, case study, multi-year, expanded deployment.`,
  },
  objectionHandling: {
    name: 'Apptivia Objection Playbook',
    category: 'negotiation',
    oneLiner: 'Acknowledge → Clarify → Respond → Confirm. Listen-Explore-Respond model. Real vs smokescreen objections.',
    triggers: ['objection', 'pushback', 'concern', 'not interested', 'too expensive', 'already have', 'think about it', 'no budget', 'timing', 'competitor', 'ghosting', 'gone dark'],
    fullDefinition: `[FRAMEWORK: Apptivia Objection Playbook]\nCoach on structured objection handling: Acknowledge → Clarify → Respond → Confirm. Help reps distinguish between real objections (budget, authority, need, timing) and smokescreens. Provide specific language patterns for common objections. Use the Listen → Acknowledge → Explore → Respond progression.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Objection Playbook — Scripts & Diagnostics]

TOP 10 OBJECTION RESPONSES:
"Too expensive": "Help me understand — too expensive compared to what? The cost of the problem, another solution, or your budget?"
"We have a solution": "Most companies we work with had something in place. What prompted this meeting? What's not working?"
"Not a priority": "What IS top priority? How does [their pain] rank against it?"
"Need to think about it": "What specifically do you need to think through — fit, budget, or something else?"
"Send me info": "What specific question are you trying to answer? I might address it right now."
"Locked into a contract": "When does it renew? Let's plan ahead so you have options."
"Need to talk to my boss": "Would it help if I joined to answer financial or technical questions?"
"Competitor does X better": "You're right, they're strong in [X]. We differentiate in [Y]. For your use case, here's why [Y] matters more."
"Tried this before and it failed": "What went wrong? Our approach to [concern] is different because [reason]."
"Just send a proposal": "I could, but I'd be guessing. Can we spend 15 minutes so the proposal addresses your actual priorities?"

REAL VS SMOKESCREEN — 3 TESTS:
1. "If we solved [objection], would you move forward?" Yes = real. They pivot to another objection = smokescreen.
2. "Scale of 1-10, how significant is this?" Below 5 = smokescreen. Above 7 = real.
3. "Is this a dealbreaker or something we can work through?" Forces commitment to severity.

GONE-DARK RECOVERY:
Breakup: "Haven't heard back — I'll close out my notes. If anything changes, you know where to find me."
Value Drop: "Came across [insight] and thought of your team. Regardless of where we stand, this might be useful."
Direct: "Quick yes, no, or not yet? Any answer is fine — just want to make sure I'm not missing something."`,
  },
  coaching: {
    name: 'Apptivia Coaching Method',
    category: 'coaching',
    oneLiner: 'Observe → Diagnose → Prescribe → Follow-up. Situation-Behavior-Impact feedback. 70-20-10 development.',
    triggers: ['coach', 'mentor', '1:1', 'one on one', 'performance review', 'feedback', 'develop', 'training', 'skill gap', 'ride along', 'call review', 'pipeline review'],
    fullDefinition: `[FRAMEWORK: Apptivia Coaching Method]\nCoach on effective sales coaching: Observe → Diagnose → Prescribe → Follow-up. Help managers identify coachable moments, deliver feedback using Situation-Behavior-Impact structure, and create development plans. Focus on one skill at a time. Apply the 70-20-10 development model (experience, exposure, education).`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Coaching Method — ODPF Cycle & Templates]

ODPF COACHING CYCLE:
Observe: Listen to calls, review pipeline, analyze KPI data. Coach on evidence, not assumptions.
Diagnose: Find the root cause. "Low close rate" could be qualification, discovery, objection handling, or demos. Pinpoint which.
Prescribe: ONE specific action. "This week, ask Pain Funnel question #6 on every discovery call." Not three things. One.
Follow-Up: Check in within 5 business days. Did they do it? What happened? Adjust based on results.
Rule: A rep can only improve one skill at a time. Overloading kills progress.

SBI FEEDBACK TEMPLATE:
Situation: "In your call with [prospect] on [date]..."
Behavior: "I noticed you [specific action] — for example, you asked [exact question or skipped X step]."
Impact: "The result was [what happened]. The prospect [reaction/outcome]."
Forward: "Next time, try [alternative]. Here's what that sounds like: [script]."
Delivery: 1 positive SBI for every 1 developmental. Lead with what they did well.

1-ON-1 AGENDA (30 min):
0-5: Rep-led update — what they're proud of, what they're stuck on. Their agenda first.
5-15: Pipeline review — pick 2-3 deals, mini MEDDPICC check. Coach on gaps.
15-25: Skill development — review last week's prescribed action. Roleplay or listen to call snippet.
25-30: Agree on 1 action item. Write it down. Both accountable.
Never use 1-on-1s for status updates. That's what CRM and dashboards are for.

SKILL PROGRESSION: Level 1 (Awareness) → Level 2 (Application with support) → Level 3 (Consistent independent use) → Level 4 (Mastery, can coach others). Focus on one skill until Level 3 before adding another.`,
  },
  forecastAccuracy: {
    name: 'Apptivia Pipeline Intelligence',
    category: 'analytics',
    oneLiner: 'Pipeline coverage (3-4x), stage verification, commit/best-case categories, velocity formula.',
    triggers: ['forecast', 'pipeline', 'coverage', 'weighted', 'commit', 'best case', 'upside', 'close date', 'slip', 'push', 'pipeline velocity', 'win rate', 'average deal size', 'sales cycle'],
    fullDefinition: `[FRAMEWORK: Apptivia Pipeline Intelligence]\nCoach on forecast discipline: pipeline coverage ratio (3-4x), stage verification, commit vs best case categories, close date hygiene. Help identify deals that should move stages, stalled opportunities, and pipeline gaps by segment/rep/timeframe. Pipeline velocity = (Opportunities × Win Rate × Deal Size) / Sales Cycle.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Pipeline Intelligence — Formulas & Checklists]

COVERAGE FORMULA: Required Pipeline = Quota × Multiplier. Standard: 3.5x mid-market, 4-5x enterprise. Example: $200K quota × 3.5 = $700K weighted pipeline needed. Segment by source: 40% outbound, 30% inbound, 20% expansion, 10% partner. Coverage below 3x = red flag, immediate prospecting sprint.

VELOCITY FORMULA: Velocity = (Opportunities × Win Rate × Avg Deal Size) / Sales Cycle Length. Example: (50 × 25% × $30K) / 45 days = $8,333/day. To increase: improve ANY of the 4 levers. Track weekly — trending down = early warning.

STAGE VERIFICATION CRITERIA:
Stage 1 — Prospecting: ICP fit identified, named contact, initial outreach attempted.
Stage 2 — Discovery: Meeting completed, pain identified and acknowledged by prospect.
Stage 3 — Qualification: MEDDPICC score ≥ 20, champion identified, budget range discussed.
Stage 4 — Proposal: Business case presented, pricing shared, decision criteria confirmed.
Stage 5 — Negotiation: Verbal agreement, paper process underway, close within 30 days.
Deals MUST meet ALL criteria for a stage. No optimistic staging.

WEEKLY HYGIENE CHECKLIST:
- Stale deals: No activity in 14+ days → update or downstage. No exceptions.
- Close date: Pushed 2+ times → move to Upside, not Commit.
- Stage regression: Deal moved backward? Why? Coach on what happened.
- New pipeline: Enough new Stage 1/2 to cover what we'll close or lose?
- Forecast categories: Commit (90%+), Best Case (60-90%), Upside (30-60%), Pipeline (<30%). Review every Monday.`,
  },
  timeManagement: {
    name: 'Apptivia Productivity System',
    category: 'coaching',
    oneLiner: 'Time blocking, territory planning, A/B/C account prioritization, CRM hygiene, selling-time ratio.',
    triggers: ['productivity', 'time management', 'priorit', 'efficiency', 'admin time', 'selling time', 'activity', 'territory', 'planning', 'time block', 'crm hygiene', 'data entry'],
    fullDefinition: `[FRAMEWORK: Apptivia Productivity System]\nCoach on maximizing selling time: time blocking for prospecting/admin/deals, territory planning, A/B/C account prioritization, CRM hygiene habits, meeting preparation. Help reps identify and eliminate time sinks. Every hour should map to pipeline generation or deal advancement.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Productivity System — Time Blocks & Prioritization]

DAILY TIME BLOCK TEMPLATE:
8:00-8:30: Morning prep — review pipeline, check signals/alerts, plan the day.
8:30-11:00: PROSPECTING BLOCK — outbound, follow-ups, LinkedIn. No meetings. This is highest-ROI time.
11:00-12:00: Discovery/demo meetings — schedule buyer meetings mid-day.
12:00-1:00: Lunch + learning — listen to one call recording or read one article.
1:00-3:00: Deal work — proposals, follow-ups, champion coaching, internal alignment.
3:00-4:00: Admin block — CRM hygiene, pipeline notes, forecast updates. Batch all admin here.
4:00-5:00: Next-day prep — pre-call research, email sequences, weekly goal check.
Protect the 8:30-11:00 block. It's the single highest-ROI time slot.

A/B/C ACCOUNT TIERING:
A-Tier (top 20%): Best ICP fit + active signals + budget confirmed. Touch 3-5x/week. Personal, high-effort.
B-Tier (middle 40%): Good fit + some signals, no confirmed budget. Touch 1-2x/week. Semi-personalized.
C-Tier (bottom 40%): Marginal fit or no signals. Touch 1x/week max via sequence. Nurture only.
Re-tier monthly. A-Tier that goes dark → B. C-Tier with funding round → A.
Rule: 60% of time on A-Tier. Equal time on all accounts = leaving money on the table.

WEEKLY PLANNING (Sunday 30 min or Monday 8:00):
1. Review: What did I accomplish? What carried over? Activity win rate?
2. Pipeline: Which deals advance? Which need action? Any at risk?
3. Prospecting: How many new activities to hit pipeline targets? Block the time.
4. Top 3: Most important things this week. Write them down.
5. Calendar audit: Cancel/shorten any meeting that doesn't advance a deal or generate pipeline.

CRM RULES: Update every deal within 24 hours of activity. Minimum fields: next step, next step date, close date, amount, stage, champion. Notes: Date + Action + Outcome + Next Step.`,
  },
  socialSelling: {
    name: 'Apptivia Social Playbook',
    category: 'prospecting',
    oneLiner: 'Profile optimization, comment-first engagement, content cadence, warm intros, social selling index improvement.',
    triggers: ['linkedin', 'social', 'personal brand', 'content', 'engagement', 'networking', 'thought leader', 'inbound', 'warm intro', 'referral'],
    fullDefinition: `[FRAMEWORK: Apptivia Social Playbook]\nCoach on social selling strategy: profile optimization, content sharing cadence, engagement tactics (comment-first approach), warm introduction requests, trigger event monitoring. Help reps build a personal brand that drives inbound interest. Focus on social selling index improvement.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Social Playbook — LinkedIn & Personal Brand]

PROFILE OPTIMIZATION:
- Headline: Lead with value, not title. "Helping [ICP] solve [pain]" > "Account Executive at [Company]."
- Banner: Custom graphic with value prop. Not the default blue.
- About: First person. P1=who you help. P2=how. P3=proof/results. End with CTA.
- Featured: Pin best content — case study, customer story, insight, or video.
- Activity: Recent posts/comments are your live portfolio. If last 5 are reposts, you need to create.

5-BEFORE-1 RULE: Before sending a DM or connection request, engage with 5 of their posts. Comments > Likes. Write 2+ sentence comments that add perspective or ask questions. Spread over 1-2 weeks (not 5 comments in one day). When you connect, reference a specific post: "Loved your take on [topic] last week."

CONTENT CADENCE (3 posts/week):
Post 1 — Industry Insight: Share a stat or trend for your ICP. Add your perspective in 2-3 sentences.
Post 2 — Story: Specific win, lesson learned, or customer conversation (anonymized). People remember stories.
Post 3 — Engagement: Ask a question, run a poll, or share a hot take. Aim for comments, not likes.
Format: Short paragraphs (1-2 sentences). Line breaks. First line = hook. No hashtag spam.

WARM INTRO TEMPLATES:
To mutual connection: "I saw you're connected to [prospect]. I think we could help their team with [challenge]. Would you make an intro?"
To customer: "You've seen firsthand how [result]. I'm trying to help [similar company]. Would you introduce me to [name]?"
Post-intro: "[Connection] suggested I reach out. They mentioned your team is [dealing with X]. Worth a 15-minute call?"`,
  },
  accountPlanning: {
    name: 'Apptivia Account Strategy',
    category: 'methodology',
    oneLiner: 'Stakeholder mapping, multi-threading, land-and-expand, whitespace analysis, executive engagement.',
    triggers: ['account plan', 'strategic account', 'land and expand', 'whitespace', 'org chart', 'multi-thread', 'executive sponsor', 'power map', 'influence map', 'buying committee'],
    fullDefinition: `[FRAMEWORK: Apptivia Account Strategy]\nCoach on account strategy: stakeholder mapping (power/influence grid), multi-threading across the buying committee, land-and-expand plays, whitespace analysis, executive engagement strategy. Help reps build account plans that identify expansion opportunities and reduce single-thread risk.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Account Strategy — Power Maps & Expansion]

POWER MAP (Influence × Support grid):
Q1 — High Influence, High Support: Your champion. Protect them, arm with internal selling materials.
Q2 — High Influence, Low Support: Your blocker. Understand concerns, tailor message to what they care about.
Q3 — Low Influence, High Support: Your coach. Good for intel but can't make decisions.
Q4 — Low Influence, Low Support: Monitor only. Don't invest time unless their influence changes.
Update the map after every meeting. Roles and support shift.

MULTI-THREADING: Every deal over $25K needs 3+ contacts across 2+ departments. Single-threaded = fragile.
Thread 1 — Economic Buyer: Signs the check. Build relationship through champion intros.
Thread 2 — Technical Evaluator: Tests/validates. Win with product depth and integration proof.
Thread 3 — End User/Champion: Uses it daily. Win with ease of use and direct workflow value.
If champion leaves — this is #1 risk. Multi-threading is your insurance. Start in Stage 2, not Stage 4.

LAND-AND-EXPAND:
Land: Start small — one team, one use case, clear ROI. Prove value in 90 days.
Expand trigger 1: First team hits measurable results → use as internal case study.
Expand trigger 2: Adjacent team notices → warm intro from champion.
Expand trigger 3: Executive sees aggregate impact → sponsors org-wide rollout.
Timeline: Land (Q1) → Prove (Q2) → 2nd team (Q3) → Enterprise agreement (Q4).

WHITESPACE MATRIX: Products/features (columns) × Departments (rows). Fill in: what they use, what they don't, what competitor fills each gap. Score cells by deal size × conversion likelihood. Focus on highest scores. Revisit quarterly — new hires and budget cycles create new whitespace.`,
  },
  closingTechniques: {
    name: 'Apptivia Close Plan',
    category: 'negotiation',
    oneLiner: 'Mutual Action Plans, paper process navigation, procurement readiness, trial close techniques.',
    triggers: ['close', 'closing', 'proposal', 'contract', 'signature', 'procurement', 'legal review', 'mutual action plan', 'map', 'paper process', 'terms', 'redline'],
    fullDefinition: `[FRAMEWORK: Apptivia Close Plan]\nCoach on closing mechanics: Mutual Action Plans (MAP), paper process navigation, procurement/legal readiness, trial close techniques, creating urgency without pressure. Help reps build close plans that account for all stakeholders and internal processes. Apply the "give to get" negotiation principle.`,
    detailedPlaybook: `[PLAYBOOK: Apptivia Close Plan — MAPs, Paper Process & Negotiation]

MUTUAL ACTION PLAN (MAP):
Shared document with: Milestone, Owner (buyer + seller), Due Date, Status.
Key milestones: Technical eval → Business case approval → Security/legal review → Commercial negotiation → Contract execution → Implementation kickoff.
Review on every call: "According to our plan, [milestone] is due [date]. Are we on track?"
Work backward from go-live: "To be live by [date], we need implementation by [date], which means contracts signed by [date]."

PAPER PROCESS CHECKLIST:
- Identify ALL approvers early: Procurement, Legal, Security, Finance, IT. Don't discover new ones at the 11th hour.
- Security review: Ask "Do you need a security questionnaire or SOC 2?" in Stage 3, not Stage 5.
- Legal: Send contract early: "Here's our standard agreement. If legal needs changes, let's start now so it doesn't delay."
- Procurement: "Is there a PO process? Typical turnaround?" Many companies need 2-4 weeks for PO.
- Budget cycle: "When does your fiscal year start? If we need this year's budget, what's the approval deadline?"

TRIAL CLOSE QUESTIONS:
"Based on what you've seen, does this solve the problem you described?"
"Is there anything preventing you from moving forward?"
"If we address [concern], would you be comfortable committing?"
"Scale of 1-10, how confident this is the right solution? What would make it a 10?"
"What would need to be true to start implementation next month?"
Use throughout the process, not just at the end. They surface objections early.

GIVE-TO-GET:
Give: Extended trial, extra onboarding, QBRs, custom integrations, flexible terms.
Get: Multi-year, case study, reference calls, expanded deployment, faster signature.
Never give without getting. "I can include [X] at no cost if we commit to [Y]-year agreement."
Walk-away signals: >20% discount with no trade, removing success metrics, can't articulate internal business case.`,
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

// ── Aaron Behavioral Constraints ─────────────────────────────────────────────
function buildAaronConstraints(orgContextBlock) {
  let constraints = `\n\n## AARON BEHAVIORAL CONSTRAINTS

### Anti-Slop (expanded)
In addition to the style rules above: never use "deep dive", "circle back", "at the end of the day", "low-hanging fruit", "move the needle", "take it to the next level", "drill down", "double down", "lean in", "unpack", "ecosystem", "landscape", "value-add", "bandwidth", "touch base", "reach out", "on my radar", "pivot", "scalable", "disruptive", "innovative", "best-in-class", "world-class", "mission-critical", "north star", "alignment", "enablement", "net-net", "boil the ocean", "peel back the onion", "run it up the flagpole", "table stakes", "thought leadership". Never start a response with "Great question!", "That's a great point!", "Absolutely!", or "I'd be happy to help with that." Get to the answer immediately.

### Specificity Over Generality
Every recommendation MUST include at least ONE of: a specific number from the user's data, a named Apptivia framework technique with a concrete step, a real scenario example, or an exact next action the rep can take today. If you cannot be specific, say so — do not fill space with generic advice like "focus on building pipeline" or "have better conversations."

### Earned Advice
Only coach on topics where you have data or framework grounding. If the user asks about something you have no data for, say: "I don't have [X] data loaded right now — here's what I can see from [available data]." Never fabricate KPI numbers, deal details, coaching observations, or performance trends that are not in your context blocks.

### Rep Dignity
NEVER use: "underperforming", "weak", "struggling", "failing", "behind", "lagging", "bottom performer", "needs improvement", "at risk." INSTEAD use: "developing in [specific area]", "building toward [goal]", "has room to grow in [metric]", "trending [up/down] on [KPI]." Frame every gap as a coaching opportunity with a clear path forward — not a judgment.

### Manager Respect
When a rep already has a coaching plan, acknowledge it first. Build on existing plans — do not contradict or replace them. If your recommendation conflicts with an existing plan, flag it: "Your current plan focuses on [X] — the data also suggests [Y] might need attention. Worth discussing with your manager." Never undermine the manager–rep relationship.

### Length Discipline
- Quick factual question → 1-3 sentences max
- Coaching advice request → 3-8 sentences with structure (bullets or steps)
- Deep analysis (pipeline review, team comparison, coaching plan) → structured output with headers, keep under 400 words
- Never pad responses to seem more thorough. Short and specific beats long and vague.`;

  // Org-specific constraints — inject whatever fields are available.
  // Full org constraint columns (team_size, average_acv, quota_attainment_pct) deferred to Spec 11.
  if (orgContextBlock) {
    const teamSizeMatch = orgContextBlock.match(/Team size:\s*(\d+)/i);
    if (teamSizeMatch) {
      const size = parseInt(teamSizeMatch[1]);
      if (size < 10) {
        constraints += `\n\n### Org Constraint — Small Team (${size} reps)\nCoaching must account for limited specialization. Reps likely wear multiple hats. Avoid advice that assumes dedicated BDR/AE/CSM splits.`;
      } else if (size >= 50) {
        constraints += `\n\n### Org Constraint — Large Team (${size} reps)\nCoaching should account for segment and team variation. Reference team-level patterns when available, not just org-level averages.`;
      }
    }

    const acvMatch = orgContextBlock.match(/(?:ACV|average contract|deal size)[:\s]*\$?([\d,]+k?)/i);
    if (acvMatch) {
      constraints += `\n\n### Org Constraint — ACV\nAverage deal value is ~${acvMatch[1]}. Calibrate deal strategy advice to this price point — a $5K ACV needs a different playbook than a $500K enterprise deal.`;
    }

    const quotaMatch = orgContextBlock.match(/quota attainment[:\s]*([\d.]+)%/i);
    if (quotaMatch) {
      const pct = parseFloat(quotaMatch[1]);
      if (pct < 60) {
        constraints += `\n\n### Org Constraint — Below Quota (${pct}%)\nTeam is significantly below quota. Prioritize fundamentals (activity volume, pipeline coverage, conversion rates) over advanced techniques. Focus on quick wins.`;
      } else if (pct > 100) {
        constraints += `\n\n### Org Constraint — Above Quota (${pct}%)\nTeam is at or above quota. Focus on skill refinement, deal optimization, and next-level capabilities rather than remedial coaching.`;
      }
    }
  }

  return constraints;
}

// ── System Prompt Builder ────────────────────────────────────────────────────
function buildFrameworkSystemPrompt(frameworkKeys, salesDnaContext, userContext, liveDataBlock, orgContextBlock, repMemoryBlock, extraDataBlock = '') {
  const { userName, role, page } = userContext;

  let prompt = `You are Aaron, an AI sales productivity coach embedded in the Apptivia platform. You are a senior strategist — not a generic AI assistant. You help sales reps, managers, and admins improve their performance with specific, actionable, framework-backed coaching.

Key context:
- User: ${userName || 'User'} (Role: ${role || 'power_user'})
- Current page: ${page || 'unknown'}
- Apptivia features: Scorecard (KPI tracking), Coach (skill development), Contests (sales competitions), Analytics, Engage (signal prospecting, outreach, account intelligence), Badges & Achievements
- Apptivia Levels: Developing → Intermediate → Proficient → Elite → Master (based on cumulative points)
- Skillsets: Conversationalist, Call Conqueror, Email Warrior, Pipeline Guru, Task Master, Scorecard Master

When suggesting navigation, use markdown links so the user can click directly:
- [Scorecard](/scorecard) — KPI attainment & performance scores
- [Coach](/coach) — Skill development, achievements, badges
- [Analytics](/analytics) — Team insights, historical trends, KPI watchdog
- [Engage](/engage) — Signal prospecting, accounts, AI outreach
- [Contests](/contests) — Sales competitions & leaderboards
- [Wallboard](/wallboard) — Real-time team display
- [Profile](/profile) — Personal settings, integrations, badges
- [Organization Settings](/settings) — Org config, Sales DNA, teams`;

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

  // Behavioral constraints (Spec 07 — always injected)
  prompt += buildAaronConstraints(orgContextBlock);

  // Add rep memory (persistent coaching context)
  if (repMemoryBlock) {
    prompt += '\n\n' + repMemoryBlock;
  }

  // Add live data block
  if (liveDataBlock) {
    prompt += '\n\n' + liveDataBlock;
  }

  // Add extra data block (query-router injected, based on user's question intent)
  if (extraDataBlock) {
    prompt += '\n\n--- PLATFORM DATA (based on user\'s question) ---' + extraDataBlock + '\n---\nIMPORTANT: Use the platform data above to answer the user\'s question with SPECIFIC numbers. Do not say "I don\'t have access to that data" when the data is provided above.';
  }

  // Framework directory (names + 1-liners only — always included so Aaron knows what's available)
  prompt += '\n\n## Available Coaching Frameworks (reference by name when relevant):';
  for (const [key, fw] of Object.entries(AARON_FRAMEWORKS)) {
    prompt += `\n- **${fw.name}** (${key}): ${fw.oneLiner}`;
  }

  // Full definitions only for matched frameworks (deferred loading — saves ~8-12K tokens per call)
  if (frameworkKeys.length > 0) {
    prompt += '\n\n=== ACTIVE FRAMEWORKS FOR THIS CONVERSATION ===';
    for (const key of frameworkKeys) {
      const fw = AARON_FRAMEWORKS[key];
      if (fw) {
        prompt += '\n\n' + fw.fullDefinition;
        if (fw.detailedPlaybook) prompt += '\n\n' + fw.detailedPlaybook;
      }
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

  // Token-size logging for cost monitoring (Spec 03)
  console.log(JSON.stringify({
    tag: 'aaron_prompt_size',
    framework_keys: frameworkKeys,
    prompt_chars: prompt.length,
    estimated_tokens: Math.ceil(prompt.length / 4),
    ts: new Date().toISOString(),
  }));

  return prompt;
}

// ── In-memory caches ─────────────────────────────────────────────────────────
const _aaronDailyLimits = {};
const _aaronLiveCache = {};
const _aaronOrgCache = {};

// ── Fetch live KPI data, anomalies, and signal count for Aaron context ───────
async function fetchAaronLiveContext(userId, organizationId, role) {
  if (!userId || !organizationId) return '';

  // Manager/admin/coach cache key is org-level (not per-user); TTL 120s vs 60s for reps
  const isManager = role === 'admin' || role === 'manager' || role === 'coach';
  const cacheKey = isManager ? `org_${organizationId}` : `${userId}_${organizationId}`;
  const TTL = isManager ? 120000 : 60000;
  const cached = _aaronLiveCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < TTL) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    // Run all queries in parallel with 3s timeout
    const timeout = (promise) => Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 3000))
    ]);

    const { start: curStart, end: curEnd } = getCurrentWeekRange();
    const { start: priorStart, end: priorEnd } = getPriorWeekRange();

    // For managers: get visible profile IDs for org-wide KPI aggregation
    let profileIds = [userId];
    if (isManager) {
      try {
        const visResult = await timeout(getVisibleProfiles(sb, userId, organizationId, role === 'power user' ? 'power_user' : role));
        if (visResult?.data?.length) profileIds = visResult.data.map(p => p.id);
      } catch (_) { /* timeout — fall back to self */ }
    }

    const [kpiResult, priorKpiResult, anomalyResult, signalResult, orgConfigResult] = await Promise.allSettled([
      // 1. Current week KPIs (manager: all visible reps, rep: self only)
      timeout(
        sb.from('kpi_values')
          .select('kpi_id, value, kpi_metrics:kpi_id(name, key)')
          .in('profile_id', profileIds)
          .gte('period_start', curStart)
          .lte('period_end', curEnd)
      ),
      // 2. Prior week KPIs (manager: all visible reps, rep: self only)
      timeout(
        sb.from('kpi_values')
          .select('kpi_id, value, kpi_metrics:kpi_id(name, key)')
          .in('profile_id', profileIds)
          .gte('period_start', priorStart)
          .lte('period_end', priorEnd)
      ),
      // 3. Recent anomalies
      timeout(
        sb.from('notifications')
          .select('title, message')
          .eq('profile_id', userId)
          .eq('type', 'kpi_anomaly')
          .gte('created_at', new Date(Date.now() - 14 * 86400000).toISOString())
          .order('created_at', { ascending: false })
          .limit(5)
      ),
      // 4. Signal count for org
      timeout(
        sb.from('engage_intent_signals')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', organizationId)
          .gte('detected_at', new Date(Date.now() - 7 * 86400000).toISOString())
      ),
      // 5. Org-specific KPI configs for accurate goals
      timeout(
        sb.from('kpi_org_configs')
          .select('kpi_id, goal, show_on_scorecard')
          .eq('organization_id', organizationId)
          .eq('is_active', true)
      ),
    ]);

    // Build org goal map (kpi_id → goal) for accurate org-specific goals
    const orgGoalMap = {};
    if (orgConfigResult.status === 'fulfilled' && orgConfigResult.value?.data) {
      for (const c of orgConfigResult.value.data) {
        orgGoalMap[c.kpi_id] = { goal: c.goal, onScorecard: c.show_on_scorecard };
      }
    }

    // Helper: format KPI rows with org goals
    const formatKpiRows = (kpiData) => {
      return (kpiData || [])
        .filter(k => k.kpi_metrics?.name)
        .map(k => {
          const orgCfg = orgGoalMap[k.kpi_id];
          const goal = orgCfg?.goal || 0;
          const pct = goal > 0 ? Math.round((k.value / goal) * 100) : 0;
          const sc = orgCfg?.onScorecard ? '' : ' [off-scorecard]';
          return `  ${k.kpi_metrics.name}: ${k.value}/${goal} (${pct}%)${sc}`;
        });
    };

    const parts = [`[LIVE DATA — This Week (${curStart} to ${curEnd})]`];

    // Current week KPI values
    if (kpiResult.status === 'fulfilled' && kpiResult.value?.data?.length) {
      const kpiLines = formatKpiRows(kpiResult.value.data);
      if (kpiLines.length) parts.push('KPIs:\n' + kpiLines.join('\n'));
    } else {
      parts.push('KPIs: No data recorded yet this week.');
    }

    // Prior week KPI values
    if (priorKpiResult.status === 'fulfilled' && priorKpiResult.value?.data?.length) {
      const priorLines = formatKpiRows(priorKpiResult.value.data);
      if (priorLines.length) parts.push(`[PRIOR WEEK (${priorStart} to ${priorEnd})]:\n` + priorLines.join('\n'));
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

    // Append ICP profile context (from engage_icp_profiles or org fallback)
    try {
      const icpCtx = await getIcpProfileContext(organizationId);
      if (icpCtx) parts.push('\n' + icpCtx);
    } catch { /* non-blocking — ICP context is supplementary */ }

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
  for (const key of Object.keys(_icpProfileCache)) {
    if (now - _icpProfileCache[key].ts > 300000) { delete _icpProfileCache[key]; evicted++; }
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
      model: SONNET_MODEL,
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

// ── Intent Classifier ────────────────────────────────────────────────────────

function classifyAaronIntent(message, page) {
  const msg = message.toLowerCase();
  const intents = [];

  if (/scorecard|attainment|score|how.*doing|performance|kpi|metric|target|goal|apptivia score|apptivity/.test(msg))
    intents.push('scorecard');
  if (/team|comparison|compare|cross-team|who.*lead|who.*struggl|department|which team|team.*thriv/.test(msg))
    intents.push('team_comparison');
  if (/contest|leaderboard|standing|competition|ranking|winner|who.*winning/.test(msg))
    intents.push('contests');
  if (/achievement|badge|level|skillset|mastery|progress|points|apptivia level|skill.*development/.test(msg))
    intents.push('progression');
  if (/coach|development plan|coaching plan|review|1.on.1|one.on.one|rep plan/.test(msg))
    intents.push('coaching');
  if (/pipeline|deal|revenue|opportunit|forecast|at.risk|closed.won|quota/.test(msg))
    intents.push('pipeline');
  if (/calendar|meeting|call prep|pre.?call|agenda|schedule|upcoming|briefing|morning|eod/.test(msg))
    intents.push('calendar');

  // Page context boost
  const PAGE_INTENT_MAP = {
    scorecard: 'scorecard', coach: 'progression', analytics: 'scorecard',
    contests: 'contests', engage: 'pipeline',
  };
  if (page && PAGE_INTENT_MAP[page] && !intents.includes(PAGE_INTENT_MAP[page]))
    intents.push(PAGE_INTENT_MAP[page]);

  return intents;
}

// ── Aaron Model Tier Routing ─────────────────────────────────────────────────
// Routes simple lookups/format requests to Haiku, coaching/complex to Sonnet.
// Spec 01: 50-70% cost reduction with no UX change for coaching interactions.

// SONNET_MODEL and HAIKU_MODEL imported from modelConstants.js at top of file
const HAIKU_ELIGIBLE_TIERS = new Set(['lookup', 'format', 'summarize']);

/**
 * Classify whether an Aaron message needs Sonnet (coaching) or Haiku (lookup/format).
 * Returns: 'lookup' | 'format' | 'summarize' | 'coaching' | 'coaching_pipeline_diagnosis' | 'coaching_belief_reframe' | 'complex'
 */
function classifyAaronModelTier(message, frameworkKeys, rolePreset) {
  const msg = (message || '').toLowerCase().trim();

  // Hard signals for COMPLEX (always Sonnet)
  if (frameworkKeys && frameworkKeys.length >= 2) return 'complex';
  // coaching_ prefix convention (Spec 03) — accept both old and new names for 30 days
  if (rolePreset === 'coaching_belief_reframe' || rolePreset === 'belief_reframe') return 'coaching_belief_reframe';
  if (rolePreset === 'coaching_pipeline_diagnosis' || rolePreset === 'pipeline_diagnosis') return 'coaching_pipeline_diagnosis';
  if (/coach|reframe|stuck|deal at risk|plan for|pip|underperforming/i.test(msg)) return 'coaching';

  // Hard signals for SIMPLE (Haiku-eligible)
  if (msg.length < 80 && /^(what is|what's|show me|tell me|how many|when|where|who is)/i.test(msg)) return 'lookup';
  if (/format|reformat|shorten|expand|rewrite|summarize/i.test(msg)) return 'format';
  if (/sum up|tldr|recap|in one sentence/i.test(msg)) return 'summarize';

  // Default to complex (Sonnet) — safer default
  return 'complex';
}

function selectAaronModel(modelTier) {
  return HAIKU_ELIGIBLE_TIERS.has(modelTier) ? HAIKU_MODEL : SONNET_MODEL;
}

// ── Data Function Cache ──────────────────────────────────────────────────────
const _aaronDataCache = {};

function getCachedOrFetch(cacheKey, ttlMs, fetchFn) {
  const cached = _aaronDataCache[cacheKey];
  if (cached && Date.now() - cached.ts < ttlMs) return Promise.resolve(cached.value);
  return Promise.race([
    fetchFn().then(v => { _aaronDataCache[cacheKey] = { value: v, ts: Date.now() }; return v; }),
    new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 8000)),
  ]).catch(err => { console.error(`[aaron-data] ${cacheKey} failed:`, err.message); return ''; });
}

/** Check Supabase query result — log error if present, throw to trigger getCachedOrFetch catch */
function checkSbResult(label, result) {
  if (result.error) {
    console.error(`[aaron-data] ${label}:`, result.error.message, result.error.details || '');
    throw new Error(`${label}: ${result.error.message}`);
  }
  return result.data;
}

// ── Helper: get Monday of current week ───────────────────────────────────────
function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - ((day + 6) % 7));
  mon.setUTCHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  sun.setUTCHours(23, 59, 59, 999);
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] };
}

function getPriorWeekRange() {
  const now = new Date();
  const day = now.getUTCDay();
  const mon = new Date(now);
  mon.setUTCDate(now.getUTCDate() - ((day + 6) % 7) - 7);
  mon.setUTCHours(0, 0, 0, 0);
  const sun = new Date(mon);
  sun.setUTCDate(mon.getUTCDate() + 6);
  sun.setUTCHours(23, 59, 59, 999);
  return { start: mon.toISOString().split('T')[0], end: sun.toISOString().split('T')[0] };
}

// ── Helper: filter profiles by role ──────────────────────────────────────────
async function getVisibleProfiles(sb, userId, orgId, role) {
  // DB enum roles_enum uses 'power user' (space), not 'power_user' (underscore)
  let query = sb.from('profiles')
    .select('id, first_name, last_name, team_id, apptivia_level, total_points, role')
    .eq('organization_id', orgId)
    .in('role', ['power user']);

  if (role === 'power_user') {
    query = query.eq('id', userId);
  } else if (role === 'manager' || role === 'coach') {
    // Get manager's team IDs first
    const { data: mgrTeams } = await sb.from('teams')
      .select('id').eq('organization_id', orgId)
      .or(`manager_id.eq.${userId},coach_id.eq.${userId}`);
    const teamIds = (mgrTeams || []).map(t => t.id);
    if (teamIds.length > 0) {
      query = query.in('team_id', teamIds);
    } else {
      query = query.eq('id', userId); // fallback to self
    }
  }
  // admin sees all (no additional filter)

  const result = await query;
  if (result.error) console.error('[aaron-data] getVisibleProfiles:', result.error.message);
  console.log(`[aaron-data] getVisibleProfiles: role=${role}, found=${result.data?.length || 0}`);
  return result.data || [];
}

// ── Data Functions ───────────────────────────────────────────────────────────

async function fetchScorecardContext(sb, userId, orgId, role) {
  return getCachedOrFetch(`scorecard_${orgId}_${userId}`, 60000, async () => {
    const { start, end } = getCurrentWeekRange();
    const prior = getPriorWeekRange();
    const profiles = await getVisibleProfiles(sb, userId, orgId, role);
    if (profiles.length === 0) return '';

    const profileIds = profiles.map(p => p.id);

    // Fetch org KPI configs (use !inner join to match frontend pattern)
    const configs = checkSbResult('scorecard_configs', await sb.from('kpi_org_configs')
      .select('kpi_id, goal, weight, kpi_metrics!inner(key, name, direction)')
      .eq('organization_id', orgId).eq('is_active', true).eq('show_on_scorecard', true));
    if (!configs || configs.length === 0) { console.log('[aaron-data] scorecard: no active scorecard configs'); return ''; }

    // Fetch current + prior week KPI values
    const curValsResult = await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', start).lte('period_end', end);
    const priorValsResult = await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', prior.start).lte('period_end', prior.end);
    const curVals = checkSbResult('scorecard_curVals', curValsResult);
    const priorVals = checkSbResult('scorecard_priorVals', priorValsResult);

    // Compute per-profile scores
    const sumByProfile = (vals) => {
      const map = {};
      for (const v of (vals || [])) {
        const key = `${v.profile_id}_${v.kpi_id}`;
        map[key] = (map[key] || 0) + Number(v.value);
      }
      return map;
    };
    const curSums = sumByProfile(curVals);
    const priorSums = sumByProfile(priorVals);

    const results = profiles.map(p => {
      let score = 0, totalWeight = 0;
      const kpiLines = [];
      for (const c of configs) {
        const val = curSums[`${p.id}_${c.kpi_id}`] || 0;
        const goal = c.goal || 1;
        const w = c.weight || 1;
        const dir = c.kpi_metrics?.direction || 'higher';
        const pct = dir === 'lower'
          ? (val > 0 ? Math.min((goal / val) * 100, 200) : null)
          : Math.min((val / goal) * 100, 200);
        if (pct !== null) {
          score += pct * w;
          totalWeight += w;
        }
        const name = c.kpi_metrics?.name || c.kpi_metrics?.key || 'KPI';
        kpiLines.push(`${name}: ${Math.round(val)}/${goal} (${pct !== null ? Math.round(pct) + '%' : 'no data'})`);
      }
      const weighted = totalWeight > 0 ? Math.round(score / totalWeight) : 0;

      // Prior week score
      let priorScore = 0, priorTotalW = 0;
      for (const c of configs) {
        const val = priorSums[`${p.id}_${c.kpi_id}`] || 0;
        const goal = c.goal || 1;
        const w = c.weight || 1;
        const dir = c.kpi_metrics?.direction || 'higher';
        const pct = dir === 'lower'
          ? (val > 0 ? Math.min((goal / val) * 100, 200) : null)
          : Math.min((val / goal) * 100, 200);
        if (pct !== null) {
          priorScore += pct * w;
          priorTotalW += w;
        }
      }
      const priorWeighted = priorTotalW > 0 ? Math.round(priorScore / priorTotalW) : 0;
      const delta = weighted - priorWeighted;
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      const name = `${p.first_name || ''} ${p.last_name || ''}`.trim() || 'Unknown';

      return { id: p.id, name, weighted, priorWeighted, delta, arrow, kpiLines };
    });

    // Format output
    let block = '\n📊 Scorecard Summary (This Week):';
    if (role === 'power_user' && results.length === 1) {
      const r = results[0];
      block += `\nYour Apptivia Score: ${r.weighted}% (${r.arrow} from ${r.priorWeighted}% last week)`;
      block += '\nKPIs: ' + r.kpiLines.join(', ');
      const lowKpis = r.kpiLines.filter(l => { const m = l.match(/\((\d+)%\)/); return m && parseInt(m[1]) < 80; });
      if (lowKpis.length > 0) block += '\nAreas needing focus: ' + lowKpis.map(l => l.split(':')[0]).join(', ');
    } else {
      // Manager/Admin view — summary + top/bottom
      const sorted = [...results].sort((a, b) => b.weighted - a.weighted);
      const avg = Math.round(sorted.reduce((s, r) => s + r.weighted, 0) / sorted.length);
      block += `\nTeam Average: ${avg}% | ${results.length} reps`;
      if (sorted.length > 0) block += `\nTop: ${sorted[0].name} (${sorted[0].weighted}%)`;
      const bottom = sorted.filter(r => r.weighted < 70).slice(-3);
      if (bottom.length > 0) block += '\nNeeds coaching: ' + bottom.map(r => `${r.name} (${r.weighted}%)`).join(', ');

      // Include requesting user's own score if they're a manager
      const self = results.find(r => r.id === userId);
      if (!self) {
        // Manager's own score (they're not in power_user list, show team only)
      }
    }
    return block;
  });
}

async function fetchTeamComparisonContext(sb, orgId) {
  return getCachedOrFetch(`teamcomp_${orgId}`, 60000, async () => {
    const { start, end } = getCurrentWeekRange();
    const prior = getPriorWeekRange();

    // Get all teams + their reps
    const teams = checkSbResult('teamcomp_teams', await sb.from('teams')
      .select('id, name').eq('organization_id', orgId));
    if (!teams || teams.length === 0) { console.log('[aaron-data] teamcomp: no teams'); return ''; }

    const reps = checkSbResult('teamcomp_reps', await sb.from('profiles')
      .select('id, team_id').eq('organization_id', orgId)
      .in('role', ['power user']));
    if (!reps || reps.length === 0) { console.log('[aaron-data] teamcomp: no reps'); return ''; }

    const configs = checkSbResult('teamcomp_configs', await sb.from('kpi_org_configs')
      .select('kpi_id, goal, weight, kpi_metrics!inner(direction)')
      .eq('organization_id', orgId).eq('is_active', true).eq('show_on_scorecard', true));
    if (!configs || configs.length === 0) { console.log('[aaron-data] teamcomp: no configs'); return ''; }

    const profileIds = reps.map(r => r.id);

    const curVals = checkSbResult('teamcomp_curVals', await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', start).lte('period_end', end));
    const priorVals = checkSbResult('teamcomp_priorVals', await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', prior.start).lte('period_end', prior.end));

    // Compute per-rep weighted score
    const computeScore = (vals, pid) => {
      let score = 0, totalW = 0;
      for (const c of configs) {
        const raw = (vals || []).filter(v => v.profile_id === pid && v.kpi_id === c.kpi_id)
          .reduce((s, v) => s + Number(v.value), 0);
        const goal = c.goal || 1;
        const w = c.weight || 1;
        const dir = c.kpi_metrics?.direction || 'higher';
        const pct = dir === 'lower'
          ? (raw > 0 ? Math.min((goal / raw) * 100, 200) : null)
          : Math.min((raw / goal) * 100, 200);
        if (pct !== null) {
          score += pct * w;
          totalW += w;
        }
      }
      return totalW > 0 ? Math.round(score / totalW) : 0;
    };

    // Aggregate by team
    const teamScores = teams.map(t => {
      const teamReps = reps.filter(r => r.team_id === t.id);
      if (teamReps.length === 0) return null;
      const curAvg = Math.round(teamReps.reduce((s, r) => s + computeScore(curVals, r.id), 0) / teamReps.length);
      const priorAvg = Math.round(teamReps.reduce((s, r) => s + computeScore(priorVals, r.id), 0) / teamReps.length);
      const delta = curAvg - priorAvg;
      const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
      return { name: t.name, avg: curAvg, count: teamReps.length, arrow };
    }).filter(Boolean).sort((a, b) => b.avg - a.avg);

    if (teamScores.length === 0) return '';

    const orgAvg = Math.round(teamScores.reduce((s, t) => s + t.avg * t.count, 0) / teamScores.reduce((s, t) => s + t.count, 0));

    let block = '\n🏢 Team Comparison (This Week):';
    teamScores.forEach((t, i) => {
      block += `\n${i + 1}. ${t.name}: ${t.avg}% avg (${t.count} reps) ${t.arrow}`;
    });
    block += `\nOrg Average: ${orgAvg}%`;
    return block;
  });
}

async function fetchContestContext(sb, userId, orgId) {
  return getCachedOrFetch(`contests_${orgId}_${userId}`, 60000, async () => {
    const contests = checkSbResult('contests_list', await sb.from('active_contests')
      .select('id, name, kpi_key, status, start_date, end_date, reward_value')
      .eq('organization_id', orgId).in('status', ['active', 'upcoming'])
      .order('start_date').limit(5));
    if (!contests || contests.length === 0) return '';

    let block = '\n🏆 Contests:';
    for (const c of contests) {
      const daysLeft = Math.max(0, Math.ceil((new Date(c.end_date) - new Date()) / 86400000));
      block += `\n"${c.name}" — ${c.status === 'active' ? `${daysLeft} days left` : `starts ${c.start_date}`}`;

      if (c.status === 'active') {
        const lbResult = await sb.from('contest_leaderboards')
          .select('profile_id, rank, score, profiles(first_name, last_name)')
          .eq('contest_id', c.id).order('rank').limit(5);
        if (lbResult.error) console.error('[aaron-data] contest_leaderboard:', lbResult.error.message);
        const lb = lbResult.data;
        if (lb && lb.length > 0) {
          const medals = ['🥇', '🥈', '🥉'];
          const top = lb.map((e, i) => {
            const name = `${e.profiles?.first_name || ''} ${e.profiles?.last_name || ''}`.trim();
            const isYou = e.profile_id === userId;
            return `${medals[i] || `#${e.rank}`} ${isYou ? 'You' : name} (${Math.round(e.score)})`;
          });
          block += '\n  ' + top.join(', ');
          const userEntry = lb.find(e => e.profile_id === userId);
          if (userEntry) block += `\n  Your rank: #${userEntry.rank}`;
          else {
            // Check if user is enrolled but not in top 5
            const { data: userLb } = await sb.from('contest_leaderboards')
              .select('rank, score').eq('contest_id', c.id).eq('profile_id', userId).maybeSingle();
            if (userLb) block += `\n  Your rank: #${userLb.rank} (score: ${Math.round(userLb.score)})`;
          }
        }
      }
    }
    return block;
  });
}

async function fetchProgressionContext(sb, userId, orgId, role) {
  return getCachedOrFetch(`progression_${orgId}_${userId}`, 60000, async () => {
    const profiles = await getVisibleProfiles(sb, userId, orgId, role);
    if (profiles.length === 0) return '';

    const profileIds = profiles.map(p => p.id);

    // Recent achievements (last 7 days)
    const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();
    const [recentAchRes, achCountsRes, badgeCountsRes, skillsetsRes] = await Promise.all([
      sb.from('profile_achievements')
        .select('profile_id, achievement_id, achievements(name)')
        .in('profile_id', profileIds).gte('completed_at', weekAgo).limit(20),
      sb.from('profile_achievements')
        .select('profile_id').in('profile_id', profileIds),
      sb.from('profile_badges')
        .select('profile_id').in('profile_id', profileIds),
      sb.from('profile_skillsets')
        .select('profile_id, skillset_id, skillsets(name), progress')
        .in('profile_id', profileIds),
    ]);
    const recentAch = checkSbResult('progression_recentAch', recentAchRes);
    const achCounts = checkSbResult('progression_achCounts', achCountsRes);
    const badgeCounts = checkSbResult('progression_badgeCounts', badgeCountsRes);
    const skillsets = checkSbResult('progression_skillsets', skillsetsRes);

    // Count per profile
    const achCountMap = {};
    (achCounts || []).forEach(a => { achCountMap[a.profile_id] = (achCountMap[a.profile_id] || 0) + 1; });
    const badgeCountMap = {};
    (badgeCounts || []).forEach(b => { badgeCountMap[b.profile_id] = (badgeCountMap[b.profile_id] || 0) + 1; });

    let block = '\n🎯 Progression:';
    if (role === 'power_user' && profiles.length === 1) {
      const p = profiles[0];
      const LEVELS = ['Developing', 'Intermediate', 'Proficient', 'Elite', 'Master'];
      const THRESHOLDS = [0, 100, 500, 2000, 5000];
      const levelIdx = LEVELS.indexOf(p.apptivia_level || 'Developing');
      const nextThreshold = THRESHOLDS[levelIdx + 1] || null;
      const ptsToNext = nextThreshold ? nextThreshold - (p.total_points || 0) : 0;

      block += `\nLevel: ${p.apptivia_level || 'Developing'} (${p.total_points || 0} pts)`;
      if (nextThreshold) block += ` — ${ptsToNext} pts to ${LEVELS[levelIdx + 1]}`;
      block += `\nAchievements: ${achCountMap[p.id] || 0} earned`;

      const recent = (recentAch || []).filter(a => a.profile_id === p.id).map(a => a.achievements?.name).filter(Boolean);
      if (recent.length > 0) block += ` (this week: ${recent.slice(0, 5).join(', ')})`;
      block += `\nBadges: ${badgeCountMap[p.id] || 0} total`;

      const mySkills = (skillsets || []).filter(s => s.profile_id === p.id);
      if (mySkills.length > 0) {
        block += '\nSkillsets: ' + mySkills.map(s => `${s.skillsets?.name || '?'} ${Math.round(s.progress || 0)}%`).join(', ');
      }
    } else {
      // Manager/Admin — team overview
      const sorted = profiles.map(p => ({
        name: `${p.first_name || ''} ${p.last_name || ''}`.trim(),
        level: p.apptivia_level || 'Developing',
        points: p.total_points || 0,
        achievements: achCountMap[p.id] || 0,
      })).sort((a, b) => b.points - a.points);

      block += `\n${sorted.length} reps:`;
      sorted.slice(0, 10).forEach(r => {
        block += `\n  ${r.name}: ${r.level} (${r.points} pts, ${r.achievements} achievements)`;
      });
      if (sorted.length > 10) block += `\n  ...and ${sorted.length - 10} more`;
    }
    return block;
  });
}

async function fetchCoachingContext(sb, userId, orgId, role) {
  return getCachedOrFetch(`coaching_${orgId}_${userId}`, 60000, async () => {
    // coaching_plans columns: name (not title), member_ids (uuid[]), created_by → profiles FK
    let query = sb.from('coaching_plans')
      .select('id, name, status, created_at, created_by, member_ids')
      .eq('organization_id', orgId)
      .in('status', ['active', 'in_progress', 'draft'])
      .order('created_at', { ascending: false })
      .limit(10);

    if (role === 'power_user') {
      query = query.contains('member_ids', [userId]);
    }
    // manager/admin see all org plans

    const plans = checkSbResult('coaching_plans', await query);
    if (!plans || plans.length === 0) return '';

    let block = '\n📋 Active Coaching Plans:';
    for (const p of plans) {
      block += `\n"${p.name}" — ${p.status}`;
    }
    return block;
  });
}

async function fetchPipelineContext(sb, userId, orgId, role) {
  return getCachedOrFetch(`pipeline_${orgId}_${userId}`, 60000, async () => {
    // Get pipeline KPI values (sourced_opps, closed_won, revenue)
    const pipelineKeys = ['sourced_opps', 'closed_won', 'closed_won_deals', 'revenue_generated', 'pipeline_value'];
    const kpiMetrics = checkSbResult('pipeline_kpiMetrics', await sb.from('kpi_metrics')
      .select('id, key, name').in('key', pipelineKeys));
    if (!kpiMetrics || kpiMetrics.length === 0) return '';

    const kpiIds = kpiMetrics.map(k => k.id);
    const profiles = await getVisibleProfiles(sb, userId, orgId, role);
    if (profiles.length === 0) return '';

    const profileIds = profiles.map(p => p.id);
    const { start, end } = getCurrentWeekRange();

    const vals = checkSbResult('pipeline_vals', await sb.from('kpi_values')
      .select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).in('kpi_id', kpiIds)
      .gte('period_start', start).lte('period_end', end));

    // Aggregate by KPI
    const totals = {};
    for (const v of (vals || [])) {
      const metric = kpiMetrics.find(k => k.id === v.kpi_id);
      if (!metric) continue;
      totals[metric.key] = (totals[metric.key] || 0) + Number(v.value);
    }

    if (Object.keys(totals).length === 0) return '';

    let block = '\n💰 Pipeline Summary (This Week):';
    const labels = {
      sourced_opps: 'New Opportunities',
      closed_won: 'Deals Closed',
      closed_won_deals: 'Deals Closed',
      revenue_generated: 'Revenue Generated',
      pipeline_value: 'Pipeline Value',
    };
    for (const [key, val] of Object.entries(totals)) {
      const label = labels[key] || key;
      const formatted = key.includes('revenue') || key.includes('pipeline')
        ? `$${val >= 1000 ? Math.round(val / 1000) + 'K' : Math.round(val)}`
        : Math.round(val);
      block += `\n${label}: ${formatted}`;
    }
    if (role !== 'power_user') block += ` (across ${profiles.length} reps)`;
    return block;
  });
}

async function fetchAnalyticsSummaryContext(sb, orgId) {
  return getCachedOrFetch(`analytics_${orgId}`, 60000, async () => {
    const { start, end } = getCurrentWeekRange();
    const prior = getPriorWeekRange();

    const reps = checkSbResult('analytics_reps', await sb.from('profiles')
      .select('id').eq('organization_id', orgId).in('role', ['power user']));
    if (!reps || reps.length === 0) return '';

    const configs = checkSbResult('analytics_configs', await sb.from('kpi_org_configs')
      .select('kpi_id, goal, weight, kpi_metrics!inner(direction)')
      .eq('organization_id', orgId).eq('is_active', true).eq('show_on_scorecard', true));
    if (!configs || configs.length === 0) return '';

    const profileIds = reps.map(r => r.id);

    const curVals = checkSbResult('analytics_curVals', await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', start).lte('period_end', end));
    const priorVals = checkSbResult('analytics_priorVals', await sb.from('kpi_values').select('profile_id, kpi_id, value')
      .in('profile_id', profileIds).gte('period_start', prior.start).lte('period_end', prior.end));

    const computeRepScore = (vals, pid) => {
      let score = 0, totalW = 0;
      for (const c of configs) {
        const raw = (vals || []).filter(v => v.profile_id === pid && v.kpi_id === c.kpi_id)
          .reduce((s, v) => s + Number(v.value), 0);
        const goal = c.goal || 1;
        const w = c.weight || 1;
        const dir = c.kpi_metrics?.direction || 'higher';
        const pct = dir === 'lower'
          ? (raw > 0 ? Math.min((goal / raw) * 100, 200) : null)
          : Math.min((raw / goal) * 100, 200);
        if (pct !== null) {
          score += pct * w;
          totalW += w;
        }
      }
      return totalW > 0 ? Math.round(score / totalW) : 0;
    };

    const curScores = reps.map(r => computeRepScore(curVals, r.id));
    const priorScores = reps.map(r => computeRepScore(priorVals, r.id));
    const curAvg = Math.round(curScores.reduce((s, v) => s + v, 0) / curScores.length);
    const priorAvg = Math.round(priorScores.reduce((s, v) => s + v, 0) / priorScores.length);
    const delta = curAvg - priorAvg;
    const arrow = delta > 0 ? '↑' : delta < 0 ? '↓' : '→';
    const atTarget = curScores.filter(s => s >= 100).length;
    const needsCoaching = curScores.filter(s => s < 70).length;

    let block = '\n📈 Org Analytics (This Week):';
    block += `\nActive reps: ${reps.length} | Org avg score: ${curAvg}% (${arrow}${Math.abs(delta)}% vs last week)`;
    block += `\nReps at target: ${atTarget}/${reps.length} (${Math.round(atTarget / reps.length * 100)}%)`;
    if (needsCoaching > 0) block += ` | Needs coaching: ${needsCoaching} reps below 70%`;
    return block;
  });
}

// ── Spec 04: Fetch Aaron outcome stats for prompt context ───────────────────
async function fetchAaronOutcomeContext(repProfileId, orgId) {
  if (!repProfileId || !orgId) return '';
  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    const { data: outcomes } = await sb
      .from('aaron_recommendation_outcomes')
      .select('kpi_key, lift_pct_30d, lift_pct_60d, was_acted_on')
      .eq('organization_id', orgId)
      .eq('rep_profile_id', repProfileId)
      .not('value_at_30d', 'is', null)
      .order('recommendation_at', { ascending: false })
      .limit(5);

    if (!outcomes || outcomes.length === 0) return '';

    const acted = outcomes.filter(o => o.was_acted_on);
    const lifts = acted.map(o => o.lift_pct_30d).filter(v => v !== null);
    const avgLift = lifts.length > 0 ? lifts.reduce((s, v) => s + v, 0) / lifts.length : null;

    let block = `\n\n## Aaron's Track Record With This Rep`;
    block += `\nLast ${outcomes.length} recommendations: ${acted.length}/${outcomes.length} were acted on.`;
    if (avgLift !== null) {
      block += `\nAverage 30-day KPI lift on acted-on recommendations: ${avgLift.toFixed(1)}%`;
      if (avgLift > 5) {
        block += `\nUse this track record as evidence when the rep or manager pushes back.`;
      } else if (avgLift < -2) {
        block += `\nBe more cautious with confident recommendations — past suggestions have not produced measurable lift.`;
      }
    }
    return block;
  } catch (err) {
    console.error('[fetchAaronOutcomeContext] Error:', err.message);
    return '';
  }
}

// ── Rep Detail Context (Spec 07 — coaching plan data injection) ───────────────

/**
 * Extract a rep name from a message, match to an org profile, and fetch their
 * detailed KPI data with 4-week trends. Used for coaching plans, 1:1 prep, etc.
 */
async function fetchRepDetailContext(sb, message, orgId, role, targetRepName = null) {
  if (!orgId) return '';

  // 1. Use explicitly provided rep name if available; fallback to regex extraction
  let candidateName = targetRepName || null;

  if (!candidateName && message) {
    const patterns = [
      /(?:for|about|on|with|coach(?:ing)?)\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/,
      /([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)'s\s+(?:performance|kpi|scorecard|plan|data|coaching)/i,
    ];
    for (const p of patterns) {
      const m = message.match(p);
      if (m) { candidateName = m[1].trim(); break; }
    }
  }
  if (!candidateName) return '';

  // 2. Look up the rep in the org
  const { data: allReps } = await sb.from('profiles')
    .select('id, first_name, last_name, team_id, role, apptivia_level, total_points')
    .eq('organization_id', orgId);
  if (!allReps || allReps.length === 0) return '';

  const lower = candidateName.toLowerCase();
  const matchedRep = allReps.find(r => {
    const full = `${r.first_name || ''} ${r.last_name || ''}`.toLowerCase().trim();
    const first = (r.first_name || '').toLowerCase();
    return full === lower || first === lower || full.startsWith(lower);
  });
  if (!matchedRep) {
    console.log(`[aaron-data] fetchRepDetail: no match for "${candidateName}" in org ${orgId}`);
    return '';
  }

  const repName = `${matchedRep.first_name || ''} ${matchedRep.last_name || ''}`.trim();
  const cacheKey = `repdetail_${orgId}_${matchedRep.id}`;

  return getCachedOrFetch(cacheKey, 60000, async () => {
    // 3. Fetch KPI configs
    const configs = checkSbResult('repdetail_configs', await sb.from('kpi_org_configs')
      .select('kpi_id, goal, weight, kpi_metrics!inner(key, name, direction)')
      .eq('organization_id', orgId).eq('is_active', true).eq('show_on_scorecard', true));
    if (!configs || configs.length === 0) return '';

    // 4. Get last 4 weeks of KPI data for trending
    const now = new Date();
    const fourWeeksAgo = new Date(now);
    fourWeeksAgo.setUTCDate(fourWeeksAgo.getUTCDate() - 28);
    const rangeStart = fourWeeksAgo.toISOString().split('T')[0];
    const { end: rangeEnd } = getCurrentWeekRange();

    const vals = checkSbResult('repdetail_vals', await sb.from('kpi_values')
      .select('kpi_id, value, period_start')
      .eq('profile_id', matchedRep.id)
      .gte('period_start', rangeStart).lte('period_end', rangeEnd));

    // 5. Aggregate values by week and KPI
    const weekBuckets = {};
    for (const v of (vals || [])) {
      const weekKey = v.period_start?.slice(0, 10) || 'unknown';
      if (!weekBuckets[weekKey]) weekBuckets[weekKey] = {};
      if (!weekBuckets[weekKey][v.kpi_id]) weekBuckets[weekKey][v.kpi_id] = 0;
      weekBuckets[weekKey][v.kpi_id] += Number(v.value);
    }
    const sortedWeeks = Object.keys(weekBuckets).sort();

    // 6. Build detail block
    let block = `\n\n🔍 DETAILED REP DATA: ${repName}`;
    block += `\nRole: ${matchedRep.role || 'rep'} | Level: ${matchedRep.apptivia_level || 'N/A'} | Points: ${matchedRep.total_points || 0}`;

    // Current week KPIs with attainment
    const { start: curStart } = getCurrentWeekRange();
    const curWeek = weekBuckets[curStart] || {};
    block += '\n\nCurrent Week KPIs:';
    for (const c of configs) {
      const val = curWeek[c.kpi_id] || 0;
      const goal = c.goal || 1;
      const name = c.kpi_metrics?.name || c.kpi_metrics?.key || 'KPI';
      const dir = c.kpi_metrics?.direction || 'higher';
      const pct = dir === 'lower'
        ? (val > 0 ? Math.min((goal / val) * 100, 200) : null)
        : Math.min((val / goal) * 100, 200);
      block += `\n  ${name}: ${Math.round(val)} / ${goal} (${pct !== null ? Math.round(pct) + '% attainment' : 'no data recorded yet'})`;
    }

    // 4-week trend for each KPI
    if (sortedWeeks.length > 1) {
      block += '\n\n4-Week Trends (oldest → newest):';
      for (const c of configs) {
        const name = c.kpi_metrics?.name || c.kpi_metrics?.key || 'KPI';
        const goal = c.goal || 1;
        const weekVals = sortedWeeks.map(w => {
          const raw = weekBuckets[w]?.[c.kpi_id] || 0;
          const dir = c.kpi_metrics?.direction || 'higher';
          const pct = dir === 'lower'
            ? (raw > 0 ? Math.min((goal / raw) * 100, 200) : null)
            : Math.min((raw / goal) * 100, 200);
          return pct !== null ? `${Math.round(pct)}%` : '—';
        });
        block += `\n  ${name}: ${weekVals.join(' → ')}`;
      }
    }

    // Identify weakest KPIs (below 50% attainment)
    const weakKpis = configs.filter(c => {
      const val = curWeek[c.kpi_id] || 0;
      const goal = c.goal || 1;
      const dir = c.kpi_metrics?.direction || 'higher';
      const pct = dir === 'lower'
        ? (val > 0 ? Math.min((goal / val) * 100, 200) : null)
        : Math.min((val / goal) * 100, 200);
      return pct === null || pct < 50;
    }).map(c => c.kpi_metrics?.name || c.kpi_metrics?.key);

    if (weakKpis.length > 0) {
      block += `\n\nKPIs below 50% attainment (coaching priority): ${weakKpis.join(', ')}`;
    }

    console.log(`[aaron-data] fetchRepDetail: ${repName} — ${configs.length} KPIs, ${sortedWeeks.length} weeks of data`);
    return block;
  });
}

// ── Calendar Context (Spec 11 — Pre-Call Prep + Daily Briefing) ──────────────
const _calendarCache = {};

async function fetchCalendarContext(userId, organizationId) {
  if (!userId || !organizationId) return '';

  const cacheKey = `${userId}_${organizationId}`;
  const cached = _calendarCache[cacheKey];
  if (cached && (Date.now() - cached.ts) < 60000) return cached.data;

  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    const now = new Date();
    const next24h = new Date(now.getTime() + 24 * 60 * 60 * 1000);

    const { data: events, error } = await sb
      .from('integration_calendar_events')
      .select('title, start_time, end_time, attendees, location, external_link')
      .eq('profile_id', userId)
      .eq('organization_id', organizationId)
      .gte('start_time', now.toISOString())
      .lte('start_time', next24h.toISOString())
      .order('start_time', { ascending: true })
      .limit(10);

    if (error || !events?.length) {
      _calendarCache[cacheKey] = { data: '', ts: Date.now() };
      return '';
    }

    let block = '[UPCOMING MEETINGS (next 24h)]';
    for (const evt of events) {
      const start = new Date(evt.start_time);
      const timeStr = start.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
      const attendeeList = (evt.attendees || [])
        .map(a => a.name || a.email)
        .filter(Boolean)
        .slice(0, 5)
        .join(', ');
      block += `\n- ${timeStr}: ${evt.title}`;
      if (attendeeList) block += ` (with: ${attendeeList})`;
      if (evt.location) block += ` [${evt.location}]`;
    }

    _calendarCache[cacheKey] = { data: block, ts: Date.now() };
    return block;
  } catch (err) {
    console.error('fetchCalendarContext error:', err.message);
    return '';
  }
}

// ── Structured Output Prompts (Spec 07) ──────────────────────────────────────
const STRUCTURED_OUTPUT_PROMPTS = {
  coaching_plan: `Output your response as JSON conforming to this schema:
{
  "type": "coaching_plan",
  "rep_name": string,
  "diagnosis": {
    "primary_kpi_gap": string,
    "evidence": [string],
    "underlying_belief": string
  },
  "coaching_plan": {
    "week_1_focus": string,
    "week_1_actions": [string],
    "week_2_focus": string,
    "week_2_actions": [string],
    "week_4_checkpoint": string
  },
  "framework_used": string,
  "manager_talk_track": string,
  "rep_facing_message": string
}
When constructing the plan, reference the organization's Sales DNA methodology (if provided above) to frame actions using the org's specific terminology and approach. If an ICP profile is available, make action items specific to the org's target market — reference actual target industries, company sizes, or tech signals rather than generic examples. Align week focuses with the org's coaching philosophy and CEP stage requirements if defined. Use the rep's detailed KPI data and 4-week trends (if provided above) to ground every recommendation in specific numbers.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  one_on_one_prep: `Output your response as JSON conforming to this schema:
{
  "type": "one_on_one_prep",
  "rep_name": string,
  "meeting_context": {
    "kpi_movement_summary": string,
    "open_deals_count": number | null,
    "deals_at_risk_count": number | null
  },
  "agenda": [
    { "topic": string, "minutes": number, "talking_points": [string] }
  ],
  "celebrate": [string],
  "investigate": [string],
  "decide": [string],
  "rep_facing_pre_read": string
}
Reference the organization's ICP profile when discussing prospecting or pipeline topics. Use the CEP pipeline stage names and win probabilities (if provided above) when evaluating deal progress. If the rep has a defined title with stage-specific responsibilities, incorporate those into talking points. Use the org's Sales DNA methodology terminology in coaching recommendations. Ground all observations in the rep's actual KPI data and trends.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  pipeline_diagnosis: `Output your response as JSON conforming to this schema:
{
  "type": "pipeline_diagnosis",
  "team_or_rep_name": string,
  "scope": "team" | "rep",
  "diagnosis_summary": string,
  "stage_health": [
    { "stage": string, "deal_count": number | null, "value": number | null, "health": "green" | "yellow" | "red", "issue": string }
  ],
  "stalled_deals": [
    { "deal_name": string, "value": number | null, "days_in_stage": number | null, "recommended_action": string }
  ],
  "missing_pipeline_value": number | null,
  "actions_this_week": [
    { "action": string, "owner": string, "deadline": string }
  ]
}
Evaluate stage health against the organization's CEP win probabilities and expected days per stage (if provided above). When assessing deal quality, reference the ICP criteria — flag deals that don't match target industries, company size, or revenue range. Use the org's qualification framework terminology (e.g., MEDDPICC criteria) when diagnosing deal gaps. Reference specific deal stage names from the org's CEP rather than generic labels.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  pre_call_prep: `Output your response as JSON conforming to this schema:
{
  "type": "pre_call_prep",
  "meeting_title": string,
  "meeting_time": string,
  "who": {
    "attendees": [string],
    "key_person": string,
    "relationship_notes": string | null
  },
  "likely_topics": [string, string, string],
  "questions_to_ask": [
    { "question": string, "why": string }
  ],
  "objection_prep": {
    "objection": string,
    "response_framework": string
  },
  "next_step_goal": string
}
Use the rep's pipeline data and deal context to ground the prep card. Reference the org's qualification framework (MEDDPICC/BANT) when suggesting questions. Match question suggestions to the deal's current stage. If calendar attendee info is available, use it for the "who" section. Keep questions_to_ask to exactly 3 items. The objection should be the MOST LIKELY objection based on deal stage and context.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  skill_builder: `Output your response as JSON conforming to this schema:
{
  "type": "skill_builder",
  "skill_dimension": string,
  "current_state": {
    "assessment": string,
    "evidence": [string]
  },
  "phase_1": {
    "name": "Surface Clearing",
    "duration": "Week 1",
    "focus": string,
    "exercises": [string]
  },
  "phase_2": {
    "name": "Structural Exposure",
    "duration": "Week 2-3",
    "focus": string,
    "exercises": [string]
  },
  "phase_3": {
    "name": "Core Displacement",
    "duration": "Week 4",
    "focus": string,
    "exercises": [string]
  },
  "success_metrics": [string],
  "managers_role": string
}
Use the rep's KPI data to identify which skill dimension needs the most work. Reference the org's Sales DNA methodology in exercises (e.g., if org uses Challenger Sale, exercises should use Challenger terminology). Ground the current_state assessment in actual performance data. Each phase should have 2-3 specific, actionable exercises.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  daily_briefing_morning: `Output your response as JSON conforming to this schema:
{
  "type": "daily_briefing_morning",
  "greeting": string,
  "priorities": [string, string, string],
  "kpi_watch": [
    { "kpi": string, "status": "on_track" | "behind" | "ahead", "action": string }
  ],
  "todays_meetings": [
    { "time": string, "title": string, "prep_note": string }
  ],
  "one_thing_to_watch": string,
  "yesterdays_commitments": string | null
}
Keep the entire briefing under 150 words. Use the rep's live KPI data for kpi_watch — focus on the 2-3 most important KPIs. Use calendar data for todays_meetings. Reference yesterday's EOD commitment from rep memory if available. The greeting should be warm but brief (first name + one line). one_thing_to_watch should be the single most important thing to pay attention to today.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,

  daily_briefing_eod: `Output your response as JSON conforming to this schema:
{
  "type": "daily_briefing_eod",
  "what_moved": [string, string],
  "what_stalled": [string],
  "reflection_question": string,
  "tomorrows_commitment": string
}
Keep the entire reflection under 120 words. what_moved should highlight 2 positive things that happened today based on KPI data or activity. what_stalled should identify 1 thing that didn't progress. reflection_question should be a thought-provoking question Aaron ASKS the rep (Aaron does NOT answer it). tomorrows_commitment should be a single specific commitment for tomorrow. Ground everything in actual KPI data and pipeline movement.
Return ONLY valid JSON. No preamble, no closing remarks, no markdown fences. If you lack data for a field, use null — never fabricate.`,
};

/**
 * Detect if message should trigger structured JSON output.
 * Returns { key, prompt } or null.
 */
function detectStructuredOutputMode(rolePreset, message, page) {
  const msg = (message || '').toLowerCase();

  // Coaching Plan — manager preset or explicit coaching plan request
  if (rolePreset === 'Coaching Plan' ||
      rolePreset === 'coaching_belief_reframe' ||
      rolePreset === 'belief_reframe' ||
      (msg.includes('coaching plan') && (msg.includes('create') || msg.includes('generate') || msg.includes('suggest') || msg.includes('build') || msg.includes('draft')))) {
    return { key: 'coaching_plan', prompt: STRUCTURED_OUTPUT_PROMPTS.coaching_plan };
  }

  // 1:1 Prep — manager preset or explicit 1:1 request
  if (rolePreset === '1-on-1 Prep' ||
      rolePreset === '1:1 Prep' ||
      /1[:\-]on[:\-]1\s*(prep|agenda|plan)/i.test(msg) ||
      /one[:\-]on[:\-]one\s*(prep|agenda|plan)/i.test(msg) ||
      (msg.includes('1:1') && (msg.includes('prep') || msg.includes('prepare') || msg.includes('agenda')))) {
    return { key: 'one_on_one_prep', prompt: STRUCTURED_OUTPUT_PROMPTS.one_on_one_prep };
  }

  // Pipeline Diagnosis — preset or explicit pipeline diagnosis request
  if (rolePreset === 'coaching_pipeline_diagnosis' ||
      rolePreset === 'pipeline_diagnosis' ||
      rolePreset === 'Pipeline Review' ||
      (msg.includes('pipeline') && (msg.includes('diagnos') || msg.includes('review') || msg.includes('health') || msg.includes('analyz')))) {
    return { key: 'pipeline_diagnosis', prompt: STRUCTURED_OUTPUT_PROMPTS.pipeline_diagnosis };
  }

  // Pre-Call Prep (Spec 11 Mode 2)
  if (rolePreset === 'Pre-Call Prep' ||
      rolePreset === 'Call Prep' ||
      /pre.?call/i.test(msg) ||
      (msg.includes('call') && (msg.includes('prep') || msg.includes('prepare'))) ||
      (msg.includes('meeting') && (msg.includes('prep') || msg.includes('prepare')))) {
    return { key: 'pre_call_prep', prompt: STRUCTURED_OUTPUT_PROMPTS.pre_call_prep };
  }

  // Skill Builder (Spec 11 Mode 4)
  if (rolePreset === 'Skill Builder' ||
      /skill\s*(build|practice|drill)/i.test(msg) ||
      /improve\s*(my|the)\s*(discovery|qualification|objection|closing|negotiation|prospecting|demo)/i.test(msg)) {
    return { key: 'skill_builder', prompt: STRUCTURED_OUTPUT_PROMPTS.skill_builder };
  }

  // Daily Briefing (Spec 11 Mode 1) — auto-selects morning/eod by hour
  if (rolePreset === 'Daily Briefing' ||
      rolePreset === 'Morning Briefing' ||
      rolePreset === 'EOD Reflection' ||
      /daily\s*briefing/i.test(msg) ||
      /morning\s*briefing/i.test(msg) ||
      /eod\s*(reflection|review|wrap)/i.test(msg) ||
      /end\s*of\s*day/i.test(msg)) {
    const hour = new Date().getHours();
    const isEod = rolePreset === 'EOD Reflection' || /eod|end\s*of\s*day/i.test(msg) || hour >= 14;
    const key = isEod ? 'daily_briefing_eod' : 'daily_briefing_morning';
    return { key, prompt: STRUCTURED_OUTPUT_PROMPTS[key] };
  }

  return null;
}

// ── Call Intelligence Context for Aaron ──────────────────────────────────────

async function fetchAaronCallContext(profileId, orgId) {
  if (!profileId || !orgId) return '';
  try {
    const sb = _getSupabaseAdmin();
    if (!sb) return '';

    // Fetch last 5 calls with conversational intelligence for this rep
    const { data: calls } = await sb
      .from('engage_call_logs')
      .select('contact_name, duration_minutes, call_sentiment, conversational_intelligence, created_at')
      .eq('organization_id', orgId)
      .eq('user_id', profileId)
      .not('conversational_intelligence', 'is', null)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!calls?.length) return '';

    // Compute aggregates
    let totalTalkRatio = 0;
    let totalMethodology = 0;
    let methodologyCount = 0;
    const objections = {};
    const sentiments = [];
    let totalQuestions = 0;
    let totalFillers = 0;

    for (const call of calls) {
      const ci = call.conversational_intelligence;
      if (!ci) continue;
      if (ci.talk_ratio?.rep) totalTalkRatio += ci.talk_ratio.rep;
      if (ci.methodology_adherence?.score != null) {
        totalMethodology += ci.methodology_adherence.score;
        methodologyCount++;
      }
      if (ci.sentiment) sentiments.push(ci.sentiment);
      if (ci.questions_asked) totalQuestions += ci.questions_asked;
      if (ci.filler_word_count) totalFillers += ci.filler_word_count;
      if (ci.objections) {
        for (const obj of ci.objections) {
          const key = obj.toLowerCase().trim();
          objections[key] = (objections[key] || 0) + 1;
        }
      }
    }

    const avgTalkRatio = Math.round(totalTalkRatio / calls.length);
    const avgMethodology = methodologyCount > 0 ? Math.round(totalMethodology / methodologyCount) : null;
    const topObjections = Object.entries(objections).sort((a, b) => b[1] - a[1]).slice(0, 3);
    const sentimentTrend = sentiments.join(' → ');
    const framework = calls.find(c => c.conversational_intelligence?.methodology_adherence?.framework)?.conversational_intelligence?.methodology_adherence?.framework || 'N/A';

    const parts = [
      `CALL INTELLIGENCE (last ${calls.length} calls):`,
      `- Avg talk ratio: ${avgTalkRatio}% (target 40-50%)`,
      `- Avg questions/call: ${Math.round(totalQuestions / calls.length)}`,
      `- Avg filler words/call: ${Math.round(totalFillers / calls.length)}`,
    ];
    if (avgMethodology !== null) {
      parts.push(`- Methodology adherence: ${avgMethodology}% (${framework})`);
    }
    if (topObjections.length > 0) {
      parts.push(`- Top objections: ${topObjections.map(([o, c]) => `${o} (${c}x)`).join(', ')}`);
    }
    if (sentimentTrend) {
      parts.push(`- Sentiment trend: ${sentimentTrend}`);
    }
    // Latest coaching suggestions
    const latestCoaching = calls[0]?.conversational_intelligence?.coaching_suggestions;
    if (latestCoaching?.length) {
      parts.push(`- Latest coaching tips: ${latestCoaching.slice(0, 3).join('; ')}`);
    }

    return parts.join('\n');
  } catch (err) {
    console.error('[fetchAaronCallContext] Error:', err.message);
    return '';
  }
}

// ── Sales DNA cache invalidation (call after saving Sales DNA config) ────────
function clearSalesDnaCache(orgId) {
  if (orgId && _salesDnaCache[orgId]) {
    delete _salesDnaCache[orgId];
    console.log(`[aaron-cache] Cleared Sales DNA cache for org ${orgId}`);
  }
}

// ── Module exports ───────────────────────────────────────────────────────────
module.exports = {
  init,
  getSalesDnaContext,
  getIcpProfileContext,
  AI_STYLE_RULE,
  AARON_FRAMEWORKS,
  PRESET_FRAMEWORK_MAP,
  PAGE_CATEGORY_BOOSTS,
  detectFrameworks,
  buildFrameworkSystemPrompt,
  classifyAaronIntent,
  classifyAaronModelTier,
  selectAaronModel,
  SONNET_MODEL,
  HAIKU_MODEL,
  _aaronDailyLimits,
  _aaronLiveCache,
  _aaronOrgCache,
  _aaronDataCache,
  fetchAaronLiveContext,
  fetchAaronOrgContext,
  fetchAaronRepMemory,
  updateAaronRepMemory,
  fetchScorecardContext,
  fetchTeamComparisonContext,
  fetchContestContext,
  fetchProgressionContext,
  fetchCoachingContext,
  fetchPipelineContext,
  fetchAnalyticsSummaryContext,
  fetchAaronOutcomeContext,
  fetchAaronCallContext,
  fetchRepDetailContext,
  fetchCalendarContext,
  STRUCTURED_OUTPUT_PROMPTS,
  detectStructuredOutputMode,
  clearSalesDnaCache,
};
