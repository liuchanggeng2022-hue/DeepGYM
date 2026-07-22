-- DeepGYM periodic training plans and plan-aware workout snapshots.

CREATE TABLE IF NOT EXISTS public.training_plans (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(trim(name)) BETWEEN 1 AND 50),
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.training_plan_days (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id text NOT NULL,
  weekday integer NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  title text NOT NULL CHECK (char_length(trim(title)) BETWEEN 1 AND 30),
  position integer NOT NULL CHECK (position >= 0),
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (id, user_id),
  FOREIGN KEY (plan_id, user_id) REFERENCES public.training_plans(id, user_id) ON DELETE CASCADE,
  UNIQUE (plan_id, weekday)
);

CREATE TABLE IF NOT EXISTS public.training_plan_exercises (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_day_id text NOT NULL,
  exercise_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  target_sets integer NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
  target_reps_min integer NOT NULL CHECK (target_reps_min BETWEEN 1 AND 100),
  target_reps_max integer NOT NULL CHECK (target_reps_max BETWEEN target_reps_min AND 100),
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  FOREIGN KEY (plan_day_id, user_id) REFERENCES public.training_plan_days(id, user_id) ON DELETE CASCADE,
  UNIQUE (plan_day_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.training_plan_states (
  id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  active_plan_id text,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  CHECK (id = user_id::text),
  FOREIGN KEY (active_plan_id, user_id) REFERENCES public.training_plans(id, user_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS training_plans_user_updated_idx ON public.training_plans (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS training_plan_days_user_plan_idx ON public.training_plan_days (user_id, plan_id, position);
CREATE INDEX IF NOT EXISTS training_plan_exercises_user_day_idx ON public.training_plan_exercises (user_id, plan_day_id, position);

ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS source_plan_day_id text;
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS target_reps_min integer CHECK (target_reps_min IS NULL OR target_reps_min >= 1);
ALTER TABLE public.workout_exercises ADD COLUMN IF NOT EXISTS target_reps_max integer CHECK (target_reps_max IS NULL OR target_reps_max >= 1);

DO $$
BEGIN
  ALTER TABLE public.workout_exercises
    ADD CONSTRAINT workout_exercises_target_reps_order
    CHECK (target_reps_min IS NULL OR target_reps_max IS NULL OR target_reps_max >= target_reps_min);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['training_plans', 'training_plan_days', 'training_plan_exercises', 'training_plan_states']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_ignore_stale ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER %I_ignore_stale BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ignore_stale_client_write()', table_name, table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name, table_name);
  END LOOP;
END $$;

ALTER TABLE public.training_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_days ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_plan_states ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own training plans" ON public.training_plans;
CREATE POLICY "Users manage own training plans" ON public.training_plans FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own training plan days" ON public.training_plan_days;
CREATE POLICY "Users manage own training plan days" ON public.training_plan_days FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own training plan exercises" ON public.training_plan_exercises;
CREATE POLICY "Users manage own training plan exercises" ON public.training_plan_exercises FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own training plan state" ON public.training_plan_states;
CREATE POLICY "Users manage own training plan state" ON public.training_plan_states FOR ALL TO authenticated
USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plans TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plan_days TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plan_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.training_plan_states TO authenticated;
