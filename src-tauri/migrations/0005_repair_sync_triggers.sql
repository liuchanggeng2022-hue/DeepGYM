-- Rebuilding sync_outbox in 0004 makes SQLite retarget existing trigger SQL to
-- the temporary table name. Recreate the workout and plan triggers so upgrades
-- from an existing DeepGYM database continue to queue changes normally.

DROP TRIGGER IF EXISTS trg_session_queue_insert;
DROP TRIGGER IF EXISTS trg_session_queue_update;
DROP TRIGGER IF EXISTS trg_exercise_queue_insert;
DROP TRIGGER IF EXISTS trg_exercise_queue_update;
DROP TRIGGER IF EXISTS trg_set_queue_insert;
DROP TRIGGER IF EXISTS trg_set_queue_update;
DROP TRIGGER IF EXISTS trg_plan_queue_insert;
DROP TRIGGER IF EXISTS trg_plan_queue_update;
DROP TRIGGER IF EXISTS trg_plan_day_queue_insert;
DROP TRIGGER IF EXISTS trg_plan_day_queue_update;
DROP TRIGGER IF EXISTS trg_plan_exercise_queue_insert;
DROP TRIGGER IF EXISTS trg_plan_exercise_queue_update;
DROP TRIGGER IF EXISTS trg_plan_state_queue_insert;
DROP TRIGGER IF EXISTS trg_plan_state_queue_update;

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
