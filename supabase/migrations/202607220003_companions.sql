-- DeepGYM companion MVP: instances, explainable growth ledger, feedback and rewards.

CREATE TABLE IF NOT EXISTS public.companion_instances (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  definition_id text NOT NULL,
  definition_version integer NOT NULL CHECK (definition_version >= 1),
  display_name text NOT NULL CHECK (char_length(trim(display_name)) BETWEEN 1 AND 24),
  created_at timestamptz NOT NULL,
  activated_at timestamptz,
  current_stage text NOT NULL CHECK (current_stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  highest_stage text NOT NULL CHECK (highest_stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  growth_xp integer NOT NULL DEFAULT 0 CHECK (growth_xp >= 0),
  bond_xp integer NOT NULL DEFAULT 0 CHECK (bond_xp >= 0),
  level integer NOT NULL DEFAULT 1 CHECK (level >= 1),
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (id, user_id)
);

CREATE TABLE IF NOT EXISTS public.companion_states (
  id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  active_companion_id text,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  CHECK (id = user_id::text),
  FOREIGN KEY (active_companion_id, user_id) REFERENCES public.companion_instances(id, user_id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS public.companion_settings (
  id text PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  text_prompts_enabled boolean NOT NULL DEFAULT true,
  interaction_frequency text NOT NULL DEFAULT 'standard' CHECK (interaction_frequency IN ('low', 'standard', 'high')),
  animation_intensity integer NOT NULL DEFAULT 2 CHECK (animation_intensity BETWEEN 0 AND 2),
  reduce_motion boolean NOT NULL DEFAULT false,
  default_rest_seconds integer NOT NULL DEFAULT 90 CHECK (default_rest_seconds BETWEEN 15 AND 600),
  recovery_mode boolean NOT NULL DEFAULT false,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  CHECK (id = user_id::text)
);

ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS companion_instance_id text;
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS active_duration_seconds integer NOT NULL DEFAULT 0 CHECK (active_duration_seconds >= 0);
ALTER TABLE public.workout_sessions ADD COLUMN IF NOT EXISTS end_reason text CHECK (end_reason IN ('completed', 'early_stop'));

DO $$ BEGIN
  ALTER TABLE public.workout_sessions ADD CONSTRAINT workout_sessions_companion_owner_fk
  FOREIGN KEY (companion_instance_id, user_id) REFERENCES public.companion_instances(id, user_id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS public.workout_feedback (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_id text NOT NULL,
  rpe integer CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  feeling text CHECK (feeling IS NULL OR feeling IN ('great', 'steady', 'tired', 'uncomfortable')),
  recovery text CHECK (recovery IS NULL OR recovery IN ('recovered', 'mild_soreness', 'fatigued', 'pain')),
  recovery_recorded_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  UNIQUE (user_id, session_id),
  FOREIGN KEY (session_id, user_id) REFERENCES public.workout_sessions(id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.companion_growth_events (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id text NOT NULL,
  source_type text NOT NULL CHECK (source_type IN ('workout', 'weekly_balance', 'streak', 'recovery', 'adjustment')),
  source_id text NOT NULL,
  rule_version integer NOT NULL CHECK (rule_version >= 1),
  xp_delta integer NOT NULL,
  bond_delta integer NOT NULL,
  reason text NOT NULL,
  breakdown jsonb,
  occurred_at timestamptz NOT NULL,
  reversed_at timestamptz,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  FOREIGN KEY (companion_id, user_id) REFERENCES public.companion_instances(id, user_id) ON DELETE CASCADE,
  UNIQUE (companion_id, source_type, source_id, rule_version)
);

CREATE TABLE IF NOT EXISTS public.companion_milestones (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('created', 'first_workout', 'streak', 'workout_count', 'record', 'evolution', 'unlock')),
  title text NOT NULL,
  description text NOT NULL,
  stage text NOT NULL CHECK (stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  occurred_at timestamptz NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  FOREIGN KEY (companion_id, user_id) REFERENCES public.companion_instances(id, user_id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS public.companion_unlocks (
  id text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  companion_id text NOT NULL,
  unlock_key text NOT NULL,
  unlocked_at timestamptz NOT NULL,
  client_updated_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT timezone('utc', now()),
  deleted_at timestamptz,
  FOREIGN KEY (companion_id, user_id) REFERENCES public.companion_instances(id, user_id) ON DELETE CASCADE,
  UNIQUE (companion_id, unlock_key)
);

CREATE INDEX IF NOT EXISTS companion_instances_user_updated_idx ON public.companion_instances (user_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS companion_growth_user_time_idx ON public.companion_growth_events (user_id, companion_id, occurred_at DESC);
CREATE INDEX IF NOT EXISTS companion_milestones_user_time_idx ON public.companion_milestones (user_id, companion_id, occurred_at DESC);

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['companion_instances', 'companion_states', 'companion_settings', 'workout_feedback', 'companion_growth_events', 'companion_milestones', 'companion_unlocks']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS %I_ignore_stale ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER %I_ignore_stale BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.ignore_stale_client_write()', table_name, table_name);
    EXECUTE format('DROP TRIGGER IF EXISTS %I_set_updated_at ON public.%I', table_name, table_name);
    EXECUTE format('CREATE TRIGGER %I_set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', table_name, table_name);
  END LOOP;
END $$;

DO $$
DECLARE table_name text;
BEGIN
  FOREACH table_name IN ARRAY ARRAY['companion_instances', 'companion_states', 'companion_settings', 'workout_feedback', 'companion_growth_events', 'companion_milestones', 'companion_unlocks']
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', table_name);
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own %s" ON public.%I', table_name, table_name);
    EXECUTE format('CREATE POLICY "Users manage own %s" ON public.%I FOR ALL TO authenticated USING ((SELECT auth.uid()) = user_id) WITH CHECK ((SELECT auth.uid()) = user_id)', table_name, table_name);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', table_name);
  END LOOP;
END $$;
