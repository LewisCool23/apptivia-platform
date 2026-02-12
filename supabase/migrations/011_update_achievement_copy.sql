-- Migration: Update achievement names/descriptions to be more intuitive

-- Conversationalist
UPDATE achievements
SET
  name = 'Conversationalist Milestone ' || n,
  description = CASE
    WHEN n <= 20 THEN 'Hold ' || (n * 2) || ' discovery conversations with 4+ minutes of talk time'
    WHEN n <= 40 THEN 'Complete ' || n || ' quality conversations with a clear next step'
    WHEN n <= 60 THEN 'Maintain ' || (n + 120) || ' seconds average talk time'
    WHEN n <= 80 THEN 'Improve talk/listen balance to ' || (40 + n) || '%'
    ELSE 'Conversationalist mastery level ' || (n - 80)
  END
FROM (
  SELECT id,
    NULLIF(regexp_replace(name, '\D', '', 'g'), '')::int AS n
  FROM achievements
  WHERE name ILIKE 'Conversationalist Achievement %'
) s
WHERE achievements.id = s.id AND s.n IS NOT NULL;

-- Call Conqueror
UPDATE achievements
SET
  name = 'Call Conqueror Milestone ' || n,
  description = CASE
    WHEN n <= 20 THEN 'Book ' || n || ' meetings from live calls'
    WHEN n <= 40 THEN 'Connect with ' || (n * 2) || ' prospects by phone'
    WHEN n <= 60 THEN 'Convert ' || (n + 20) || '% of connects into meetings'
    WHEN n <= 80 THEN 'Schedule ' || n || ' qualified meetings with decision makers'
    ELSE 'Call conversion mastery level ' || (n - 80)
  END
FROM (
  SELECT id,
    NULLIF(regexp_replace(name, '\D', '', 'g'), '')::int AS n
  FROM achievements
  WHERE name ILIKE 'Call Conqueror Achievement %'
) s
WHERE achievements.id = s.id AND s.n IS NOT NULL;

-- Email Warrior
UPDATE achievements
SET
  name = 'Email Warrior Milestone ' || n,
  description = CASE
    WHEN n <= 20 THEN 'Maintain a ' || (n + 5) || '% reply rate on outbound sequences'
    WHEN n <= 40 THEN 'Send ' || (n * 10) || ' personalized emails with a clear CTA'
    WHEN n <= 60 THEN 'Generate ' || (n * 2) || ' positive email replies'
    WHEN n <= 80 THEN 'Source ' || n || ' opportunities from email'
    ELSE 'Email outreach mastery level ' || (n - 80)
  END
FROM (
  SELECT id,
    NULLIF(regexp_replace(name, '\D', '', 'g'), '')::int AS n
  FROM achievements
  WHERE name ILIKE 'Email Warrior Achievement %'
) s
WHERE achievements.id = s.id AND s.n IS NOT NULL;

-- Pipeline Guru
UPDATE achievements
SET
  name = 'Pipeline Guru Milestone ' || n,
  description = CASE
    WHEN n <= 20 THEN 'Create $' || (n * 5) || 'K qualified pipeline'
    WHEN n <= 40 THEN 'Source ' || n || ' qualified opportunities with next steps'
    WHEN n <= 60 THEN 'Advance ' || n || ' deals to Stage 2+'
    WHEN n <= 80 THEN 'Generate $' || (n * 10) || 'K in pipeline movement'
    ELSE 'Pipeline mastery level ' || (n - 80)
  END
FROM (
  SELECT id,
    NULLIF(regexp_replace(name, '\D', '', 'g'), '')::int AS n
  FROM achievements
  WHERE name ILIKE 'Pipeline Guru Achievement %'
) s
WHERE achievements.id = s.id AND s.n IS NOT NULL;

-- Task Master
UPDATE achievements
SET
  name = 'Task Master Milestone ' || n,
  description = CASE
    WHEN n <= 20 THEN 'Complete ' || (n * 5) || ' tasks before due date'
    WHEN n <= 40 THEN 'Maintain ' || (n + 60) || '% on-time completion'
    WHEN n <= 60 THEN 'Hit ' || n || ' straight days of full task completion'
    WHEN n <= 80 THEN 'Finish ' || (n * 2) || ' high-priority tasks'
    ELSE 'Execution mastery level ' || (n - 80)
  END
FROM (
  SELECT id,
    NULLIF(regexp_replace(name, '\D', '', 'g'), '')::int AS n
  FROM achievements
  WHERE name ILIKE 'Task Master Achievement %'
) s
WHERE achievements.id = s.id AND s.n IS NOT NULL;
