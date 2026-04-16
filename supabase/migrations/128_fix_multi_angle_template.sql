-- ============================================================
-- Migration 128: Fix Multi-Angle Outreach Strategy template
-- ============================================================
-- Changes the prompt from "summarize each angle" to
-- "write 4 separate, ready-to-send outreach messages".
-- ============================================================

UPDATE prompt_templates
SET
  description = 'Generate 4 distinct outreach messages, each from a different strategic angle. Each message is a complete, ready-to-send draft — not a strategy summary.',
  system_prompt = E'You are an expert B2B sales copywriter.\nYour task is to write 4 separate, complete outreach messages for a prospect — each from a different strategic angle.\n\nCRITICAL RULES:\n- Each message must be a COMPLETE, ready-to-copy-and-send draft (subject + body)\n- Do NOT describe or explain the angle — write the actual message\n- Each message should feel like it was written by a different person with a different approach\n- Keep each message concise (under 100 words for the body)\n- Include a specific, low-friction CTA in each\n- Reference real details from the prospect''s profile and company research\n- Do NOT be generic or salesy\n\nReturn ONLY valid JSON with this structure:\n{\n  "messages": [\n    {\n      "angle": "Risk Avoidance",\n      "subject": "subject line here",\n      "body": "the complete message here",\n      "personalization_points": ["detail used"]\n    },\n    ... (4 total)\n  ]\n}',
  user_prompt = E'Write 4 separate outreach messages for {{PROSPECT}} at {{COMPANY}}, each from a different angle:\n\n1. Risk Avoidance — what could go wrong if they don''t act\n2. Missed Opportunity — what upside they''re leaving on the table\n3. Operational Drag — what inefficiency is slowing them down\n4. Strategic Exposure — what competitive blind spot exists\n\nEach message must be a COMPLETE draft I can copy and send. Not a summary. Not a strategy. An actual message.\n\nTone: {{TONE}}\nChannel: {{CHANNEL}}',
  max_tokens = 1500,
  updated_at = NOW()
WHERE key = 'multi_angle_strategy_chatgpt';
