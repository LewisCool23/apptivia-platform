-- Migration 137: Seed KPI values for week of April 6–12, 2026
-- Follows drift-based pattern from migration 120 (prior week: Mar 30 – Apr 5)

DO $$
DECLARE
  _org_id   uuid := 'c065a9f9-dd42-496d-bda3-246adcfe7949';
  _ps       date := '2026-04-06';   -- this seed week Monday
  _pe       date := '2026-04-12';   -- this seed week Sunday
  _prev_ps  date := '2026-03-30';   -- prior week Monday (migration 120)
  _prev_pe  date := '2026-04-05';   -- prior week Sunday (migration 120)
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
        WHERE  profile_id   = _rep.profile_id
          AND  kpi_id       = _kpi.kpi_id
          AND  period_start  = _ps
          AND  period_end    = _pe
      ) THEN
        CONTINUE;
      END IF;

      -- Look up prior week value for drift calculation
      SELECT v.value INTO _prev_val
      FROM   kpi_values v
      WHERE  v.profile_id   = _rep.profile_id
        AND  v.kpi_id       = _kpi.kpi_id
        AND  v.period_start  = _prev_ps
        AND  v.period_end    = _prev_pe
      LIMIT 1;

      IF _prev_val IS NOT NULL AND _prev_val > 0 THEN
        -- Drift: -12% to +15% from prior week
        _drift   := 0.88 + (random() * 0.27);
        _new_val := round((_prev_val * _drift)::numeric, 1);
      ELSE
        -- No prior data: generate from goal with 55%–125% spread
        _new_val := round((_kpi.goal * (0.55 + (random() * 0.70)))::numeric, 1);
      END IF;

      IF _new_val < 0 THEN _new_val := 0; END IF;

      -- Cap "lower is better" KPIs at 2.5x goal
      IF _kpi.direction = 'lower' AND _new_val > _kpi.goal * 2.5 THEN
        _new_val := round((_kpi.goal * (0.70 + random() * 0.80))::numeric, 1);
      END IF;

      -- Round count-based KPIs to integers
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

  RAISE NOTICE '[seed-137] Inserted % kpi_values rows for week % to %', _inserted, _ps, _pe;
END $$;
