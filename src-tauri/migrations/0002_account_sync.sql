DROP INDEX IF EXISTS idx_workout_session_single_active;

ALTER TABLE workout_session ADD COLUMN owner_user_id TEXT;
ALTER TABLE workout_session ADD COLUMN status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'completed', 'archived'));
ALTER TABLE workout_session ADD COLUMN device_id TEXT;
ALTER TABLE workout_session ADD COLUMN updated_at TEXT;
ALTER TABLE workout_session ADD COLUMN deleted_at TEXT;

ALTER TABLE workout_exercise ADD COLUMN owner_user_id TEXT;
ALTER TABLE workout_exercise ADD COLUMN updated_at TEXT;
ALTER TABLE workout_exercise ADD COLUMN deleted_at TEXT;

ALTER TABLE workout_set ADD COLUMN owner_user_id TEXT;
ALTER TABLE workout_set ADD COLUMN updated_at TEXT;
ALTER TABLE workout_set ADD COLUMN deleted_at TEXT;

UPDATE workout_session SET status = CASE WHEN ended_at IS NULL THEN 'active' ELSE 'completed' END;
UPDATE workout_session SET updated_at = COALESCE(created_at, CURRENT_TIMESTAMP);
UPDATE workout_exercise SET updated_at = CURRENT_TIMESTAMP;
UPDATE workout_set SET updated_at = COALESCE(completed_at, CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_workout_session_owner_status
  ON workout_session (owner_user_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workout_exercise_owner
  ON workout_exercise (owner_user_id, session_id, position);
CREATE INDEX IF NOT EXISTS idx_workout_set_owner
  ON workout_set (owner_user_id, workout_exercise_id, position);

CREATE TABLE IF NOT EXISTS sync_outbox (
  owner_user_id TEXT NOT NULL,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('session', 'exercise', 'set')),
  entity_id TEXT NOT NULL,
  queued_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (owner_user_id, entity_type, entity_id)
);

CREATE INDEX IF NOT EXISTS idx_sync_outbox_owner_time
  ON sync_outbox (owner_user_id, queued_at);

CREATE TABLE IF NOT EXISTS sync_state (
  owner_user_id TEXT PRIMARY KEY NOT NULL,
  last_pulled_at TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS device_identity (
  id TEXT PRIMARY KEY NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TRIGGER IF NOT EXISTS trg_session_queue_insert
AFTER INSERT ON workout_session
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'session', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_session_queue_update
AFTER UPDATE ON workout_session
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'session', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_exercise_queue_insert
AFTER INSERT ON workout_exercise
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_exercise_queue_update
AFTER UPDATE ON workout_exercise
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'exercise', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_set_queue_insert
AFTER INSERT ON workout_set
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'set', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;

CREATE TRIGGER IF NOT EXISTS trg_set_queue_update
AFTER UPDATE ON workout_set
WHEN NEW.owner_user_id IS NOT NULL
BEGIN
  INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
  VALUES (NEW.owner_user_id, 'set', NEW.id, CURRENT_TIMESTAMP)
  ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP;
END;
