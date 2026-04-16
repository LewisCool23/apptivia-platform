-- Migration 120: Fix migration 119 date boundaries
-- Migration 119 seeded kpi_values with dates off by 1 day:
--   period_start = 2026-03-31 (Tuesday) → should be 2026-03-30 (Monday)
--   period_end   = 2026-04-06 (Monday)  → should be 2026-04-05 (Sunday)
-- This caused "This Week" (Apr 6–12) to display last week's data because
-- period_end=Apr 6 overlaps with qStart=Apr 6 in the overlap query.

-- Step 1: Delete the wrongly-dated rows
DELETE FROM kpi_values
WHERE period_start = '2026-03-31'
  AND period_end   = '2026-04-06';

-- Step 2: Re-seed with correct dates (Mon 2026-03-30 to Sun 2026-04-05)
-- using the same logic as migration 119 but with corrected date references.
DO $$
DECLARE
  _org_id   uuid := 'c065a9f9-dd42-496d-bda3-246adcfe7949';
  _ps       date := '2026-03-30';   -- last week Monday (correct)
  _pe       date := '2026-04-05';   -- last week Sunday (correct)
  _prev_ps  date := '2026-03-23';   -- prior week Monday (matches migration 098)
  _prev_pe  date := '2026-03-29';   -- prior week Sunday (matches migration 098)
  _rep      record;
  _kpi      record;
  _prev_val numeric;
  _new_val  numeric;
  _drift    numeric;
  _inserted int := 0;
BEGIN
  FOR _rep IN
    SELECT p.id AS profile_id, p.team_id, p.first_name
    FROM   profiles p
    WHERE  p.organization_id = _org_id
      AND  p.role NOT IN ('admin', 'manager', 'coach')
    ORDER BY p.first_name
  LOOP
    FOR _kpi IN
      SELECT oc.kpi_id,
             COALESCE(oc.goal, m.goal)       AS goal,
             COALESCE(m.direction, 'higher')  AS direction,
             m.key                            AS kpi_key
      FROM   kpi_org_configs oc
      JOIN   kpi_metrics m ON m.id = oc.kpi_id
      WHERE  oc.organization_id = _org_id
        AND  oc.is_active = true
    LOOP
      -- Skip if data already exists for this rep/kpi/week
      IF EXISTS (
        SELECT 1 FROM kpi_values
        WHERE  profile_id  = _rep.profile_id
          AND  kpi_id      = _kpi.kpi_id
          AND  period_start = _ps
          AND  period_end   = _pe
      ) THEN
        CONTINUE;
      END IF;

      -- Look up prior week value (now matches migration 098 dates correctly)
      SELECT v.value INTO _prev_val
      FROM   kpi_values v
      WHERE  v.profile_id  = _rep.profile_id
        AND  v.kpi_id      = _kpi.kpi_id
        AND  v.period_start = _prev_ps
        AND  v.period_end   = _prev_pe
      LIMIT 1;

      IF _prev_val IS NOT NULL AND _prev_val > 0 THEN
        _drift   := 0.88 + (random() * 0.27);
        _new_val := round((_prev_val * _drift)::numeric, 1);
      ELSE
        _new_val := round((_kpi.goal * (0.55 + (random() * 0.70)))::numeric, 1);
      END IF;

      IF _new_val < 0 THEN _new_val := 0; END IF;

      IF _kpi.direction = 'lower' AND _new_val > _kpi.goal * 2.5 THEN
        _new_val := round((_kpi.goal * (0.70 + random() * 0.80))::numeric, 1);
      END IF;

      IF _kpi.kpi_key IN (
        'call_connects','dials','emails_sent','social_touches','conversations',
        'meetings','demos_completed','follow_ups','discovery_calls',
        'qualified_leads','sourced_opps','stage2_opps','closed_won'
      ) THEN
        _new_val := round(_new_val);
      END IF;

      INSERT INTO kpi_values (kpi_id, profile_id, team_id, value, period_start, period_end)
      VALUES (_kpi.kpi_id, _rep.profile_id, _rep.team_id, _new_val, _ps, _pe);

      _inserted := _inserted + 1;
    END LOOP;
  END LOOP;

  RAISE NOTICE '[seed-120] Deleted bad rows, re-inserted % kpi_values rows for last week (% to %)', _inserted, _ps, _pe;
END $$;
