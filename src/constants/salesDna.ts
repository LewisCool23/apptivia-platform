/**
 * Sales DNA Constants — Methodologies, Qualification Frameworks, and type definitions.
 * Used across onboarding, org settings, CEP configuration, and AI coaching prompts.
 */

// ── Sales Methodology Definitions ────────────────────────────────────────────

export interface SalesMethodology {
  key: string;
  name: string;
  short_description: string;
  core_principles: string[];
  coaching_focus: string;
}

export const SALES_METHODOLOGIES: SalesMethodology[] = [
  {
    key: 'spin_selling',
    name: 'SPIN Selling',
    short_description: 'Situation, Problem, Implication, Need-Payoff questions to uncover buyer pain',
    core_principles: [
      'Ask Situation questions to understand the buyer\'s current state',
      'Probe Problem questions to surface explicit difficulties',
      'Develop Implication questions to expand the impact of problems',
      'Guide Need-Payoff questions so the buyer articulates the value of a solution',
    ],
    coaching_focus: 'Discovery call quality, question depth, and letting the buyer self-discover value',
  },
  {
    key: 'challenger_sale',
    name: 'Challenger Sale',
    short_description: 'Teach, Tailor, Take Control — reps challenge the buyer\'s thinking',
    core_principles: [
      'Teach the buyer something new about their business',
      'Tailor messaging to the specific stakeholder and their priorities',
      'Take control of the sale with constructive tension',
      'Lead with commercial insight, not product features',
    ],
    coaching_focus: 'Insight delivery, ability to reframe buyer thinking, and comfortable assertiveness',
  },
  {
    key: 'sandler_selling',
    name: 'Sandler Selling System',
    short_description: 'Buyer-seller equality; uses a pain funnel to qualify; no chasing',
    core_principles: [
      'Establish an upfront contract for every interaction',
      'Use the pain funnel to uncover deep emotional drivers',
      'Qualify budget, decision, and fulfillment before proposing',
      'Never chase — mutual respect and equal business stature',
    ],
    coaching_focus: 'Pain funnel discipline, upfront contracts, and no-chase prospecting cadence',
  },
  {
    key: 'solution_selling',
    name: 'Solution Selling',
    short_description: 'Diagnose problems first, then map product capabilities to solutions',
    core_principles: [
      'Diagnose before you prescribe — understand pain first',
      'Map product capabilities to specific buyer problems',
      'Create a vision of the solution in the buyer\'s mind',
      'Align with the buyer\'s decision process',
    ],
    coaching_focus: 'Needs analysis depth, capability-to-pain mapping, and vision creation skills',
  },
  {
    key: 'consultative_selling',
    name: 'Consultative Selling',
    short_description: 'Act as a trusted advisor; deep discovery before any pitch',
    core_principles: [
      'Position yourself as a trusted advisor, not a vendor',
      'Invest in deep discovery to understand the full business context',
      'Provide value in every interaction regardless of outcome',
      'Build long-term relationships over transactional wins',
    ],
    coaching_focus: 'Relationship building, strategic questioning, and business acumen',
  },
  {
    key: 'snap_selling',
    name: 'SNAP Selling',
    short_description: 'Keep it Simple, be iNvaluable, always Align, raise Priorities',
    core_principles: [
      'Keep it Simple — reduce complexity for overwhelmed buyers',
      'Be iNvaluable — stand out as an essential resource',
      'Always Align with the buyer\'s objectives and constraints',
      'Raise Priorities — elevate urgency for your solution',
    ],
    coaching_focus: 'Message simplicity, buyer-centric communication, and urgency creation',
  },
  {
    key: 'value_selling',
    name: 'Value Selling',
    short_description: 'Quantify ROI/business value rather than selling features',
    core_principles: [
      'Lead every conversation with quantified business value',
      'Build ROI models that resonate with economic buyers',
      'Connect product capabilities to measurable business outcomes',
      'Use customer success stories with concrete metrics',
    ],
    coaching_focus: 'ROI articulation, business case development, and value-based objection handling',
  },
  {
    key: 'command_of_message',
    name: 'Command of the Message',
    short_description: 'Consistent value messaging tied to buyer pain points (Force Management)',
    core_principles: [
      'Articulate value consistently using a messaging framework',
      'Differentiate on what you do better than anyone else',
      'Connect every message to the buyer\'s specific pain and desired outcomes',
      'Use proof points and metrics to support claims',
    ],
    coaching_focus: 'Messaging consistency, differentiation articulation, and proof-point usage',
  },
  {
    key: 'gap_selling',
    name: 'Gap Selling',
    short_description: 'Focus on the gap between the buyer\'s current state and desired future state',
    core_principles: [
      'Deeply understand the buyer\'s current state and its impact',
      'Define the buyer\'s desired future state in concrete terms',
      'Quantify the gap between current and future state',
      'Position your solution as the bridge across the gap',
    ],
    coaching_focus: 'Current state diagnosis, future state visioning, and gap quantification',
  },
  {
    key: 'miller_heiman',
    name: 'Miller Heiman (Strategic Selling)',
    short_description: 'Map all buying influences in complex deals',
    core_principles: [
      'Identify all buying influences: Economic, Technical, User, Coach',
      'Assess each influence\'s stance: Growth, Trouble, Even Keel, Overconfident',
      'Develop strategies for each influence to align with your solution',
      'Create a win-win result concept for every stakeholder',
    ],
    coaching_focus: 'Stakeholder mapping, political navigation, and multi-threaded deal management',
  },
  {
    key: 'target_account_selling',
    name: 'Target Account Selling (TAS)',
    short_description: 'Structured account planning for enterprise pursuits',
    core_principles: [
      'Prioritize accounts based on fit and win probability',
      'Build detailed account plans with competitive positioning',
      'Map organizational structure and decision-making process',
      'Execute systematic engagement across the buying committee',
    ],
    coaching_focus: 'Account planning discipline, executive engagement, and competitive strategy',
  },
  {
    key: 'inbound_selling',
    name: 'Inbound Selling',
    short_description: 'Align sales process to the buyer\'s journey (HubSpot methodology)',
    core_principles: [
      'Identify buyers already in an active buying journey',
      'Connect with leads through personalized, helpful outreach',
      'Explore the buyer\'s goals, challenges, and timeline',
      'Advise with a tailored presentation of your solution',
    ],
    coaching_focus: 'Buyer journey alignment, personalization at scale, and helpful selling',
  },
  {
    key: 'neat_selling',
    name: 'N.E.A.T. Selling',
    short_description: 'Need, Economic impact, Access to authority, Timeline',
    core_principles: [
      'Uncover core Need — what is the buyer truly trying to solve',
      'Quantify Economic impact — what is the cost of inaction',
      'Gain Access to authority — connect with decision-makers early',
      'Establish Timeline — understand the buyer\'s urgency and deadlines',
    ],
    coaching_focus: 'Needs articulation, economic storytelling, and authority access strategies',
  },
  {
    key: 'conceptual_selling',
    name: 'Conceptual Selling',
    short_description: 'Understand the buyer\'s concept of the solution before presenting product',
    core_principles: [
      'Understand the buyer\'s concept of what they need before presenting',
      'Ask confirmation, new information, and attitude questions',
      'Ensure mutual understanding of the buyer\'s decision criteria',
      'Only present product when concept alignment is confirmed',
    ],
    coaching_focus: 'Concept validation, active listening, and presentation timing discipline',
  },
];

// ── Qualification Framework Definitions ──────────────────────────────────────

export interface QualificationCriterion {
  key: string;
  label: string;
  description: string;
}

export interface QualificationFramework {
  key: string;
  name: string;
  short_description: string;
  criteria: QualificationCriterion[];
  coaching_focus: string;
}

export const QUALIFICATION_FRAMEWORKS: QualificationFramework[] = [
  {
    key: 'bant',
    name: 'BANT',
    short_description: 'Budget, Authority, Need, Timeline — classic top-of-funnel qualification',
    criteria: [
      { key: 'budget', label: 'Budget', description: 'Does the prospect have budget allocated or the ability to allocate budget?' },
      { key: 'authority', label: 'Authority', description: 'Are we engaged with the decision-maker or someone who can influence the decision?' },
      { key: 'need', label: 'Need', description: 'Does the prospect have a clear business need that our solution addresses?' },
      { key: 'timeline', label: 'Timeline', description: 'Is there a defined timeline or event driving the purchase decision?' },
    ],
    coaching_focus: 'Quick qualification, budget discovery techniques, and decision-maker access',
  },
  {
    key: 'meddic',
    name: 'MEDDIC',
    short_description: 'Metrics, Economic Buyer, Decision Criteria, Decision Process, Identify Pain, Champion',
    criteria: [
      { key: 'metrics', label: 'Metrics', description: 'What quantifiable measures will the buyer use to evaluate success?' },
      { key: 'economic_buyer', label: 'Economic Buyer', description: 'Who has the authority to approve budget and sign the deal?' },
      { key: 'decision_criteria', label: 'Decision Criteria', description: 'What technical, business, and vendor criteria will drive the decision?' },
      { key: 'decision_process', label: 'Decision Process', description: 'What steps, approvals, and timeline does the buyer follow to make a decision?' },
      { key: 'identify_pain', label: 'Identify Pain', description: 'What is the core business pain driving the evaluation?' },
      { key: 'champion', label: 'Champion', description: 'Who inside the account is actively selling on our behalf?' },
    ],
    coaching_focus: 'Champion development, economic buyer access, and metrics-driven value articulation',
  },
  {
    key: 'meddpicc',
    name: 'MEDDPICC',
    short_description: 'MEDDIC + Paper Process + Competition — the most comprehensive enterprise framework',
    criteria: [
      { key: 'metrics', label: 'Metrics', description: 'What quantifiable measures will the buyer use to evaluate success?' },
      { key: 'economic_buyer', label: 'Economic Buyer', description: 'Who has the authority to approve budget and sign the deal?' },
      { key: 'decision_criteria', label: 'Decision Criteria', description: 'What technical, business, and vendor criteria will drive the decision?' },
      { key: 'decision_process', label: 'Decision Process', description: 'What steps, approvals, and timeline does the buyer follow to make a decision?' },
      { key: 'paper_process', label: 'Paper Process', description: 'What is the legal, procurement, and contract approval workflow?' },
      { key: 'identify_pain', label: 'Identify Pain', description: 'What is the core business pain driving the evaluation?' },
      { key: 'champion', label: 'Champion', description: 'Who inside the account is actively selling on our behalf?' },
      { key: 'competition', label: 'Competition', description: 'Who are we competing against and what is our competitive differentiation?' },
    ],
    coaching_focus: 'Champion development, competitive positioning, procurement navigation, and multi-stakeholder deal management',
  },
];

// ── Methodology Approach Types ───────────────────────────────────────────────

export type MethodologyApproach = 'single' | 'hybrid' | 'custom';

export const METHODOLOGY_APPROACHES: { key: MethodologyApproach; label: string; description: string }[] = [
  { key: 'single', label: 'Single Methodology', description: 'Your team follows one core sales methodology' },
  { key: 'hybrid', label: 'Hybrid Model', description: 'Primary + Secondary methodology, optionally mapped to CEP stages' },
  { key: 'custom', label: 'Custom / Proprietary', description: 'Your org has its own internal sales methodology' },
];

// ── Sales DNA Shape (stored as JSONB on organizations.sales_dna) ─────────────

export interface MethodologyStageMapping {
  stage_key: string;
  methodology_key: string; // which methodology to use at this CEP stage
}

export interface SalesDnaConfig {
  methodology_approach: MethodologyApproach;
  primary_methodology: string | null;       // key from SALES_METHODOLOGIES
  secondary_methodology: string | null;     // key (hybrid only)
  custom_methodology_name: string | null;   // custom only
  custom_methodology_principles: string[];  // custom only
  qualification_framework: string | null;   // key from QUALIFICATION_FRAMEWORKS
  methodology_stage_mapping: MethodologyStageMapping[]; // hybrid CEP stage overrides
}

export const DEFAULT_SALES_DNA: SalesDnaConfig = {
  methodology_approach: 'single',
  primary_methodology: null,
  secondary_methodology: null,
  custom_methodology_name: null,
  custom_methodology_principles: [],
  qualification_framework: null,
  methodology_stage_mapping: [],
};

// ── Helper: Build coaching context string from Sales DNA ─────────────────────

export function buildSalesDnaCoachingContext(salesDna: SalesDnaConfig | null): string {
  if (!salesDna) return '';

  const parts: string[] = [];

  // Methodology context
  const approach = salesDna.methodology_approach;
  if (approach === 'single' && salesDna.primary_methodology) {
    const m = SALES_METHODOLOGIES.find(x => x.key === salesDna.primary_methodology);
    if (m) {
      parts.push(`=== SALES METHODOLOGY: ${m.name} ===`);
      parts.push(`Approach: ${m.short_description}`);
      parts.push(`Core Principles:\n${m.core_principles.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`);
      parts.push(`Coaching Focus: ${m.coaching_focus}`);
      parts.push('IMPORTANT: All coaching recommendations MUST align with this methodology. Use its language, techniques, and frameworks in your suggestions.');
    }
  } else if (approach === 'hybrid') {
    const primary = SALES_METHODOLOGIES.find(x => x.key === salesDna.primary_methodology);
    const secondary = SALES_METHODOLOGIES.find(x => x.key === salesDna.secondary_methodology);
    if (primary) {
      parts.push(`=== SALES METHODOLOGY: Hybrid Model ===`);
      parts.push(`Primary: ${primary.name} — ${primary.short_description}`);
      parts.push(`Primary Principles:\n${primary.core_principles.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`);
      if (secondary) {
        parts.push(`Secondary: ${secondary.name} — ${secondary.short_description}`);
        parts.push(`Secondary Principles:\n${secondary.core_principles.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`);
      }
      if (salesDna.methodology_stage_mapping?.length > 0) {
        parts.push(`Stage Mapping:`);
        for (const mapping of salesDna.methodology_stage_mapping) {
          const meth = SALES_METHODOLOGIES.find(x => x.key === mapping.methodology_key);
          if (meth) parts.push(`  - ${mapping.stage_key}: Use ${meth.name}`);
        }
      }
      parts.push('IMPORTANT: Use the primary methodology as the default coaching framework. Reference the secondary methodology where its techniques are more applicable (e.g., at mapped CEP stages).');
    }
  } else if (approach === 'custom') {
    parts.push(`=== SALES METHODOLOGY: ${salesDna.custom_methodology_name || 'Custom'} (Proprietary) ===`);
    if (salesDna.custom_methodology_principles?.length > 0) {
      parts.push(`Core Principles:\n${salesDna.custom_methodology_principles.map((p, i) => `  ${i + 1}. ${p}`).join('\n')}`);
    }
    parts.push('IMPORTANT: All coaching recommendations MUST align with this organization\'s proprietary methodology and principles.');
  }

  // Qualification framework context
  if (salesDna.qualification_framework) {
    const qf = QUALIFICATION_FRAMEWORKS.find(x => x.key === salesDna.qualification_framework);
    if (qf) {
      parts.push('');
      parts.push(`=== QUALIFICATION FRAMEWORK: ${qf.name} ===`);
      parts.push(`Framework: ${qf.short_description}`);
      parts.push(`Criteria:`);
      for (const c of qf.criteria) {
        parts.push(`  - ${c.label}: ${c.description}`);
      }
      parts.push(`Coaching Focus: ${qf.coaching_focus}`);
      parts.push(`IMPORTANT: When coaching on deal qualification, discovery, or pipeline management, reference ${qf.name} criteria. Coaching suggestions for lagging qualification KPIs should map back to specific ${qf.name} elements.`);
    }
  }

  return parts.join('\n');
}

// ── Helper: Get qualification framework exit criteria for CEP ─────────────────

export function getQualificationExitCriteria(frameworkKey: string | null): { key: string; label: string }[] {
  if (!frameworkKey) return [];
  const qf = QUALIFICATION_FRAMEWORKS.find(x => x.key === frameworkKey);
  if (!qf) return [];
  return qf.criteria.map(c => ({
    key: `qual_${c.key}`,
    label: `${c.label} confirmed`,
  }));
}
