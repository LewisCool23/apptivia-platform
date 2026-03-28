-- ========================================================================
-- Migration 068: Fix Pipeline Guru achievement KPI key mismatch
--
-- Problem: 8 Pipeline Guru achievements reference criteria.kpi = "closed_won_deals"
-- but the actual kpi_metrics key is "closed_won". runAchievementCheck() can't
-- find the KPI → silently skips all "Deals Closed" achievements.
--
-- Fix: Update criteria.kpi from "closed_won_deals" to "closed_won" for all
-- affected achievements. Also fix the weekly variant "closed_won_deals_weekly".
-- ========================================================================

-- Fix cumulative achievements (5, 10, 20, 30, 50, 75, 100 Deals Closed)
UPDATE achievements
SET criteria = jsonb_set(criteria, '{kpi}', '"closed_won"')
WHERE criteria->>'kpi' = 'closed_won_deals';

-- Fix weekly achievement (Weekly Closer)
UPDATE achievements
SET criteria = jsonb_set(criteria, '{kpi}', '"closed_won_weekly"')
WHERE criteria->>'kpi' = 'closed_won_deals_weekly';
