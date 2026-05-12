/**
 * frameworkPlaybooks.ts — Rich playbook content for Aaron's 14 coaching frameworks.
 *
 * Used in two places:
 * 1. Resources page (structured rendering with sections/bullets)
 * 2. Aaron system prompt injection (plain-text version in aaronService.js)
 *
 * Keys match AARON_FRAMEWORKS in aaronService.js.
 */

export interface PlaybookSection {
  title: string;
  items: string[];
}

export interface FrameworkPlaybook {
  key: string;
  name: string;
  category: 'prospecting' | 'discovery' | 'qualification' | 'methodology' | 'negotiation' | 'coaching' | 'analytics';
  tagline: string;
  icon: string;
  coreFramework: string;
  sections: PlaybookSection[];
}

export const CATEGORY_META: Record<string, { label: string; color: string }> = {
  prospecting:   { label: 'Prospecting',    color: 'bg-emerald-100 text-emerald-700' },
  discovery:     { label: 'Discovery',      color: 'bg-sky-100 text-sky-700' },
  qualification: { label: 'Qualification',  color: 'bg-violet-100 text-violet-700' },
  methodology:   { label: 'Methodology',    color: 'bg-amber-100 text-amber-700' },
  negotiation:   { label: 'Negotiation',    color: 'bg-rose-100 text-rose-700' },
  coaching:      { label: 'Coaching',       color: 'bg-indigo-100 text-indigo-700' },
  analytics:     { label: 'Analytics',      color: 'bg-teal-100 text-teal-700' },
};

export const FRAMEWORK_PLAYBOOKS: FrameworkPlaybook[] = [
  // ═══════════════════════════════════════════════════════════
  // 1. APPTIVIA PROSPECTING PLAYBOOK
  // ═══════════════════════════════════════════════════════════
  {
    key: 'jbarrows',
    name: 'Apptivia Prospecting Playbook',
    category: 'prospecting',
    tagline: 'Research-based outreach that earns the right to a conversation.',
    icon: 'Megaphone',
    coreFramework: 'Research → Personalize → Multi-Touch Cadence → Iterate',
    sections: [
      {
        title: '5-Touch Cadence Template',
        items: [
          'Day 1: Personalized email — reference a specific trigger event (funding, hiring, tech change). Subject line under 6 words.',
          'Day 3: LinkedIn connection request — attach a 1-sentence note referencing the email topic.',
          'Day 5: Phone call — use the Research-Based Opener (below). Leave voicemail if no answer.',
          'Day 8: Value-add email — share a relevant case study, article, or insight. No pitch.',
          'Day 12: Breakup email — "Closing the loop" with a direct CTA. Creates urgency without desperation.',
        ],
      },
      {
        title: 'Research-Based Opener Scripts',
        items: [
          'Trigger Opener: "I noticed [company] just [specific event]. When that happens, teams like yours typically face [challenge]. Is that on your radar?"',
          'Referral Opener: "I was talking to [mutual connection / similar company], and they mentioned [pain point]. Curious if you\'re seeing the same thing."',
          'Insight Opener: "[Industry stat or trend]. Most [title] I talk to are concerned about [implication]. How is your team handling it?"',
        ],
      },
      {
        title: 'Voicemail Framework (30 seconds max)',
        items: [
          'Structure: Hook (5s) → Relevance (10s) → CTA (10s) → Contact Info (5s).',
          'Hook: State their name and one specific thing about their company.',
          'Relevance: Connect to a challenge their role typically faces.',
          'CTA: Give a clear, low-commitment next step ("I\'ll send a quick email with details").',
          'Never pitch the product in a voicemail. The goal is a callback, not a sale.',
        ],
      },
      {
        title: 'Email Structure Rules',
        items: [
          'Subject lines: 1-6 words, lowercase, no exclamation marks. Test question vs statement.',
          'Body: 3 short paragraphs max. First paragraph = about THEM (trigger/pain). Second = bridge to relevance. Third = single CTA.',
          'CTA types: Calendar link, yes/no question, or "reply with a time." Never more than one CTA.',
          'Personalization rule: If you could send the same email to 10 people, it\'s not personalized enough.',
        ],
      },
      {
        title: 'Pattern Interrupt Techniques',
        items: [
          'Reversal: Start with what you\'re NOT ("This isn\'t a sales pitch — I genuinely don\'t know if we can help yet").',
          'Permission-based: "I know I\'m interrupting your day. Can I take 27 seconds to explain why I called, and you can decide if it\'s worth continuing?"',
          'Peer proof: "We just helped [similar company] solve [specific problem]. Thought it might be relevant to your team."',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 2. APPTIVIA PAIN DISCOVERY
  // ═══════════════════════════════════════════════════════════
  {
    key: 'sandler',
    name: 'Apptivia Pain Discovery',
    category: 'discovery',
    tagline: 'Uncover real pain, not surface-level symptoms.',
    icon: 'Search',
    coreFramework: 'Surface Pain → Business Impact → Personal Impact → Budget → Decision → Fulfill',
    sections: [
      {
        title: 'Pain Funnel — 7-Question Sequence',
        items: [
          '1. "Tell me more about that..." (open the door — let them describe the problem)',
          '2. "Can you be more specific? Give me an example." (move from vague to concrete)',
          '3. "How long has this been going on?" (establish duration = severity)',
          '4. "What have you tried to do about it?" (understand prior attempts = frustration level)',
          '5. "Did that work?" (likely no — builds acknowledgment of the gap)',
          '6. "How much do you think that has cost you?" (quantify the pain in dollars or time)',
          '7. "How do you feel about that?" (surface the personal/emotional impact — this is where urgency lives)',
        ],
      },
      {
        title: 'Upfront Agreement Script',
        items: [
          'Before every meeting: "Here\'s what I\'d like to accomplish today — [agenda]. At the end, one of three things will happen: you\'ll say yes, you\'ll say no, or we\'ll agree on a clear next step. Any of those is fine. Does that work for you?"',
          'Why it works: eliminates "think-it-overs," sets mutual expectations, gives the prospect permission to say no.',
          'Adapt for discovery: "I\'ll ask some direct questions about your current situation. If at any point you feel this isn\'t a fit, just tell me — I\'d rather know now than waste your time."',
        ],
      },
      {
        title: 'Budget / Decision / Pain Triangle',
        items: [
          'Pain FIRST: Never discuss budget or decision process until pain is fully uncovered and quantified.',
          'Budget question: "If we could solve [quantified pain], what kind of investment would make sense relative to the [$ cost] you\'re losing?" (anchors to their pain, not your price)',
          'Decision process: "Walk me through how your organization has made decisions like this in the past. Who else would need to weigh in?"',
          'Red flag: If they can\'t articulate the pain in dollar terms, you haven\'t gone deep enough. Go back to the funnel.',
        ],
      },
      {
        title: 'Avoiding "Happy Ears" — 6 Warning Signs',
        items: [
          'They say "this is great" but won\'t commit to a next step with a specific date.',
          'They agree with everything you say without pushback or questions.',
          'They won\'t introduce you to other stakeholders or the economic buyer.',
          'They describe pain in generic terms ("we need to be more efficient") without specifics.',
          'They keep rescheduling or shortening meetings.',
          'Antidote: Use negative reverse selling — "It sounds like this might not be a priority right now. Am I reading that right?" Forces honesty.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 3. APPTIVIA DEAL QUALIFICATION
  // ═══════════════════════════════════════════════════════════
  {
    key: 'meddpicc',
    name: 'Apptivia Deal Qualification',
    category: 'qualification',
    tagline: 'Rigorous deal health assessment — every element scored, every gap flagged.',
    icon: 'ClipboardCheck',
    coreFramework: 'Metrics → Economic Buyer → Decision Criteria → Decision Process → Paper Process → Identify Pain → Champion → Competition',
    sections: [
      {
        title: 'MEDDPICC Scorecard (Rate Each 1-5)',
        items: [
          'Metrics (1-5): Can the prospect quantify the business outcome they expect? 5 = specific numbers agreed. 1 = vague "improvement."',
          'Economic Buyer (1-5): Have you identified AND met the person with budget authority? 5 = direct relationship. 1 = unknown.',
          'Decision Criteria (1-5): Do you know what they\'ll evaluate? 5 = written criteria you helped shape. 1 = guessing.',
          'Decision Process (1-5): Do you know every step from eval to signature? 5 = mapped with timeline. 1 = "they\'ll let us know."',
          'Paper Process (1-5): Legal, procurement, security review mapped? 5 = all stakeholders identified. 1 = haven\'t discussed.',
          'Identify Pain (1-5): Is the pain quantified and personal? 5 = champion feels it daily. 1 = nice-to-have.',
          'Champion (1-5): Do you have someone selling internally on your behalf? 5 = actively advocating. 1 = no internal ally.',
          'Competition (1-5): Do you know who else they\'re evaluating? 5 = differentiated on key criteria. 1 = blind.',
        ],
      },
      {
        title: 'Champion Validation — 5 Tests',
        items: [
          'Access: Can they get you a meeting with the Economic Buyer?',
          'Influence: Do other stakeholders defer to their opinion?',
          'Vested interest: Do they personally benefit from this project succeeding?',
          'Information: Do they share competitive intel, internal politics, and real timelines?',
          'Coaching: Do they tell you how to win, not just what to present?',
          'If the answer to 3+ of these is no, you have a coach, not a champion. Keep looking.',
        ],
      },
      {
        title: 'Deal Health Color Coding',
        items: [
          'Green (score 35-40): All elements covered, champion active, clear path to close. Forecast as Commit.',
          'Yellow (score 25-34): 1-2 gaps but manageable. Requires specific action plan this week. Forecast as Best Case.',
          'Red (score below 25): Multiple unknowns, no champion, or no access to EB. Do NOT forecast. Requires intervention or disqualification.',
          'Rule: Review color weekly in pipeline review. Any deal sitting Yellow for 2+ weeks without improvement → Red.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 4. APPTIVIA DISCOVERY METHOD
  // ═══════════════════════════════════════════════════════════
  {
    key: 'spin',
    name: 'Apptivia Discovery Method',
    category: 'discovery',
    tagline: 'Structured question progression that uncovers business impact fast.',
    icon: 'MessageCircle',
    coreFramework: 'Situation → Problem → Implication → Need-Payoff',
    sections: [
      {
        title: 'SPIN Question Bank (3 per stage)',
        items: [
          'Situation: "Walk me through how your team currently handles [process]." / "What tools are you using for [function] today?" / "How is your team structured for [activity]?"',
          'Problem: "What\'s the biggest challenge with that approach?" / "Where does the process break down?" / "What are reps/managers complaining about most?"',
          'Implication: "When that happens, what\'s the impact on [revenue/pipeline/retention]?" / "How does that affect your ability to hit [quarterly goal]?" / "If this doesn\'t get fixed, what happens in 6 months?"',
          'Need-Payoff: "If you could solve that, what would it mean for [metric]?" / "How would your team\'s day change if [pain] went away?" / "What would hitting [target] consistently be worth to the org?"',
        ],
      },
      {
        title: 'Discovery Call Structure (45 minutes)',
        items: [
          'Minutes 0-5: Upfront agreement + agenda setting. Confirm time, attendees, and mutual goal.',
          'Minutes 5-10: Situation questions — gather context quickly. Don\'t linger here. Max 3 questions.',
          'Minutes 10-25: Problem + Implication questions — this is where value is created. Spend 60% of discovery time here.',
          'Minutes 25-35: Need-Payoff questions — help them articulate the desired future state in their own words.',
          'Minutes 35-40: Recap pain and desired outcome. Confirm alignment.',
          'Minutes 40-45: Next steps — specific date, attendees, agenda for next meeting. Send calendar invite before you hang up.',
        ],
      },
      {
        title: 'Move from S to I Fast — The 10-Minute Rule',
        items: [
          'Rule: Get through Situation questions in the first 10 minutes max. If you\'re still asking context questions at minute 15, you\'re losing the meeting.',
          'Pre-call research eliminates most Situation questions. If you can find it on LinkedIn, their website, or in your CRM, don\'t ask it.',
          'Transition phrases: "That\'s really helpful context. Let me ask — where does that process tend to break down?" (S→P) / "You mentioned [problem]. When that happens, what\'s the downstream impact?" (P→I)',
        ],
      },
      {
        title: 'Discovery Debrief Template',
        items: [
          'Fill out within 30 minutes of every discovery call:',
          'Confirmed Pain: What specific problem did they acknowledge? (Use their exact words)',
          'Business Impact: What is this costing them? ($ or time or risk)',
          'Decision Landscape: Who else is involved? What\'s the timeline? What are they comparing against?',
          'Unknowns: What did we NOT learn? What assumptions do we need to validate next meeting?',
          'Next Step: What is the specific next action, with whom, by when?',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 5. APPTIVIA INSIGHT SELLING
  // ═══════════════════════════════════════════════════════════
  {
    key: 'challenger',
    name: 'Apptivia Insight Selling',
    category: 'methodology',
    tagline: 'Lead with insight, not information. Reframe how buyers think about their problem.',
    icon: 'Lightbulb',
    coreFramework: 'Warmer → Reframe → Rational Drowning → Emotional Impact → New Way → Your Solution',
    sections: [
      {
        title: 'Teaching Pitch — 6-Step Structure',
        items: [
          '1. Warmer: Start with a challenge you know they face. "Most [title]s I talk to are dealing with [common problem]."',
          '2. Reframe: Introduce an insight that challenges their current thinking. "What we\'re finding is that the real issue isn\'t [what they think] — it\'s [unexpected root cause]."',
          '3. Rational Drowning: Show data/evidence that makes the problem feel bigger than they realized. Use 2-3 proof points.',
          '4. Emotional Impact: Make it personal. "For someone in your role, this means [consequence that affects them directly]."',
          '5. New Way: Present a different approach without pitching your product. "The companies getting ahead are doing [approach]."',
          '6. Your Solution: Only now connect your product to the new way. "That\'s exactly what we built Apptivia to do."',
        ],
      },
      {
        title: 'Stakeholder Tailoring Matrix',
        items: [
          'VP Sales / CRO: Lead with quota attainment impact, pipeline predictability, rep productivity metrics. They care about forecast accuracy and revenue.',
          'Sales Manager: Lead with coaching efficiency, time savings, and rep development visibility. They care about making their team better without more admin work.',
          'RevOps / Sales Ops: Lead with data integrity, process consistency, and stack consolidation. They care about reducing tool sprawl and improving reporting.',
          'CFO / Finance: Lead with cost per rep, ROI timeline, and payback period. They care about unit economics, not features.',
          'Rule: Never present the same deck to different stakeholders. Adapt the opening, proof points, and CTA for each persona.',
        ],
      },
      {
        title: 'Constructive Tension — 3 Graduated Approaches',
        items: [
          'Level 1 — Gentle Reframe: "That\'s a common approach. What we\'re seeing is that it works until [scale/complexity]. Have you noticed that?"',
          'Level 2 — Data Challenge: "Interesting — when we looked at [X companies], the ones doing it that way had [Y% worse outcome]. What\'s your experience been?"',
          'Level 3 — Direct Challenge: "I\'d actually push back on that. Here\'s why: [evidence]. The risk of staying the current course is [quantified consequence]."',
          'Rule: Match the tension level to your relationship depth. Level 1 on first call. Level 3 only after trust is established.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 6. APPTIVIA GAP ANALYSIS
  // ═══════════════════════════════════════════════════════════
  {
    key: 'gapSelling',
    name: 'Apptivia Gap Analysis',
    category: 'discovery',
    tagline: 'The bigger the gap between current and future state, the more urgency and budget.',
    icon: 'ArrowLeftRight',
    coreFramework: 'Current State → Impact → Root Cause → Future State → Solution → Gap Size = Urgency',
    sections: [
      {
        title: 'Current → Future State Mapping',
        items: [
          'Current State questions: "Describe what your sales process looks like today, step by step." / "What does a typical rep\'s day look like?" / "How do you currently measure rep performance?"',
          'Future State questions: "If you could wave a magic wand, what would this look like in 12 months?" / "What metrics would you be hitting?" / "How would your team\'s workflow change?"',
          'Document both states in the prospect\'s own language. Their words carry more weight in the business case than yours.',
        ],
      },
      {
        title: 'Impact Chain Worksheet',
        items: [
          'Level 1 — Immediate Problem: "Reps spend 40% of their time on admin tasks."',
          'Level 2 — Department Impact: "That means 40% less selling time per rep, so pipeline is consistently short."',
          'Level 3 — Company Impact: "Pipeline shortage causes missed quarterly targets, which affects company valuation and investor confidence."',
          'Level 4 — Dollar Impact: "With 20 reps at $150K OTE, 40% admin time = $1.2M/year in unproductive compensation."',
          'Rule: Always get to Level 4. A gap without a dollar figure is just an opinion.',
        ],
      },
      {
        title: 'Root Cause Analysis — Adapted 5 Whys',
        items: [
          'Why 1: "Why is pipeline short?" → "Reps aren\'t prospecting enough."',
          'Why 2: "Why aren\'t they prospecting?" → "Too much time on admin and CRM updates."',
          'Why 3: "Why so much admin?" → "No automation, manual data entry, spreadsheet-based tracking."',
          'Why 4: "Why no automation?" → "Current tools don\'t integrate, and the team doesn\'t trust the data."',
          'Why 5: "Why don\'t they trust the data?" → "Scoring is subjective, no single source of truth."',
          'Now you\'ve found the root cause (data trust) instead of treating the symptom (pipeline).',
        ],
      },
      {
        title: 'Gap Size = Urgency Scale',
        items: [
          'Small gap (current is "okay"): Nice-to-have. Low urgency. Likely stalls. Consider: Is this a real deal or a tire kicker?',
          'Medium gap (current causes friction): Important but may lose to competing priorities. Need: business case with hard numbers.',
          'Large gap (current is failing): Must-fix. Budget will be found. Your job: compress the timeline and ensure you\'re the solution.',
          'If the prospect describes their current state as "fine," you haven\'t uncovered the gap yet. Go deeper with Implication questions.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 7. APPTIVIA VALUE SELLING
  // ═══════════════════════════════════════════════════════════
  {
    key: 'valueFramework',
    name: 'Apptivia Value Selling',
    category: 'negotiation',
    tagline: 'Anchor every conversation to value delivered, never to price charged.',
    icon: 'DollarSign',
    coreFramework: 'Define Problem Cost → Quantify Solution Value → Present Price in Context → Defend Without Discounting',
    sections: [
      {
        title: 'ROI Calculator — 3 Value Drivers',
        items: [
          'Time Savings: Hours saved per rep per week × hourly cost × number of reps × 52 weeks. Example: 5 hrs/week × $50/hr × 20 reps × 52 = $260,000/year.',
          'Revenue Uplift: Incremental deals closed × average deal size. Example: 2 extra deals/rep/quarter × $30K × 20 reps = $1.2M/year.',
          'Cost Avoidance: Tools eliminated + headcount not needed + reduced churn. Example: 3 tools at $15K + 1 analyst at $80K = $125K/year.',
          'Total Value = Sum of all three. Present as: "For your team, the conservative estimate is [$X]. Your investment would be [$Y], giving you a [Z]x return in year one."',
        ],
      },
      {
        title: 'Business Case Structure',
        items: [
          'Page 1 — Executive Summary: Problem statement (their words), proposed solution, expected ROI, timeline.',
          'Page 2 — Current State Cost: Quantified pain using their data from discovery. Include direct costs AND opportunity costs.',
          'Page 3 — Future State Value: What changes, by how much, over what timeline. Use conservative assumptions.',
          'Page 4 — Investment & Payback: Your pricing, implementation timeline, expected payback period (target: under 6 months).',
          'Rule: Build it WITH the champion, not FOR them. Co-create so it reflects their internal language and priorities.',
        ],
      },
      {
        title: 'Cost of Inaction Formula',
        items: [
          'Monthly bleed × 12 = Annual waste. "You\'re currently losing [$X/month] to [problem]. Over the next 12 months, that\'s [$12X] — and that assumes the problem doesn\'t get worse."',
          'Compound effect: "Every month you delay, [specific consequence] compounds. The cost of waiting is higher than the cost of acting."',
          'Competitive risk: "While you\'re evaluating, your competitors who have already solved this are [outpacing you in specific way]."',
          'Present cost of inaction BEFORE presenting your price. The anchor should be what they\'re losing, not what you charge.',
        ],
      },
      {
        title: 'Discount Defense Scripts',
        items: [
          '"I can absolutely adjust scope to fit your budget. Which capabilities would you be comfortable removing?" (Reframes discount as scope reduction.)',
          '"I understand budget is tight. Let me show you the ROI math — at [$price], you\'re getting a [X]x return. Where else can you invest [$price] and get [X]x back?"',
          '"I can offer [longer contract term / annual prepay] for a lower effective rate. Would a 12-month commitment work for your team?"',
          'Never discount without getting something in return. Trade: faster close date, case study participation, multi-year commitment, expanded deployment.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 8. APPTIVIA OBJECTION PLAYBOOK
  // ═══════════════════════════════════════════════════════════
  {
    key: 'objectionHandling',
    name: 'Apptivia Objection Playbook',
    category: 'negotiation',
    tagline: 'Every objection is either a real barrier or a smokescreen. Handle both.',
    icon: 'Shield',
    coreFramework: 'Acknowledge → Clarify → Respond → Confirm',
    sections: [
      {
        title: 'Top 10 Objections with Responses',
        items: [
          '"Too expensive": "I hear you. Help me understand — too expensive compared to what? The cost of the problem, another solution, or your budget for this quarter?"',
          '"We already have a solution": "That makes sense — most companies we work with had something in place before. What prompted you to take this meeting? What\'s not working?"',
          '"Not a priority right now": "I understand priorities shift. Can you help me understand what IS the top priority? And how does [their pain] rank against it?"',
          '"Need to think about it": "Of course. To help me help you — what specifically do you need to think through? Is it the fit, the budget, or something else?"',
          '"Send me more info": "Happy to. So I send the right thing — what specific question are you trying to answer? I might be able to address it right now."',
          '"We\'re locked into a contract": "When does that contract come up for renewal? Let\'s plan ahead so you have options. What would make you consider switching?"',
          '"I need to talk to my team/boss": "Absolutely. Would it help if I joined that conversation to answer any technical or financial questions they might have?"',
          '"Your competitor does X better": "You\'re right, [competitor] is strong in [X]. Where we differentiate is [Y]. For your specific use case — [their pain] — here\'s why [Y] matters more."',
          '"We tried something like this and it failed": "That\'s really important to know. What went wrong? We can make sure we don\'t repeat those mistakes. Our approach to [specific concern] is different because [reason]."',
          '"Can you just send a proposal?": "I could, but I\'d be guessing at what matters most to you. Can we spend 15 minutes making sure the proposal actually addresses your priorities?"',
        ],
      },
      {
        title: 'Real vs Smokescreen — 3 Diagnostic Questions',
        items: [
          '"If we could solve [objection], would you be ready to move forward?" — If yes, it\'s real. Address it. If they pivot to another objection, the first one was a smokescreen.',
          '"On a scale of 1-10, how significant is this concern?" — Below 5 = smokescreen. Above 7 = real. Between = needs more exploration.',
          '"Is this a dealbreaker, or is it something we can work through?" — Forces them to commit to the severity. Most smokescreens dissolve under direct inquiry.',
        ],
      },
      {
        title: 'Gone-Dark Recovery (3 Re-Engagement Templates)',
        items: [
          'The Breakup: "Hi [Name], I haven\'t heard back and I don\'t want to be that person who keeps following up. I\'ll assume the timing isn\'t right and close out my notes. If anything changes, you know where to find me."',
          'The Value Drop: "Hi [Name], came across [relevant insight/article/data point] and thought of your team. Regardless of where things stand with us, this might be useful."',
          'The Direct Ask: "Hi [Name], I want to respect your time. Can you give me a quick yes, no, or not yet? Any answer is fine — I just want to make sure I\'m not missing something."',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 9. APPTIVIA COACHING METHOD
  // ═══════════════════════════════════════════════════════════
  {
    key: 'coaching',
    name: 'Apptivia Coaching Method',
    category: 'coaching',
    tagline: 'Observe, diagnose, prescribe, follow up. One skill at a time.',
    icon: 'GraduationCap',
    coreFramework: 'Observe → Diagnose → Prescribe → Follow-Up (ODPF Cycle)',
    sections: [
      {
        title: 'ODPF Coaching Cycle',
        items: [
          'Observe: Listen to calls, review pipeline, analyze KPI data. Don\'t coach on assumptions — coach on evidence.',
          'Diagnose: Identify the root cause, not the symptom. "Low close rate" could be qualification, discovery, objection handling, or demo skills. Pinpoint which.',
          'Prescribe: Give ONE specific action to improve. "This week, I want you to ask the Pain Funnel question #6 on every discovery call." Not three things. One.',
          'Follow-Up: Check in within 5 business days. Did they do it? What happened? Adjust the prescription based on results.',
          'Rule: A rep can only improve one skill at a time. Overloading kills progress.',
        ],
      },
      {
        title: 'SBI Feedback Template',
        items: [
          'Situation: "In your call with [prospect] on [date]..."',
          'Behavior: "I noticed you [specific observable action] — for example, you asked [exact question or skipped X step]."',
          'Impact: "The result was [what happened]. The prospect [specific reaction/outcome]."',
          'Forward: "Next time, try [specific alternative]. Here\'s what that would sound like: [example script]."',
          'Delivery rule: 1 positive SBI for every 1 developmental SBI. Lead with what they did well.',
        ],
      },
      {
        title: '1-on-1 Coaching Agenda (30 minutes)',
        items: [
          'Minutes 0-5: Rep-led update — what they\'re proud of, what they\'re stuck on. (Their agenda first.)',
          'Minutes 5-15: Pipeline review — pick 2-3 deals, do a mini MEDDPICC check. Coach on gaps.',
          'Minutes 15-25: Skill development — review progress on last week\'s prescribed action. Roleplay or listen to a call snippet.',
          'Minutes 25-30: Agree on 1 action item for next week. Write it down. Both accountable.',
          'Never use 1-on-1s for status updates. That\'s what CRM and dashboards are for.',
        ],
      },
      {
        title: 'Skill Progression Ladder',
        items: [
          'Level 1 — Awareness: Rep knows the skill exists and why it matters. (Coach teaches the concept.)',
          'Level 2 — Application: Rep can execute the skill with coaching support. (Roleplay, shadowing.)',
          'Level 3 — Consistency: Rep uses the skill independently on most calls. (Call review shows pattern.)',
          'Level 4 — Mastery: Rep adapts the skill to different situations and can coach others. (Peer mentoring.)',
          'Track each rep\'s level per skill in their coaching plan. Promote focus on one skill until Level 3 before adding another.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 10. APPTIVIA PIPELINE INTELLIGENCE
  // ═══════════════════════════════════════════════════════════
  {
    key: 'forecastAccuracy',
    name: 'Apptivia Pipeline Intelligence',
    category: 'analytics',
    tagline: 'Pipeline math doesn\'t lie. Coverage, velocity, and stage hygiene drive forecast accuracy.',
    icon: 'BarChart3',
    coreFramework: 'Coverage Ratio + Velocity Formula + Stage Verification + Forecast Discipline',
    sections: [
      {
        title: 'Pipeline Coverage Formula',
        items: [
          'Required Pipeline = Quota × Coverage Multiplier. Standard multiplier: 3.5x for mid-market, 4-5x for enterprise.',
          'Example: $200K quota × 3.5 = $700K of weighted pipeline needed at start of quarter.',
          'Segment by source: 40% outbound, 30% inbound, 20% expansion, 10% partner. Diversification reduces risk.',
          'Coverage below 3x at any point in the quarter = red flag. Immediate prospecting sprint needed.',
        ],
      },
      {
        title: 'Pipeline Velocity Formula',
        items: [
          'Velocity = (Opportunities × Win Rate × Avg Deal Size) / Sales Cycle Length',
          'Example: (50 opps × 25% × $30K) / 45 days = $8,333/day pipeline velocity.',
          'To increase velocity, improve ANY of the four levers: more qualified opportunities, higher win rate, larger deals, or shorter cycles.',
          'Track velocity weekly. Trending down = early warning sign. Don\'t wait for end-of-quarter to react.',
        ],
      },
      {
        title: 'Stage Verification Criteria',
        items: [
          'Stage 1 — Prospecting: Identified as ICP fit. Has a named contact. Initial outreach attempted.',
          'Stage 2 — Discovery: Discovery meeting completed. Pain identified and acknowledged by prospect.',
          'Stage 3 — Qualification: MEDDPICC score ≥ 20. Champion identified. Budget range discussed.',
          'Stage 4 — Proposal: Business case presented. Pricing shared. Decision criteria confirmed.',
          'Stage 5 — Negotiation: Verbal agreement. Working through paper process. Close date within 30 days.',
          'Rule: Deals MUST meet ALL criteria to be in a stage. No optimistic staging.',
        ],
      },
      {
        title: 'Weekly Pipeline Hygiene Checklist',
        items: [
          'Stale deals: Any deal with no activity in 14+ days → update or downstage. No exceptions.',
          'Close date integrity: Any deal with a pushed close date 2+ times → move to Upside, not Commit.',
          'Stage regression: Did any deal move backward? Why? Coach on what happened.',
          'New pipeline created: Did we add enough new Stage 1/2 to cover what we\'ll close or lose this quarter?',
          'Forecast categories: Commit (90%+), Best Case (60-90%), Upside (30-60%), Pipeline (<30%). Review every Monday.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 11. APPTIVIA PRODUCTIVITY SYSTEM
  // ═══════════════════════════════════════════════════════════
  {
    key: 'timeManagement',
    name: 'Apptivia Productivity System',
    category: 'coaching',
    tagline: 'Every hour maps to pipeline generation or deal advancement. No wasted motion.',
    icon: 'Clock',
    coreFramework: 'Time Block → Prioritize Accounts → Eliminate Time Sinks → Weekly Planning Ritual',
    sections: [
      {
        title: 'Daily Time Block Template',
        items: [
          '8:00-8:30: Morning prep — review pipeline, check signals/alerts, plan the day. CRM updates.',
          '8:30-11:00: Prospecting block — new outbound, follow-ups, LinkedIn engagement. No meetings during this block.',
          '11:00-12:00: Discovery/demo meetings — schedule buyer meetings mid-day when attention is highest.',
          '12:00-1:00: Lunch + learning — listen to one call recording, read one industry article.',
          '1:00-3:00: Deal work — proposals, follow-ups, champion coaching, internal alignment.',
          '3:00-4:00: Admin block — CRM hygiene, pipeline notes, forecast updates. Batch all admin here.',
          '4:00-5:00: Next-day prep — pre-call research, email sequences, weekly goal check.',
          'Rule: Protect the 8:30-11:00 prospecting block. It\'s the single highest-ROI time slot.',
        ],
      },
      {
        title: 'A/B/C Account Tiering',
        items: [
          'A-Tier (top 20%): Best ICP fit + active buying signals + budget confirmed. Touch 3-5x/week. Personal, high-effort outreach.',
          'B-Tier (middle 40%): Good ICP fit + some signals but no confirmed budget. Touch 1-2x/week. Semi-personalized.',
          'C-Tier (bottom 40%): Marginal fit or no signals. Touch 1x/week max via sequence. Nurture only.',
          'Re-tier monthly based on new signals and engagement. An A-Tier that goes dark drops to B. A C-Tier with a funding round jumps to A.',
          'Rule: 60% of your time on A-Tier accounts. If you\'re spending equal time on all accounts, you\'re leaving money on the table.',
        ],
      },
      {
        title: 'Weekly Planning Ritual (Sunday 30-min or Monday 8:00)',
        items: [
          'Review: What did I accomplish last week? What carried over? What was my win rate on activities?',
          'Pipeline: Which deals advance this week? Which need action? Any at risk of slipping?',
          'Prospecting: How many new activities do I need to hit weekly pipeline targets? Block the time.',
          'Top 3: What are the 3 most important things to accomplish this week? Write them down.',
          'Calendar audit: Cancel or shorten any meeting that doesn\'t advance a deal or generate pipeline.',
        ],
      },
      {
        title: 'CRM Hygiene Rules',
        items: [
          'Update every deal within 24 hours of any activity. Not Friday. Not end of quarter. Same day.',
          'Minimum fields per deal: next step, next step date, close date, amount, stage, champion name.',
          'If you can\'t articulate the next step, the deal is stalled. Update or downstage.',
          'Notes format: Date + Action + Outcome + Next Step. Example: "5/5 — Discovery call with VP Sales. Confirmed $200K budget pain. Next: Demo with CFO 5/12."',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 12. APPTIVIA SOCIAL PLAYBOOK
  // ═══════════════════════════════════════════════════════════
  {
    key: 'socialSelling',
    name: 'Apptivia Social Playbook',
    category: 'prospecting',
    tagline: 'Build a personal brand that makes prospects come to you.',
    icon: 'Users',
    coreFramework: 'Optimize Profile → Engage First → Create Content → Request Warm Intros',
    sections: [
      {
        title: 'LinkedIn Profile Optimization Checklist',
        items: [
          'Headline: Lead with value, not title. "Helping [ICP] solve [pain]" > "Account Executive at Apptivia."',
          'Banner image: Custom graphic with your value prop or company brand. Not the default blue.',
          'About section: Write in first person. Paragraph 1 = who you help. Paragraph 2 = how. Paragraph 3 = proof/results. End with CTA.',
          'Featured section: Pin your best content — case study, customer story, industry insight, or video.',
          'Activity: Your recent posts and comments are your live portfolio. If the last 5 activities are all reposts, you need to create.',
        ],
      },
      {
        title: '5-Before-1 Engagement Rule',
        items: [
          'Before sending a DM or connection request, engage with 5 of their posts first. Like, comment, share.',
          'Comments > Likes. Write substantive comments (2+ sentences) that add a perspective, ask a question, or share a related experience.',
          'After 5 engagements, your name is familiar. Your connection request isn\'t cold anymore.',
          'Timing: Engage over 1-2 weeks. Don\'t pile 5 comments on one day — that\'s obvious and feels forced.',
          'When you DO send the request, reference a specific post: "Loved your take on [topic] last week. Would enjoy staying connected."',
        ],
      },
      {
        title: 'Content Cadence (3 posts/week)',
        items: [
          'Post 1 — Industry Insight: Share a stat, trend, or observation relevant to your ICP. Add your perspective in 2-3 sentences.',
          'Post 2 — Story/Experience: Share a specific win, lesson learned, or customer conversation (anonymized). People remember stories, not stats.',
          'Post 3 — Engagement Post: Ask a question, run a poll, or share a hot take. Invite responses. Aim for comments, not likes.',
          'Format rules: Short paragraphs (1-2 sentences each). Use line breaks. First line = hook. No hashtag spam. Tag people mentioned.',
        ],
      },
      {
        title: 'Warm Intro Request Templates',
        items: [
          'To a mutual connection: "Hey [Name], I saw you\'re connected to [prospect]. I think what we\'re doing could really help their team with [specific challenge]. Would you be open to making an intro?"',
          'To a customer: "You\'ve seen firsthand how [result]. I\'m trying to help [similar company] with the same challenge. Would you be willing to introduce me to [name] on their team?"',
          'Post-intro follow-up: "[Mutual connection] suggested I reach out. They mentioned your team is [dealing with X]. I\'d love to share how we helped them — would a 15-minute call be worth your time?"',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 13. APPTIVIA ACCOUNT STRATEGY
  // ═══════════════════════════════════════════════════════════
  {
    key: 'accountPlanning',
    name: 'Apptivia Account Strategy',
    category: 'methodology',
    tagline: 'Map every stakeholder, multi-thread every deal, plan every expansion.',
    icon: 'Building2',
    coreFramework: 'Power Map → Multi-Thread → Land-and-Expand → Whitespace → Executive Engagement',
    sections: [
      {
        title: 'Power Map Template',
        items: [
          'Map all stakeholders on two axes: Influence (how much sway they have) and Support (how favorable they are to you).',
          'Quadrant 1 — High Influence, High Support: Your champion. Protect and arm them with internal selling materials.',
          'Quadrant 2 — High Influence, Low Support: Your blocker. Understand their concerns. Find what they care about and tailor your message.',
          'Quadrant 3 — Low Influence, High Support: Your coach. They give you intel but can\'t make decisions. Use them for information, not access.',
          'Quadrant 4 — Low Influence, Low Support: Monitor only. Don\'t invest time here unless their influence changes.',
          'Update the power map after every meeting. Roles and support levels shift.',
        ],
      },
      {
        title: 'Multi-Threading Playbook',
        items: [
          'Rule: Every deal over $25K needs at least 3 contacts across 2 departments. Single-threaded deals are fragile.',
          'Thread 1 — Economic Buyer: The person who signs the check. Build relationship through champion introductions.',
          'Thread 2 — Technical Evaluator: The person who tests/validates. Win them with product depth and proof of integration.',
          'Thread 3 — End User/Champion: The person who uses it daily. Win them with ease of use and direct value to their workflow.',
          'If your champion leaves: This is the #1 risk to enterprise deals. Multi-threading is your insurance policy. Start threading in Stage 2, not Stage 4.',
        ],
      },
      {
        title: 'Land-and-Expand Triggers',
        items: [
          'Initial land: Start small — one team, one use case, clear ROI. Prove value in 90 days.',
          'Expand trigger 1: First team hits measurable results. Use their data as internal case study.',
          'Expand trigger 2: Adjacent team notices results. Get a warm intro from the champion.',
          'Expand trigger 3: Executive sees aggregate impact and sponsors org-wide rollout.',
          'Timeline: Land (Q1) → Prove value (Q2) → Expand to 2nd team (Q3) → Enterprise agreement (Q4). 12-month cycle.',
        ],
      },
      {
        title: 'Whitespace Analysis Matrix',
        items: [
          'Map: Products/features (columns) × Departments/teams (rows). Fill in what they\'re using, what they\'re not, and what competitor they use for each.',
          'Identify gaps: Which departments have the pain but haven\'t seen your solution? Which features solve problems they haven\'t yet articulated?',
          'Prioritize: Score each whitespace cell by estimated deal size × likelihood of conversion. Focus on high-score cells first.',
          'Revisit quarterly with your champion. New hires, new initiatives, and budget cycles create new whitespace.',
        ],
      },
    ],
  },

  // ═══════════════════════════════════════════════════════════
  // 14. APPTIVIA CLOSE PLAN
  // ═══════════════════════════════════════════════════════════
  {
    key: 'closingTechniques',
    name: 'Apptivia Close Plan',
    category: 'negotiation',
    tagline: 'Closing is a process, not a moment. Plan every step from verbal to signature.',
    icon: 'CheckCircle',
    coreFramework: 'Mutual Action Plan → Paper Process Navigation → Urgency Creation → Give-to-Get Negotiation',
    sections: [
      {
        title: 'Mutual Action Plan (MAP) Template',
        items: [
          'Shared document (not your internal tracker) with: Milestone, Owner, Due Date, Status.',
          'Key milestones: Technical evaluation → Business case approval → Security/legal review → Commercial negotiation → Contract execution → Implementation kickoff.',
          'Each milestone has: Who owns it (buyer side + seller side), what "done" looks like, and when it must complete to hit their go-live date.',
          'Review the MAP on every call. "According to our plan, [milestone] is due [date]. Are we on track?" This keeps the deal moving without being pushy.',
          'Tip: Work backward from their desired go-live date. "To be live by [date], we\'d need to start implementation by [date], which means contracts signed by [date]."',
        ],
      },
      {
        title: 'Paper Process Navigation Checklist',
        items: [
          'Identify all approvers early: Procurement, Legal, Security, Finance, IT. Don\'t discover a new approver at the 11th hour.',
          'Security review: Ask "Do you require a security questionnaire or SOC 2 report?" in Stage 3, not Stage 5. Pre-fill if possible.',
          'Legal redlines: Send your contract early with a note: "Here\'s our standard agreement. If your legal team needs changes, let\'s start that process now so it doesn\'t delay the timeline."',
          'Procurement: Ask "Is there a PO process? What\'s the typical turnaround?" Many companies need 2-4 weeks for PO creation.',
          'Budget cycle: "When does your fiscal year start? If we need to use this year\'s budget, when is the deadline to get this approved?"',
        ],
      },
      {
        title: 'Trial Close Questions (10 Gauge-Readiness Checks)',
        items: [
          '"Based on what you\'ve seen, does this solve the problem you described?"',
          '"Is there anything that would prevent you from moving forward?"',
          '"If we could address [concern], would you be comfortable committing?"',
          '"On a scale of 1-10, how confident are you that this is the right solution? What would make it a 10?"',
          '"What would need to be true for you to start implementation next month?"',
          'Rule: Use trial closes throughout the sales process, not just at the end. They surface objections early.',
        ],
      },
      {
        title: 'Give-to-Get Negotiation Matrix',
        items: [
          'What you can give: Extended trial, extra onboarding sessions, quarterly business reviews, custom integrations, flexible payment terms.',
          'What you get in return: Multi-year commitment, case study participation, reference calls, expanded deployment, faster signature.',
          'Never give without getting. "I can include [X] at no additional cost if we can commit to a [Y]-year agreement."',
          'Walk-away signals: Buyer asks for >20% discount with no trade, wants to remove success metrics from the contract, or can\'t articulate the business case internally.',
          'Rule: If the deal requires more than 15% discount to close, you either haven\'t built enough value or you\'re selling to the wrong buyer.',
        ],
      },
    ],
  },
];
