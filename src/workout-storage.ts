import type Database from "@tauri-apps/plugin-sql";
import type {
  AddExerciseResult,
  CloudPlannedExercise,
  CloudTrainingPlan,
  CloudTrainingPlanDay,
  CloudTrainingPlanState,
  CloudWorkoutExercise,
  CloudWorkoutSession,
  CloudWorkoutSet,
  SyncBatch,
  SyncEntityType,
  TrainingPlan,
  TrainingPlanDay,
  TrainingPlanInput,
  TrainingPlanState,
  WorkoutExercise,
  WorkoutRepository,
  WorkoutSession,
  WorkoutSessionStatus,
  WorkoutSet,
} from "./workout-types";

const DATABASE_URL = "sqlite:deepgym.db";
const LEGACY_BROWSER_STORAGE_KEY = "deepgym.workouts.v1";
const BROWSER_DEVICE_KEY = "deepgym.device-id";
const DEFAULT_SET_COUNT = 3;

interface SessionRow {
  session_id: string;
  owner_user_id: string;
  started_at: string;
  ended_at: string | null;
  status: WorkoutSessionStatus;
  device_id: string | null;
  source_plan_day_id: string | null;
  companion_instance_id: string | null;
  active_duration_seconds: number;
  end_reason: WorkoutSession["endReason"];
  session_updated_at: string;
  session_deleted_at: string | null;
  workout_exercise_id: string | null;
  exercise_id: string | null;
  exercise_position: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  exercise_updated_at: string | null;
  exercise_deleted_at: string | null;
  set_id: string | null;
  set_position: number | null;
  weight_kg: number | null;
  reps: number | null;
  completed: number | null;
  completed_at: string | null;
  set_updated_at: string | null;
  set_deleted_at: string | null;
}

interface BrowserStore {
  sessions: WorkoutSession[];
  plans: TrainingPlan[];
  planState: TrainingPlanState;
}

interface PlanRow {
  plan_id: string;
  owner_user_id: string;
  plan_name: string;
  plan_updated_at: string;
  plan_deleted_at: string | null;
  day_id: string | null;
  weekday: number | null;
  day_title: string | null;
  day_position: number | null;
  day_updated_at: string | null;
  day_deleted_at: string | null;
  planned_exercise_id: string | null;
  planned_exercise_source_id: string | null;
  planned_exercise_position: number | null;
  target_sets: number | null;
  target_reps_min: number | null;
  target_reps_max: number | null;
  planned_exercise_updated_at: string | null;
  planned_exercise_deleted_at: string | null;
}

function now() {
  return new Date().toISOString();
}

function canonicalTimestamp(value: string) {
  const timestamp = new Date(value);
  return Number.isNaN(timestamp.getTime()) ? value : timestamp.toISOString();
}

function canonicalOptionalTimestamp(value: string | null) {
  return value ? canonicalTimestamp(value) : null;
}

function createId(prefix: string) {
  const random = typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  return `${prefix}_${random}`;
}

function createSet(position: number, updatedAt = now()): WorkoutSet {
  return {
    id: createId("set"),
    position,
    weightKg: null,
    reps: null,
    completed: false,
    completedAt: null,
    updatedAt,
    deletedAt: null,
  };
}

function createSets(updatedAt: string, count = DEFAULT_SET_COUNT) {
  return Array.from({ length: count }, (_, position) => createSet(position, updatedAt));
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function emptyPlanState(): TrainingPlanState {
  return { activePlanId: null, updatedAt: now() };
}

function hydratePlans(rows: PlanRow[]) {
  const plans = new Map<string, TrainingPlan>();
  const days = new Map<string, TrainingPlanDay>();
  for (const row of rows) {
    let plan = plans.get(row.plan_id);
    if (!plan) {
      plan = {
        id: row.plan_id,
        ownerUserId: row.owner_user_id,
        name: row.plan_name,
        updatedAt: row.plan_updated_at,
        deletedAt: row.plan_deleted_at,
        days: [],
      };
      plans.set(row.plan_id, plan);
    }
    if (!row.day_id || row.day_deleted_at || row.weekday === null || !row.day_title) continue;
    let day = days.get(row.day_id);
    if (!day) {
      day = {
        id: row.day_id,
        weekday: row.weekday,
        title: row.day_title,
        position: row.day_position || 0,
        updatedAt: row.day_updated_at || row.plan_updated_at,
        deletedAt: null,
        exercises: [],
      };
      days.set(row.day_id, day);
      plan.days.push(day);
    }
    if (!row.planned_exercise_id || row.planned_exercise_deleted_at || !row.planned_exercise_source_id) continue;
    day.exercises.push({
      id: row.planned_exercise_id,
      exerciseId: row.planned_exercise_source_id,
      position: row.planned_exercise_position || 0,
      targetSets: row.target_sets || 1,
      targetRepsMin: row.target_reps_min || 1,
      targetRepsMax: row.target_reps_max || 1,
      updatedAt: row.planned_exercise_updated_at || day.updatedAt,
      deletedAt: null,
    });
  }
  for (const plan of plans.values()) {
    plan.days.sort((a, b) => a.position - b.position);
    for (const day of plan.days) day.exercises.sort((a, b) => a.position - b.position);
  }
  return [...plans.values()];
}

function hydrateSessions(rows: SessionRow[]) {
  const sessions = new Map<string, WorkoutSession>();
  const exerciseMaps = new Map<string, Map<string, WorkoutExercise>>();

  for (const row of rows) {
    let session = sessions.get(row.session_id);
    if (!session) {
      session = {
        id: row.session_id,
        ownerUserId: row.owner_user_id,
        startedAt: row.started_at,
        endedAt: row.ended_at,
        status: row.status,
        deviceId: row.device_id,
        sourcePlanDayId: row.source_plan_day_id,
        companionInstanceId: row.companion_instance_id,
        activeDurationSeconds: row.active_duration_seconds || 0,
        endReason: row.end_reason,
        updatedAt: row.session_updated_at,
        deletedAt: row.session_deleted_at,
        exercises: [],
      };
      sessions.set(row.session_id, session);
      exerciseMaps.set(row.session_id, new Map());
    }

    if (!row.workout_exercise_id || !row.exercise_id || row.exercise_deleted_at) continue;
    const sessionExerciseMap = exerciseMaps.get(row.session_id)!;
    let workoutExercise = sessionExerciseMap.get(row.workout_exercise_id);
    if (!workoutExercise) {
      workoutExercise = {
        id: row.workout_exercise_id,
        exerciseId: row.exercise_id,
        position: row.exercise_position || 0,
        targetRepsMin: row.target_reps_min,
        targetRepsMax: row.target_reps_max,
        updatedAt: row.exercise_updated_at || row.session_updated_at,
        deletedAt: null,
        sets: [],
      };
      sessionExerciseMap.set(row.workout_exercise_id, workoutExercise);
      session.exercises.push(workoutExercise);
    }

    if (row.set_id && !row.set_deleted_at) {
      workoutExercise.sets.push({
        id: row.set_id,
        position: row.set_position || 0,
        weightKg: row.weight_kg,
        reps: row.reps,
        completed: row.completed === 1,
        completedAt: row.completed_at,
        updatedAt: row.set_updated_at || workoutExercise.updatedAt,
        deletedAt: null,
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
    s.owner_user_id,
    s.started_at,
    s.ended_at,
    s.status,
    s.device_id,
    s.source_plan_day_id,
    s.companion_instance_id,
    s.active_duration_seconds,
    s.end_reason,
    s.updated_at AS session_updated_at,
    s.deleted_at AS session_deleted_at,
    we.id AS workout_exercise_id,
    we.exercise_id,
    we.position AS exercise_position,
    we.target_reps_min,
    we.target_reps_max,
    we.updated_at AS exercise_updated_at,
    we.deleted_at AS exercise_deleted_at,
    ws.id AS set_id,
    ws.position AS set_position,
    ws.weight_kg,
    ws.reps,
    ws.completed,
    ws.completed_at,
    ws.updated_at AS set_updated_at,
    ws.deleted_at AS set_deleted_at
  FROM workout_session s
  LEFT JOIN workout_exercise we ON we.session_id = s.id AND we.deleted_at IS NULL
  LEFT JOIN workout_set ws ON ws.workout_exercise_id = we.id AND ws.deleted_at IS NULL
`;

const PLAN_SELECT = `
  SELECT
    p.id AS plan_id,
    p.owner_user_id,
    p.name AS plan_name,
    p.updated_at AS plan_updated_at,
    p.deleted_at AS plan_deleted_at,
    d.id AS day_id,
    d.weekday,
    d.title AS day_title,
    d.position AS day_position,
    d.updated_at AS day_updated_at,
    d.deleted_at AS day_deleted_at,
    pe.id AS planned_exercise_id,
    pe.exercise_id AS planned_exercise_source_id,
    pe.position AS planned_exercise_position,
    pe.target_sets,
    pe.target_reps_min,
    pe.target_reps_max,
    pe.updated_at AS planned_exercise_updated_at,
    pe.deleted_at AS planned_exercise_deleted_at
  FROM training_plan p
  LEFT JOIN training_plan_day d ON d.plan_id = p.id AND d.deleted_at IS NULL
  LEFT JOIN training_plan_exercise pe ON pe.plan_day_id = d.id AND pe.deleted_at IS NULL
`;

function validatePlanInput(input: TrainingPlanInput) {
  const name = input.name.trim();
  if (!name || name.length > 50) throw new Error("计划名称需要填写，且不能超过 50 个字符。");
  if (input.days.length < 1) throw new Error("请至少选择一个训练日。");
  const weekdays = new Set<number>();
  for (const day of input.days) {
    if (!Number.isInteger(day.weekday) || day.weekday < 1 || day.weekday > 7 || weekdays.has(day.weekday)) {
      throw new Error("每个星期只能安排一个训练日。");
    }
    weekdays.add(day.weekday);
    if (!day.title.trim() || day.title.trim().length > 30) throw new Error("训练日名称需要填写，且不能超过 30 个字符。");
    if (day.exercises.length < 1) throw new Error(`请为“${day.title.trim()}”至少添加一个动作。`);
    const exerciseIds = new Set<string>();
    for (const exercise of day.exercises) {
      if (!exercise.exerciseId || exerciseIds.has(exercise.exerciseId)) throw new Error("同一训练日不能重复添加动作。");
      exerciseIds.add(exercise.exerciseId);
      if (!Number.isInteger(exercise.targetSets) || exercise.targetSets < 1 || exercise.targetSets > 20) throw new Error("目标组数需要在 1–20 之间。");
      if (!Number.isInteger(exercise.targetRepsMin) || !Number.isInteger(exercise.targetRepsMax)
        || exercise.targetRepsMin < 1 || exercise.targetRepsMax > 100 || exercise.targetRepsMin > exercise.targetRepsMax) {
        throw new Error("目标次数需要在 1–100 之间，且下限不能大于上限。");
      }
    }
  }
  return name;
}

async function pendingEntry(db: Database, userId: string, entityType: SyncEntityType, entityId: string) {
  const rows = await db.select<Array<{ count: number }>>(
    "SELECT COUNT(*) AS count FROM sync_outbox WHERE owner_user_id = $1 AND entity_type = $2 AND entity_id = $3",
    [userId, entityType, entityId],
  );
  return (rows[0]?.count || 0) > 0;
}

class SqliteWorkoutRepository implements WorkoutRepository {
  readonly mode = "sqlite" as const;

  constructor(
    private readonly db: Database,
    readonly userId: string,
    readonly deviceId: string,
  ) {}

  async claimLegacyData() {
    const timestamp = now();
    await this.db.execute(
      `UPDATE workout_session
       SET owner_user_id = $1, device_id = COALESCE(device_id, $2), updated_at = $3
       WHERE owner_user_id IS NULL`,
      [this.userId, this.deviceId, timestamp],
    );
    await this.db.execute(
      `UPDATE workout_exercise
       SET owner_user_id = $1, updated_at = $2
       WHERE owner_user_id IS NULL
         AND session_id IN (SELECT id FROM workout_session WHERE owner_user_id = $1)`,
      [this.userId, timestamp],
    );
    await this.db.execute(
      `UPDATE workout_set
       SET owner_user_id = $1, updated_at = $2
       WHERE owner_user_id IS NULL
         AND workout_exercise_id IN (SELECT id FROM workout_exercise WHERE owner_user_id = $1)`,
      [this.userId, timestamp],
    );
  }

  async getActiveSession() {
    const sessions = await this.listActiveSessions();
    return sessions[0] || null;
  }

  async listActiveSessions() {
    const rows = await this.db.select<SessionRow[]>(`${SESSION_SELECT}
      WHERE s.owner_user_id = $1 AND s.status = 'active' AND s.deleted_at IS NULL
      ORDER BY s.updated_at DESC, we.position ASC, ws.position ASC
    `, [this.userId]);
    return hydrateSessions(rows);
  }

  async addExercise(exerciseId: string): Promise<AddExerciseResult> {
    let session = await this.getActiveSession();
    if (session) {
      const existing = session.exercises.find((item) => item.exerciseId === exerciseId);
      if (existing) return { session, alreadyPresent: true };
    }

    const timestamp = now();
    if (!session) {
      session = {
        id: createId("session"),
        ownerUserId: this.userId,
        startedAt: timestamp,
        endedAt: null,
        status: "active",
        deviceId: this.deviceId,
        sourcePlanDayId: null,
        companionInstanceId: null,
        activeDurationSeconds: 0,
        endReason: null,
        updatedAt: timestamp,
        deletedAt: null,
        exercises: [],
      };
      await this.db.execute(
        `INSERT INTO workout_session
          (id, started_at, owner_user_id, status, device_id, updated_at, deleted_at)
         VALUES ($1, $2, $3, 'active', $4, $5, NULL)`,
        [session.id, session.startedAt, this.userId, this.deviceId, timestamp],
      );
    }

    const removed = await this.db.select<Array<{ id: string }>>(
      `SELECT id FROM workout_exercise
       WHERE owner_user_id = $1 AND session_id = $2 AND exercise_id = $3 AND deleted_at IS NOT NULL`,
      [this.userId, session.id, exerciseId],
    );
    if (removed[0]) {
      await this.db.execute(
        "UPDATE workout_exercise SET deleted_at = NULL, updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
        [timestamp, removed[0].id, this.userId],
      );
      await this.db.execute(
        "UPDATE workout_set SET deleted_at = NULL, updated_at = $1 WHERE workout_exercise_id = $2 AND owner_user_id = $3",
        [timestamp, removed[0].id, this.userId],
      );
    } else {
      const workoutExerciseId = createId("exercise");
      await this.db.execute(
        `INSERT INTO workout_exercise
          (id, session_id, exercise_id, position, owner_user_id, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, NULL)`,
        [workoutExerciseId, session.id, exerciseId, session.exercises.length, this.userId, timestamp],
      );
      for (const set of createSets(timestamp)) {
        await this.db.execute(
          `INSERT INTO workout_set
            (id, workout_exercise_id, position, owner_user_id, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, NULL)`,
          [set.id, workoutExerciseId, set.position, this.userId, timestamp],
        );
      }
    }
    await this.touchSession(session.id, timestamp);
    return { session: (await this.getActiveSession())!, alreadyPresent: false };
  }

  async removeExercise(workoutExerciseId: string) {
    const rows = await this.db.select<Array<{ session_id: string }>>(
      "SELECT session_id FROM workout_exercise WHERE id = $1 AND owner_user_id = $2 AND deleted_at IS NULL",
      [workoutExerciseId, this.userId],
    );
    const sessionId = rows[0]?.session_id;
    if (!sessionId) return;
    const timestamp = now();
    await this.db.execute(
      "UPDATE workout_set SET deleted_at = $1, updated_at = $1 WHERE workout_exercise_id = $2 AND owner_user_id = $3 AND deleted_at IS NULL",
      [timestamp, workoutExerciseId, this.userId],
    );
    await this.db.execute(
      "UPDATE workout_exercise SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, workoutExerciseId, this.userId],
    );
    const count = await this.db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM workout_exercise WHERE session_id = $1 AND owner_user_id = $2 AND deleted_at IS NULL",
      [sessionId, this.userId],
    );
    if ((count[0]?.count || 0) === 0) {
      await this.db.execute(
        "UPDATE workout_session SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3 AND status = 'active'",
        [timestamp, sessionId, this.userId],
      );
    } else {
      await this.touchSession(sessionId, timestamp);
    }
  }

  async addSet(workoutExerciseId: string) {
    const positions = await this.db.select<Array<{ next_position: number; session_id: string }>>(
      `SELECT COALESCE(MAX(ws.position), -1) + 1 AS next_position, we.session_id
       FROM workout_exercise we
       LEFT JOIN workout_set ws ON ws.workout_exercise_id = we.id
       WHERE we.id = $1 AND we.owner_user_id = $2 AND we.deleted_at IS NULL`,
      [workoutExerciseId, this.userId],
    );
    const row = positions[0];
    if (!row?.session_id) return;
    const timestamp = now();
    await this.db.execute(
      `INSERT INTO workout_set
        (id, workout_exercise_id, position, owner_user_id, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, $5, NULL)`,
      [createId("set"), workoutExerciseId, row.next_position || 0, this.userId, timestamp],
    );
    await this.db.execute(
      "UPDATE workout_exercise SET updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, workoutExerciseId, this.userId],
    );
    await this.touchSession(row.session_id, timestamp);
  }

  async deleteSet(setId: string) {
    const rows = await this.db.select<Array<{ workout_exercise_id: string; session_id: string }>>(
      `SELECT ws.workout_exercise_id, we.session_id
       FROM workout_set ws JOIN workout_exercise we ON we.id = ws.workout_exercise_id
       WHERE ws.id = $1 AND ws.owner_user_id = $2 AND ws.deleted_at IS NULL`,
      [setId, this.userId],
    );
    if (!rows[0]) return;
    const timestamp = now();
    await this.db.execute(
      "UPDATE workout_set SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, setId, this.userId],
    );
    await this.db.execute(
      "UPDATE workout_exercise SET updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
      [timestamp, rows[0].workout_exercise_id, this.userId],
    );
    await this.touchSession(rows[0].session_id, timestamp);
  }

  async saveSets(sets: WorkoutSet[]) {
    const timestamp = now();
    const touchedSessions = new Set<string>();
    for (const set of sets) {
      const completed = Boolean(set.completed && set.reps && set.reps > 0);
      const rows = await this.db.select<Array<{ workout_exercise_id: string; session_id: string }>>(
        `SELECT ws.workout_exercise_id, we.session_id
         FROM workout_set ws JOIN workout_exercise we ON we.id = ws.workout_exercise_id
         WHERE ws.id = $1 AND ws.owner_user_id = $2 AND ws.deleted_at IS NULL`,
        [set.id, this.userId],
      );
      if (!rows[0]) continue;
      await this.db.execute(
        `UPDATE workout_set
         SET weight_kg = $1, reps = $2, completed = $3, completed_at = $4, updated_at = $5
         WHERE id = $6 AND owner_user_id = $7 AND deleted_at IS NULL`,
        [set.weightKg, set.reps, completed ? 1 : 0, completed ? set.completedAt : null, timestamp, set.id, this.userId],
      );
      await this.db.execute(
        "UPDATE workout_exercise SET updated_at = $1 WHERE id = $2 AND owner_user_id = $3",
        [timestamp, rows[0].workout_exercise_id, this.userId],
      );
      touchedSessions.add(rows[0].session_id);
    }
    for (const sessionId of touchedSessions) await this.touchSession(sessionId, timestamp);
  }

  async attachCompanion(sessionId: string, companionId: string) {
    const timestamp = now();
    await this.db.execute(
      `UPDATE workout_session SET companion_instance_id = COALESCE(companion_instance_id, $1), updated_at = $2
       WHERE id = $3 AND owner_user_id = $4 AND status = 'active' AND deleted_at IS NULL`,
      [companionId, timestamp, sessionId, this.userId],
    );
    const session = await this.getActiveSession();
    if (!session || session.id !== sessionId) throw new Error("没有找到正在进行的训练。");
    return session;
  }

  async completeSession(sessionId: string, endedAt: string, options: {
    endReason?: WorkoutSession["endReason"] extends infer T ? Exclude<T, null> : never;
    activeDurationSeconds?: number;
    companionInstanceId?: string | null;
  } = {}) {
    const counts = await this.db.select<Array<{ count: number }>>(
      `SELECT COUNT(*) AS count
       FROM workout_set ws
       JOIN workout_exercise we ON we.id = ws.workout_exercise_id
       JOIN workout_session s ON s.id = we.session_id
       WHERE s.id = $1 AND s.owner_user_id = $2 AND s.deleted_at IS NULL
         AND we.deleted_at IS NULL AND ws.deleted_at IS NULL AND ws.completed = 1 AND ws.reps >= 1`,
      [sessionId, this.userId],
    );
    if ((counts[0]?.count || 0) === 0) throw new Error("至少完成一组后才能结束训练。");
    await this.db.execute(
      `UPDATE workout_session
       SET ended_at = $1, status = 'completed', updated_at = $1,
           end_reason = $2, active_duration_seconds = MAX(active_duration_seconds, $3),
           companion_instance_id = COALESCE(companion_instance_id, $4)
       WHERE id = $5 AND owner_user_id = $6 AND status = 'active' AND deleted_at IS NULL`,
      [endedAt, options.endReason || "completed", Math.max(0, Math.round(options.activeDurationSeconds || 0)), options.companionInstanceId || null, sessionId, this.userId],
    );
  }

  async deleteSession(sessionId: string) {
    const timestamp = now();
    await this.db.execute(
      `UPDATE workout_session
       SET deleted_at = $1, updated_at = $1
       WHERE id = $2 AND owner_user_id = $3
         AND status IN ('completed', 'archived') AND deleted_at IS NULL`,
      [timestamp, sessionId, this.userId],
    );
  }

  async listHistory(limit = 100) {
    const rows = await this.db.select<SessionRow[]>(`
      WITH recent_sessions AS (
        SELECT id FROM workout_session
        WHERE owner_user_id = $1 AND status IN ('completed', 'archived') AND deleted_at IS NULL
        ORDER BY COALESCE(ended_at, updated_at) DESC
        LIMIT $2
      )
      ${SESSION_SELECT}
      WHERE s.id IN (SELECT id FROM recent_sessions)
      ORDER BY COALESCE(s.ended_at, s.updated_at) DESC, we.position ASC, ws.position ASC
    `, [this.userId, limit]);
    return hydrateSessions(rows);
  }

  async listCompletedSessionsBetween(startAt: string, endAt: string) {
    const rows = await this.db.select<SessionRow[]>(`${SESSION_SELECT}
      WHERE s.owner_user_id = $1 AND s.status = 'completed' AND s.deleted_at IS NULL
        AND s.ended_at >= $2 AND s.ended_at < $3
      ORDER BY s.ended_at DESC, we.position ASC, ws.position ASC
    `, [this.userId, startAt, endAt]);
    return hydrateSessions(rows);
  }

  async listTrainingPlans() {
    const rows = await this.db.select<PlanRow[]>(`${PLAN_SELECT}
      WHERE p.owner_user_id = $1 AND p.deleted_at IS NULL
      ORDER BY p.updated_at DESC, d.position ASC, pe.position ASC
    `, [this.userId]);
    return hydratePlans(rows);
  }

  async getTrainingPlanState() {
    const rows = await this.db.select<Array<{ active_plan_id: string | null; updated_at: string }>>(
      "SELECT active_plan_id, updated_at FROM training_plan_state WHERE owner_user_id = $1 AND deleted_at IS NULL",
      [this.userId],
    );
    return rows[0]
      ? { activePlanId: rows[0].active_plan_id, updatedAt: rows[0].updated_at }
      : emptyPlanState();
  }

  async saveTrainingPlan(input: TrainingPlanInput) {
    const name = validatePlanInput(input);
    const timestamp = now();
    const planId = input.id || createId("plan");
    await this.db.execute(
      `INSERT INTO training_plan (id, owner_user_id, name, updated_at, deleted_at)
       VALUES ($1, $2, $3, $4, NULL)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = NULL
       WHERE training_plan.owner_user_id = excluded.owner_user_id`,
      [planId, this.userId, name, timestamp],
    );
    await this.db.execute(
      "UPDATE training_plan_day SET deleted_at = $1, updated_at = $1 WHERE plan_id = $2 AND owner_user_id = $3 AND deleted_at IS NULL",
      [timestamp, planId, this.userId],
    );
    await this.db.execute(
      `UPDATE training_plan_exercise SET deleted_at = $1, updated_at = $1
       WHERE owner_user_id = $2 AND plan_day_id IN (SELECT id FROM training_plan_day WHERE plan_id = $3) AND deleted_at IS NULL`,
      [timestamp, this.userId, planId],
    );
    for (const [dayIndex, day] of input.days.entries()) {
      const matchingDays = day.id ? [] : await this.db.select<Array<{ id: string }>>(
        "SELECT id FROM training_plan_day WHERE plan_id = $1 AND owner_user_id = $2 AND weekday = $3 LIMIT 1",
        [planId, this.userId, day.weekday],
      );
      const dayId = day.id || matchingDays[0]?.id || createId("plan_day");
      await this.db.execute(
        `INSERT INTO training_plan_day
          (id, plan_id, owner_user_id, weekday, title, position, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NULL)
         ON CONFLICT(id) DO UPDATE SET weekday = excluded.weekday, title = excluded.title,
           position = excluded.position, updated_at = excluded.updated_at, deleted_at = NULL
         WHERE training_plan_day.owner_user_id = excluded.owner_user_id`,
        [dayId, planId, this.userId, day.weekday, day.title.trim(), dayIndex, timestamp],
      );
      for (const [exerciseIndex, exercise] of day.exercises.entries()) {
        const matchingExercises = exercise.id ? [] : await this.db.select<Array<{ id: string }>>(
          "SELECT id FROM training_plan_exercise WHERE plan_day_id = $1 AND owner_user_id = $2 AND exercise_id = $3 LIMIT 1",
          [dayId, this.userId, exercise.exerciseId],
        );
        const plannedExerciseId = exercise.id || matchingExercises[0]?.id || createId("plan_exercise");
        await this.db.execute(
          `INSERT INTO training_plan_exercise
            (id, plan_day_id, owner_user_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
           ON CONFLICT(id) DO UPDATE SET exercise_id = excluded.exercise_id, position = excluded.position,
             target_sets = excluded.target_sets, target_reps_min = excluded.target_reps_min,
             target_reps_max = excluded.target_reps_max, updated_at = excluded.updated_at, deleted_at = NULL
           WHERE training_plan_exercise.owner_user_id = excluded.owner_user_id`,
          [plannedExerciseId, dayId, this.userId, exercise.exerciseId, exerciseIndex, exercise.targetSets,
            exercise.targetRepsMin, exercise.targetRepsMax, timestamp],
        );
      }
    }
    const plan = (await this.listTrainingPlans()).find((item) => item.id === planId);
    if (!plan) throw new Error("训练计划保存失败。");
    return plan;
  }

  async duplicateTrainingPlan(planId: string) {
    const plan = (await this.listTrainingPlans()).find((item) => item.id === planId);
    if (!plan) throw new Error("没有找到要复制的训练计划。");
    return this.saveTrainingPlan({
      name: `${plan.name} 副本`.slice(0, 50),
      days: plan.days.map((day, position) => ({
        weekday: day.weekday,
        title: day.title,
        position,
        exercises: day.exercises.map((exercise, exercisePosition) => ({
          exerciseId: exercise.exerciseId,
          position: exercisePosition,
          targetSets: exercise.targetSets,
          targetRepsMin: exercise.targetRepsMin,
          targetRepsMax: exercise.targetRepsMax,
        })),
      })),
    });
  }

  async deleteTrainingPlan(planId: string) {
    const timestamp = now();
    await this.db.execute(
      "UPDATE training_plan SET deleted_at = $1, updated_at = $1 WHERE id = $2 AND owner_user_id = $3 AND deleted_at IS NULL",
      [timestamp, planId, this.userId],
    );
    await this.db.execute(
      "UPDATE training_plan_state SET active_plan_id = NULL, updated_at = $1 WHERE owner_user_id = $2 AND active_plan_id = $3",
      [timestamp, this.userId, planId],
    );
  }

  async setActiveTrainingPlan(planId: string | null) {
    if (planId && !(await this.listTrainingPlans()).some((plan) => plan.id === planId)) throw new Error("没有找到要启用的训练计划。");
    const timestamp = now();
    await this.db.execute(
      `INSERT INTO training_plan_state (owner_user_id, active_plan_id, updated_at, deleted_at)
       VALUES ($1, $2, $3, NULL)
       ON CONFLICT(owner_user_id) DO UPDATE SET active_plan_id = excluded.active_plan_id,
         updated_at = excluded.updated_at, deleted_at = NULL`,
      [this.userId, planId, timestamp],
    );
  }

  async startPlannedWorkout(planDayId: string) {
    const day = (await this.listTrainingPlans()).flatMap((plan) => plan.days).find((item) => item.id === planDayId);
    if (!day) throw new Error("没有找到要开始的计划训练日。");
    let session = await this.getActiveSession();
    const timestamp = now();
    if (!session) {
      const sessionId = createId("session");
      await this.db.execute(
        `INSERT INTO workout_session
          (id, started_at, owner_user_id, status, device_id, source_plan_day_id, updated_at, deleted_at)
         VALUES ($1, $2, $3, 'active', $4, $5, $6, NULL)`,
        [sessionId, timestamp, this.userId, this.deviceId, planDayId, timestamp],
      );
      session = (await this.getActiveSession())!;
    } else if (!session.sourcePlanDayId) {
      await this.db.execute(
        "UPDATE workout_session SET source_plan_day_id = $1, updated_at = $2 WHERE id = $3 AND owner_user_id = $4",
        [planDayId, timestamp, session.id, this.userId],
      );
    }
    const existingIds = new Set(session.exercises.map((exercise) => exercise.exerciseId));
    let nextPosition = session.exercises.length;
    for (const planned of day.exercises) {
      if (existingIds.has(planned.exerciseId)) continue;
      const workoutExerciseId = createId("exercise");
      await this.db.execute(
        `INSERT INTO workout_exercise
          (id, session_id, exercise_id, position, owner_user_id, target_reps_min, target_reps_max, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NULL)`,
        [workoutExerciseId, session.id, planned.exerciseId, nextPosition++, this.userId,
          planned.targetRepsMin, planned.targetRepsMax, timestamp],
      );
      for (const set of createSets(timestamp, planned.targetSets)) {
        await this.db.execute(
          `INSERT INTO workout_set (id, workout_exercise_id, position, owner_user_id, updated_at, deleted_at)
           VALUES ($1, $2, $3, $4, $5, NULL)`,
          [set.id, workoutExerciseId, set.position, this.userId, timestamp],
        );
      }
    }
    await this.touchSession(session.id, timestamp);
    return (await this.getActiveSession())!;
  }

  async getSyncBatch(): Promise<SyncBatch> {
    const sessions = await this.db.select<CloudWorkoutSession[]>(
      `SELECT s.id, s.owner_user_id AS user_id, s.started_at, s.ended_at, s.status, s.device_id,
              s.source_plan_day_id, s.companion_instance_id, s.active_duration_seconds, s.end_reason,
              s.updated_at AS client_updated_at, s.deleted_at
       FROM workout_session s
       JOIN sync_outbox o ON o.entity_id = s.id AND o.entity_type = 'session' AND o.owner_user_id = s.owner_user_id
       WHERE s.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const exercises = await this.db.select<CloudWorkoutExercise[]>(
      `SELECT we.id, we.owner_user_id AS user_id, we.session_id, we.exercise_id, we.position,
              we.target_reps_min, we.target_reps_max, we.updated_at AS client_updated_at, we.deleted_at
       FROM workout_exercise we
       JOIN sync_outbox o ON o.entity_id = we.id AND o.entity_type = 'exercise' AND o.owner_user_id = we.owner_user_id
       WHERE we.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const sets = await this.db.select<Array<Omit<CloudWorkoutSet, "completed"> & { completed: number }>>(
      `SELECT ws.id, ws.owner_user_id AS user_id, ws.workout_exercise_id, ws.position,
              ws.weight_kg, ws.reps, ws.completed, ws.completed_at,
              ws.updated_at AS client_updated_at, ws.deleted_at
       FROM workout_set ws
       JOIN sync_outbox o ON o.entity_id = ws.id AND o.entity_type = 'set' AND o.owner_user_id = ws.owner_user_id
       WHERE ws.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const plans = await this.db.select<CloudTrainingPlan[]>(
      `SELECT p.id, p.owner_user_id AS user_id, p.name, p.updated_at AS client_updated_at, p.deleted_at
       FROM training_plan p JOIN sync_outbox o ON o.entity_id = p.id AND o.entity_type = 'plan' AND o.owner_user_id = p.owner_user_id
       WHERE p.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const planDays = await this.db.select<CloudTrainingPlanDay[]>(
      `SELECT d.id, d.owner_user_id AS user_id, d.plan_id, d.weekday, d.title, d.position,
              d.updated_at AS client_updated_at, d.deleted_at
       FROM training_plan_day d JOIN sync_outbox o ON o.entity_id = d.id AND o.entity_type = 'plan_day' AND o.owner_user_id = d.owner_user_id
       WHERE d.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const planExercises = await this.db.select<CloudPlannedExercise[]>(
      `SELECT pe.id, pe.owner_user_id AS user_id, pe.plan_day_id, pe.exercise_id, pe.position,
              pe.target_sets, pe.target_reps_min, pe.target_reps_max,
              pe.updated_at AS client_updated_at, pe.deleted_at
       FROM training_plan_exercise pe JOIN sync_outbox o ON o.entity_id = pe.id AND o.entity_type = 'plan_exercise' AND o.owner_user_id = pe.owner_user_id
       WHERE pe.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    const planStates = await this.db.select<CloudTrainingPlanState[]>(
      `SELECT ps.owner_user_id AS id, ps.owner_user_id AS user_id, ps.active_plan_id,
              ps.updated_at AS client_updated_at, ps.deleted_at
       FROM training_plan_state ps JOIN sync_outbox o ON o.entity_id = ps.owner_user_id
         AND o.entity_type = 'plan_state' AND o.owner_user_id = ps.owner_user_id
       WHERE ps.owner_user_id = $1 ORDER BY o.queued_at`,
      [this.userId],
    );
    return {
      sessions,
      exercises,
      sets: sets.map((set) => ({ ...set, completed: set.completed === 1 })),
      plans,
      planDays,
      planExercises,
      planStates,
    };
  }

  async markSynced(entityType: SyncEntityType, records: Array<{ id: string; client_updated_at: string }>) {
    const table = entityType === "session" ? "workout_session"
      : entityType === "exercise" ? "workout_exercise"
        : entityType === "set" ? "workout_set"
          : entityType === "plan" ? "training_plan"
            : entityType === "plan_day" ? "training_plan_day"
              : entityType === "plan_exercise" ? "training_plan_exercise"
                : "training_plan_state";
    const idColumn = entityType === "plan_state" ? "owner_user_id" : "id";
    for (const record of records) {
      await this.db.execute(
        `DELETE FROM sync_outbox
         WHERE owner_user_id = $1 AND entity_type = $2 AND entity_id = $3
           AND EXISTS (
             SELECT 1 FROM ${table}
             WHERE ${idColumn} = $3 AND owner_user_id = $1
               AND ABS(julianday(updated_at) - julianday($4)) < 0.00000001
           )`,
        [this.userId, entityType, record.id, record.client_updated_at],
      );
    }
  }

  async getPendingCount() {
    const rows = await this.db.select<Array<{ count: number }>>(
      "SELECT COUNT(*) AS count FROM sync_outbox WHERE owner_user_id = $1",
      [this.userId],
    );
    return rows[0]?.count || 0;
  }

  async getLastPulledAt() {
    const rows = await this.db.select<Array<{ last_pulled_at: string | null }>>(
      "SELECT last_pulled_at FROM sync_state WHERE owner_user_id = $1",
      [this.userId],
    );
    return rows[0]?.last_pulled_at || null;
  }

  async applyRemote(batch: SyncBatch) {
    for (const session of batch.sessions) {
      const clientUpdatedAt = canonicalTimestamp(session.client_updated_at);
      await this.db.execute(
        `INSERT INTO workout_session
          (id, started_at, ended_at, owner_user_id, status, device_id, source_plan_day_id,
           companion_instance_id, active_duration_seconds, end_reason, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
         ON CONFLICT(id) DO UPDATE SET
           started_at = excluded.started_at, ended_at = excluded.ended_at, owner_user_id = excluded.owner_user_id,
           status = excluded.status, device_id = excluded.device_id, source_plan_day_id = excluded.source_plan_day_id,
           companion_instance_id = excluded.companion_instance_id, active_duration_seconds = excluded.active_duration_seconds,
           end_reason = excluded.end_reason, updated_at = excluded.updated_at,
           deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = workout_session.owner_user_id
           AND excluded.updated_at >= workout_session.updated_at`,
        [
          session.id,
          canonicalTimestamp(session.started_at),
          canonicalOptionalTimestamp(session.ended_at),
          this.userId,
          session.status,
          session.device_id,
          session.source_plan_day_id,
          session.companion_instance_id,
          session.active_duration_seconds || 0,
          session.end_reason,
          clientUpdatedAt,
          canonicalOptionalTimestamp(session.deleted_at),
        ],
      );
      await this.finishRemoteApply("session", session.id, clientUpdatedAt, "workout_session");
    }
    for (const exercise of batch.exercises) {
      const clientUpdatedAt = canonicalTimestamp(exercise.client_updated_at);
      await this.db.execute(
        `INSERT INTO workout_exercise
          (id, session_id, exercise_id, position, owner_user_id, target_reps_min, target_reps_max, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT(id) DO UPDATE SET
           session_id = excluded.session_id, exercise_id = excluded.exercise_id, position = excluded.position,
           owner_user_id = excluded.owner_user_id, target_reps_min = excluded.target_reps_min,
           target_reps_max = excluded.target_reps_max, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = workout_exercise.owner_user_id
           AND excluded.updated_at >= workout_exercise.updated_at`,
        [
          exercise.id,
          exercise.session_id,
          exercise.exercise_id,
          exercise.position,
          this.userId,
          exercise.target_reps_min,
          exercise.target_reps_max,
          clientUpdatedAt,
          canonicalOptionalTimestamp(exercise.deleted_at),
        ],
      );
      await this.finishRemoteApply("exercise", exercise.id, clientUpdatedAt, "workout_exercise");
    }
    for (const set of batch.sets) {
      const clientUpdatedAt = canonicalTimestamp(set.client_updated_at);
      await this.db.execute(
        `INSERT INTO workout_set
          (id, workout_exercise_id, position, weight_kg, reps, completed, completed_at, owner_user_id, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET
           workout_exercise_id = excluded.workout_exercise_id, position = excluded.position,
           weight_kg = excluded.weight_kg, reps = excluded.reps, completed = excluded.completed,
           completed_at = excluded.completed_at, owner_user_id = excluded.owner_user_id,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = workout_set.owner_user_id
           AND excluded.updated_at >= workout_set.updated_at`,
        [
          set.id,
          set.workout_exercise_id,
          set.position,
          set.weight_kg,
          set.reps,
          set.completed ? 1 : 0,
          canonicalOptionalTimestamp(set.completed_at),
          this.userId,
          clientUpdatedAt,
          canonicalOptionalTimestamp(set.deleted_at),
        ],
      );
      await this.finishRemoteApply("set", set.id, clientUpdatedAt, "workout_set");
    }
    for (const plan of batch.plans) {
      const clientUpdatedAt = canonicalTimestamp(plan.client_updated_at);
      await this.db.execute(
        `INSERT INTO training_plan (id, owner_user_id, name, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT(id) DO UPDATE SET name = excluded.name, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = training_plan.owner_user_id AND excluded.updated_at >= training_plan.updated_at`,
        [plan.id, this.userId, plan.name, clientUpdatedAt, canonicalOptionalTimestamp(plan.deleted_at)],
      );
      await this.finishRemoteApply("plan", plan.id, clientUpdatedAt, "training_plan");
    }
    for (const day of batch.planDays) {
      const clientUpdatedAt = canonicalTimestamp(day.client_updated_at);
      await this.db.execute(
        `INSERT INTO training_plan_day
          (id, plan_id, owner_user_id, weekday, title, position, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT(id) DO UPDATE SET plan_id = excluded.plan_id, weekday = excluded.weekday,
           title = excluded.title, position = excluded.position, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = training_plan_day.owner_user_id AND excluded.updated_at >= training_plan_day.updated_at`,
        [day.id, day.plan_id, this.userId, day.weekday, day.title, day.position, clientUpdatedAt,
          canonicalOptionalTimestamp(day.deleted_at)],
      );
      await this.finishRemoteApply("plan_day", day.id, clientUpdatedAt, "training_plan_day");
    }
    for (const exercise of batch.planExercises) {
      const clientUpdatedAt = canonicalTimestamp(exercise.client_updated_at);
      await this.db.execute(
        `INSERT INTO training_plan_exercise
          (id, plan_day_id, owner_user_id, exercise_id, position, target_sets, target_reps_min, target_reps_max, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT(id) DO UPDATE SET plan_day_id = excluded.plan_day_id, exercise_id = excluded.exercise_id,
           position = excluded.position, target_sets = excluded.target_sets, target_reps_min = excluded.target_reps_min,
           target_reps_max = excluded.target_reps_max, updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.owner_user_id = training_plan_exercise.owner_user_id
           AND excluded.updated_at >= training_plan_exercise.updated_at`,
        [exercise.id, exercise.plan_day_id, this.userId, exercise.exercise_id, exercise.position,
          exercise.target_sets, exercise.target_reps_min, exercise.target_reps_max, clientUpdatedAt,
          canonicalOptionalTimestamp(exercise.deleted_at)],
      );
      await this.finishRemoteApply("plan_exercise", exercise.id, clientUpdatedAt, "training_plan_exercise");
    }
    for (const state of batch.planStates) {
      const clientUpdatedAt = canonicalTimestamp(state.client_updated_at);
      await this.db.execute(
        `INSERT INTO training_plan_state (owner_user_id, active_plan_id, updated_at, deleted_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT(owner_user_id) DO UPDATE SET active_plan_id = excluded.active_plan_id,
           updated_at = excluded.updated_at, deleted_at = excluded.deleted_at
         WHERE excluded.updated_at >= training_plan_state.updated_at`,
        [this.userId, state.active_plan_id, clientUpdatedAt, canonicalOptionalTimestamp(state.deleted_at)],
      );
      await this.finishRemoteApply("plan_state", state.id, clientUpdatedAt, "training_plan_state");
    }
  }

  async setLastSyncedAt(remoteCursor: string | null, syncedAt: string) {
    await this.db.execute(
      `INSERT INTO sync_state (owner_user_id, last_pulled_at, last_synced_at)
       VALUES ($1, $2, $3)
       ON CONFLICT(owner_user_id) DO UPDATE SET
         last_pulled_at = CASE
           WHEN excluded.last_pulled_at IS NULL THEN sync_state.last_pulled_at
           WHEN sync_state.last_pulled_at IS NULL OR excluded.last_pulled_at > sync_state.last_pulled_at THEN excluded.last_pulled_at
           ELSE sync_state.last_pulled_at
         END,
         last_synced_at = excluded.last_synced_at`,
      [this.userId, remoteCursor, syncedAt],
    );
  }

  async resolveActiveConflict(keepSessionId: string) {
    const timestamp = now();
    const active = await this.listActiveSessions();
    if (!active.some((session) => session.id === keepSessionId)) throw new Error("选择的训练记录已经不存在。");
    for (const session of active) {
      if (session.id === keepSessionId) continue;
      await this.db.execute(
        `UPDATE workout_session SET status = 'archived', ended_at = NULL, updated_at = $1
         WHERE id = $2 AND owner_user_id = $3 AND status = 'active'`,
        [timestamp, session.id, this.userId],
      );
    }
    await this.touchSession(keepSessionId, timestamp);
  }

  async clearUserData() {
    await this.db.execute("DELETE FROM sync_outbox WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM sync_state WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM training_plan_state WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM training_plan WHERE owner_user_id = $1", [this.userId]);
    await this.db.execute("DELETE FROM workout_session WHERE owner_user_id = $1", [this.userId]);
  }

  private async touchSession(sessionId: string, timestamp: string) {
    await this.db.execute(
      "UPDATE workout_session SET updated_at = $1 WHERE id = $2 AND owner_user_id = $3 AND deleted_at IS NULL",
      [timestamp, sessionId, this.userId],
    );
  }

  private async finishRemoteApply(
    entityType: SyncEntityType,
    entityId: string,
    remoteUpdatedAt: string,
    table: "workout_session" | "workout_exercise" | "workout_set" | "training_plan" | "training_plan_day" | "training_plan_exercise" | "training_plan_state",
  ) {
    const idColumn = table === "training_plan_state" ? "owner_user_id" : "id";
    const local = await this.db.select<Array<{ updated_at: string }>>(
      `SELECT updated_at FROM ${table} WHERE ${idColumn} = $1 AND owner_user_id = $2`,
      [entityId, this.userId],
    );
    if (local[0]?.updated_at === remoteUpdatedAt) {
      await this.markSynced(entityType, [{ id: entityId, client_updated_at: remoteUpdatedAt }]);
    } else if (!(await pendingEntry(this.db, this.userId, entityType, entityId))) {
      await this.db.execute(
        `INSERT INTO sync_outbox (owner_user_id, entity_type, entity_id, queued_at)
         VALUES ($1, $2, $3, CURRENT_TIMESTAMP)
         ON CONFLICT(owner_user_id, entity_type, entity_id) DO UPDATE SET queued_at = CURRENT_TIMESTAMP`,
        [this.userId, entityType, entityId],
      );
    }
  }
}

class BrowserPreviewWorkoutRepository implements WorkoutRepository {
  readonly mode = "browser-preview" as const;
  readonly deviceId: string;
  private readonly storageKey: string;

  constructor(readonly userId: string) {
    this.storageKey = `deepgym.workouts.v2.${userId}`;
    const existing = localStorage.getItem(BROWSER_DEVICE_KEY);
    this.deviceId = existing || createId("device");
    if (!existing) localStorage.setItem(BROWSER_DEVICE_KEY, this.deviceId);
  }

  async claimLegacyData() {
    if (localStorage.getItem(this.storageKey)) return;
    const legacy = localStorage.getItem(LEGACY_BROWSER_STORAGE_KEY);
    if (!legacy) return;
    try {
      const value = JSON.parse(legacy) as BrowserStore;
      const timestamp = now();
      const sessions = (value.sessions || []).map((session) => this.normalizeSession(session, timestamp));
      this.write({ sessions, plans: [], planState: emptyPlanState() });
      localStorage.removeItem(LEGACY_BROWSER_STORAGE_KEY);
    } catch {
      // Keep an unreadable legacy value untouched so it can be recovered manually.
    }
  }

  private normalizeSession(session: WorkoutSession, fallback: string): WorkoutSession {
    const status = session.status || (session.endedAt ? "completed" : "active");
    return {
      ...session,
      ownerUserId: this.userId,
      status,
      deviceId: session.deviceId || this.deviceId,
      sourcePlanDayId: session.sourcePlanDayId || null,
      companionInstanceId: session.companionInstanceId || null,
      activeDurationSeconds: session.activeDurationSeconds || 0,
      endReason: session.endReason || null,
      updatedAt: session.updatedAt || session.endedAt || session.startedAt || fallback,
      deletedAt: session.deletedAt || null,
      exercises: (session.exercises || []).map((exercise) => ({
        ...exercise,
        targetRepsMin: exercise.targetRepsMin || null,
        targetRepsMax: exercise.targetRepsMax || null,
        updatedAt: exercise.updatedAt || fallback,
        deletedAt: exercise.deletedAt || null,
        sets: (exercise.sets || []).map((set) => ({
          ...set,
          updatedAt: set.updatedAt || set.completedAt || fallback,
          deletedAt: set.deletedAt || null,
        })),
      })),
    };
  }

  private read(): BrowserStore {
    try {
      const stored = localStorage.getItem(this.storageKey);
      if (!stored) return { sessions: [], plans: [], planState: emptyPlanState() };
      const value = JSON.parse(stored) as BrowserStore;
      return {
        sessions: Array.isArray(value.sessions) ? value.sessions.map((session) => this.normalizeSession(session, now())) : [],
        plans: Array.isArray(value.plans) ? value.plans : [],
        planState: value.planState || emptyPlanState(),
      };
    } catch {
      return { sessions: [], plans: [], planState: emptyPlanState() };
    }
  }

  private write(store: BrowserStore) {
    localStorage.setItem(this.storageKey, JSON.stringify(store));
  }

  async getActiveSession() {
    const sessions = await this.listActiveSessions();
    return sessions[0] || null;
  }

  async listActiveSessions() {
    return clone(this.read().sessions
      .filter((item) => item.status === "active" && !item.deletedAt)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async addExercise(exerciseId: string): Promise<AddExerciseResult> {
    const store = this.read();
    let session = store.sessions.find((item) => item.status === "active" && !item.deletedAt);
    const timestamp = now();
    if (!session) {
      session = {
        id: createId("session"), ownerUserId: this.userId, startedAt: timestamp, endedAt: null,
        status: "active", deviceId: this.deviceId, sourcePlanDayId: null, companionInstanceId: null,
        activeDurationSeconds: 0, endReason: null, updatedAt: timestamp, deletedAt: null, exercises: [],
      };
      store.sessions.push(session);
    }
    if (session.exercises.some((item) => item.exerciseId === exerciseId && !item.deletedAt)) {
      return { session: clone(session), alreadyPresent: true };
    }
    const removed = session.exercises.find((item) => item.exerciseId === exerciseId && item.deletedAt);
    if (removed) {
      removed.deletedAt = null;
      removed.updatedAt = timestamp;
      removed.sets.forEach((set) => { set.deletedAt = null; set.updatedAt = timestamp; });
    } else {
      session.exercises.push({
        id: createId("exercise"), exerciseId, position: session.exercises.length,
        targetRepsMin: null, targetRepsMax: null,
        updatedAt: timestamp, deletedAt: null, sets: createSets(timestamp),
      });
    }
    session.updatedAt = timestamp;
    this.write(store);
    return { session: clone(session), alreadyPresent: false };
  }

  async removeExercise(workoutExerciseId: string) {
    const store = this.read();
    const session = store.sessions.find((item) => item.exercises.some((exercise) => exercise.id === workoutExerciseId));
    if (!session) return;
    const timestamp = now();
    const exercise = session.exercises.find((item) => item.id === workoutExerciseId);
    if (!exercise) return;
    exercise.deletedAt = timestamp;
    exercise.updatedAt = timestamp;
    exercise.sets.forEach((set) => { set.deletedAt = timestamp; set.updatedAt = timestamp; });
    session.updatedAt = timestamp;
    if (!session.exercises.some((item) => !item.deletedAt)) session.deletedAt = timestamp;
    this.write(store);
  }

  async addSet(workoutExerciseId: string) {
    const store = this.read();
    for (const session of store.sessions) {
      const exercise = session.exercises.find((item) => item.id === workoutExerciseId && !item.deletedAt);
      if (!exercise) continue;
      const timestamp = now();
      const position = Math.max(-1, ...exercise.sets.map((set) => set.position)) + 1;
      exercise.sets.push(createSet(position, timestamp));
      exercise.updatedAt = timestamp;
      session.updatedAt = timestamp;
      this.write(store);
      return;
    }
  }

  async deleteSet(setId: string) {
    const store = this.read();
    const timestamp = now();
    for (const session of store.sessions) {
      for (const exercise of session.exercises) {
        const set = exercise.sets.find((item) => item.id === setId && !item.deletedAt);
        if (!set) continue;
        set.deletedAt = timestamp;
        set.updatedAt = timestamp;
        exercise.updatedAt = timestamp;
        session.updatedAt = timestamp;
        this.write(store);
        return;
      }
    }
  }

  async saveSets(sets: WorkoutSet[]) {
    const updates = new Map(sets.map((set) => [set.id, set]));
    const store = this.read();
    const timestamp = now();
    for (const session of store.sessions) {
      let touched = false;
      for (const exercise of session.exercises) {
        exercise.sets = exercise.sets.map((set) => {
          const update = updates.get(set.id);
          if (!update) return set;
          touched = true;
          const completed = Boolean(update.completed && update.reps && update.reps > 0);
          return { ...update, completed, completedAt: completed ? update.completedAt : null, updatedAt: timestamp };
        });
        if (touched) exercise.updatedAt = timestamp;
      }
      if (touched) session.updatedAt = timestamp;
    }
    this.write(store);
  }

  async attachCompanion(sessionId: string, companionId: string) {
    const store = this.read();
    const session = store.sessions.find((item) => item.id === sessionId && item.status === "active" && !item.deletedAt);
    if (!session) throw new Error("没有找到正在进行的训练。");
    if (!session.companionInstanceId) session.companionInstanceId = companionId;
    session.updatedAt = now();
    this.write(store);
    return clone(session);
  }

  async completeSession(sessionId: string, endedAt: string, options: {
    endReason?: WorkoutSession["endReason"] extends infer T ? Exclude<T, null> : never;
    activeDurationSeconds?: number;
    companionInstanceId?: string | null;
  } = {}) {
    const store = this.read();
    const session = store.sessions.find((item) => item.id === sessionId && item.status === "active" && !item.deletedAt);
    if (!session) throw new Error("没有找到正在进行的训练。");
    if (!session.exercises.some((exercise) => !exercise.deletedAt && exercise.sets.some((set) => !set.deletedAt && set.completed && set.reps && set.reps > 0))) {
      throw new Error("至少完成一组后才能结束训练。");
    }
    session.endedAt = endedAt;
    session.status = "completed";
    session.endReason = options.endReason || "completed";
    session.activeDurationSeconds = Math.max(session.activeDurationSeconds || 0, Math.round(options.activeDurationSeconds || 0));
    session.companionInstanceId ||= options.companionInstanceId || null;
    session.updatedAt = endedAt;
    this.write(store);
  }

  async deleteSession(sessionId: string) {
    const store = this.read();
    const session = store.sessions.find((item) => item.id === sessionId
      && (item.status === "completed" || item.status === "archived")
      && !item.deletedAt);
    if (!session) return;
    const timestamp = now();
    session.deletedAt = timestamp;
    session.updatedAt = timestamp;
    this.write(store);
  }

  async listHistory(limit = 100) {
    return clone(this.read().sessions
      .filter((session) => !session.deletedAt && (session.status === "completed" || session.status === "archived"))
      .sort((a, b) => (b.endedAt || b.updatedAt).localeCompare(a.endedAt || a.updatedAt))
      .slice(0, limit));
  }

  async listCompletedSessionsBetween(startAt: string, endAt: string) {
    return clone(this.read().sessions
      .filter((session) => !session.deletedAt && session.status === "completed" && session.endedAt
        && session.endedAt >= startAt && session.endedAt < endAt)
      .sort((a, b) => (b.endedAt || b.updatedAt).localeCompare(a.endedAt || a.updatedAt)));
  }

  async listTrainingPlans() {
    return clone(this.read().plans.filter((plan) => !plan.deletedAt).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
  }

  async getTrainingPlanState() {
    return clone(this.read().planState);
  }

  async saveTrainingPlan(input: TrainingPlanInput) {
    const name = validatePlanInput(input);
    const store = this.read();
    const timestamp = now();
    const existing = input.id ? store.plans.find((plan) => plan.id === input.id) : null;
    const plan: TrainingPlan = {
      id: existing?.id || createId("plan"),
      ownerUserId: this.userId,
      name,
      updatedAt: timestamp,
      deletedAt: null,
      days: input.days.map((day, position) => ({
        id: day.id || createId("plan_day"),
        weekday: day.weekday,
        title: day.title.trim(),
        position,
        updatedAt: timestamp,
        deletedAt: null,
        exercises: day.exercises.map((exercise, exercisePosition) => ({
          id: exercise.id || createId("plan_exercise"),
          exerciseId: exercise.exerciseId,
          position: exercisePosition,
          targetSets: exercise.targetSets,
          targetRepsMin: exercise.targetRepsMin,
          targetRepsMax: exercise.targetRepsMax,
          updatedAt: timestamp,
          deletedAt: null,
        })),
      })),
    };
    if (existing) Object.assign(existing, plan);
    else store.plans.push(plan);
    this.write(store);
    return clone(plan);
  }

  async duplicateTrainingPlan(planId: string) {
    const plan = this.read().plans.find((item) => item.id === planId && !item.deletedAt);
    if (!plan) throw new Error("没有找到要复制的训练计划。");
    return this.saveTrainingPlan({
      name: `${plan.name} 副本`.slice(0, 50),
      days: plan.days.map((day, position) => ({
        weekday: day.weekday,
        title: day.title,
        position,
        exercises: day.exercises.map((exercise, exercisePosition) => ({
          exerciseId: exercise.exerciseId,
          position: exercisePosition,
          targetSets: exercise.targetSets,
          targetRepsMin: exercise.targetRepsMin,
          targetRepsMax: exercise.targetRepsMax,
        })),
      })),
    });
  }

  async deleteTrainingPlan(planId: string) {
    const store = this.read();
    const plan = store.plans.find((item) => item.id === planId && !item.deletedAt);
    if (!plan) return;
    const timestamp = now();
    plan.deletedAt = timestamp;
    plan.updatedAt = timestamp;
    if (store.planState.activePlanId === planId) store.planState = { activePlanId: null, updatedAt: timestamp };
    this.write(store);
  }

  async setActiveTrainingPlan(planId: string | null) {
    const store = this.read();
    if (planId && !store.plans.some((plan) => plan.id === planId && !plan.deletedAt)) throw new Error("没有找到要启用的训练计划。");
    store.planState = { activePlanId: planId, updatedAt: now() };
    this.write(store);
  }

  async startPlannedWorkout(planDayId: string) {
    const store = this.read();
    const day = store.plans.filter((plan) => !plan.deletedAt).flatMap((plan) => plan.days).find((item) => item.id === planDayId);
    if (!day) throw new Error("没有找到要开始的计划训练日。");
    const timestamp = now();
    let session = store.sessions.find((item) => item.status === "active" && !item.deletedAt);
    if (!session) {
      session = {
        id: createId("session"), ownerUserId: this.userId, startedAt: timestamp, endedAt: null,
        status: "active", deviceId: this.deviceId, sourcePlanDayId: planDayId,
        companionInstanceId: null, activeDurationSeconds: 0, endReason: null,
        updatedAt: timestamp, deletedAt: null, exercises: [],
      };
      store.sessions.push(session);
    } else if (!session.sourcePlanDayId) session.sourcePlanDayId = planDayId;
    const existingIds = new Set(session.exercises.filter((exercise) => !exercise.deletedAt).map((exercise) => exercise.exerciseId));
    for (const planned of day.exercises) {
      if (existingIds.has(planned.exerciseId)) continue;
      session.exercises.push({
        id: createId("exercise"),
        exerciseId: planned.exerciseId,
        position: session.exercises.length,
        targetRepsMin: planned.targetRepsMin,
        targetRepsMax: planned.targetRepsMax,
        updatedAt: timestamp,
        deletedAt: null,
        sets: createSets(timestamp, planned.targetSets),
      });
    }
    session.updatedAt = timestamp;
    this.write(store);
    return clone(session);
  }

  async getSyncBatch(): Promise<SyncBatch> {
    return { sessions: [], exercises: [], sets: [], plans: [], planDays: [], planExercises: [], planStates: [] };
  }
  async markSynced(_entityType: SyncEntityType, _records: Array<{ id: string; client_updated_at: string }>) {}
  async getPendingCount() { return 0; }
  async getLastPulledAt() { return null; }
  async applyRemote(_batch: SyncBatch) {}
  async setLastSyncedAt(_remoteCursor: string | null, _syncedAt: string) {}

  async resolveActiveConflict(keepSessionId: string) {
    const store = this.read();
    const timestamp = now();
    for (const session of store.sessions) {
      if (session.status !== "active" || session.id === keepSessionId) continue;
      session.status = "archived";
      session.endedAt = null;
      session.updatedAt = timestamp;
    }
    this.write(store);
  }

  async clearUserData() {
    localStorage.removeItem(this.storageKey);
  }
}

export async function createWorkoutRepository(userId: string): Promise<WorkoutRepository> {
  if (!userId) throw new Error("缺少当前账号，无法打开训练记录。");
  if (!("__TAURI_INTERNALS__" in window)) {
    const repository = new BrowserPreviewWorkoutRepository(userId);
    await repository.claimLegacyData();
    return repository;
  }
  const { default: DatabaseClass } = await import("@tauri-apps/plugin-sql");
  const db = await DatabaseClass.load(DATABASE_URL);
  await db.execute("PRAGMA foreign_keys = ON");
  const identities = await db.select<Array<{ id: string }>>("SELECT id FROM device_identity ORDER BY created_at LIMIT 1");
  const deviceId = identities[0]?.id || createId("device");
  if (!identities[0]) await db.execute("INSERT INTO device_identity (id) VALUES ($1)", [deviceId]);
  const repository = new SqliteWorkoutRepository(db, userId, deviceId);
  return repository;
}
