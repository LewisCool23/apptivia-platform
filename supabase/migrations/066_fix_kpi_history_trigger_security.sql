-- Fix: kpi_metric_history trigger fails with RLS violation because it runs
-- in the client's auth context. Make it SECURITY DEFINER so it executes as
-- the function owner (postgres), bypassing RLS on the history table.

CREATE OR REPLACE FUNCTION fn_kpi_metrics_history()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER          -- ← runs as owner, not as the calling client
SET search_path = public  -- best practice with SECURITY DEFINER
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO kpi_metric_history (kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
    VALUES (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());
    RETURN NEW;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF NEW.goal IS DISTINCT FROM OLD.goal
       OR NEW.weight IS DISTINCT FROM OLD.weight
       OR NEW.show_on_scorecard IS DISTINCT FROM OLD.show_on_scorecard
       OR NEW.is_active IS DISTINCT FROM OLD.is_active
    THEN
      -- Close current history row
      UPDATE kpi_metric_history
        SET valid_to = now()
      WHERE kpi_id = NEW.id
        AND valid_to IS NULL;

      -- Open new history row
      INSERT INTO kpi_metric_history (kpi_id, goal, weight, show_on_scorecard, is_active, valid_from)
      VALUES (NEW.id, NEW.goal, NEW.weight, NEW.show_on_scorecard, NEW.is_active, now());
    END IF;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;
