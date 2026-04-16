-- Migration 119: Seed last week (2026-03-30 to 2026-04-05) KPI values
-- for every rep in the Apptivia Test Organization.
-- Values are based on existing prior-week trends with slight random variation.
-- NOTE: Original dates (03-31 to 04-06) were off-by-one. Fixed to Mon-Sun.

DO $$
DECLARE
  _org_id   uuid := 'c065a9f9-dd42-496d-bda3-246adcfe7949';
  _ps       date := '2026-03-30';   -- last week Monday
  _pe       date := '2026-04-05';   -- last week Sunday
  _prev_ps  date := '2026-03-23';   -- prior week Monday  (for trend base)
  _prev_pe  date := '2026-03-29';   -- prior week Sunday
  _rep      record;
  _kpi      record;
  _prev_val numeric;
  _new_val  numeric;
  _drift    numeric;
  _inserted int := 0;
BEGIN
  -- Loop over every non-admin/non-manager/non-coach rep in the test org
  FOR _rep IN
    SELECT p.id AS profile_id, p.team_id, p.first_name
    FROM   profiles p
    WHERE  p.organization_id = _org_id
      AND  p.role NOT IN ('admin', 'manager', 'coach')
    ORDER BY p.first_name
  LOOP
    -- Loop over every active KPI configured for this org
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

      -- Look up prior week value for this rep+kpi to base trend on
      SELECT v.value INTO _prev_val
      FROM   kpi_values v
      WHERE  v.profile_id  = _rep.profile_id
        AND  v.kpi_id      = _kpi.kpi_id
        AND  v.period_start = _prev_ps
        AND  v.period_end   = _prev_pe
      LIMIT 1;

      IF _prev_val IS NOT NULL AND _prev_val > 0 THEN
        -- Drift between -12% and +15% from prior week (slight variation)
        _drift   := 0.88 + (random() * 0.27);   -- range: 0.88..1.15
        _new_val := round((_prev_val * _drift)::numeric, 1);
      ELSE
        -- No prior week data — generate from goal with wider spread
        -- Random multiplier between 0.55 and 1.25 of the goal
        _new_val := round((_kpi.goal * (0.55 + (random() * 0.70)))::numeric, 1);
      END IF;

      -- Floor at 0
      IF _new_val < 0 THEN _new_val := 0; END IF;

      -- For "lower is better" KPIs (like response_time, sales_cycle_days)
      -- keep values realistic — don't let them balloon
      IF _kpi.direction = 'lower' AND _new_val > _kpi.goal * 2.5 THEN
        _new_val := round((_kpi.goal * (0.70 + random() * 0.80))::numeric, 1);
      END IF;

      -- Integer rounding for count-based KPIs
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

  RAISE NOTICE '[seed-119] Inserted % kpi_values rows for last week (% to %)', _inserted, _ps, _pe;
END $$;
