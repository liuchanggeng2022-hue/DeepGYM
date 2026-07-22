import type { SupabaseClient } from "@supabase/supabase-js";
import type { CompanionRepository, CompanionSyncBatch } from "./companion-types";
import type {
  CloudPlannedExercise,
  CloudTrainingPlan,
  CloudTrainingPlanDay,
  CloudTrainingPlanState,
  CloudWorkoutExercise,
  CloudWorkoutSession,
  CloudWorkoutSet,
  SyncBatch,
  SyncState,
  WorkoutRepository,
} from "./workout-types";

type SyncListener = (state: SyncState) => void;

const INITIAL_STATE: SyncState = {
  status: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  conflicts: [],
};

function syncError(reason: unknown) {
  const details = reason && typeof reason === "object"
    ? reason as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    : null;
  const message = reason instanceof Error
    ? reason.message
    : [details?.message, details?.details, details?.hint, details?.code ? `错误代码 ${details.code}` : null]
        .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
        .join(" · ") || String(reason || "");
  if (message.toLowerCase().includes("failed to fetch") || !navigator.onLine) {
    return "当前离线，训练已安全保存在本机。";
  }
  if (message === "[object Object]") return "云端同步失败，请在“我的”中点击“立即同步”查看最新状态。";
  return message || "云端同步失败，本机数据不会丢失。";
}

function latestRemoteCursor(batch: SyncBatch, companions?: CompanionSyncBatch) {
  const timestamps = [
    ...batch.plans,
    ...batch.planDays,
    ...batch.planExercises,
    ...batch.planStates,
    ...batch.sessions,
    ...batch.exercises,
    ...batch.sets,
    ...(companions?.instances || []),
    ...(companions?.states || []),
    ...(companions?.settings || []),
    ...(companions?.feedback || []),
    ...(companions?.growthEvents || []),
    ...(companions?.milestones || []),
    ...(companions?.unlocks || []),
  ]
    .map((row) => row.updated_at)
    .filter((value): value is string => Boolean(value));
  return timestamps.sort().at(-1) || null;
}

export class SyncService {
  private state: SyncState = { ...INITIAL_STATE };
  private readonly listeners = new Set<SyncListener>();
  private syncPromise: Promise<SyncState> | null = null;
  private interval: number | null = null;
  private stopped = true;

  constructor(
    private readonly repository: WorkoutRepository,
    private readonly client: SupabaseClient,
    private readonly userId: string,
    private readonly companionRepository?: CompanionRepository,
  ) {}

  start() {
    if (!this.stopped) return;
    this.stopped = false;
    window.addEventListener("online", this.handleOnline);
    window.addEventListener("offline", this.handleOffline);
    this.interval = window.setInterval(() => void this.syncNow(), 30_000);
    void this.syncNow();
  }

  stop() {
    this.stopped = true;
    window.removeEventListener("online", this.handleOnline);
    window.removeEventListener("offline", this.handleOffline);
    if (this.interval !== null) window.clearInterval(this.interval);
    this.interval = null;
  }

  subscribe(listener: SyncListener) {
    this.listeners.add(listener);
    listener(this.getStatus());
    return () => this.listeners.delete(listener);
  }

  getStatus() {
    return { ...this.state, conflicts: [...this.state.conflicts] };
  }

  async pullRemoteFirst() {
    if (!navigator.onLine) {
      await this.updateOffline();
      return this.getStatus();
    }
    this.setState({ status: "syncing", error: undefined });
    try {
      const [remote, remoteCompanions] = await Promise.all([this.pullRemote(), this.pullCompanionRemote()]);
      await this.repository.applyRemote(remote);
      if (remoteCompanions && this.companionRepository) await this.companionRepository.applyRemote(remoteCompanions);
      const conflicts = await this.findConflicts();
      const pendingCount = await this.repository.getPendingCount();
      this.setState({
        status: conflicts.length > 1 ? "conflict" : "idle",
        pendingCount,
        conflicts,
      });
      return this.getStatus();
    } catch (reason) {
      const pendingCount = await this.repository.getPendingCount();
      this.setState({ status: navigator.onLine ? "error" : "offline", pendingCount, error: syncError(reason) });
      return this.getStatus();
    }
  }

  async syncNow() {
    if (this.syncPromise) return this.syncPromise;
    this.syncPromise = this.performSync().finally(() => { this.syncPromise = null; });
    return this.syncPromise;
  }

  async resolveActiveConflict(keepSessionId: string) {
    await this.repository.resolveActiveConflict(keepSessionId);
    return this.syncNow();
  }

  private async performSync() {
    if (!navigator.onLine) {
      await this.updateOffline();
      return this.getStatus();
    }

    this.setState({ status: "syncing", error: undefined });
    try {
      const batch = await this.repository.getSyncBatch();
      const companions = await this.companionRepository?.getSyncBatch();
      if (companions) {
        await this.push("companion_instances", companions.instances);
        await this.companionRepository!.markSynced("companion", companions.instances);
        await this.push("companion_states", companions.states);
        await this.companionRepository!.markSynced("companion_state", companions.states);
        await this.push("companion_settings", companions.settings);
        await this.companionRepository!.markSynced("companion_settings", companions.settings);
      }
      await this.push("training_plans", batch.plans);
      await this.repository.markSynced("plan", batch.plans);
      await this.push("training_plan_days", batch.planDays);
      await this.repository.markSynced("plan_day", batch.planDays);
      await this.push("training_plan_exercises", batch.planExercises);
      await this.repository.markSynced("plan_exercise", batch.planExercises);
      await this.push("training_plan_states", batch.planStates);
      await this.repository.markSynced("plan_state", batch.planStates);
      await this.push("workout_sessions", batch.sessions);
      await this.repository.markSynced("session", batch.sessions);
      await this.push("workout_exercises", batch.exercises);
      await this.repository.markSynced("exercise", batch.exercises);
      await this.push("workout_sets", batch.sets);
      await this.repository.markSynced("set", batch.sets);
      if (companions) {
        await this.push("workout_feedback", companions.feedback);
        await this.companionRepository!.markSynced("workout_feedback", companions.feedback);
        await this.push("companion_growth_events", companions.growthEvents);
        await this.companionRepository!.markSynced("growth_event", companions.growthEvents);
        await this.push("companion_milestones", companions.milestones);
        await this.companionRepository!.markSynced("milestone", companions.milestones);
        await this.push("companion_unlocks", companions.unlocks);
        await this.companionRepository!.markSynced("unlock", companions.unlocks);
      }

      const [remote, remoteCompanions] = await Promise.all([this.pullRemote(batch), this.pullCompanionRemote()]);
      await this.repository.applyRemote(remote);
      if (remoteCompanions && this.companionRepository) await this.companionRepository.applyRemote(remoteCompanions);
      const syncedAt = new Date().toISOString();
      await this.repository.setLastSyncedAt(latestRemoteCursor(remote, remoteCompanions || undefined), syncedAt);
      const conflicts = await this.findConflicts();
      const pendingCount = await this.repository.getPendingCount();
      this.setState({
        status: conflicts.length > 1 ? "conflict" : "idle",
        pendingCount,
        lastSyncedAt: syncedAt,
        error: undefined,
        conflicts,
      });
    } catch (reason) {
      const pendingCount = await this.repository.getPendingCount();
      this.setState({
        status: navigator.onLine ? "error" : "offline",
        pendingCount,
        error: syncError(reason),
      });
    }
    return this.getStatus();
  }

  private async push(table: string, rows: Array<{ id: string }>) {
    if (rows.length === 0) return;
    const { error } = await this.client.from(table).upsert(rows, { onConflict: "id" });
    if (error) throw error;
  }

  private async pullRemote(pushed?: SyncBatch): Promise<SyncBatch> {
    const cursor = await this.repository.getLastPulledAt();
    const overlapCursor = cursor
      ? new Date(new Date(cursor).getTime() - 60_000).toISOString()
      : null;
    const fetchRows = async <T,>(table: string) => {
      let query = this.client
        .from(table)
        .select("*")
        .eq("user_id", this.userId)
        .order("updated_at", { ascending: true });
      if (overlapCursor) query = query.gt("updated_at", overlapCursor);
      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as T[];
    };
    const fetchIds = async <T extends { id: string }>(table: string, ids: string[]) => {
      if (ids.length === 0) return [] as T[];
      const { data, error } = await this.client
        .from(table)
        .select("*")
        .eq("user_id", this.userId)
        .in("id", ids);
      if (error) throw error;
      return (data || []) as T[];
    };
    const merge = <T extends { id: string }>(incremental: T[], confirmed: T[]) => {
      const records = new Map(incremental.map((row) => [row.id, row]));
      for (const row of confirmed) records.set(row.id, row);
      return [...records.values()];
    };
    const [
      plans,
      planDays,
      planExercises,
      planStates,
      sessions,
      exercises,
      sets,
      confirmedPlans,
      confirmedPlanDays,
      confirmedPlanExercises,
      confirmedPlanStates,
      confirmedSessions,
      confirmedExercises,
      confirmedSets,
    ] = await Promise.all([
      fetchRows<CloudTrainingPlan>("training_plans"),
      fetchRows<CloudTrainingPlanDay>("training_plan_days"),
      fetchRows<CloudPlannedExercise>("training_plan_exercises"),
      fetchRows<CloudTrainingPlanState>("training_plan_states"),
      fetchRows<CloudWorkoutSession>("workout_sessions"),
      fetchRows<CloudWorkoutExercise>("workout_exercises"),
      fetchRows<CloudWorkoutSet>("workout_sets"),
      fetchIds<CloudTrainingPlan>("training_plans", pushed?.plans.map((row) => row.id) || []),
      fetchIds<CloudTrainingPlanDay>("training_plan_days", pushed?.planDays.map((row) => row.id) || []),
      fetchIds<CloudPlannedExercise>("training_plan_exercises", pushed?.planExercises.map((row) => row.id) || []),
      fetchIds<CloudTrainingPlanState>("training_plan_states", pushed?.planStates.map((row) => row.id) || []),
      fetchIds<CloudWorkoutSession>("workout_sessions", pushed?.sessions.map((row) => row.id) || []),
      fetchIds<CloudWorkoutExercise>("workout_exercises", pushed?.exercises.map((row) => row.id) || []),
      fetchIds<CloudWorkoutSet>("workout_sets", pushed?.sets.map((row) => row.id) || []),
    ]);
    return {
      plans: merge(plans, confirmedPlans),
      planDays: merge(planDays, confirmedPlanDays),
      planExercises: merge(planExercises, confirmedPlanExercises),
      planStates: merge(planStates, confirmedPlanStates),
      sessions: merge(sessions, confirmedSessions),
      exercises: merge(exercises, confirmedExercises),
      sets: merge(sets, confirmedSets),
    };
  }

  private async pullCompanionRemote(): Promise<CompanionSyncBatch | null> {
    if (!this.companionRepository) return null;
    const fetchRows = async <T,>(table: string) => {
      const { data, error } = await this.client.from(table).select("*").eq("user_id", this.userId).order("updated_at", { ascending: true });
      if (error) throw error;
      return (data || []) as T[];
    };
    const [instances, states, settings, feedback, growthEvents, milestones, unlocks] = await Promise.all([
      fetchRows<CompanionSyncBatch["instances"][number]>("companion_instances"),
      fetchRows<CompanionSyncBatch["states"][number]>("companion_states"),
      fetchRows<CompanionSyncBatch["settings"][number]>("companion_settings"),
      fetchRows<CompanionSyncBatch["feedback"][number]>("workout_feedback"),
      fetchRows<CompanionSyncBatch["growthEvents"][number]>("companion_growth_events"),
      fetchRows<CompanionSyncBatch["milestones"][number]>("companion_milestones"),
      fetchRows<CompanionSyncBatch["unlocks"][number]>("companion_unlocks"),
    ]);
    return { instances, states, settings, feedback, growthEvents, milestones, unlocks };
  }

  private async findConflicts() {
    const sessions = await this.repository.listActiveSessions();
    return sessions.length > 1 ? sessions : [];
  }

  private async updateOffline() {
    const pendingCount = await this.repository.getPendingCount();
    this.setState({
      status: "offline",
      pendingCount,
      error: "当前离线，训练已安全保存在本机。",
    });
  }

  private readonly handleOnline = () => {
    void this.syncNow();
  };

  private readonly handleOffline = () => {
    void this.updateOffline();
  };

  private setState(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    for (const listener of this.listeners) listener(this.getStatus());
  }
}
