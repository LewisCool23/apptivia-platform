-- Migration: Create skillsets and achievements system for Coach page

-- Add apptivia_level to profiles table
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS apptivia_level text DEFAULT 'Developing';
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS current_score numeric DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS day_streak integer DEFAULT 0;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS total_points integer DEFAULT 0;

-- Update existing profiles with sample data
UPDATE profiles SET 
  apptivia_level = CASE 
    WHEN id = '00000000-0000-0000-0000-000000000100'::uuid THEN 'Proficient'
    WHEN id = '00000000-0000-0000-0000-000000000101'::uuid THEN 'Proficient'
    WHEN id = '00000000-0000-0000-0000-000000000102'::uuid THEN 'Intermediate'
    ELSE 'Intermediate'
  END,
  current_score = CASE 
    WHEN id = '00000000-0000-0000-0000-000000000100'::uuid THEN 175
    WHEN id = '00000000-0000-0000-0000-000000000101'::uuid THEN 151
    WHEN id = '00000000-0000-0000-0000-000000000102'::uuid THEN 116
    ELSE 103
  END,
  day_streak = FLOOR(RANDOM() * 10 + 1)::integer,
  total_points = FLOOR(RANDOM() * 1000 + 500)::integer
WHERE id IN (
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000103'::uuid
);

-- Ensure skillsets table exists with correct structure
CREATE TABLE IF NOT EXISTS skillsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  description text NOT NULL,
  color text NOT NULL,
  icon text,
  created_at timestamptz DEFAULT now()
);

-- Clear existing skillsets if any
DELETE FROM skillsets;

-- Insert the 5 core skillsets
INSERT INTO skillsets (id, name, description, color) VALUES
  ('10000000-0000-0000-0000-000000000001'::uuid, 'Conversationalist', 'Master meaningful sales conversations', '#3B82F6'),
  ('10000000-0000-0000-0000-000000000002'::uuid, 'Call Conqueror', 'Excel at call conversion and scheduling meetings', '#10B981'),
  ('10000000-0000-0000-0000-000000000003'::uuid, 'Email Warrior', 'Dominate email outreach', '#8B5CF6'),
  ('10000000-0000-0000-0000-000000000004'::uuid, 'Pipeline Guru', 'Generate high-value opportunities', '#F59E0B'),
  ('10000000-0000-0000-0000-000000000005'::uuid, 'Task Master', 'Perfect task execution', '#EF4444')
ON CONFLICT (name) DO UPDATE SET
  description = EXCLUDED.description,
  color = EXCLUDED.color;

-- Ensure achievements table exists with correct structure
CREATE TABLE IF NOT EXISTS achievements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skillset_id uuid NOT NULL REFERENCES skillsets(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text NOT NULL,
  points integer DEFAULT 10,
  difficulty text DEFAULT 'medium', -- easy, medium, hard
  created_at timestamptz DEFAULT now()
);

-- Create index for performance
CREATE INDEX IF NOT EXISTS idx_achievements_skillset_id ON achievements(skillset_id);

-- Clear existing achievements
DELETE FROM achievements;

-- Insert 100 achievements for Conversationalist
INSERT INTO achievements (skillset_id, name, description, points, difficulty)
SELECT 
  '10000000-0000-0000-0000-000000000001'::uuid,
  'Conversationalist Milestone ' || generate_series,
  CASE 
    WHEN generate_series <= 20 THEN 'Hold ' || (generate_series * 2) || ' discovery conversations with 4+ minutes of talk time'
    WHEN generate_series <= 40 THEN 'Complete ' || generate_series || ' quality conversations with a clear next step'
    WHEN generate_series <= 60 THEN 'Maintain ' || (generate_series + 120) || ' seconds average talk time'
    WHEN generate_series <= 80 THEN 'Improve talk/listen balance to ' || (40 + generate_series) || '%'
    ELSE 'Conversationalist mastery level ' || (generate_series - 80)
  END,
  CASE 
    WHEN generate_series <= 33 THEN 5
    WHEN generate_series <= 66 THEN 10
    ELSE 20
  END,
  CASE 
    WHEN generate_series <= 33 THEN 'easy'
    WHEN generate_series <= 66 THEN 'medium'
    ELSE 'hard'
  END
FROM generate_series(1, 100);

-- Insert 100 achievements for Call Conqueror
INSERT INTO achievements (skillset_id, name, description, points, difficulty)
SELECT 
  '10000000-0000-0000-0000-000000000002'::uuid,
  'Call Conqueror Milestone ' || generate_series,
  CASE 
    WHEN generate_series <= 20 THEN 'Book ' || generate_series || ' meetings from live calls'
    WHEN generate_series <= 40 THEN 'Connect with ' || (generate_series * 2) || ' prospects by phone'
    WHEN generate_series <= 60 THEN 'Convert ' || (generate_series + 20) || '% of connects into meetings'
    WHEN generate_series <= 80 THEN 'Schedule ' || generate_series || ' qualified meetings with decision makers'
    ELSE 'Call conversion mastery level ' || (generate_series - 80)
  END,
  CASE 
    WHEN generate_series <= 33 THEN 5
    WHEN generate_series <= 66 THEN 10
    ELSE 20
  END,
  CASE 
    WHEN generate_series <= 33 THEN 'easy'
    WHEN generate_series <= 66 THEN 'medium'
    ELSE 'hard'
  END
FROM generate_series(1, 100);

-- Insert 100 achievements for Email Warrior
INSERT INTO achievements (skillset_id, name, description, points, difficulty)
SELECT 
  '10000000-0000-0000-0000-000000000003'::uuid,
  'Email Warrior Milestone ' || generate_series,
  CASE 
    WHEN generate_series <= 20 THEN 'Maintain a ' || (generate_series + 5) || '% reply rate on outbound sequences'
    WHEN generate_series <= 40 THEN 'Send ' || (generate_series * 10) || ' personalized emails with a clear CTA'
    WHEN generate_series <= 60 THEN 'Generate ' || (generate_series * 2) || ' positive email replies'
    WHEN generate_series <= 80 THEN 'Source ' || generate_series || ' opportunities from email'
    ELSE 'Email outreach mastery level ' || (generate_series - 80)
  END,
  CASE 
    WHEN generate_series <= 33 THEN 5
    WHEN generate_series <= 66 THEN 10
    ELSE 20
  END,
  CASE 
    WHEN generate_series <= 33 THEN 'easy'
    WHEN generate_series <= 66 THEN 'medium'
    ELSE 'hard'
  END
FROM generate_series(1, 100);

-- Insert 100 achievements for Pipeline Guru
INSERT INTO achievements (skillset_id, name, description, points, difficulty)
SELECT 
  '10000000-0000-0000-0000-000000000004'::uuid,
  'Pipeline Guru Milestone ' || generate_series,
  CASE 
    WHEN generate_series <= 20 THEN 'Create $' || (generate_series * 5) || 'K qualified pipeline'
    WHEN generate_series <= 40 THEN 'Source ' || generate_series || ' qualified opportunities with next steps'
    WHEN generate_series <= 60 THEN 'Advance ' || generate_series || ' deals to Stage 2+'
    WHEN generate_series <= 80 THEN 'Generate $' || (generate_series * 10) || 'K in pipeline movement'
    ELSE 'Pipeline mastery level ' || (generate_series - 80)
  END,
  CASE 
    WHEN generate_series <= 33 THEN 5
    WHEN generate_series <= 66 THEN 10
    ELSE 20
  END,
  CASE 
    WHEN generate_series <= 33 THEN 'easy'
    WHEN generate_series <= 66 THEN 'medium'
    ELSE 'hard'
  END
FROM generate_series(1, 100);

-- Insert 100 achievements for Task Master
INSERT INTO achievements (skillset_id, name, description, points, difficulty)
SELECT 
  '10000000-0000-0000-0000-000000000005'::uuid,
  'Task Master Milestone ' || generate_series,
  CASE 
    WHEN generate_series <= 20 THEN 'Complete ' || (generate_series * 5) || ' tasks before due date'
    WHEN generate_series <= 40 THEN 'Maintain ' || (generate_series + 60) || '% on-time completion'
    WHEN generate_series <= 60 THEN 'Hit ' || generate_series || ' straight days of full task completion'
    WHEN generate_series <= 80 THEN 'Finish ' || (generate_series * 2) || ' high-priority tasks'
    ELSE 'Execution mastery level ' || (generate_series - 80)
  END,
  CASE 
    WHEN generate_series <= 33 THEN 5
    WHEN generate_series <= 66 THEN 10
    ELSE 20
  END,
  CASE 
    WHEN generate_series <= 33 THEN 'easy'
    WHEN generate_series <= 66 THEN 'medium'
    ELSE 'hard'
  END
FROM generate_series(1, 100);

-- Create profile_skillsets junction table for tracking progress
CREATE TABLE IF NOT EXISTS profile_skillsets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  skillset_id uuid NOT NULL REFERENCES skillsets(id) ON DELETE CASCADE,
  progress numeric DEFAULT 0 CHECK (progress >= 0 AND progress <= 100),
  next_milestone text,
  achievements_completed integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(profile_id, skillset_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_profile_skillsets_profile_id ON profile_skillsets(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_skillsets_skillset_id ON profile_skillsets(skillset_id);

-- Insert sample skillset progress for demo profiles
INSERT INTO profile_skillsets (profile_id, skillset_id, progress, next_milestone, achievements_completed)
SELECT 
  p.id,
  s.id,
  FLOOR(RANDOM() * 40 + 50)::numeric, -- Random progress between 50-90
  CASE 
    WHEN s.name = 'Conversationalist' THEN 'Improve talk ratio to 80%'
    WHEN s.name = 'Call Conqueror' THEN 'Book 10 meetings this week'
    WHEN s.name = 'Email Warrior' THEN 'Maintain 25%+ reply rate'
    WHEN s.name = 'Pipeline Guru' THEN 'Create $50K pipeline this month'
    WHEN s.name = 'Task Master' THEN '100% completion for 10 days'
  END,
  FLOOR(RANDOM() * 30 + 10)::integer -- Random achievements completed 10-40
FROM profiles p
CROSS JOIN skillsets s
WHERE p.id IN (
  '00000000-0000-0000-0000-000000000100'::uuid,
  '00000000-0000-0000-0000-000000000101'::uuid,
  '00000000-0000-0000-0000-000000000102'::uuid,
  '00000000-0000-0000-0000-000000000103'::uuid
)
ON CONFLICT (profile_id, skillset_id) DO UPDATE SET
  progress = EXCLUDED.progress,
  next_milestone = EXCLUDED.next_milestone,
  achievements_completed = EXCLUDED.achievements_completed;
