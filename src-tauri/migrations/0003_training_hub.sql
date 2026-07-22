ALTER TABLE workout_session ADD COLUMN source_plan_day_id TEXT;
ALTER TABLE workout_exercise ADD COLUMN target_reps_min INTEGER CHECK (target_reps_min IS NULL OR target_reps_min >= 1);
ALTER TABLE workout_exercise ADD COLUMN target_reps_max INTEGER CHECK (target_reps_max IS NULL OR target_reps_max >= 1);

CREATE TABLE IF NOT EXISTS training_plan (
  id TEXT PRIMARY KEY NOT NULL,
  owner_user_id TEXT NOT NULL,
  name TEXT NOT NULL CHECK (length(trim(name)) BETWEEN 1 AND 50),
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_training_plan_owner
  ON training_plan (owner_user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS training_plan_day (
  id TEXT PRIMARY KEY NOT NULL,
  plan_id TEXT NOT NULL REFERENCES training_plan(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  weekday INTEGER NOT NULL CHECK (weekday BETWEEN 1 AND 7),
  title TEXT NOT NULL CHECK (length(trim(title)) BETWEEN 1 AND 30),
  position INTEGER NOT NULL CHECK (position >= 0),
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (plan_id, weekday)
);

CREATE INDEX IF NOT EXISTS idx_training_plan_day_owner
  ON training_plan_day (owner_user_id, plan_id, position);

CREATE TABLE IF NOT EXISTS training_plan_exercise (
  id TEXT PRIMARY KEY NOT NULL,
  plan_day_id TEXT NOT NULL REFERENCES training_plan_day(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  target_sets INTEGER NOT NULL CHECK (target_sets BETWEEN 1 AND 20),
  target_reps_min INTEGER NOT NULL CHECK (target_reps_min BETWEEN 1 AND 100),
  target_reps_max INTEGER NOT NULL CHECK (target_reps_max BETWEEN 1 AND 100 AND target_reps_max >= target_reps_min),
  updated_at TEXT NOT NULL,
  deleted_at TEXT,
  UNIQUE (plan_day_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_training_plan_exercise_owner
  ON training_plan_exercise (owner_user_id, plan_day_id, position);

CREATE TABLE IF NOT EXISTS training_plan_state (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  active_plan_id TEXT REFERENCES training_plan(id) ON DELETE SET NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

DROP TRIGGER IF EXISTS trg_session_queue_insert;
DROP TRIGGER IF EXISTS trg_session_queue_update;
DROP TRIGGER IF EXISTS trg_exercise_queue_insert;
DROP TRIGGER IF EXISTS trg_exercise_queue_update;
DROP TRIGGER IF EXISTS trg_set_queue_insert;
DROP TRIGGER IF EXISTS trg_set_queue_update;
DROP INDEX IF EXISTS idx_sync_outbox_owner_time;

ALTER TABLE sync_outbox RENAME TO sync_outbox_v2;

CREATE TABLE sync_outbox (
  owner_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('session', 'exercise', 'set', 'plan', 'plan_day', 'plan_exercise', 'plan_state')),
  entity_id TEXT NOT NULL,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_user_id, entity_type, entity_id)
);

INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
SELECT owner_user_id, entity_type, entity_id, queued_at FROM sync_outbox_v2;
DROP TABLE sync_outbox_v2;

CREATE INDEX IF NOT EXISTS idx_sync_outbox_owner_time
  ON sync_outbox (owner_user_id, queued_at);

CREATE TRIGGER trg_session_queue_insert AFTER INSERT ON workout_session WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'session', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_session_queue_update AFTER UPDATE ON workout_session WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'session', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_exercise_queue_insert AFTER INSERT ON workout_exercise WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_exercise_queue_update AFTER UPDATE ON workout_exercise WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_set_queue_insert AFTER INSERT ON workout_set WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'set', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_set_queue_update AFTER UPDATE ON workout_set WHEN NEW.owner_user_id IS NOT NULL BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'set', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER trg_plan_queue_insert AFTER INSERT ON training_plan BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_queue_update AFTER UPDATE ON training_plan BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_day_queue_insert AFTER INSERT ON training_plan_day BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_day', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_day_queue_update AFTER UPDATE ON training_plan_day BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_day', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_exercise_queue_insert AFTER INSERT ON training_plan_exercise BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_exercise_queue_update AFTER UPDATE ON training_plan_exercise BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_state_queue_insert AFTER INSERT ON training_plan_state BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_state', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
CREATE TRIGGER trg_plan_state_queue_update AFTER UPDATE ON training_plan_state BEGIN
  INSERT INTO sync_outbox VALUES (NEW.owner_user_id, 'plan_state', NEW.owner_user_id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
