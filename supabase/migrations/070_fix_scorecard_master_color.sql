-- Migration 070: Fix Scorecard Master missing color
-- Scorecard Master was created in migration 018 without a color value,
-- causing invisible progress bars in the frontend.

UPDATE skillsets
SET color = '#D97706'
WHERE name = 'Scorecard Master'
  AND (color IS NULL OR color = '');
