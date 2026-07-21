import type Database from "@tauri-apps/plugin-sql";
import type {
  AddExerciseResult,
  WorkoutExercise,
  WorkoutRepository,
  WorkoutSession,
  WorkoutSet,
} from "./workout-types";

const DATABASE_URL = "sqlite:deepgym.db";
const BROWSER_STORAGE_KEY = "deepgym.workouts.v1";
const DEFAULT_SET_COUNT = 3;

interface SessionRow {
  session_id: string;
  started_at: string;
  ended_at: string | null;
  workout_exercise_id: string | null;
  exercise_id: string | null;
  exercise_position: number | null;
  set_id: string | null;
  set_position: number | null;
  weight_kg: number | null;
  reps: number | null;
  completed: number | null;
  completed_at: string | null;
}

function createId(prefix: string) {
  const random = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function createSet(position: number): WorkoutSet {
  return {
    id: createId("set"),
    position,
    weightKg: null,
    reps: null,
    completed: false,
    completedAt: null,
  };
}

function createSets(count = DEFAULT_SET_COUNT): WorkoutSet[] {
  return Array.from({ length: count }, (_, position) => createSet(position));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function hydrateSessions(rows: SessionRow[]) {
  const sessions = new Map<string, WorkoutSession>();
  const exerciseMaps = new Map<string, Map<string, WorkoutExercise>>();

  for (const row of rows) {
    let session = sessions.get(row.session_id);
    if (!session) {
      session = {
        id: row.session_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        exercises: [],
      };
      sessions.set(row.session_id, session);
      exerciseMaps.set(row.session_id, new Map());
    }

    if (!row.workout_exercise_id || !row.exercise_id) continue;
    const sessionExerciseMap = exerciseMaps.get(row.session_id)!;
    let workoutExercise = sessionExerciseMap.get(row.workout_exercise_id);
    if (!workoutExercise) {
      workoutExercise = {
        id: row.workout_exercise_id,
        exerciseId: row.exercise_id,
        position: row.exercise_position || 0,
        sets: [],
      };
      sessionExerciseMap.set(row.workout_exercise_id, workoutExercise);
      session.exercises.push(workoutExercise);
    }

    if (row.set_id) {
      workoutExercise.sets.push({
        id: row.set_id,
        position: row.set_position || 0,
        weightKg: row.weight_kg,
        reps: row.reps,
        completed: row.completed === 1,
        completedAt: row.completed_at,
      });
    }
  }

  for (const session of sessions.values()) {
    session.exercises.sort((a, b) => a.position - b.position);
    for (const exercise of session.exercises) exercise.sets.sort((a, b) => a.position - b.position);
  }

  return [...sessions.values()];
}

const SESSION_SELECT = `
  SELECT
    s.id AS session_id,
    s.started_at,
    s.ended_at,
    we.id AS workout_exercise_id,
    we.exercise_id,
    we.position AS exercise_position,
    ws.id AS set_id,
    ws.position AS set_position,
    ws.weight_kg,
    ws.reps,
    ws.completed,
    ws.completed_at
  FROM workout_session s
  LEFT JOIN workout_exercise we ON we.session_id = s.id
  LEFT JOIN workout_set ws ON ws.workout_exercise_id = we.id
`;

class SqliteWorkoutRepository implements WorkoutRepository {
  readonly mode = "sqlite" as const;

  constructor(private readonly db: Database) {}

  async getActiveSession() {
    const rows = await this.db.select<SessionRow[]>(`${SESSION_SELECT}
      WHERE s.ended_at IS NULL
      ORDER BY s.started_at DESC, we.position ASC, ws.position ASC
    `);
    return hydrateSessions(rows)[0] || null;
  }

  async addExercise(exerciseId: string): Promise<AddExerciseResult> {
    let session = await this.getActiveSession();
    if (session) {
      const existing = session.exercises.find((item) => item.exerciseId === exerciseId);
      if (existing) return { session, alreadyPresent: true };
    }

    let createdSession = false;
    if (!session) {
      session = { id: createId("session"), startedAt: new Date().toISOString(), endedAt: null, exercises: [] };
      await this.db.execute(
        "INSERT INTO workout_session (id, started_at) VALUES ($1, $2)",
        [session.id, session.startedAt],
      );
      createdSession = true;
    }

    const workoutExercise: WorkoutExercise = {
      id: createId("exercise"),
      exerciseId,
      position: session.exercises.length,
      sets: createSets(),
    };

    try {
      await this.db.execute(
        "INSERT INTO workout_exercise (id, session_id, exercise_id, position) VALUES ($1, $2, $3, $4)",
        [workoutExercise.id, session.id, exerciseId, workoutExercise.position],
      );
      for (const set of workoutExercise.sets) {
        await this.db.execute(
          "INSERT INTO workout_set (id, workout_exercise_id, position) VALUES ($1, $2, $3)",
          [set.id, workoutExercise.id, set.position],
        );
      }
    } catch (error) {
      await this.db.execute("DELETE FROM workout_exercise WHERE id = $1", [workoutExercise.id]);
      if (createdSession) await this.db.execute("DELETE FROM workout_session WHERE id = $1", [session.id]);
      throw error;
    }

    return { session: (await this.getActiveSession())!, alreadyPresent: false };
  }

  async removeExercise(workoutExerciseId: string) {
    const rows = await this.db.select<Array<{ session_id: string }>>(
      "SELECT session_id FROM workout_exercise WHERE id = $1",
      [workoutExerciseId],
    );
    await this.db.execute("DELETE FROM workout_exercise WHERE id = $1", [workoutExerciseId]);
    const sessionId = rows[0]?.session_id;
    if (!sessionId) return;
    const count = await this.db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM workout_exercise WHERE session_id = $1",
      [sessionId],
    );
    if ((count[0]?.count || 0) === 0) {
      await this.db.execute("DELETE FROM workout_session WHERE id = $1 AND ended_at IS NULL", [sessionId]);
    }
  }

  async addSet(workoutExerciseId: string) {
    const positions = await this.db.select<Array<{ next_position: number }>>(
      "SELECT COALESCE(MAX(position), -1) + 1 AS next_position FROM workout_set WHERE workout_exercise_id = $1",
      [workoutExerciseId],
    );
    await this.db.execute(
      "INSERT INTO workout_set (id, workout_exercise_id, position) VALUES ($1, $2, $3)",
      [createId("set"), workoutExerciseId, positions[0]?.next_position || 0],
    );
  }

  async deleteSet(setId: string) {
    await this.db.execute("DELETE FROM workout_set WHERE id = $1", [setId]);
  }

  async saveSets(sets: WorkoutSet[]) {
    for (const set of sets) {
      const completed = Boolean(set.completed && set.reps && set.reps > 0);
      await this.db.execute(
        `UPDATE workout_set
         SET weight_kg = $1, reps = $2, completed = $3, completed_at = $4
         WHERE id = $5`,
        [set.weightKg, set.reps, completed ? 1 : 0, completed ? set.completedAt : null, set.id],
      );
    }
  }

  async completeSession(sessionId: string, endedAt: string) {
    const counts = await this.db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) AS count
       FROM workout_set ws
       JOIN workout_exercise we ON we.id = ws.workout_exercise_id
       WHERE we.session_id = $1 AND ws.completed = 1 AND ws.reps >= 1`,
      [sessionId],
    );
    if ((counts[0]?.count || 0) === 0) throw new Error("至少完成一组后才能结束训练。");
    await this.db.execute(
      "UPDATE workout_session SET ended_at = $1 WHERE id = $2 AND ended_at IS NULL",
      [endedAt, sessionId],
    );
  }

  async listHistory(limit = 100) {
    const rows = await this.db.select<SessionRow[]>(`
      WITH recent_sessions AS (
        SELECT id, started_at, ended_at
        FROM workout_session
        WHERE ended_at IS NOT NULL
        ORDER BY ended_at DESC
        LIMIT $1
      )
      SELECT
        s.id AS session_id,
        s.started_at,
        s.ended_at,
        we.id AS workout_exercise_id,
        we.exercise_id,
        we.position AS exercise_position,
        ws.id AS set_id,
        ws.position AS set_position,
        ws.weight_kg,
        ws.reps,
        ws.completed,
        ws.completed_at
      FROM recent_sessions s
      LEFT JOIN workout_exercise we ON we.session_id = s.id
      LEFT JOIN workout_set ws ON ws.workout_exercise_id = we.id
      ORDER BY s.ended_at DESC, we.position ASC, ws.position ASC
    `, [limit]);
    return hydrateSessions(rows);
  }
}

interface BrowserStore {
  sessions: WorkoutSession[];
}

class BrowserPreviewWorkoutRepository implements WorkoutRepository {
  readonly mode = "browser-preview" as const;

  private read(): BrowserStore {
    try {
      const stored = localStorage.getItem(BROWSER_STORAGE_KEY);
      if (!stored) return { sessions: [] };
      const value = JSON.parse(stored) as BrowserStore;
      return Array.isArray(value.sessions) ? value : { sessions: [] };
    } catch {
      return { sessions: [] };
    }
  }

  private write(store: BrowserStore) {
    localStorage.setItem(BROWSER_STORAGE_KEY, JSON.stringify(store));
  }

  async getActiveSession() {
    const session = this.read().sessions.find((item) => !item.endedAt);
    return session ? clone(session) : null;
  }

  async addExercise(exerciseId: string): Promise<AddExerciseResult> {
    const store = this.read();
    let session = store.sessions.find((item) => !item.endedAt);
    if (!session) {
      session = { id: createId("session"), startedAt: new Date().toISOString(), endedAt: null, exercises: [] };
      store.sessions.push(session);
    }
    if (session.exercises.some((item) => item.exerciseId === exerciseId)) {
      return { session: clone(session), alreadyPresent: true };
    }
    session.exercises.push({
      id: createId("exercise"),
      exerciseId,
      position: session.exercises.length,
      sets: createSets(),
    });
    this.write(store);
    return { session: clone(session), alreadyPresent: false };
  }

  async removeExercise(workoutExerciseId: string) {
    const store = this.read();
    const session = store.sessions.find((item) => item.exercises.some((exercise) => exercise.id === workoutExerciseId));
    if (!session) return;
    session.exercises = session.exercises.filter((exercise) => exercise.id !== workoutExerciseId);
    if (session.exercises.length === 0 && !session.endedAt) {
      store.sessions = store.sessions.filter((item) => item.id !== session.id);
    }
    this.write(store);
  }

  async addSet(workoutExerciseId: string) {
    const store = this.read();
    for (const session of store.sessions) {
      const exercise = session.exercises.find((item) => item.id === workoutExerciseId);
      if (!exercise) continue;
      exercise.sets.push(createSet(exercise.sets.length));
      this.write(store);
      return;
    }
  }

  async deleteSet(setId: string) {
    const store = this.read();
    for (const session of store.sessions) {
      for (const exercise of session.exercises) exercise.sets = exercise.sets.filter((set) => set.id !== setId);
    }
    this.write(store);
  }

  async saveSets(sets: WorkoutSet[]) {
    const updates = new Map(sets.map((set) => {
      const completed = Boolean(set.completed && set.reps && set.reps > 0);
      return [set.id, { ...set, completed, completedAt: completed ? set.completedAt : null }];
    }));
    const store = this.read();
    for (const session of store.sessions) {
      for (const exercise of session.exercises) {
        exercise.sets = exercise.sets.map((set) => updates.has(set.id) ? clone(updates.get(set.id)!) : set);
      }
    }
    this.write(store);
  }

  async completeSession(sessionId: string, endedAt: string) {
    const store = this.read();
    const session = store.sessions.find((item) => item.id === sessionId && !item.endedAt);
    if (!session) throw new Error("没有找到正在进行的训练。");
    if (!session.exercises.some((exercise) => exercise.sets.some((set) => set.completed && set.reps && set.reps > 0))) {
      throw new Error("至少完成一组后才能结束训练。");
    }
    session.endedAt = endedAt;
    this.write(store);
  }

  async listHistory(limit = 100) {
    return clone(this.read().sessions
      .filter((session) => session.endedAt)
      .sort((a, b) => (b.endedAt || "").localeCompare(a.endedAt || ""))
      .slice(0, limit));
  }
}

export async function createWorkoutRepository(): Promise<WorkoutRepository> {
  if (!("__TAURI_INTERNALS__" in window)) return new BrowserPreviewWorkoutRepository();
  const { default: DatabaseClass } = await import("@tauri-apps/plugin-sql");
  const db = await DatabaseClass.load(DATABASE_URL);
  await db.execute("PRAGMA foreign_keys = ON");
  return new SqliteWorkoutRepository(db);
}
