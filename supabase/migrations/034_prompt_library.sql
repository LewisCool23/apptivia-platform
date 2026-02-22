-- ============================================================
-- Migration 034: Prompt Library System
-- ============================================================
-- Creates the prompt_templates table and seeds the 8-prompt
-- "Outbound AI Prompt Library" that top sales teams use.
-- ============================================================

-- ── Table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prompt_templates (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,  -- NULL = global / system prompt
  key             TEXT NOT NULL,                 -- machine key, e.g. 'account_research_chatgpt'
  name            TEXT NOT NULL,                 -- display name
  category        TEXT NOT NULL DEFAULT 'general', -- research | outreach | analysis | follow_up | deliverability
  ai_model        TEXT NOT NULL DEFAULT 'claude', -- 'chatgpt' | 'claude' | 'any'
  description     TEXT,
  system_prompt   TEXT,                          -- system-level instructions (sent as system message)
  user_prompt     TEXT NOT NULL,                 -- the main prompt template with {{VARIABLE}} placeholders
  variables       TEXT[] DEFAULT '{}',           -- list of expected variables, e.g. {'COMPANY','PROBLEM'}
  channel         TEXT,                          -- email | linkedin | call | NULL (not channel-specific)
  tags            TEXT[] DEFAULT '{}',           -- free-form tags for search/filter
  sort_order      INT DEFAULT 0,                -- display order within category
  max_tokens      INT DEFAULT 1000,
  temperature     REAL DEFAULT 0.7,
  is_active       BOOLEAN DEFAULT true,
  is_system       BOOLEAN DEFAULT false,         -- system prompts can't be deleted by users
  version         INT DEFAULT 1,
  created_by      UUID REFERENCES auth.users(id),
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_prompt_templates_org ON prompt_templates(organization_id);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_category ON prompt_templates(category);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_key ON prompt_templates(key);
CREATE INDEX IF NOT EXISTS idx_prompt_templates_active ON prompt_templates(is_active);

-- RLS
ALTER TABLE prompt_templates ENABLE ROW LEVEL SECURITY;

-- Users can read system prompts (org_id IS NULL) and their own org's prompts
CREATE POLICY "prompt_templates_select" ON prompt_templates
  FOR SELECT USING (
    organization_id IS NULL
    OR organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Users can insert prompts for their own org
CREATE POLICY "prompt_templates_insert" ON prompt_templates
  FOR INSERT WITH CHECK (
    organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Users can update their own org's prompts (not system prompts)
CREATE POLICY "prompt_templates_update" ON prompt_templates
  FOR UPDATE USING (
    is_system = false
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- Users can delete their own org's prompts (not system prompts)
CREATE POLICY "prompt_templates_delete" ON prompt_templates
  FOR DELETE USING (
    is_system = false
    AND organization_id = (SELECT organization_id FROM profiles WHERE id = auth.uid())
  );

-- ── Seed: The 8-Prompt Outbound AI Prompt Library ───────────

INSERT INTO prompt_templates (key, name, category, ai_model, description, system_prompt, user_prompt, variables, channel, tags, sort_order, max_tokens, temperature, is_system)
VALUES

-- 1. Account Research (ChatGPT)
(
  'account_research_chatgpt',
  'Account Research — Structured Insight',
  'research',
  'chatgpt',
  'Force structured, sales-relevant insight fast. ChatGPT excels at logical decomposition and prioritization.',
  'You are a senior B2B sales strategist. Focus only on insight that would change outbound messaging. Ignore company history, mission statements, and generic descriptions.',
  E'Using public information, analyze {{COMPANY}}.\nDeliver only:\n1. The top 3 business priorities they are likely focused on right now\n2. The biggest operational or strategic risk tied to those priorities\n3. One initiative that could fail if nothing changes\n\nFocus only on insight that would change outbound messaging.',
  '{COMPANY}',
  NULL,
  '{research,account,structured,chatgpt,priorities,risk}',
  1, 1000, 0.7, true
),

-- 2. 10-Minute Research Rule (ChatGPT)
(
  '10_minute_research_chatgpt',
  '10-Minute Research Rule',
  'research',
  'chatgpt',
  'Prevent over-research and trivia collection. Get fast clarity without analysis paralysis.',
  'You are a senior B2B sales strategist. You have 10 minutes to prepare. State assumptions clearly. Do not hedge.',
  E'You have 10 minutes to prepare outbound insight on {{COMPANY}}.\nOutput only:\n1. One unavoidable business problem\n2. One reason it is urgent now\n3. One role most exposed if it goes unsolved\n\nState assumptions clearly. Do not hedge.',
  '{COMPANY}',
  NULL,
  '{research,fast,time-boxed,chatgpt,urgent}',
  2, 800, 0.7, true
),

-- 3. Buying Committee Mapping (Claude)
(
  'buying_committee_claude',
  'Buying Committee Mapping',
  'research',
  'claude',
  'Infer internal dynamics before messaging anyone. Claude is stronger at contextual role interpretation and human incentives.',
  'You are an expert sales strategist specializing in complex B2B buying committees. Provide nuanced, realistic inference about human motivations and organizational dynamics.',
  E'Based on {{COMPANY}} size, industry, and maturity, infer the likely buying committee for a solution addressing {{PROBLEM}}.\n\nIdentify:\n- Economic buyer\n- Operational owner\n- Technical blocker\n- Likely internal skeptic\n\nFor each role, explain:\n- What success looks like to them\n- What they fear being blamed for',
  '{COMPANY,PROBLEM}',
  NULL,
  '{research,buying committee,stakeholder,claude,mapping}',
  3, 1500, 0.7, true
),

-- 4. Multi-Angle Outreach Strategy (ChatGPT)
(
  'multi_angle_strategy_chatgpt',
  'Multi-Angle Outreach Strategy',
  'outreach',
  'chatgpt',
  'Avoid single-angle messaging. ChatGPT generates distinct, logically separated hypotheses. If all four angles sound similar, the research is weak.',
  'You are a senior B2B outbound strategist. Generate distinct, logically separated outreach angles. Do not write email copy — summarize each angle in one sentence only.',
  E'Using the account insight above, generate 4 outbound angles for {{COMPANY}}:\n1. Risk avoidance\n2. Missed opportunity\n3. Operational drag\n4. Strategic exposure\n\nSummarize each angle in one sentence.\nDo not write email copy.\n\nRule: If all four angles sound similar, the research is weak.',
  '{COMPANY}',
  NULL,
  '{outreach,angles,strategy,chatgpt,messaging}',
  4, 800, 0.7, true
),

-- 5. First Email Draft (Claude)
(
  'first_email_claude',
  'First Email Draft — Controlled',
  'outreach',
  'claude',
  'Produce human, non-templated language. Claude writes more naturally and avoids salesy patterns.',
  'You are a thoughtful sales operator, not a salesperson. Write naturally. Avoid buzzwords, flattery, generic value claims, and salesy patterns.',
  E'Draft a first-touch outbound email using the following angle: {{SELECTED_ANGLE}}\n\nContext:\n- Company: {{COMPANY}}\n- Prospect: {{PROSPECT}}\n\nConstraints:\n- Under 90 words\n- No buzzwords\n- No flattery\n- No generic value claims\n- One concrete observation\n- One soft, curious question\n\nWrite as a thoughtful operator, not a salesperson.',
  '{SELECTED_ANGLE,COMPANY,PROSPECT}',
  'email',
  '{outreach,email,first-touch,claude,draft,human}',
  5, 500, 0.8, true
),

-- 6. Reply Interpretation (Claude)
(
  'reply_interpretation_claude',
  'Reply Interpretation — Read the Subtext',
  'analysis',
  'claude',
  'Respond to meaning, not words. Claude excels at tone, subtext, and avoidance detection.',
  'You are an expert at reading between the lines in sales conversations. Focus on subtext, avoidance patterns, and implicit signals. Be respectful and precise.',
  E'Analyze the following reply:\n\n{{REPLY_TEXT}}\n\nIdentify:\n1. What they explicitly said\n2. What they implicitly signaled\n3. What they avoided answering\n4. The most respectful next step',
  '{REPLY_TEXT}',
  NULL,
  '{analysis,reply,subtext,tone,claude,interpretation}',
  6, 800, 0.7, true
),

-- 7. Follow-Up Logic (ChatGPT)
(
  'follow_up_chatgpt',
  'Follow-Up Logic — Intentional',
  'follow_up',
  'chatgpt',
  'Ensure follow-ups are intentional, not automated. Based on reply analysis, generate a respectful follow-up.',
  'You are a senior sales professional who writes concise, respectful follow-ups. Never use pressure language. Reference only what the prospect implied. Always end with an easy exit option.',
  E'Based on the reply analysis above:\n\n{{REPLY_ANALYSIS}}\n\nDraft a follow-up message.\nConstraints:\n- Under 70 words\n- No pressure language\n- Reference only what they implied\n- End with an easy exit option',
  '{REPLY_ANALYSIS}',
  NULL,
  '{follow_up,reply,chatgpt,respectful,intentional}',
  7, 500, 0.7, true
),

-- 8. Spam & Deliverability Review (ChatGPT)
(
  'spam_review_chatgpt',
  'Spam & Deliverability Review',
  'deliverability',
  'chatgpt',
  'Protect domains and sender reputation. Identify spam triggers without improving persuasion.',
  'You are an email deliverability expert. Identify risks only. Do not improve persuasion or add selling language. Rewrite only the risky sections.',
  E'Review the following outbound message for spam and deliverability risk.\n\n{{MESSAGE_TEXT}}\n\nIdentify:\n1. Spam trigger phrases\n2. Language that signals automation\n3. Anything that feels templated\n\nRewrite only the risky sections.\nDo not improve persuasion.',
  '{MESSAGE_TEXT}',
  NULL,
  '{deliverability,spam,review,chatgpt,email,reputation}',
  8, 800, 0.5, true
)

ON CONFLICT DO NOTHING;

-- ── Updated-at trigger ───────────────────────────────────────

CREATE OR REPLACE FUNCTION update_prompt_templates_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_prompt_templates_updated_at ON prompt_templates;
CREATE TRIGGER trg_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW EXECUTE FUNCTION update_prompt_templates_updated_at();
