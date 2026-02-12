-- Migration: coaching plans for auto/custom plan storage

CREATE TABLE IF NOT EXISTS coaching_plans (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid REFERENCES profiles(id) ON DELETE SET NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('auto', 'custom')),
  plan_text text NOT NULL,
  highlights jsonb,
  audience_label text,
  member_ids uuid[] DEFAULT '{}'::uuid[],
  status text NOT NULL DEFAULT 'draft'
);

ALTER TABLE coaching_plans ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE polname = 'coaching_plans_owner_access' AND tablename = 'coaching_plans'
  ) THEN
    CREATE POLICY coaching_plans_owner_access
      ON coaching_plans
      FOR ALL
      USING (auth.uid() = created_by)
      WITH CHECK (auth.uid() = created_by);
  END IF;
END $$;
