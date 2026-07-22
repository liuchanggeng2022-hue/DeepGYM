ALTER TABLE workout_session ADD COLUMN companion_instance_id TEXT;
ALTER TABLE workout_session ADD COLUMN active_duration_seconds INTEGER NOT NULL DEFAULT 0 CHECK (active_duration_seconds >= 0);
ALTER TABLE workout_session ADD COLUMN end_reason TEXT CHECK (end_reason IN ('completed', 'early_stop'));

CREATE TABLE IF NOT EXISTS companion_instance (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  definition_id TEXT NOT NULL,
  definition_version INTEGER NOT NULL CHECK (definition_version >= 1),
  display_name TEXT NOT NULL CHECK (length(trim(display_name)) BETWEEN 1 AND 24),
  created_at TEXT NOT NULL,
  activated_at TEXT,
  current_stage TEXT NOT NULL CHECK (current_stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  highest_stage TEXT NOT NULL CHECK (highest_stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  growth_xp INTEGER NOT NULL DEFAULT 0 CHECK (growth_xp >= 0),
  bond_xp INTEGER NOT NULL DEFAULT 0 CHECK (bond_xp >= 0),
  level INTEGER NOT NULL DEFAULT 1 CHECK (level >= 1),
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_companion_instance_owner
  ON companion_instance (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS companion_state (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  active_companion_id TEXT REFERENCES companion_instance(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS companion_settings (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  text_prompts_enabled INTEGER NOT NULL DEFAULT 1 CHECK (text_prompts_enabled IN (0, 1)),
  interaction_frequency TEXT NOT NULL DEFAULT 'standard' CHECK (interaction_frequency IN ('low', 'standard', 'high')),
  animation_intensity INTEGER NOT NULL DEFAULT 2 CHECK (animation_intensity BETWEEN 0 AND 2),
  reduce_motion INTEGER NOT NULL DEFAULT 0 CHECK (reduce_motion IN (0, 1)),
  default_rest_seconds INTEGER NOT NULL DEFAULT 90 CHECK (default_rest_seconds BETWEEN 15 AND 600),
  recovery_mode INTEGER NOT NULL DEFAULT 0 CHECK (recovery_mode IN (0, 1)),
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE TABLE IF NOT EXISTS workout_feedback (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  rpe INTEGER CHECK (rpe IS NULL OR rpe BETWEEN 1 AND 10),
  feeling TEXT CHECK (feeling IS NULL OR feeling IN ('great', 'steady', 'tired', 'uncomfortable')),
  recovery TEXT CHECK (recovery IS NULL OR recovery IN ('recovered', 'mild_soreness', 'fatigued', 'pain')),
  recovery_recorded_at TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (owner_user_id, session_id)
);

CREATE TABLE IF NOT EXISTS companion_growth_event (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  companion_id TEXT NOT NULL REFERENCES companion_instance(id) ON DELETE CASCADE,
  source_type TEXT NOT NULL CHECK (source_type IN ('workout', 'weekly_balance', 'streak', 'recovery', 'adjustment')),
  source_id TEXT NOT NULL,
  rule_version INTEGER NOT NULL CHECK (rule_version >= 1),
  xp_delta INTEGER NOT NULL,
  bond_delta INTEGER NOT NULL,
  reason TEXT NOT NULL,
  breakdown_json TEXT,
  occurred_at TEXT NOT NULL,
  reversed_at TEXT,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (companion_id, source_type, source_id, rule_version)
);

CREATE INDEX IF NOT EXISTS idx_companion_growth_owner_time
  ON companion_growth_event (owner_user_id, companion_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS companion_milestone (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  companion_id TEXT NOT NULL REFERENCES companion_instance(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('created', 'first_workout', 'streak', 'workout_count', 'record', 'evolution', 'unlock')),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  stage TEXT NOT NULL CHECK (stage IN ('initial', 'adaptation', 'growth', 'strength', 'mature', 'final')),
  occurred_at TEXT NOT NULL,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_companion_milestone_owner_time
  ON companion_milestone (owner_user_id, companion_id, occurred_at DESC);

CREATE TABLE IF NOT EXISTS companion_unlock (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  companion_id TEXT NOT NULL REFERENCES companion_instance(id) ON DELETE CASCADE,
  unlock_key TEXT NOT NULL,
  unlocked_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (companion_id, unlock_key)
);

CREATE TABLE IF NOT EXISTS workout_runtime_state (
  session_id TEXT PRIMARY KEY NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  workout_exercise_id TEXT,
  set_id TEXT,
  motion_family TEXT,
  phase TEXT NOT NULL CHECK (phase IN ('idle', 'preparing', 'working', 'resting', 'paused', 'completed', 'aborted')),
  phase_started_at TEXT,
  rest_ends_at TEXT,
  accumulated_active_seconds INTEGER NOT NULL DEFAULT 0 CHECK (accumulated_active_seconds >= 0),
  updated_at TEXT NOT NULL
);

DROP INDEX IF EXISTS idx_sync_outbox_owner_time;
ALTER TABLE sync_outbox RENAME TO sync_outbox_v3;

CREATE TABLE sync_outbox (
  owner_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN (
    'session', 'exercise', 'set', 'plan', 'plan_day', 'plan_exercise', 'plan_state',
    'companion', 'companion_state', 'companion_settings', 'workout_feedback', 'growth_event', 'milestone', 'unlock'
  )),
  entity_id TEXT NOT NULL,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_user_id, entity_type, entity_id)
);

INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
SELECT owner_user_id, entity_type, entity_id, queued_at FROM sync_outbox_v3;
DROP TABLE sync_outbox_v3;

CREATE INDEX IF NOT EXISTS idx_sync_outbox_owner_time
  ON sync_outbox (owner_user_id, queued_at);

CREATE TRIGGER trg_companion_queue_insert AFTER INSERT ON companion_instance BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_companion_queue_update AFTER UPDATE ON companion_instance BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_companion_state_queue_insert AFTER INSERT ON companion_state BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion_state', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_companion_state_queue_update AFTER UPDATE ON companion_state BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion_state', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_companion_settings_queue_insert AFTER INSERT ON companion_settings BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion_settings', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_companion_settings_queue_update AFTER UPDATE ON companion_settings BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'companion_settings', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_workout_feedback_queue_insert AFTER INSERT ON workout_feedback BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'workout_feedback', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_workout_feedback_queue_update AFTER UPDATE ON workout_feedback BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'workout_feedback', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_growth_event_queue_insert AFTER INSERT ON companion_growth_event BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'growth_event', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_growth_event_queue_update AFTER UPDATE ON companion_growth_event BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'growth_event', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_milestone_queue_insert AFTER INSERT ON companion_milestone BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'milestone', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_milestone_queue_update AFTER UPDATE ON companion_milestone BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'milestone', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_unlock_queue_insert AFTER INSERT ON companion_unlock BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'unlock', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_unlock_queue_update AFTER UPDATE ON companion_unlock BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'unlock', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
