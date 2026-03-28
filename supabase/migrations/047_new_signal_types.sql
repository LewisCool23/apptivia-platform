-- Migration 047: Add 7 new signal type definitions to the universal signal library
-- No schema changes — signal_subtype is stored in raw_data JSONB on engage_intent_signals

INSERT INTO engage_signal_definitions
  (signal_key, signal_name, category, description, default_score, default_strength, is_universal, sort_order)
VALUES
  (
    'g2_review',
    'G2 Review Activity',
    'interest',
    'A company employee or customer left a review on G2, indicating active evaluation of tools in your category. High-intent peer validation signal.',
    68, 'high', true, 102
  ),
  (
    'reddit_buying_intent',
    'Reddit Buying Intent',
    'buyer_intent',
    'A Reddit discussion thread where a company or its users express intent to evaluate or purchase a solution in your category.',
    72, 'high', true, 103
  ),
  (
    'reddit_churn_risk',
    'Reddit Churn Risk Signal',
    'buyer_intent',
    'Reddit post or comment indicating frustration with a competitor or current vendor — high probability of switching intent.',
    78, 'high', true, 104
  ),
  (
    'reddit_competitor_mention',
    'Reddit Competitor Mention',
    'interest',
    'Company, product, or pain point mentioned in a Reddit thread alongside competitor names. Useful competitive intelligence.',
    55, 'medium', true, 105
  ),
  (
    'product_hunt_launch',
    'Product Hunt Launch',
    'company_event',
    'Company launched a new product on Product Hunt, indicating a go-to-market push and hiring/scaling activity likely to follow.',
    62, 'medium', true, 131
  ),
  (
    'hiring_velocity',
    'Rapid Hiring Acceleration',
    'company_event',
    'Company is posting significantly more jobs than baseline, indicating growth phase. Strong trigger for scaling tooling needs.',
    70, 'high', true, 36
  ),
  (
    'dept_expansion',
    'Department-Level Expansion',
    'company_event',
    'A specific department (Sales, Marketing, Engineering) is expanding rapidly based on job postings, signaling focused investment.',
    65, 'medium', true, 37
  )
ON CONFLICT (signal_key) DO NOTHING;
