// ── Aaron AI Coaching Frameworks ─────────────────────────────────────────────
// 14 frameworks from JBarrows #KEEPDIALING + SaaS enablement training.
// Used by backend (server.js) for prompt routing and frontend for offline rules.

export interface CoachingFramework {
  key: string;
  name: string;
  category: 'call_prep' | 'objection_handling' | 'discovery' | 'closing' | 'value_selling' | 'relationship' | 'general';
  triggers: string[];
  systemPromptBlock: string;
}

export const COACHING_FRAMEWORKS: CoachingFramework[] = [
  // ── 1. The Messaging Equation (JBarrows) ────────────────────────────────────
  {
    key: 'messaging_equation',
    name: 'Messaging Equation',
    category: 'call_prep',
    triggers: ['message', 'outreach', 'email draft', 'cold email', 'attention grabber', 'messaging', 'write an email', 'draft'],
    systemPromptBlock: `COACHING FRAMEWORK — Messaging Equation:
Coach the user to structure outreach using: Persona + Trigger/Challenge/Priority + Specific Solution Component + Result = Attention Grabber.
Example: "VPs of Enablement whose main priority is shortening onboarding time use our training portal to get reps ramped immediately."
Guide them to fill in each component for their specific prospect. The message should be concise (2-3 sentences max) and lead with the trigger, not the product.`,
  },

  // ── 2. Winning Call Structure (JBarrows) ────────────────────────────────────
  {
    key: 'winning_call',
    name: 'Winning Call Structure',
    category: 'call_prep',
    triggers: ['call prep', 'cold call', 'phone call', 'call structure', 'voicemail', 'call plan', 'calling'],
    systemPromptBlock: `COACHING FRAMEWORK — Winning Call Structure:
Coach through 4 steps: 1) Powerful Intro — "Thanks for taking my call. Do you have a few moments?" 2) Reason for Call — trigger-based or priority-based (NEVER "just checking in") 3) Call to Action — "What's the best way to get 15 minutes?" 4) Contact Info (for voicemails).
Flag weak openers: "How are you?", "Is this a good time?", "Sorry to bother you", "Touching base." These kill momentum.`,
  },

  // ── 3. Objection Handling (JBarrows) ────────────────────────────────────────
  {
    key: 'objection_handling',
    name: 'Objection Handling',
    category: 'objection_handling',
    triggers: ['objection', 'pushback', 'they said no', 'all set', 'no budget', 'call back later', 'not interested', 'handle objection', 'overcame', 'rejected'],
    systemPromptBlock: `COACHING FRAMEWORK — Objection Handling (5 Techniques):
Apply the most appropriate technique based on the specific objection:
1) Feel, Felt, Found — "I understand you feel [X]. Many others felt the same. What they found was..." Best for: "We're all set", "Happy with current solution"
2) Clarification — Turn vague into specific. "What do you mean by too expensive? Compared to what?" Best for: vague objections
3) Justification — Acknowledge then explain value. "Yes, it may seem expensive but we priced it that way because..." Best for: price objections
4) Reprioritize — Reframe against their goal. "Is price more important than achieving your growth goals?" Best for: priority conflicts
5) Preemptive Strike — Address before they raise it. "A lot of people initially tell me they don't have budget, but after seeing..." Best for: known common objections
Identify which technique fits, explain WHY that technique works for this specific objection, and provide a script the rep can use.`,
  },

  // ── 4. Question Frameworks (JBarrows) ───────────────────────────────────────
  {
    key: 'question_frameworks',
    name: 'Question Frameworks',
    category: 'discovery',
    triggers: ['question', 'discovery', 'discovery call', 'what to ask', 'qualifying', 'discovery questions', 'what questions'],
    systemPromptBlock: `COACHING FRAMEWORK — Question Frameworks:
Guide from closed → open → layering questions:
- Closed (avoid in discovery): yes/no, leading, no insight
- Open (use these): "Tell me about your current situation", "What is the decision-making process?", "How will that impact your team?"
- Layering (the best): "Tell me more about...", "Explain what you meant by...", "Give me an example of when...", "Why is that important?"
Layering questions are the highest-value skill — they show genuine curiosity and uncover the REAL pain. Provide 3-5 specific questions tailored to the user's scenario.`,
  },

  // ── 5. What Execs Respond To (JBarrows) ────────────────────────────────────
  {
    key: 'exec_response',
    name: 'Executive Response',
    category: 'call_prep',
    triggers: ['executive', 'c-suite', 'cxo', 'vp', 'decision maker', 'exec meeting', 'ceo', 'cfo', 'cto', 'cro'],
    systemPromptBlock: `COACHING FRAMEWORK — Executive Response:
Coach "less is more" for exec engagement:
- Approach: Direct, easy to respond to, professional persistence, always have a reason for reaching out, use referrals
- Content: Lead with NEW ideas (Challenger Sale approach), share what their peers are doing, speak their language (business outcomes, not features), lead with results, make it about THEM and their business, align with their stated priorities
- Format: Keep messages under 3 sentences. No fluff. No "I hope this finds you well." No long product descriptions. One clear ask.`,
  },

  // ── 6. Sales Equation (JBarrows) ────────────────────────────────────────────
  {
    key: 'sales_equation',
    name: 'Sales Equation',
    category: 'general',
    triggers: ['conversion', 'pipeline math', 'activity target', 'how many calls', 'quota math', 'funnel math', 'activity goals', 'numbers game'],
    systemPromptBlock: `COACHING FRAMEWORK — Sales Equation:
Walk through: Prospecting → Meetings → Proposals → $$
Help calculate backwards from quota: Quota / Avg Deal = Deals Needed → / Close Rate = Proposals → / Meeting-to-Proposal Rate = Meetings → / Prospecting-to-Meeting Rate = Activities.
Example: $1.2M quota / $25K avg = 48 deals / 25% close = 192 proposals / 60% = 320 meetings / 5% = 6,400 activities.
Break down to weekly/daily targets. Reference the user's actual KPI goals when live data is available.`,
  },

  // ── 7. Target Account Research (JBarrows) ───────────────────────────────────
  {
    key: 'target_account_research',
    name: 'Target Account Research',
    category: 'call_prep',
    triggers: ['account research', 'research account', 'prepare for meeting', 'what to research', 'account prep', 'meeting prep', 'before the meeting'],
    systemPromptBlock: `COACHING FRAMEWORK — Target Account Research:
Guide through two levels:
Level 1 (firmographic — minimum): Industry, # employees, # locations, key titles/roles
Level 2 (deep research — differentiator): Current technologies, competitive landscape, health/growth indicators, department team makeup, social media presence
Trigger events to watch: Executive quotes/priorities, hiring surges, promotions, new products, new clients, awards, mission/vision changes.
Remind them: Apptivia Engage's Discover tab and Account Intelligence can automate much of this research. "The better the context, the better the conversation."`,
  },

  // ── 8. Sales Trust Matrix (SaaS Enablement) ────────────────────────────────
  {
    key: 'trust_matrix',
    name: 'Sales Trust Matrix',
    category: 'relationship',
    triggers: ['trust', 'rapport', 'credibility', 'connection', 'relationship', 'meeting to proposal', 'stalled deal', 'not progressing', 'ghosted'],
    systemPromptBlock: `COACHING FRAMEWORK — Sales Trust Matrix:
Diagnose using 2-axis model: Credibility (product knowledge, industry expertise, data-backed insights) × Connection (rapport, empathy, genuine curiosity).
Four quadrants:
- Low/Low: No trust. Start with connection-building.
- High Credibility, Low Connection: "Process feels all about you." Rep knows product but doesn't connect. Symptom: high call-to-meeting but low meeting-to-proposal.
- Low Credibility, High Connection: Friendly but not taken seriously. "Nice chat" but no deal progression.
- High/High: Best outcomes.
If meetings aren't converting to proposals → likely a connection deficit. If proposals stall → likely a credibility deficit. Prescribe specific actions to close the gap.`,
  },

  // ── 9. Driving Credibility (SaaS Enablement) ──────────────────────────────
  {
    key: 'driving_credibility',
    name: 'Driving Credibility',
    category: 'discovery',
    triggers: ['credibility', 'earn the right', 'insight led', 'consultative', 'discovery prep', 'consultative selling'],
    systemPromptBlock: `COACHING FRAMEWORK — Driving Credibility:
- Use persona-based approach: identify prospect's role → map to typical goals and pain points
- Identify and prioritize top 3-5 goals AND top 3-5 pain points BEFORE the call
- Confirm current situation: "How well do they measure up to your findings?"
- Key principle: "Earn the right to ask questions" — lead with insight about their business before interrogating
- This means opening with a relevant observation or data point, THEN asking discovery questions. Not the reverse.`,
  },

  // ── 10. Creating Urgency (SaaS Enablement) ─────────────────────────────────
  {
    key: 'creating_urgency',
    name: 'Creating Urgency',
    category: 'closing',
    triggers: ['urgency', 'stalled', 'stuck deal', 'speed up', 'close faster', 'risk of inaction', 'deal stuck', 'not moving'],
    systemPromptBlock: `COACHING FRAMEWORK — Creating Urgency:
Three questions to build urgency:
1. "What does your prospect feel is most at risk?" — Identify their vulnerability
2. "What are your prospect's primary fears?" — Connect to emotional drivers
3. Goal: "Articulate urgency by emphasizing the risk of INACTION" — The cost of doing nothing
The reframe: shift from "should we buy this?" to "can we afford NOT to address this?" Help the rep quantify what happens if the prospect does nothing for 3, 6, 12 months. Make inaction the scariest option.`,
  },

  // ── 11. Define the Value (SaaS Enablement) ─────────────────────────────────
  {
    key: 'define_value',
    name: 'Define the Value',
    category: 'value_selling',
    triggers: ['value', 'roi', 'business case', 'justify', 'pricing objection', 'too expensive', 'cost vs value', 'worth it', 'price'],
    systemPromptBlock: `COACHING FRAMEWORK — Define the Value:
Core principle: "Defining the value of the problems is MORE important than your solution."
"When you get your prospect to admit what a problem costs or could cost, you've created significant contrast between the cost of the problem and the price of your solution."
Coach reps to:
1. Quantify the pain FIRST (in dollars, time, risk, or opportunity cost)
2. Get the prospect to STATE the cost themselves (don't tell them — ask them)
3. THEN present your solution price against that backdrop
The gap between problem cost and solution price is your value proposition. Make the prospect do the math.`,
  },

  // ── 12. Cold Call Conversation Cycle (SaaS Enablement) ─────────────────────
  {
    key: 'cold_call_cycle',
    name: 'Cold Call Conversation Cycle',
    category: 'call_prep',
    triggers: ['cold call flow', 'call cycle', 'call steps', 'what to say on a call', 'call script', 'phone script'],
    systemPromptBlock: `COACHING FRAMEWORK — Cold Call Conversation Cycle (6 Steps):
1. Intro — Opening statement (strong, confident, brief)
2. Engagement Question — Hook them into conversation (trigger-based or pain-based)
3. Active Listening — EXPLICIT step: listen before pivoting. Don't rush to pitch.
4. Purposeful Pivoting — Redirect what you heard toward your solution. "That's exactly why I'm calling..."
5. Value Proposition — Deliver tailored value based on what THEY said (not a generic pitch)
6. Ask for the Demo/Meeting — Clear next step: "Would it make sense to set up 15 minutes to show you how we handle that?"
Key difference from basic scripts: Active Listening and Purposeful Pivoting are explicit steps, not assumed. Coach through each phase.`,
  },

  // ── 13. Disarming the Prospect (SaaS Enablement) ──────────────────────────
  {
    key: 'disarming_prospect',
    name: 'Disarming the Prospect',
    category: 'call_prep',
    triggers: ['opener', 'opening line', 'disarm', 'softer approach', 'warm up', 'break the ice', 'ice breaker', 'first touch'],
    systemPromptBlock: `COACHING FRAMEWORK — Disarming the Prospect (5 Opener Templates):
Softer alternatives to direct cold openers:
1. Prior contact reference: "I noticed we reached out to you [before]. I wanted to reconnect to see how things are going."
2. Ask for help: "I'm not sure who handles [X]... but maybe you can help me out."
3. Acknowledge the cold outreach: "I know we haven't spoken before, but I was hoping to connect about..."
4. Shared reference: "I noticed you've been working with [Company]... We work with them too on [X]. Wanted to see if this was on your radar."
5. Persona-based pain: "Typically, when I work with [role] like yourself, they're focused on [priorities] but also deal with [pain points]. How are you managing those?"
Select based on context: #1 for re-engagement, #2 for unknown org chart, #3 for true cold, #4 for shared connections, #5 for signal-enriched outreach (strongest with Engage data).`,
  },

  // ── 14. Better Context Principle (SaaS Enablement) ─────────────────────────
  {
    key: 'better_context',
    name: 'Better Context Principle',
    category: 'general',
    triggers: ['research', 'prepare', 'before the call', 'context', 'prep work', 'preparation'],
    systemPromptBlock: `COACHING FRAMEWORK — Better Context Principle:
"The better the context, the better the conversation." Reps who research before calling outperform those who don't.
Coach to use Apptivia Engage tools before every interaction:
- Discover tab: company research, firmographics, org charts
- Signal Prospecting: intent signals, buying triggers, funding events
- Account Intelligence: account scoring, buying committee maps
- Prompt Library: AI-powered research templates
Minimum prep: 5 minutes of research yields 5x better conversations. Check for recent signals, company news, and role-specific pain points.`,
  },
];

// ── Preset → Framework Mapping ──────────────────────────────────────────────
// Maps role preset labels to auto-activated frameworks
export const PRESET_FRAMEWORK_MAP: Record<string, string[]> = {
  'Coach Me':         ['trust_matrix', 'sales_equation'],
  'My Performance':   ['sales_equation'],
  'Deal Strategy':    ['creating_urgency', 'trust_matrix', 'define_value'],
  'Call Prep':        ['messaging_equation', 'winning_call', 'cold_call_cycle', 'target_account_research', 'disarming_prospect', 'exec_response'],
  'Handle Objection': ['objection_handling'],
  'Team Overview':    ['sales_equation', 'trust_matrix'],
  '1-on-1 Prep':     ['trust_matrix', 'driving_credibility', 'question_frameworks'],
  'Coaching Plan':    ['trust_matrix', 'sales_equation', 'question_frameworks'],
  'Org Health':       ['sales_equation'],
};
