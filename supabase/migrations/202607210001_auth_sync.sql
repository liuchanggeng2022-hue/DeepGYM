-- DeepGYM hosted schema. Run in the Supabase SQL editor for the Singapore project.

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.ignore_stale_client_write()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = ''
AS $$
BEGIN
  IF NEW.client_updated_at < OLD.client_updated_at THEN
    RETURN NULL;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TABLE IF NOT EXISTS public.workout_sessions (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived')),
  device_id text,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (id, user_id),
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE TABLE IF NOT EXISTS public.workout_exercises (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  exercise_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (id, user_id),
  FOREIGN KEY (session_id, user_id) REFERENCES public.workout_sessions(id, user_id) ON DELETE CASCADE,
  UNIQUE (session_id, exercise_id)
);

CREATE TABLE IF NOT EXISTS public.workout_sets (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  workout_exercise_id text NOT NULL,
  position integer NOT NULL CHECK (position >= 0),
  weight_kg double precision CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps integer CHECK (reps IS NULL OR reps >= 0),
  completed boolean NOT NULL DEFAULT false,
  completed_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  FOREIGN KEY (workout_exercise_id, user_id) REFERENCES public.workout_exercises(id, user_id) ON DELETE CASCADE,
  UNIQUE (workout_exercise_id, position)
);

CREATE INDEX IF NOT EXISTS workout_sessions_user_updated_idx
  ON public.workout_sessions (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS workout_exercises_user_session_idx
  ON public.workout_exercises (user_id, session_id, position);
CREATE INDEX IF NOT EXISTS workout_sets_user_exercise_idx
  ON public.workout_sets (user_id, workout_exercise_id, position);

DROP TRIGGER IF EXISTS workout_sessions_ignore_stale ON public.workout_sessions;
CREATE TRIGGER workout_sessions_ignore_stale
BEFORE UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.ignore_stale_client_write();

DROP TRIGGER IF EXISTS workout_exercises_ignore_stale ON public.workout_exercises;
CREATE TRIGGER workout_exercises_ignore_stale
BEFORE UPDATE ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.ignore_stale_client_write();

DROP TRIGGER IF EXISTS workout_sets_ignore_stale ON public.workout_sets;
CREATE TRIGGER workout_sets_ignore_stale
BEFORE UPDATE ON public.workout_sets
FOR EACH ROW EXECUTE FUNCTION public.ignore_stale_client_write();

DROP TRIGGER IF EXISTS workout_sessions_set_updated_at ON public.workout_sessions;
CREATE TRIGGER workout_sessions_set_updated_at
BEFORE UPDATE ON public.workout_sessions
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workout_exercises_set_updated_at ON public.workout_exercises;
CREATE TRIGGER workout_exercises_set_updated_at
BEFORE UPDATE ON public.workout_exercises
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS workout_sets_set_updated_at ON public.workout_sets;
CREATE TRIGGER workout_sets_set_updated_at
BEFORE UPDATE ON public.workout_sets
FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own workout sessions" ON public.workout_sessions;
CREATE POLICY "Users manage own workout sessions"
ON public.workout_sessions FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own workout exercises" ON public.workout_exercises;
CREATE POLICY "Users manage own workout exercises"
ON public.workout_exercises FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users manage own workout sets" ON public.workout_sets;
CREATE POLICY "Users manage own workout sets"
ON public.workout_sets FOR ALL
TO authenticated
USING ((SELECT auth.uid()) = user_id)
WITH CHECK ((SELECT auth.uid()) = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sessions TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_exercises TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.workout_sets TO authenticated;
