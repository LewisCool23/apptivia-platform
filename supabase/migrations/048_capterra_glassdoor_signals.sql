-- Migration 048: Add capterra_review to universal signal library
-- Glassdoor subtypes are stored in raw_data.signal_subtype (no new signal_key needed)

INSERT INTO engage_signal_definitions
  (signal_key, signal_name, category, description, default_score, default_strength, is_universal, sort_order)
VALUES
  (
    'capterra_review',
    'Capterra Review Activity',
    'interest',
    'A company employee or customer left a review on Capterra, indicating active evaluation of software in your category.',
    65, 'medium', true, 103
  )
ON CONFLICT (signal_key) DO NOTHING;
