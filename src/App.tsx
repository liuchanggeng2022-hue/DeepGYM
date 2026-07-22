import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import appIcon from "../assets/deepgym-icon.png";
import {
  bodyPartLabel,
  CATEGORY_ORDER,
  equipmentLabel,
  exerciseName,
  hasChineseExerciseName,
  indexAndSortExercises,
  instructionSteps,
  mediaUrl,
  muscleLabel,
  normalize,
  PAGE_SIZE,
} from "./exercise-data";
import type { Exercise, IndexedExercise } from "./types";
import { TodayWorkoutView } from "./WorkoutViews";
import { TrainingDataView, TrainingPlanView, TrainingTabs } from "./TrainingHubViews";
import { CompanionSettlementDialog, CompanionView, WorkoutFeedbackDialog } from "./CompanionViews";
import { AccountMenu, AccountSettingsView, ActiveWorkoutConflict } from "./AuthViews";
import { COMPANION_CATALOG } from "./companion-catalog";
import { motionFamilyForExercise } from "./companion-growth";
import { companionDefinitionFor, createCompanionRepository } from "./companion-storage";
import { createProfileService } from "./profile-service";
import { SyncService } from "./sync-service";
import { createWorkoutRepository } from "./workout-storage";
import { summarizeDay, summarizeSessions } from "./workout-summary";
import type { AuthService, AuthUser } from "./auth-types";
import type { UserProfile } from "./profile-types";
import type {
  CompanionDefinition,
  CompanionInstance,
  CompanionMilestone,
  CompanionProgress,
  CompanionRepository,
  CompanionSettings,
  CompanionSettlement,
  RecoveryFeeling,
  WorkoutEndReason,
  WorkoutFeeling,
  WorkoutRuntimeState,
} from "./companion-types";
import type {
  AppView,
  SyncState,
  TrainingPlan,
  TrainingPlanInput,
  TrainingPlanState,
  TrainingSection,
  WorkoutRepository,
  WorkoutSession,
  WorkoutSet,
} from "./workout-types";

const DATA_URL = "/data/exercises.json";

const INITIAL_COMPANION_SETTINGS: CompanionSettings = {
  textPromptsEnabled: true,
  interactionFrequency: "standard",
  animationIntensity: 2,
  reduceMotion: false,
  defaultRestSeconds: 90,
  recoveryMode: false,
  updatedAt: new Date(0).toISOString(),
};

function DumbbellIcon({ small = false }: { small?: boolean }) {
  return (
    <span className={`brand-mark${small ? " small" : ""}`} aria-hidden="true">
      <svg viewBox="0 0 44 44"><path d="M9 17v10M14 13v18M30 13v18M35 17v10M14 22h16" /></svg>
    </span>
  );
}

function ExerciseCard({ exercise, onOpen }: { exercise: IndexedExercise; onOpen: () => void }) {
  const [imageFailed, setImageFailed] = useState(false);
  const translated = hasChineseExerciseName(exercise);

  return (
    <button
      type="button"
      className="exercise-card"
      aria-label={`查看${exerciseName(exercise)}动作指导`}
      onClick={onOpen}
    >
      <span className="card-part">{bodyPartLabel(exercise.body_part)}</span>
      <span className={`card-media${imageFailed ? " media-failed" : ""}`}>
        <img
          src={mediaUrl(exercise.image)}
          alt={`${exerciseName(exercise)}动作缩略图`}
          loading="lazy"
          decoding="async"
          onError={() => setImageFailed(true)}
        />
      </span>
      <span className="card-body">
        <span className="card-arrow" aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M7 17 17 7M8 7h9v9" /></svg>
        </span>
        <span className="card-title">{exerciseName(exercise)}</span>
        <span className="card-english">{translated ? exercise.name : "中文常用名待整理"}</span>
        <span className="card-meta">
          <span title="目标肌群">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></svg>
            {muscleLabel(exercise.target)}
          </span>
          <span title="所需器械">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>
            {equipmentLabel(exercise.equipment)}
          </span>
        </span>
      </span>
    </button>
  );
}

function ExerciseDialog({
  exercise,
  onClose,
  onAdd,
  added,
  adding,
}: {
  exercise: Exercise | null;
  onClose: () => void;
  onAdd: (exercise: Exercise) => void;
  added: boolean;
  adding: boolean;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [mediaPaused, setMediaPaused] = useState(false);
  const [mediaFailed, setMediaFailed] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (exercise && !dialog.open) dialog.showModal();
    if (!exercise && dialog.open) dialog.close();
  }, [exercise]);

  useEffect(() => {
    setMediaPaused(false);
    setMediaFailed(false);
  }, [exercise]);

  const close = () => {
    if (dialogRef.current?.open) dialogRef.current.close();
    else onClose();
  };

  const guide = exercise ? instructionSteps(exercise) : { steps: [], language: "中文指导" };
  const imageSource = exercise ? mediaUrl(mediaPaused ? exercise.image : exercise.gif_url) : "";

  return (
    <dialog
      className="exercise-dialog"
      ref={dialogRef}
      aria-labelledby="detailTitle"
      onClose={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      {exercise && (
        <div className="dialog-shell">
          <button className="dialog-close" type="button" aria-label="关闭动作详情" onClick={close}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17" /></svg>
          </button>

          <div className="detail-media-column">
            <div className="detail-media">
              {!mediaFailed && (
                <img
                  src={imageSource}
                  alt={`${exerciseName(exercise)}动作${mediaPaused ? "静态" : "动态"}示范`}
                  onError={() => setMediaFailed(true)}
                />
              )}
              <div className="media-error" hidden={!mediaFailed}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v14H4zM8 13l2-2 3 3 2-2 3 3M9 9h.01" /></svg>
                <strong>动图暂时无法加载</strong>
                <span>文字步骤仍可正常查看</span>
              </div>
              {!mediaFailed && (
                <button className="media-toggle" type="button" onClick={() => setMediaPaused((value) => !value)}>
                  {mediaPaused ? (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 9 6-9 6Z" /></svg>
                  ) : (
                    <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 6v12M15 6v12" /></svg>
                  )}
                  <span>{mediaPaused ? "继续播放" : "暂停动图"}</span>
                </button>
              )}
            </div>
          </div>

          <article className="detail-content">
            <p className="eyebrow">MOVEMENT GUIDE / 动作指导</p>
            <h2 id="detailTitle">{exerciseName(exercise)}</h2>
            <p className="detail-english-name">
              {hasChineseExerciseName(exercise) ? exercise.name : "上游暂未提供中文动作名"}
            </p>
            <div className="detail-tags">
              <span className="detail-tag">{bodyPartLabel(exercise.body_part)}</span>
              <span className="detail-tag">{equipmentLabel(exercise.equipment)}</span>
              <span className="detail-tag">动作 ID · {exercise.id}</span>
            </div>

            <dl className="muscle-overview">
              <div>
                <dt>主要目标</dt>
                <dd>{muscleLabel(exercise.target)}</dd>
              </div>
              <div>
                <dt>辅助肌群</dt>
                <dd>
                  {(exercise.secondary_muscles || []).map(muscleLabel).join("、") || muscleLabel(exercise.muscle_group)}
                </dd>
              </div>
            </dl>

            <section className="steps-section" aria-labelledby="stepsTitle">
              <div className="content-heading">
                <h3 id="stepsTitle">动作步骤</h3>
                <span>{guide.language}</span>
              </div>
              <ol className="instruction-list">
                {guide.steps.map((step, index) => <li key={`${exercise.id}-${index}`}>{step}</li>)}
              </ol>
            </section>

            <aside className="safety-note">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 4 6v6c0 5 3.4 8.4 8 9 4.6-.6 8-4 8-9V6l-8-3Z" /><path d="m9 12 2 2 4-5" /></svg>
              <p><strong>训练提醒</strong> 使用可控重量并保持呼吸。如动作引起疼痛，请立即停止并咨询合格专业人士。</p>
            </aside>

            <div className="detail-actions">
              <button className="primary-button" type="button" disabled={added || adding} onClick={() => onAdd(exercise)}>
                {added ? "已在今日训练中" : adding ? "正在加入…" : "加入今日训练"}
              </button>
            </div>
          </article>
        </div>
      )}
    </dialog>
  );
}

const INITIAL_SYNC_STATE: SyncState = {
  status: "idle",
  pendingCount: 0,
  lastSyncedAt: null,
  conflicts: [],
};

export default function App({
  authUser,
  authService,
  authOffline,
}: {
  authUser: AuthUser;
  authService: AuthService;
  authOffline: boolean;
}) {
  const [exercises, setExercises] = useState<IndexedExercise[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<IndexedExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<AppView>("library");
  const [trainingSection, setTrainingSection] = useState<TrainingSection>("record");
  const [workoutRepository, setWorkoutRepository] = useState<WorkoutRepository | null>(null);
  const [companionRepository, setCompanionRepository] = useState<CompanionRepository | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [trainingPlans, setTrainingPlans] = useState<TrainingPlan[]>([]);
  const [trainingPlanState, setTrainingPlanState] = useState<TrainingPlanState>({ activePlanId: null, updatedAt: new Date(0).toISOString() });
  const [trainingDataInitialDate, setTrainingDataInitialDate] = useState<Date | null>(null);
  const [trainingDataRefreshKey, setTrainingDataRefreshKey] = useState(0);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const [workoutBusy, setWorkoutBusy] = useState(false);
  const [workoutError, setWorkoutError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [companionInstances, setCompanionInstances] = useState<CompanionInstance[]>([]);
  const [activeCompanion, setActiveCompanion] = useState<CompanionInstance | null>(null);
  const [companionProgress, setCompanionProgress] = useState<CompanionProgress | null>(null);
  const [companionSettings, setCompanionSettings] = useState<CompanionSettings>(INITIAL_COMPANION_SETTINGS);
  const [companionMilestones, setCompanionMilestones] = useState<CompanionMilestone[]>([]);
  const [companionBusy, setCompanionBusy] = useState(false);
  const [companionError, setCompanionError] = useState("");
  const [workoutRuntime, setWorkoutRuntime] = useState<WorkoutRuntimeState | null>(null);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [finishReason, setFinishReason] = useState<WorkoutEndReason>("completed");
  const [companionSettlement, setCompanionSettlement] = useState<CompanionSettlement | null>(null);
  const [settlementSummary, setSettlementSummary] = useState<ReturnType<typeof summarizeDay> | null>(null);
  const [recoverySessionId, setRecoverySessionId] = useState<string | null>(null);
  const [syncState, setSyncState] = useState<SyncState>(() => ({
    ...INITIAL_SYNC_STATE,
    status: authOffline ? "offline" : "idle",
  }));
  const [accountBusy, setAccountBusy] = useState(false);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [profileBusy, setProfileBusy] = useState(false);
  const [profileError, setProfileError] = useState("");
  const activeSessionRef = useRef<WorkoutSession | null>(null);
  const workoutRuntimeRef = useRef<WorkoutRuntimeState | null>(null);
  const syncServiceRef = useRef<SyncService | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyDraftRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const profileService = useMemo(
    () => createProfileService(authService.getClient(), authUser.id),
    [authService, authUser.id],
  );

  const setActiveWorkout = (session: WorkoutSession | null) => {
    activeSessionRef.current = session;
    setActiveSession(session);
  };

  const setRuntime = (runtime: WorkoutRuntimeState | null) => {
    workoutRuntimeRef.current = runtime;
    setWorkoutRuntime(runtime);
  };

  const loadExercises = async () => {
    setLoading(true);
    setError("");
    try {
      const response = await fetch(DATA_URL);
      if (!response.ok) throw new Error(`读取动作数据失败（HTTP ${response.status}）`);
      const records = await response.json() as Exercise[];
      if (!Array.isArray(records) || records.length === 0) throw new Error("动作数据格式不正确。");
      setExercises(indexAndSortExercises(records));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "未知错误，请重试。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadExercises();
  }, []);

  useEffect(() => {
    let active = true;
    setProfileBusy(true);
    setProfileError("");
    void profileService.load()
      .then((value) => {
        if (active) setProfile(value);
      })
      .catch((reason) => {
        if (!active) return;
        setProfileError(reason instanceof Error ? reason.message : "个人资料加载失败。");
      })
      .finally(() => {
        if (active) setProfileBusy(false);
      });
    return () => { active = false; };
  }, [profileService]);

  useEffect(() => {
    let active = true;
    let stopSync: (() => void) | null = null;
    const initializeWorkoutStorage = async () => {
      setWorkoutLoading(true);
      try {
        const [repository, partnerRepository] = await Promise.all([
          createWorkoutRepository(authUser.id),
          createCompanionRepository(authUser.id),
        ]);
        let syncService: SyncService | null = null;
        if (repository.mode === "sqlite" && authService.configured) {
          syncService = new SyncService(repository, authService.getClient(), authUser.id, partnerRepository);
          syncServiceRef.current = syncService;
          let previousStatus: SyncState["status"] | null = null;
          const unsubscribe = syncService.subscribe((state) => {
            if (!active) return;
            setSyncState(state);
            if (previousStatus === "syncing" && (state.status === "idle" || state.status === "conflict") && !dirtyDraftRef.current) {
              void Promise.all([
                repository.getActiveSession(),
                repository.listHistory(),
                repository.listTrainingPlans(),
                repository.getTrainingPlanState(),
                partnerRepository.listInstances(),
                partnerRepository.getActiveInstance(),
                partnerRepository.getSettings(),
              ]).then(async ([session, history, plans, planState, instances, partner, partnerSettings]) => {
                if (!active || dirtyDraftRef.current) return;
                setActiveWorkout(session);
                setWorkoutHistory(history);
                setTrainingPlans(plans);
                setTrainingPlanState(planState);
                setCompanionInstances(instances);
                setActiveCompanion(partner);
                setCompanionSettings(partnerSettings);
                if (partner) {
                  const allSessions = session ? [session, ...history] : history;
                  const [partnerProgress, partnerMilestones] = await Promise.all([
                    partnerRepository.getProgress(partner.id, companionDefinitionFor(partner), allSessions),
                    partnerRepository.listMilestones(partner.id),
                  ]);
                  if (!active || dirtyDraftRef.current) return;
                  setCompanionProgress(partnerProgress);
                  setCompanionMilestones(partnerMilestones);
                }
                setTrainingDataRefreshKey((value) => value + 1);
              });
            }
            previousStatus = state.status;
          });
          stopSync = () => {
            unsubscribe();
            syncService?.stop();
          };
          await syncService.pullRemoteFirst();
        }

        await repository.claimLegacyData();
        if (syncService) await syncService.syncNow();
        else {
          const pendingCount = await repository.getPendingCount();
          setSyncState({
            status: navigator.onLine ? "idle" : "offline",
            pendingCount,
            lastSyncedAt: null,
            conflicts: [],
            error: navigator.onLine ? undefined : "当前离线，训练已安全保存在本机。",
          });
        }
        const [session, history, plans, planState, instances, partner, partnerSettings] = await Promise.all([
          repository.getActiveSession(),
          repository.listHistory(),
          repository.listTrainingPlans(),
          repository.getTrainingPlanState(),
          partnerRepository.listInstances(),
          partnerRepository.getActiveInstance(),
          partnerRepository.getSettings(),
        ]);
        if (!active) return;
        setWorkoutRepository(repository);
        setCompanionRepository(partnerRepository);
        setActiveWorkout(session);
        setWorkoutHistory(history);
        setTrainingPlans(plans);
        setTrainingPlanState(planState);
        setCompanionInstances(instances);
        setActiveCompanion(partner);
        setCompanionSettings(partnerSettings);
        if (partner) {
          const allSessions = session ? [session, ...history] : history;
          const [partnerProgress, partnerMilestones] = await Promise.all([
            partnerRepository.getProgress(partner.id, companionDefinitionFor(partner), allSessions),
            partnerRepository.listMilestones(partner.id),
          ]);
          setCompanionProgress(partnerProgress);
          setCompanionMilestones(partnerMilestones);
        }
        if (session) setRuntime(await partnerRepository.getRuntimeState(session.id));
        setWorkoutError("");
        syncService?.start();
      } catch (reason) {
        if (!active) return;
        setWorkoutError(reason instanceof Error ? reason.message : "训练记录存储初始化失败。");
      } finally {
        if (active) setWorkoutLoading(false);
      }
    };
    void initializeWorkoutStorage();
    return () => {
      active = false;
      stopSync?.();
      syncServiceRef.current = null;
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, [authService, authUser.id]);

  useEffect(() => {
    const focusSearch = (event: KeyboardEvent) => {
      const tagName = (document.activeElement as HTMLElement | null)?.tagName;
      const isTyping = tagName === "INPUT" || tagName === "TEXTAREA" || tagName === "SELECT";
      if (event.key === "/" && !isTyping && !selected) {
        event.preventDefault();
        document.querySelector<HTMLInputElement>("#searchInput")?.focus();
      }
    };
    document.addEventListener("keydown", focusSearch);
    return () => document.removeEventListener("keydown", focusSearch);
  }, [selected]);

  const availableCategories = useMemo(
    () => CATEGORY_ORDER.filter((value) => exercises.some((exercise) => exercise.body_part === value)),
    [exercises],
  );

  const equipmentOptions = useMemo(() => {
    const counts = new Map<string, number>();
    for (const exercise of exercises) counts.set(exercise.equipment, (counts.get(exercise.equipment) || 0) + 1);
    return [...counts.entries()].sort(([aName, aCount], [bName, bCount]) => {
      const difference = bCount - aCount;
      return difference || equipmentLabel(aName).localeCompare(equipmentLabel(bName), "zh-CN");
    });
  }, [exercises]);

  const exerciseLookup = useMemo(
    () => new Map(exercises.map((exercise) => [exercise.id, exercise])),
    [exercises],
  );

  const todaySummary = useMemo(() => summarizeDay(workoutHistory), [workoutHistory]);

  const queryTokens = normalize(query).split(" ").filter(Boolean);
  const filtered = useMemo(() => exercises.filter((exercise) => {
    const matchesQuery = queryTokens.length === 0 || queryTokens.every((token) => exercise.searchIndex.includes(token));
    const matchesCategory = !category || exercise.body_part === category;
    const matchesEquipment = !equipment || exercise.equipment === equipment;
    return matchesQuery && matchesCategory && matchesEquipment;
  }), [category, equipment, exercises, queryTokens.join("|")]);

  const visible = filtered.slice(0, visibleCount);
  const isFiltered = Boolean(queryTokens.length || category || equipment);

  const resetPagination = () => setVisibleCount(PAGE_SIZE);
  const clearFilters = () => {
    setQuery("");
    setCategory("");
    setEquipment("");
    resetPagination();
  };

  const persistDraft = async () => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current);
      saveTimerRef.current = null;
    }
    const session = activeSessionRef.current;
    if (!workoutRepository || !session || !dirtyDraftRef.current) return;
    const generation = saveGenerationRef.current;
    const sets = session.exercises.flatMap((exercise) => exercise.sets);
    await workoutRepository.saveSets(sets);
    if (generation === saveGenerationRef.current) dirtyDraftRef.current = false;
    setLastSavedAt(new Date());
    void syncServiceRef.current?.syncNow();
  };

  const scheduleDraftSave = () => {
    if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => {
      void persistDraft().catch((reason) => {
        setWorkoutError(reason instanceof Error ? reason.message : "训练记录自动保存失败。");
      });
    }, 450);
  };

  const handleSetChange = (setId: string, patch: Partial<WorkoutSet>) => {
    const session = activeSessionRef.current;
    if (!session) return;
    const next: WorkoutSession = {
      ...session,
      exercises: session.exercises.map((exercise) => ({
        ...exercise,
        sets: exercise.sets.map((set) => set.id === setId ? { ...set, ...patch } : set),
      })),
    };
    setActiveWorkout(next);
    dirtyDraftRef.current = true;
    saveGenerationRef.current += 1;
    scheduleDraftSave();
  };

  const refreshActiveWorkout = async () => {
    if (!workoutRepository) return;
    const session = await workoutRepository.getActiveSession();
    dirtyDraftRef.current = false;
    setActiveWorkout(session);
  };

  const refreshCompanionData = useCallback(async (
    sessionsOverride?: WorkoutSession[],
    repositoryOverride?: CompanionRepository,
  ) => {
    const repository = repositoryOverride || companionRepository;
    if (!repository) return;
    const [instances, partner, settings] = await Promise.all([
      repository.listInstances(),
      repository.getActiveInstance(),
      repository.getSettings(),
    ]);
    const sessions = sessionsOverride || (activeSessionRef.current ? [activeSessionRef.current, ...workoutHistory] : workoutHistory);
    setCompanionInstances(instances);
    setActiveCompanion(partner);
    setCompanionSettings(settings);
    if (!partner) {
      setCompanionProgress(null);
      setCompanionMilestones([]);
      setRecoverySessionId(null);
      return;
    }
    const [progress, milestones] = await Promise.all([
      repository.getProgress(partner.id, companionDefinitionFor(partner), sessions),
      repository.listMilestones(partner.id),
    ]);
    setCompanionProgress(progress);
    setCompanionMilestones(milestones);
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`;
    const candidates = sessions.filter((session) => session.status === "completed" && !session.deletedAt
      && session.companionInstanceId === partner.id && session.endedAt)
      .sort((a, b) => new Date(b.endedAt!).getTime() - new Date(a.endedAt!).getTime());
    let pendingRecovery: string | null = null;
    for (const session of candidates) {
      const ended = new Date(session.endedAt!);
      const endedKey = `${ended.getFullYear()}-${ended.getMonth()}-${ended.getDate()}`;
      if (endedKey === todayKey) continue;
      const feedback = await repository.getFeedback(session.id);
      if (!feedback?.recovery) pendingRecovery = session.id;
      break;
    }
    setRecoverySessionId(pendingRecovery);
  }, [companionRepository, workoutHistory]);

  const handleAddExercise = async (exercise: Exercise) => {
    if (!workoutRepository) {
      setWorkoutError("本地训练记录仍在准备，请稍后再试。");
      return;
    }
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      const result = await workoutRepository.addExercise(exercise.id);
      setActiveWorkout(result.session);
      setSelected(null);
      setView("training");
      setTrainingSection("record");
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "加入今日训练失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleAddSet = async (workoutExerciseId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.addSet(workoutExerciseId);
      await refreshActiveWorkout();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "添加组失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleDeleteSet = async (setId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.deleteSet(setId);
      await refreshActiveWorkout();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "删除组失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleRemoveExercise = async (workoutExerciseId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.removeExercise(workoutExerciseId);
      await refreshActiveWorkout();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "移除动作失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const runtimeWithElapsed = (runtime: WorkoutRuntimeState | null, at = new Date()) => {
    if (!runtime) return null;
    const counts = runtime.phase === "working" || runtime.phase === "resting";
    const elapsed = counts && runtime.phaseStartedAt
      ? Math.min(600, Math.max(0, Math.round((at.getTime() - new Date(runtime.phaseStartedAt).getTime()) / 1000)))
      : 0;
    return { ...runtime, accumulatedActiveSeconds: runtime.accumulatedActiveSeconds + elapsed };
  };

  const saveRuntime = async (runtime: WorkoutRuntimeState | null) => {
    setRuntime(runtime);
    if (!companionRepository || !runtime) return;
    await companionRepository.saveRuntimeState(runtime);
  };

  const handleStartSet = async (workoutExerciseId: string, setId: string) => {
    const session = activeSessionRef.current;
    if (!session || !workoutRepository || !companionRepository) return;
    setWorkoutError("");
    try {
      let nextSession = session;
      if (!session.companionInstanceId && activeCompanion) {
        nextSession = await workoutRepository.attachCompanion(session.id, activeCompanion.id);
        setActiveWorkout(nextSession);
      }
      const exercise = nextSession.exercises.find((item) => item.id === workoutExerciseId);
      const current = runtimeWithElapsed(workoutRuntimeRef.current);
      const preparing: WorkoutRuntimeState = {
        sessionId: session.id,
        workoutExerciseId,
        setId,
        motionFamily: motionFamilyForExercise(exercise ? exerciseLookup.get(exercise.exerciseId) : undefined),
        phase: "preparing",
        phaseStartedAt: new Date().toISOString(),
        restEndsAt: null,
        accumulatedActiveSeconds: current?.accumulatedActiveSeconds || 0,
      };
      await saveRuntime(preparing);
      window.setTimeout(() => {
        const latest = workoutRuntimeRef.current;
        if (!latest || latest.sessionId !== session.id || latest.setId !== setId || latest.phase !== "preparing") return;
        void saveRuntime({ ...latest, phase: "working", phaseStartedAt: new Date().toISOString() });
      }, companionSettings.reduceMotion ? 0 : 700);
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "开始本组失败。");
    }
  };

  const handleCompleteSet = (workoutExerciseId: string, set: WorkoutSet) => {
    if (set.completed) {
      handleSetChange(set.id, { completed: false, completedAt: null });
      return;
    }
    handleSetChange(set.id, { completed: true, completedAt: new Date().toISOString() });
    const session = activeSessionRef.current;
    if (!session || !companionRepository) return;
    void (async () => {
      try {
        let nextSession = session;
        if (!session.companionInstanceId && activeCompanion && workoutRepository) {
          nextSession = await workoutRepository.attachCompanion(session.id, activeCompanion.id);
          setActiveWorkout({
            ...nextSession,
            exercises: nextSession.exercises.map((exercise) => ({
              ...exercise,
              sets: exercise.sets.map((item) => item.id === set.id ? { ...item, completed: true, completedAt: new Date().toISOString() } : item),
            })),
          });
        }
        const current = runtimeWithElapsed(workoutRuntimeRef.current);
        const exercise = nextSession.exercises.find((item) => item.id === workoutExerciseId);
        const startedAt = new Date();
        const resting: WorkoutRuntimeState = {
          sessionId: session.id,
          workoutExerciseId,
          setId: set.id,
          motionFamily: motionFamilyForExercise(exercise ? exerciseLookup.get(exercise.exerciseId) : undefined),
          phase: "resting",
          phaseStartedAt: startedAt.toISOString(),
          restEndsAt: new Date(startedAt.getTime() + companionSettings.defaultRestSeconds * 1000).toISOString(),
          accumulatedActiveSeconds: current?.accumulatedActiveSeconds || 0,
        };
        await saveRuntime(resting);
      } catch (reason) {
        setWorkoutError(reason instanceof Error ? reason.message : "组间休息计时启动失败。");
      }
    })();
  };

  const transitionRuntime = async (phase: WorkoutRuntimeState["phase"], clearRest = false) => {
    const current = runtimeWithElapsed(workoutRuntimeRef.current);
    if (!current) return;
    await saveRuntime({ ...current, phase, phaseStartedAt: phase === "paused" || phase === "idle" ? null : new Date().toISOString(),
      restEndsAt: clearRest ? null : current.restEndsAt });
  };

  const requestFinishWorkout = (reason: WorkoutEndReason) => {
    setFinishReason(reason);
    setFeedbackOpen(true);
  };

  const finishWorkout = async (feedback: { rpe: number | null; feeling: WorkoutFeeling | null }) => {
    const session = activeSessionRef.current;
    if (!workoutRepository || !session) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    setCompanionError("");
    try {
      await persistDraft();
      if (companionRepository) await companionRepository.saveFeedback(session.id, { ...feedback, recovery: null });
      const endedAt = new Date().toISOString();
      const finalRuntime = runtimeWithElapsed(workoutRuntimeRef.current, new Date(endedAt));
      const activeDurationSeconds = finalRuntime?.accumulatedActiveSeconds || 0;
      await workoutRepository.completeSession(session.id, endedAt, {
        endReason: finishReason,
        activeDurationSeconds,
        companionInstanceId: session.companionInstanceId || activeCompanion?.id || null,
      });
      if (companionRepository) await companionRepository.clearRuntimeState(session.id);
      setRuntime(null);
      const history = await workoutRepository.listHistory();
      const completedSession = history.find((item) => item.id === session.id) || { ...session, endedAt, status: "completed" as const,
        endReason: finishReason, activeDurationSeconds, companionInstanceId: session.companionInstanceId || activeCompanion?.id || null };
      const summary = summarizeSessions([completedSession]);
      setSettlementSummary(summary);
      const companionId = completedSession.companionInstanceId;
      const companion = companionId ? companionInstances.find((item) => item.id === companionId) || activeCompanion : null;
      const definition = companion ? companionDefinitionFor(companion) : null;
      if (companionRepository && companion && definition) {
        const completedSetCount = completedSession.exercises.reduce((sum, item) => sum + item.sets.filter((set) => set.completed).length, 0);
        const plannedSetCount = completedSession.sourcePlanDayId
          ? completedSession.exercises.reduce((sum, item) => sum + item.sets.length, 0)
          : 0;
        const pastExerciseIds = new Set(workoutHistory.flatMap((item) => item.exercises.map((exercise) => exercise.exerciseId)));
        const newExerciseCount = completedSession.exercises.filter((item) => !pastExerciseIds.has(item.exerciseId)).length;
        const personalRecordCount = completedSession.exercises.filter((exercise) => {
          const best = (sets: WorkoutSet[]) => Math.max(0, ...sets.filter((set) => set.completed && set.weightKg && set.reps)
            .map((set) => (set.weightKg || 0) * (1 + (set.reps || 0) / 30)));
          const currentBest = best(exercise.sets);
          const previousBest = Math.max(0, ...workoutHistory.flatMap((item) => item.exercises)
            .filter((item) => item.exerciseId === exercise.exerciseId).map((item) => best(item.sets)));
          return previousBest > 0 && currentBest >= previousBest * 1.025;
        }).length;
        const settlement = await companionRepository.settleWorkout(companion.id, definition, {
          session: completedSession,
          summary,
          effectiveDurationMinutes: Math.round(activeDurationSeconds / 60),
          planCompletionRate: plannedSetCount ? completedSetCount / plannedSetCount : 0,
          newExerciseCount,
          personalRecordCount,
          bodyParts: [...new Set(completedSession.exercises.map((item) => exerciseLookup.get(item.exerciseId)?.body_part).filter((value): value is string => Boolean(value)))],
          feedback,
          endedReason: finishReason,
          occurredAt: endedAt,
        });
        setCompanionSettlement(settlement);
      }
      setFeedbackOpen(false);
      setWorkoutHistory(history);
      setActiveWorkout(await workoutRepository.getActiveSession());
      setLastSavedAt(new Date());
      setTrainingDataRefreshKey((value) => value + 1);
      await refreshCompanionData(history);
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "完成训练失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleDeleteSession = async (sessionId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.deleteSession(sessionId);
      await companionRepository?.reverseWorkoutGrowth(sessionId);
      const history = await workoutRepository.listHistory();
      setWorkoutHistory(history);
      await refreshCompanionData(history);
      setTrainingDataRefreshKey((value) => value + 1);
      await syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "删除训练记录失败。");
      throw reason;
    } finally {
      setWorkoutBusy(false);
    }
  };

  const refreshTrainingPlans = async () => {
    if (!workoutRepository) return;
    const [plans, planState] = await Promise.all([
      workoutRepository.listTrainingPlans(),
      workoutRepository.getTrainingPlanState(),
    ]);
    setTrainingPlans(plans);
    setTrainingPlanState(planState);
  };

  const handleSaveTrainingPlan = async (input: TrainingPlanInput) => {
    if (!workoutRepository) throw new Error("训练计划存储仍在准备，请稍后再试。");
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      const saved = await workoutRepository.saveTrainingPlan(input);
      if (!trainingPlanState.activePlanId) await workoutRepository.setActiveTrainingPlan(saved.id);
      await refreshTrainingPlans();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "训练计划保存失败。");
      throw reason;
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleActivateTrainingPlan = async (planId: string | null) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await workoutRepository.setActiveTrainingPlan(planId);
      await refreshTrainingPlans();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "训练计划状态保存失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleDuplicateTrainingPlan = async (planId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await workoutRepository.duplicateTrainingPlan(planId);
      await refreshTrainingPlans();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "复制训练计划失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleDeleteTrainingPlan = async (planId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await workoutRepository.deleteTrainingPlan(planId);
      await refreshTrainingPlans();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "删除训练计划失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleStartPlanDay = async (planDayId: string) => {
    if (!workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      setActiveWorkout(await workoutRepository.startPlannedWorkout(planDayId));
      setView("training");
      setTrainingSection("record");
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "从计划开始训练失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const loadCompletedSessions = useCallback(async (startAt: string, endAt: string) => {
    if (!workoutRepository) return [];
    return workoutRepository.listCompletedSessionsBetween(startAt, endAt);
  }, [workoutRepository]);

  const showTodayTrainingData = () => {
    setTrainingDataInitialDate(new Date());
    setView("training");
    setTrainingSection("data");
  };

  const handleCreateCompanion = async (definition: CompanionDefinition, displayName: string) => {
    if (!companionRepository) throw new Error("搭档数据仍在准备，请稍后再试。");
    setCompanionBusy(true);
    setCompanionError("");
    try {
      await companionRepository.createInstance(definition, displayName);
      await refreshCompanionData();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "搭档创建失败。";
      setCompanionError(message);
      throw reason;
    } finally {
      setCompanionBusy(false);
    }
  };

  const handleSwitchCompanion = async (companionId: string) => {
    if (!companionRepository) return;
    if (activeSessionRef.current?.companionInstanceId || (workoutRuntimeRef.current && workoutRuntimeRef.current.phase !== "idle")) {
      setCompanionError("这场训练已经和当前搭档开始了。完成或结束训练后再切换，成长值就不会重复计算。");
      return;
    }
    setCompanionBusy(true);
    setCompanionError("");
    try {
      await companionRepository.switchActive(companionId);
      await refreshCompanionData();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setCompanionError(reason instanceof Error ? reason.message : "搭档切换失败。");
    } finally {
      setCompanionBusy(false);
    }
  };

  const handleDeleteCompanion = async (companionId: string) => {
    if (!companionRepository) return;
    if (activeSessionRef.current?.companionInstanceId === companionId) {
      setCompanionError("当前训练已经绑定这名搭档，请先完成或结束训练。");
      return;
    }
    setCompanionBusy(true);
    setCompanionError("");
    try {
      await companionRepository.deleteInstance(companionId);
      await refreshCompanionData();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setCompanionError(reason instanceof Error ? reason.message : "搭档删除失败。");
    } finally {
      setCompanionBusy(false);
    }
  };

  const handleSaveCompanionSettings = async (settings: CompanionSettings) => {
    if (!companionRepository) return;
    setCompanionBusy(true);
    setCompanionError("");
    try {
      setCompanionSettings(await companionRepository.saveSettings(settings));
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setCompanionError(reason instanceof Error ? reason.message : "搭档设置保存失败。");
    } finally {
      setCompanionBusy(false);
    }
  };

  const handleRecoveryFeedback = async (sessionId: string, recovery: RecoveryFeeling) => {
    if (!companionRepository) return;
    setCompanionBusy(true);
    setCompanionError("");
    try {
      await companionRepository.saveRecovery(sessionId, recovery);
      if (recovery === "pain") {
        const settings = await companionRepository.getSettings();
        await companionRepository.saveSettings({ ...settings, recoveryMode: true });
      }
      setRecoverySessionId(null);
      await refreshCompanionData();
      void syncServiceRef.current?.syncNow();
    } catch (reason) {
      setCompanionError(reason instanceof Error ? reason.message : "恢复状态保存失败。");
    } finally {
      setCompanionBusy(false);
    }
  };

  const handleSyncNow = async () => {
    await persistDraft();
    if (!navigator.onLine) throw new Error("当前处于离线状态，请联网后再同步。");
    const service = syncServiceRef.current;
    if (!service) throw new Error(workoutRepository?.mode === "browser-preview"
      ? "浏览器预览不会上传数据，请在 DeepGYM 桌面应用中同步。"
      : "云端同步服务尚未就绪，请稍后再试。");
    const state = await service.syncNow();
    if (state.status === "error" || state.status === "offline") {
      throw new Error(state.error || "云端同步失败，本机数据不会丢失。");
    }
  };

  const handleSaveNickname = async (nickname: string) => {
    setProfileBusy(true);
    setProfileError("");
    try {
      setProfile(await profileService.saveNickname(nickname));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "昵称保存失败。";
      setProfileError(message);
      throw reason;
    } finally {
      setProfileBusy(false);
    }
  };

  const handleUploadAvatar = async (file: File) => {
    setProfileBusy(true);
    setProfileError("");
    try {
      setProfile(await profileService.uploadAvatar(file));
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "头像上传失败。";
      setProfileError(message);
      throw reason;
    } finally {
      setProfileBusy(false);
    }
  };

  const handleRemoveAvatar = async () => {
    setProfileBusy(true);
    setProfileError("");
    try {
      setProfile(await profileService.removeAvatar());
    } catch (reason) {
      const message = reason instanceof Error ? reason.message : "头像删除失败。";
      setProfileError(message);
      throw reason;
    } finally {
      setProfileBusy(false);
    }
  };

  const handleLogout = async () => {
    if (!workoutRepository) throw new Error("训练记录仍在准备，请稍后再试。");
    setAccountBusy(true);
    try {
      await persistDraft();
      if (!navigator.onLine) throw new Error("当前处于离线状态。请联网并完成同步后再退出，以免训练记录留在这台设备上。");
      const syncService = syncServiceRef.current;
      if (workoutRepository.mode === "sqlite" && !syncService) throw new Error("云端同步尚未就绪，暂时不能退出登录。");
      const state = syncService ? await syncService.syncNow() : syncState;
      if (state.status === "error" || state.status === "offline") throw new Error(state.error || "同步失败，暂时不能退出登录。");
      if (state.conflicts.length > 1) throw new Error("请先选择要继续的进行中训练，再退出登录。");
      const pendingCount = await workoutRepository.getPendingCount();
      if (pendingCount > 0) throw new Error(`还有 ${pendingCount} 项记录尚未同步，暂时不能退出登录。`);
      syncService?.stop();
      await authService.signOut();
      await companionRepository?.clearUserData();
      await workoutRepository.clearUserData();
    } finally {
      setAccountBusy(false);
    }
  };

  const handleDeleteAccount = async (password: string) => {
    if (!workoutRepository) throw new Error("训练记录仍在准备，请稍后再试。");
    if (!navigator.onLine) throw new Error("删除账号需要联网验证身份，请恢复网络后重试。");
    setAccountBusy(true);
    try {
      syncServiceRef.current?.stop();
      await authService.deleteAccount(password);
      await companionRepository?.clearUserData();
      await workoutRepository.clearUserData();
    } finally {
      setAccountBusy(false);
    }
  };

  const handleResolveConflict = async (sessionId: string) => {
    const service = syncServiceRef.current;
    if (!service || !workoutRepository) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await service.resolveActiveConflict(sessionId);
      const [session, history] = await Promise.all([
        workoutRepository.getActiveSession(),
        workoutRepository.listHistory(),
      ]);
      setActiveWorkout(session);
      setWorkoutHistory(history);
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "处理训练冲突失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const activeExerciseIds = new Set(activeSession?.exercises.map((exercise) => exercise.exerciseId) || []);
  const workoutCompanion = activeSession?.companionInstanceId
    ? companionInstances.find((item) => item.id === activeSession.companionInstanceId) || activeCompanion
    : activeCompanion;
  const workoutCompanionDefinition = companionDefinitionFor(workoutCompanion || null);
  const syncStatusText = syncState.status === "syncing"
    ? "正在同步云端"
    : syncState.status === "offline"
      ? "离线保存"
      : syncState.status === "error"
        ? "同步失败"
        : syncState.status === "conflict"
          ? "等待处理训练冲突"
          : syncState.pendingCount > 0
            ? `${syncState.pendingCount} 项待同步`
            : workoutRepository?.mode === "browser-preview" ? "浏览器预览不上传" : "云端已同步";
  const topbarStatus = view === "account"
    ? "登录与账号设置"
    : view === "partner"
      ? companionError
        ? "搭档数据需要处理"
        : activeCompanion
          ? `${activeCompanion.displayName} · ${syncStatusText}`
          : `${COMPANION_CATALOG.length} 名搭档可选择 · ${syncStatusText}`
    : view === "library"
      ? error ? "动作数据加载失败" : loading ? "正在读取动作数据…" : `${exercises.length.toLocaleString("zh-CN")} 个动作 · ${syncStatusText}`
      : workoutError ? "训练记录需要处理" : workoutLoading ? "正在打开本地记录…" : syncStatusText;

  return (
    <>
      <div className="app-layout">
        <aside className="sidebar" aria-label="主导航">
          <a className="brand" href="#exercise-library" aria-label="DeepGYM 首页" onClick={(event) => { event.preventDefault(); setView("library"); }}>
            <DumbbellIcon />
            <span>Deep<span>GYM</span></span>
          </a>

          <nav className="main-nav">
            <button className={`nav-item${view === "library" ? " active" : ""}`} type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => setView("library")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>
              <span>动作指导</span>
            </button>
            <button className={`nav-item${view === "training" ? " active" : ""}`} type="button" aria-current={view === "training" ? "page" : undefined} onClick={() => setView("training")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" /></svg>
              <span>训练</span>{activeSession && <span className="nav-badge">{activeSession.exercises.length}</span>}
            </button>
            <button className={`nav-item${view === "partner" ? " active" : ""}`} type="button" aria-current={view === "partner" ? "page" : undefined} onClick={() => setView("partner")}>
              <img className="nav-partner-icon" src={appIcon} alt="" aria-hidden="true" />
              <span>搭档</span>{activeCompanion && <span className="nav-badge">{activeCompanion.level}</span>}
            </button>
            <button className={`nav-item${view === "account" ? " active" : ""}`} type="button" aria-current={view === "account" ? "page" : undefined} onClick={() => setView("account")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.4-6 8-6s7.3 1.8 8 6" /></svg>
              <span>我的</span>
            </button>
          </nav>

        </aside>

        <main className="main-content">
          <header className="topbar">
            <button className="mobile-brand" type="button" aria-label="DeepGYM" onClick={() => setView("library")}>
              <DumbbellIcon small /><strong>DeepGYM</strong>
            </button>
            <div className="topbar-state" aria-label="数据状态">
              <span className={`status-dot${view === "library" ? error ? " error" : "" : workoutError ? " error" : ""}`} aria-hidden="true"></span>
              <span>{topbarStatus}</span>
            </div>
            <AccountMenu
              user={authUser}
              profile={profile}
              syncState={syncState}
              busy={accountBusy || workoutBusy || companionBusy}
              onLogout={handleLogout}
              onDelete={handleDeleteAccount}
            />
          </header>

          {view === "library" && <div className="page-wrap" id="exercise-library">
            <h1 className="sr-only">动作指导与动作库</h1>

            <section className="finder" aria-label="查找动作">
              <label className="search-field" htmlFor="searchInput">
                <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
                <input
                  id="searchInput"
                  type="search"
                  autoComplete="off"
                  value={query}
                  onChange={(event) => { setQuery(event.target.value); resetPagination(); }}
                  placeholder="搜索动作、目标肌群或器械，例如：卧推 / bench press"
                />
                <kbd>/</kbd>
              </label>

              <div className="filter-line">
                <div className="category-scroll" aria-label="按身体部位筛选">
                  {["", ...availableCategories].map((value) => (
                    <button
                      key={value || "all"}
                      type="button"
                      className={`filter-chip${category === value ? " active" : ""}`}
                      aria-pressed={category === value}
                      onClick={() => { setCategory(value); resetPagination(); }}
                    >
                      {value ? bodyPartLabel(value) : "全部"}
                    </button>
                  ))}
                </div>
                <label className="select-wrap" htmlFor="equipmentFilter">
                  <span className="sr-only">按器械筛选</span>
                  <select
                    id="equipmentFilter"
                    value={equipment}
                    onChange={(event) => { setEquipment(event.target.value); resetPagination(); }}
                  >
                    <option value="">全部器械</option>
                    {equipmentOptions.map(([value, count]) => (
                      <option key={value} value={value}>{equipmentLabel(value)} · {count}</option>
                    ))}
                  </select>
                  <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 10 4 4 4-4" /></svg>
                </label>
              </div>
            </section>

            <section className="results" aria-live="polite" aria-busy={loading}>
              <div className="section-heading">
                <div>
                  <h2>动作列表</h2>
                  <p>{loading ? "正在加载完整动作库…" : isFiltered ? `找到 ${filtered.length.toLocaleString("zh-CN")} 个匹配动作` : `精选常用动作优先展示，共 ${filtered.length.toLocaleString("zh-CN")} 个`}</p>
                </div>
                {isFiltered && <button className="text-button" type="button" onClick={clearFilters}>清除筛选</button>}
              </div>

              {loading && (
                <div className="loading-grid" aria-label="动作加载中">
                  {Array.from({ length: 6 }, (_, index) => <div className="skeleton-card" key={index}></div>)}
                </div>
              )}

              {!loading && error && (
                <div className="empty-state">
                  <span className="empty-icon">!</span><h3>动作数据没有加载成功</h3><p>{error}</p>
                  <button className="primary-button compact" type="button" onClick={() => void loadExercises()}>重新加载</button>
                </div>
              )}

              {!loading && !error && filtered.length === 0 && (
                <div className="empty-state">
                  <span className="empty-icon search-empty"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg></span>
                  <h3>没有找到匹配动作</h3><p>试试减少关键词，或清除身体部位和器械筛选。</p>
                  <button className="secondary-button compact" type="button" onClick={clearFilters}>清除全部条件</button>
                </div>
              )}

              {!loading && !error && filtered.length > 0 && (
                <>
                  <div className="exercise-grid">
                    {visible.map((exercise) => (
                      <ExerciseCard key={exercise.id} exercise={exercise} onOpen={() => setSelected(exercise)} />
                    ))}
                  </div>
                  <div className="load-more-wrap">
                    {visibleCount < filtered.length && (
                      <button className="secondary-button" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>显示更多动作</button>
                    )}
                    <p>已显示 {Math.min(visibleCount, filtered.length).toLocaleString("zh-CN")} / {filtered.length.toLocaleString("zh-CN")} 个动作</p>
                  </div>
                </>
              )}
            </section>

            <footer className="page-footer">
              <p>动作元数据来自 <a href="https://github.com/hasaneyldrm/exercises-dataset" target="_blank" rel="noreferrer">hasaneyldrm/exercises-dataset</a></p>
            </footer>
          </div>}

          {view === "training" && (
            <>
              <div className="page-wrap training-tabs-wrap">
                <TrainingTabs section={trainingSection} onChange={(section) => {
                  setTrainingDataInitialDate(null);
                  setTrainingSection(section);
                }} />
              </div>
              {trainingSection === "plan" && (
                <TrainingPlanView
                  plans={trainingPlans}
                  planState={trainingPlanState}
                  exercises={exercises}
                  activeSession={activeSession}
                  busy={workoutBusy || workoutLoading}
                  error={workoutError}
                  onSave={handleSaveTrainingPlan}
                  onActivate={handleActivateTrainingPlan}
                  onDuplicate={handleDuplicateTrainingPlan}
                  onDelete={handleDeleteTrainingPlan}
                  onStartDay={handleStartPlanDay}
                />
              )}
              {trainingSection === "record" && (
                <TodayWorkoutView
                  session={activeSession}
                  todaySummary={todaySummary}
                  exerciseLookup={exerciseLookup}
                  busy={workoutBusy}
                  error={workoutError}
                  lastSavedAt={lastSavedAt}
                  companion={workoutCompanion || null}
                  companionDefinition={workoutCompanionDefinition}
                  companionSettings={companionSettings}
                  runtime={workoutRuntime}
                  onBrowse={() => setView("library")}
                  onViewTodayData={showTodayTrainingData}
                  onSetChange={handleSetChange}
                  onAddSet={(id) => void handleAddSet(id)}
                  onDeleteSet={(id) => void handleDeleteSet(id)}
                  onRemoveExercise={(id) => void handleRemoveExercise(id)}
                  onStartSet={(exerciseId, setId) => void handleStartSet(exerciseId, setId)}
                  onCompleteSet={handleCompleteSet}
                  onPauseRuntime={() => void transitionRuntime("paused")}
                  onResumeRuntime={() => void transitionRuntime("working", true)}
                  onSkipRest={() => void transitionRuntime("idle", true)}
                  onOpenPartner={() => setView("partner")}
                  onFinish={() => requestFinishWorkout("completed")}
                  onFinishEarly={() => requestFinishWorkout("early_stop")}
                />
              )}
              {trainingSection === "data" && (
                <TrainingDataView
                  exerciseLookup={exerciseLookup}
                  refreshKey={trainingDataRefreshKey}
                  initialDate={trainingDataInitialDate}
                  loadSessions={loadCompletedSessions}
                  onInitialDateConsumed={() => setTrainingDataInitialDate(null)}
                  onDeleteSession={handleDeleteSession}
                />
              )}
            </>
          )}

          {view === "partner" && (
            <CompanionView
              catalog={COMPANION_CATALOG}
              instances={companionInstances}
              active={activeCompanion}
              progress={companionProgress}
              settings={companionSettings}
              milestones={companionMilestones}
              busy={companionBusy || workoutBusy || workoutLoading}
              error={companionError}
              recoverySessionId={recoverySessionId}
              onCreate={handleCreateCompanion}
              onSwitch={handleSwitchCompanion}
              onDelete={handleDeleteCompanion}
              onSaveSettings={handleSaveCompanionSettings}
              onRecovery={handleRecoveryFeedback}
              onGoTrain={() => { setView("training"); setTrainingSection("record"); }}
            />
          )}

          {view === "account" && (
            <AccountSettingsView
              user={authUser}
              profile={profile}
              syncState={syncState}
              busy={accountBusy || workoutBusy}
              profileBusy={profileBusy}
              profileError={profileError}
              onLogout={handleLogout}
              onDelete={handleDeleteAccount}
              onSync={handleSyncNow}
              onSaveNickname={handleSaveNickname}
              onUploadAvatar={handleUploadAvatar}
              onRemoveAvatar={handleRemoveAvatar}
            />
          )}
        </main>
      </div>

      <ExerciseDialog
        exercise={selected}
        onClose={() => setSelected(null)}
        onAdd={(exercise) => void handleAddExercise(exercise)}
        added={Boolean(selected && activeExerciseIds.has(selected.id))}
        adding={workoutBusy || workoutLoading}
      />
      <ActiveWorkoutConflict sessions={syncState.conflicts} onResolve={(id) => void handleResolveConflict(id)} />
      <WorkoutFeedbackDialog
        open={feedbackOpen}
        busy={workoutBusy}
        onSubmit={(rpe, feeling) => void finishWorkout({ rpe, feeling })}
        onSkip={() => void finishWorkout({ rpe: null, feeling: null })}
        onCancel={() => setFeedbackOpen(false)}
      />
      <CompanionSettlementDialog
        settlement={companionSettlement}
        summary={settlementSummary}
        definition={companionSettlement ? companionDefinitionFor(companionSettlement.companion) : null}
        settings={companionSettings}
        onClose={() => setCompanionSettlement(null)}
      />
    </>
  );
}
