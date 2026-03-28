/**
 * Consolidated KPI coaching guidance — single source of truth.
 * Used by DataDrivenPlaybook (inline playbook) and CoachingPlans (plan builder + AI prompt).
 */

// ── Shared constants ────────────────────────────────────────────────
export const LAGGING_THRESHOLD = 80;
export const DECLINING_TREND_THRESHOLD = -5;
export const DEFAULT_TREND_WEEKS = 5;

// ── Shared utility ──────────────────────────────────────────────────
export const buildLabel = (key: string): string =>
  key.replace(/_/g, ' ').replace(/([a-zA-Z])(\d)/g, '$1 $2').replace(/\b\w/g, (c) => c.toUpperCase());

export interface KpiGuidanceEntry {
  title: string;
  diagnosis: string;
  coachingQuestion: string;
  tips: string[];
}

export const KPI_GUIDANCE: Record<string, KpiGuidanceEntry> = {
  // ── Pipeline Guru KPIs ──────────────────────────────────────────────
  sourced_opps: {
    title: 'Sourced Opportunities',
    diagnosis: 'Low sourced opps usually means insufficient top-of-funnel activity — reps may not be prospecting consistently or are targeting the wrong accounts.',
    coachingQuestion: 'Walk me through your prospecting routine this week — how many accounts did you actively work, and what channels did you use?',
    tips: [
      'Block 60-90 minutes of daily prospecting time and protect it like a customer meeting — no internal calls during this window.',
      'Refresh target account lists weekly using Engage intent signals, recent funding rounds, and hiring activity.',
      'Use multi-threading: reach 3+ contacts per account to increase conversion from outreach to opportunity.',
      'Review win/loss data monthly to identify which verticals and personas convert best, then focus prospecting there.',
      'Set a personal daily outreach quota (e.g., 15 new touches) and track it visibly on your desk or dashboard.',
    ],
  },
  stage2_opps: {
    title: 'Stage 2 Opportunities',
    diagnosis: 'Low Stage 2 conversions indicate deals are stalling early — qualification may be weak, or reps are not confirming pain and buying process before advancing.',
    coachingQuestion: 'For the deals you advanced this week, can you walk me through how you confirmed the prospect has a real pain point and an active buying process?',
    tips: [
      'Before advancing any deal to Stage 2, confirm three things: identified pain, quantified business impact, and a known buying process.',
      'Map the buying committee early — identify the champion, economic buyer, and technical evaluator by the end of discovery.',
      'Create a mutual action plan with the prospect before advancing, including agreed-upon next steps and a timeline.',
      'Review Stage 1 deals weekly in a pipeline meeting and challenge yourself: "Does this deal deserve to advance, or am I being optimistic?"',
      'Use the MEDDPICC framework (or your org\'s methodology) as a checklist before marking any opportunity as Stage 2.',
    ],
  },
  pipeline_created: {
    title: 'Pipeline Created',
    diagnosis: 'Low pipeline creation means new deals are not entering the funnel fast enough — either outreach volume is low, messaging isn\'t resonating, or targeting is off.',
    coachingQuestion: 'How much net-new pipeline did you create this week, and which specific activities generated those opportunities?',
    tips: [
      'Target accounts showing clear buying triggers: recent funding, executive hiring, technology changes, or expansion announcements.',
      'Expand coverage by adding adjacent roles and departments to your outreach within existing target accounts.',
      'Re-run outbound sequences to your top 50 accounts weekly with fresh angles — don\'t wait for inbound.',
      'Dedicate one session per week to "pipeline creation sprints" — 90 minutes of focused outreach with no interruptions.',
      'Track your outreach-to-opportunity conversion rate and optimize the channels and messages that perform best.',
    ],
  },
  pipeline_advanced: {
    title: 'Pipeline Advanced',
    diagnosis: 'Stalled pipeline advancement means deals are getting stuck in middle stages — often due to missing stakeholder alignment, unclear next steps, or lack of urgency.',
    coachingQuestion: 'Which deals have been in the same stage for more than 2 weeks, and what\'s the specific blocker for each?',
    tips: [
      'Review all deals weekly and identify the single next action needed to move each one forward.',
      'Use mutual action plans with clear owner + deadline for every open deal past Stage 2.',
      'Multi-thread into executive sponsors for deals stuck at the champion level — single-threaded deals stall 3x more often.',
      'Create urgency by tying your solution to a business event, deadline, or cost-of-inaction that matters to the buyer.',
      'For deals stuck more than 2 weeks, change your approach: bring in a new stakeholder, offer a workshop, or reframe the value prop.',
    ],
  },
  qualified_leads: {
    title: 'Qualified Leads',
    diagnosis: 'Low qualified lead count suggests either insufficient lead volume, poor lead quality from marketing, or reps are not qualifying/disqualifying efficiently.',
    coachingQuestion: 'Of the leads you worked this week, how many met our ICP criteria, and how quickly did you qualify or disqualify each one?',
    tips: [
      'Tighten ICP qualification criteria and disqualify early — time spent on bad-fit leads is time stolen from real opportunities.',
      'Validate budget, authority, need, and timeline (BANT) within the first 2 conversations, not after a demo.',
      'Use win/loss analysis to refine which lead characteristics actually predict closed deals, then update your qualification checklist.',
      'Set a same-day response SLA for new inbound leads — qualified lead conversion drops 10x after the first hour.',
      'Build a simple qualification scorecard (1-5 on ICP fit, pain, budget, timeline) and share it in pipeline reviews.',
    ],
  },

  // ── Call Conqueror KPIs ─────────────────────────────────────────────
  call_connects: {
    title: 'Call Connects',
    diagnosis: 'Low call connects typically mean reps are calling at the wrong times, using poor caller ID practices, or not making enough attempts per prospect.',
    coachingQuestion: 'What times are you typically calling, and how many attempts do you make before moving on from a prospect?',
    tips: [
      'Call during peak connect windows: 8-10am and 4-6pm in the prospect\'s local time zone — avoid the 11am-2pm dead zone.',
      'Run a 3x3 cadence: 3 call attempts across 3 different days, paired with email and social touches between calls.',
      'Pair every call with a 20-second voicemail and a same-day follow-up email referencing the voicemail.',
      'Use local presence dialing when available — local area codes increase connect rates by 30-40%.',
      'Track your call-to-connect ratio weekly and set incremental improvement targets (e.g., move from 8% to 10% connect rate).',
    ],
  },
  meetings: {
    title: 'Meetings Booked',
    diagnosis: 'Low meeting count despite good activity usually means the value proposition isn\'t landing — prospects aren\'t seeing enough reason to give you their time.',
    coachingQuestion: 'When you do get a prospect on the phone, what\'s your opening 30 seconds sound like, and how often does it lead to a booked meeting?',
    tips: [
      'Lead with a crisp, prospect-specific problem statement — not your product pitch. Show you understand their world.',
      'Qualify for genuine interest and next steps before asking for calendar time — don\'t push for meetings with uninterested prospects.',
      'End every productive conversation with a clear calendar ask and two specific proposed time slots.',
      'Use social proof relevant to their industry: "Companies like [similar company] saw [specific result] — worth a 20-minute conversation?"',
      'Follow up within 2 hours of any positive signal with a calendar invite and a 1-sentence agenda.',
    ],
  },
  discovery_calls: {
    title: 'Discovery Calls',
    diagnosis: 'Low discovery call count means either not enough meetings are converting to deeper conversations, or reps are jumping straight to demos without proper discovery.',
    coachingQuestion: 'For the meetings you had this week, how many included structured discovery, and what did you learn about the prospect\'s pain points?',
    tips: [
      'Prepare 3-5 discovery questions specific to each prospect\'s role, industry, and likely challenges before every call.',
      'Map pain to business value during the call — ask "What happens if you don\'t solve this?" to quantify impact.',
      'Capture notes immediately after each discovery call while details are fresh — these feed your proposal quality.',
      'Use the 40/60 talk-listen ratio: ask more, tell less. The best discovery calls feel like a conversation, not an interrogation.',
      'End every discovery call by summarizing what you heard and confirming: "Did I capture your situation accurately?"',
    ],
  },

  // ── Conversationalist KPIs ──────────────────────────────────────────
  talk_time_minutes: {
    title: 'Talk Time',
    diagnosis: 'Low talk time means reps aren\'t having enough live conversations — they may be over-relying on email/chat or getting quick hang-ups.',
    coachingQuestion: 'How much of your day is spent in actual live conversations vs. email and admin work?',
    tips: [
      'Use a structured discovery agenda to keep conversations engaging and moving forward — avoid awkward silences.',
      'Ask open-ended questions and actively summarize back to confirm understanding — this extends and deepens conversations.',
      'Stack calls back-to-back in focused blocks to build momentum and avoid context-switching between activities.',
      'Record and review one call per week to identify where conversations end prematurely and practice extending them.',
      'Set a daily talk-time target (e.g., 90 minutes) and track it on your dashboard as a leading indicator.',
    ],
  },
  conversations: {
    title: 'Conversations',
    diagnosis: 'Low conversation count with adequate call volume means calls are too short or one-sided — prospects aren\'t engaging in meaningful dialogue.',
    coachingQuestion: 'Of your calls this week, how many turned into real two-way conversations where you learned something new about the prospect?',
    tips: [
      'Aim for meaningful two-way dialogue, not one-sided pitches — a conversation means the prospect is actively engaging.',
      'Maintain a 40/60 talk-listen ratio: ask more questions, tell less. Let the prospect do most of the talking.',
      'Log conversation outcomes immediately (pain discovered, objections raised, next steps) for coaching and follow-up quality.',
      'Use "tell me more about that" and "what does that look like for your team?" to deepen shallow conversations.',
      'Review your conversation-to-meeting conversion rate — if conversations aren\'t leading to next steps, work on your close.',
    ],
  },

  // ── Task Master KPIs ────────────────────────────────────────────────
  follow_ups: {
    title: 'Follow Ups',
    diagnosis: 'Low follow-ups indicate reps are letting leads go cold — either they\'re not building follow-up habits or they\'re overwhelmed with too many open threads.',
    coachingQuestion: 'How many prospects do you currently have in your follow-up queue, and what\'s your system for making sure none fall through the cracks?',
    tips: [
      'Build a consistent follow-up cadence for every new lead: day 1, day 3, day 7, day 14 at minimum.',
      'Schedule the next follow-up during the call itself — "I\'ll send you X by Tuesday and follow up Thursday. Sound good?"',
      'Use task reminders or CRM activity tracking to ensure zero missed follow-ups — set them before ending each session.',
      'Personalize follow-ups by referencing something specific from your last conversation — generic "just checking in" emails get ignored.',
      'Review your follow-up pipeline weekly: archive dead leads, re-engage warm ones, and prioritize hot prospects.',
    ],
  },
  demos_completed: {
    title: 'Demos Completed',
    diagnosis: 'Low demo completion typically means either not enough qualified opportunities are being created, or booked demos are being canceled/no-showed.',
    coachingQuestion: 'How many demos did you have scheduled vs. completed this week, and what caused any cancellations or no-shows?',
    tips: [
      'Qualify prospects thoroughly before scheduling a demo — demos to unqualified prospects waste time and hurt morale.',
      'Set a clear agenda and define success metrics up front: "By the end of this demo, we\'ll determine if X solves Y for you."',
      'End every demo with a mutual action plan: specific next steps, owners, and a timeline toward a decision.',
      'Send a confirmation email 24 hours before with the agenda and a 1-click reschedule option to reduce no-shows.',
      'Tailor each demo to the prospect\'s specific use case — generic demos convert 40% worse than personalized ones.',
    ],
  },
  response_time: {
    title: 'Response Time',
    diagnosis: 'Slow response times signal disorganization or inbox overload — prospects lose interest quickly, and competitors respond faster.',
    coachingQuestion: 'What\'s your average time to respond to a new inbound lead or prospect reply this week?',
    tips: [
      'Set a personal response SLA: under 1 hour for hot leads, under 4 hours for all prospect replies.',
      'Use email templates and snippets for common reply scenarios to cut response drafting time by 60%.',
      'Batch inbox review twice daily (morning + late afternoon) rather than reactively checking all day.',
      'Enable mobile notifications for prospect replies so you can at least acknowledge receipt quickly, even if a full response takes longer.',
      'Track your response time metric weekly and celebrate improvement — even a 30-minute improvement matters.',
    ],
  },
  sales_cycle_days: {
    title: 'Sales Cycle Days',
    diagnosis: 'Long sales cycles usually indicate deals are stalling due to unclear next steps, missing stakeholders, or lack of buyer urgency.',
    coachingQuestion: 'Which of your current deals have been open the longest, and what specific action could shorten each one by a week?',
    tips: [
      'Set clear next steps with specific dates at every stage transition — vague "we\'ll circle back" extends cycles dramatically.',
      'Compress discovery-to-demo timelines by doing pre-meeting research and coming to demos ready with tailored questions.',
      'Use urgency triggers (contract end dates, budget cycles, competitive evaluations) to create natural deadlines.',
      'Identify and engage the economic buyer earlier — deals without executive sponsorship by Stage 3 take 2x longer to close.',
      'Do a weekly "stuck deal" review: any deal with no activity in 7+ days gets a forced next action or disqualification.',
    ],
  },
  win_rate: {
    title: 'Win Rate',
    diagnosis: 'Low win rate typically points to poor qualification, competitive losses, or pricing/positioning issues — reps may be advancing deals that shouldn\'t be in the pipeline.',
    coachingQuestion: 'Of the deals you lost recently, what were the top 2-3 reasons, and how could you have identified those risks earlier?',
    tips: [
      'Run weekly deal reviews with your manager to identify risk early and course-correct before it\'s too late.',
      'Multi-thread every deal past Stage 2: engage 3+ stakeholders to reduce single-point-of-failure risk.',
      'Capture and reuse winning talk tracks — document what works in deals you win and replicate the pattern.',
      'Conduct win/loss interviews (or review CRM notes) monthly to find patterns in why deals close or don\'t.',
      'Improve qualification rigor: disqualifying 20% more bad-fit deals early will raise your win rate more than any closing technique.',
    ],
  },

  // ── Email Warrior KPIs ──────────────────────────────────────────────
  emails_sent: {
    title: 'Emails Sent',
    diagnosis: 'Low email volume may indicate reps are over-thinking each email or not using sequences/templates effectively to scale their outreach.',
    coachingQuestion: 'How are you balancing email personalization with volume, and are you using sequences to automate multi-step outreach?',
    tips: [
      'Personalize the first line with something specific to the prospect — their company, a recent event, or a shared connection.',
      'Batch email writing in focused 30-minute blocks to maintain quality while hitting volume targets.',
      'Mix value-driven content (insights, case studies, benchmarks) with direct questions to drive replies.',
      'Use sequences for the repetitive steps and save manual effort for the high-value personalization touches.',
      'A/B test subject lines weekly — even small improvements in open rates compound over time.',
    ],
  },
  social_touches: {
    title: 'Social Touches',
    diagnosis: 'Low social touch count suggests reps aren\'t incorporating LinkedIn and social selling into their outreach mix — they may see it as optional.',
    coachingQuestion: 'How are you using LinkedIn and social channels as part of your prospecting cadence this week?',
    tips: [
      'Engage with prospects\' LinkedIn posts (like, comment, share) before sending a connection request — warm touches convert 3x better.',
      'Use short, relevant comments that add value — avoid generic "Great post!" reactions.',
      'Follow up social engagement with a personalized message tying their content to a relevant business challenge.',
      'Set a daily social touch target (e.g., 5 meaningful interactions) and incorporate it into your morning routine.',
      'Share your own insights and content to build credibility — prospects research sellers before responding.',
    ],
  },

  // ── Engage Pro KPIs ─────────────────────────────────────────────────
  sequences_created: {
    title: 'Sequences Created',
    diagnosis: 'Low sequence creation means reps aren\'t systematizing their outreach — they\'re doing one-off touches instead of building repeatable multi-step cadences.',
    coachingQuestion: 'How many active sequences do you have running, and when was the last time you created a new one for a specific segment?',
    tips: [
      'Build persona-based sequences for each ICP segment — one size does not fit all.',
      'Start with 5-7 step sequences mixing email, LinkedIn, and calls across 2-3 weeks.',
      'Clone top-performing sequences and adapt them for new verticals or buyer personas.',
      'Review sequence performance monthly: pause underperformers and double down on what converts.',
    ],
  },
  prospects_enrolled: {
    title: 'Prospects Enrolled',
    diagnosis: 'Low enrollment count means reps have sequences but aren\'t feeding them with enough prospects — the automation is idle.',
    coachingQuestion: 'How many new prospects did you enroll in sequences this week, and what source did they come from?',
    tips: [
      'Enroll prospects from Engage intent signals immediately — strike while the buying signal is hot.',
      'Batch-enroll prospects from weekly account research sessions rather than adding one at a time.',
      'Re-enroll warm prospects who went cold in a different sequence with a fresh angle.',
      'Set a weekly enrollment target (e.g., 25 new prospects) and track it alongside your outreach metrics.',
    ],
  },
  sequence_replies: {
    title: 'Sequence Replies',
    diagnosis: 'Low reply rates with adequate enrollment means the messaging isn\'t resonating — subjects, value props, or CTAs need improvement.',
    coachingQuestion: 'What\'s your current reply rate, and have you tested different subject lines or messaging angles recently?',
    tips: [
      'Personalize the first line of every sequence email with account-specific context from Engage research.',
      'Use the AI Playbook Builder for context-rich messaging tailored to each prospect\'s situation.',
      'A/B test subject lines and CTAs weekly — track which versions drive the most replies.',
      'Keep emails under 100 words with one clear question or CTA — long emails get skimmed and ignored.',
    ],
  },
  accounts_researched: {
    title: 'Accounts Researched',
    diagnosis: 'Low research count means reps are reaching out blind — without understanding the prospect\'s business, outreach quality suffers.',
    coachingQuestion: 'Before your last 3 outreach touches, how much did you know about each prospect\'s company and situation?',
    tips: [
      'Research every prospect\'s company in Engage before any outreach — spend 5 minutes to save 50 minutes of wasted effort.',
      'Build buying committee maps for Tier 1 and Tier 2 accounts before initiating contact.',
      'Review AI-generated account intelligence and risk factors before meetings to ask smarter questions.',
      'Set a weekly research target tied to your prospecting plan — research feeds pipeline quality.',
    ],
  },
  playbooks_executed: {
    title: 'Playbooks Executed',
    diagnosis: 'Low playbook execution means reps aren\'t leveraging the guided workflows available to them — they may not know which playbooks exist or when to use them.',
    coachingQuestion: 'Which Engage playbooks have you run this week, and are there signals or deal stages where you could have used one?',
    tips: [
      'Run signal-triggered playbooks as soon as new high-intent signals appear — timeliness matters.',
      'Execute account playbooks before every first meeting to ensure thorough preparation.',
      'Use pipeline playbooks to unstick mid-stage deals with new angles and stakeholder strategies.',
      'Review available playbooks monthly and bookmark the ones most relevant to your territory.',
    ],
  },
  outreach_drafts_sent: {
    title: 'Outreach Drafts Sent',
    diagnosis: 'Low draft usage means reps aren\'t leveraging AI-generated content to accelerate their outreach — they may be writing everything from scratch.',
    coachingQuestion: 'How often are you using AI-generated drafts as starting points for your outreach, and how much time does it save you?',
    tips: [
      'Use AI drafts as a starting point, then add your personal touch — 80% AI scaffold + 20% human personalization.',
      'Generate drafts across multiple channels (email, LinkedIn, call scripts) for each prospect.',
      'Batch-generate drafts weekly during your prospecting prep session to front-load the week.',
      'Rate and give feedback on AI drafts to improve future suggestions for your style.',
    ],
  },
  engage_signals_actioned: {
    title: 'Signals Actioned',
    diagnosis: 'Low signal action rate means valuable buying signals are being ignored — reps may not be checking their signal feed regularly.',
    coachingQuestion: 'How often do you check your Signal Prospecting feed, and how quickly do you act on high-intent signals?',
    tips: [
      'Check Signal Prospecting daily for new high-intent signals — make it part of your morning routine.',
      'Act on funding, hiring, and technology change signals within 24 hours while they\'re still relevant.',
      'Pair signals with account research before reaching out — signals tell you when, research tells you what to say.',
      'Prioritize signals by score: focus on 70+ signals first, then work down to lower-scoring ones.',
    ],
  },
  engage_deals_influenced: {
    title: 'Deals Influenced',
    diagnosis: 'Low deal influence from Engage means reps aren\'t connecting their Engage activity to pipeline outcomes — either the activities aren\'t targeted enough or attribution is missing.',
    coachingQuestion: 'Which of your current deals were influenced by Engage activities, and how did those activities help move the deal forward?',
    tips: [
      'Track which Engage activities (research, signals, playbooks) contributed to each deal in your pipeline.',
      'Use account intelligence to multi-thread stalled deals — find new contacts and angles through Engage data.',
      'Run pipeline playbooks on at-risk deals to surface new stakeholders and competitive insights.',
      'Review your Engage-influenced deals monthly to identify which activities have the highest deal impact.',
    ],
  },
};
