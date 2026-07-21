CREATE TABLE IF NOT EXISTS workout_session (
  id TEXT PRIMARY KEY NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CHECK (ended_at IS NULL OR ended_at >= started_at)
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_workout_session_single_active
  ON workout_session ((1))
  WHERE ended_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_workout_session_ended_at
  ON workout_session (ended_at DESC);

CREATE TABLE IF NOT EXISTS workout_exercise (
  id TEXT PRIMARY KEY NOT NULL,
  session_id TEXT NOT NULL REFERENCES workout_session(id) ON DELETE CASCADE,
  exercise_id TEXT NOT NULL,
  position INTEGER NOT NULL CHECK (position >= 0),
  UNIQUE (session_id, exercise_id)
);

CREATE INDEX IF NOT EXISTS idx_workout_exercise_session
  ON workout_exercise (session_id, position);

CREATE TABLE IF NOT EXISTS workout_set (
  id TEXT PRIMARY KEY NOT NULL,
  workout_exercise_id TEXT NOT NULL REFERENCES workout_exercise(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position >= 0),
  weight_kg REAL CHECK (weight_kg IS NULL OR weight_kg >= 0),
  reps INTEGER CHECK (reps IS NULL OR reps >= 0),
  completed INTEGER NOT NULL DEFAULT 0 CHECK (completed IN (0, 1)),
  completed_at TEXT,
  UNIQUE (workout_exercise_id, position)
);

CREATE INDEX IF NOT EXISTS idx_workout_set_exercise
  ON workout_set (workout_exercise_id, position);
