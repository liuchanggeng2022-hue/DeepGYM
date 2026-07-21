import { useEffect, useMemo, useRef, useState } from "react";
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
  SOURCE_BASE,
} from "./exercise-data";
import type { Exercise, IndexedExercise } from "./types";
import { TodayWorkoutView, WorkoutHistoryView } from "./WorkoutViews";
import { createWorkoutRepository } from "./workout-storage";
import { summarizeDay } from "./workout-summary";
import type { AppView, WorkoutRepository, WorkoutSession, WorkoutSet } from "./workout-types";

const DATA_URL = "/data/exercises.json";

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
            <p className="media-attribution">
              <a href="https://gymvisual.com/" target="_blank" rel="noreferrer">© Gym visual — https://gymvisual.com/</a>
            </p>
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
              <a className="source-link" href={`${SOURCE_BASE}/videos`} target="_blank" rel="noreferrer">在数据源中查看</a>
            </div>
          </article>
        </div>
      )}
    </dialog>
  );
}

export default function App() {
  const [exercises, setExercises] = useState<IndexedExercise[]>([]);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [equipment, setEquipment] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selected, setSelected] = useState<IndexedExercise | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [view, setView] = useState<AppView>("library");
  const [workoutRepository, setWorkoutRepository] = useState<WorkoutRepository | null>(null);
  const [activeSession, setActiveSession] = useState<WorkoutSession | null>(null);
  const [workoutHistory, setWorkoutHistory] = useState<WorkoutSession[]>([]);
  const [workoutLoading, setWorkoutLoading] = useState(true);
  const [workoutBusy, setWorkoutBusy] = useState(false);
  const [workoutError, setWorkoutError] = useState("");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const activeSessionRef = useRef<WorkoutSession | null>(null);
  const saveTimerRef = useRef<number | null>(null);
  const dirtyDraftRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const runningInTauri = "__TAURI_INTERNALS__" in window;

  const setActiveWorkout = (session: WorkoutSession | null) => {
    activeSessionRef.current = session;
    setActiveSession(session);
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
    const initializeWorkoutStorage = async () => {
      setWorkoutLoading(true);
      try {
        const repository = await createWorkoutRepository();
        const [session, history] = await Promise.all([
          repository.getActiveSession(),
          repository.listHistory(),
        ]);
        if (!active) return;
        setWorkoutRepository(repository);
        setActiveWorkout(session);
        setWorkoutHistory(history);
        setWorkoutError("");
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
      if (saveTimerRef.current !== null) window.clearTimeout(saveTimerRef.current);
    };
  }, []);

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
      setView("today");
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
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "删除组失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleRemoveExercise = async (workoutExerciseId: string) => {
    if (!workoutRepository || !window.confirm("移除此动作及其尚未完成的组记录？")) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.removeExercise(workoutExerciseId);
      await refreshActiveWorkout();
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "移除动作失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const handleFinishWorkout = async () => {
    const session = activeSessionRef.current;
    if (!workoutRepository || !session) return;
    setWorkoutBusy(true);
    setWorkoutError("");
    try {
      await persistDraft();
      await workoutRepository.completeSession(session.id, new Date().toISOString());
      const history = await workoutRepository.listHistory();
      setWorkoutHistory(history);
      setActiveWorkout(await workoutRepository.getActiveSession());
      setLastSavedAt(new Date());
    } catch (reason) {
      setWorkoutError(reason instanceof Error ? reason.message : "完成训练失败。");
    } finally {
      setWorkoutBusy(false);
    }
  };

  const activeExerciseIds = new Set(activeSession?.exercises.map((exercise) => exercise.exerciseId) || []);
  const topbarStatus = view === "library"
    ? error ? "动作数据加载失败" : loading ? "正在读取动作数据…" : `${exercises.length.toLocaleString("zh-CN")} 个动作已就绪`
    : workoutError ? "训练记录需要处理" : workoutLoading ? "正在打开本地记录…" : workoutRepository?.mode === "sqlite" ? "SQLite 本地记录已就绪" : "浏览器预览记录已就绪";

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
            <button className={`nav-item${view === "today" ? " active" : ""}`} type="button" aria-current={view === "today" ? "page" : undefined} onClick={() => setView("today")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
              <span>今日训练</span>{activeSession && <span className="nav-badge">{activeSession.exercises.length}</span>}
            </button>
            <button className={`nav-item${view === "history" ? " active" : ""}`} type="button" aria-current={view === "history" ? "page" : undefined} onClick={() => setView("history")}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" /></svg>
              <span>训练记录</span>{workoutHistory.length > 0 && <span className="nav-badge">{workoutHistory.length}</span>}
            </button>
          </nav>

          <div className="sidebar-note">
            <span className="status-dot" aria-hidden="true"></span>
            <div>
              <strong>{runningInTauri ? "Tauri 桌面模式" : "浏览器开发预览"}</strong>
              <p>训练记录保存在本机，动图需要网络。</p>
            </div>
          </div>
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
            <button className="avatar" type="button" disabled aria-label="个人资料将在后续开放">DG</button>
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
              <p>媒体：<a href="https://gymvisual.com/" target="_blank" rel="noreferrer">© Gym visual — https://gymvisual.com/</a></p>
            </footer>
          </div>}

          {view === "today" && (
            <TodayWorkoutView
              session={activeSession}
              todaySummary={todaySummary}
              exerciseLookup={exerciseLookup}
              busy={workoutBusy}
              error={workoutError}
              storageMode={workoutRepository?.mode || null}
              lastSavedAt={lastSavedAt}
              onBrowse={() => setView("library")}
              onSetChange={handleSetChange}
              onAddSet={(id) => void handleAddSet(id)}
              onDeleteSet={(id) => void handleDeleteSet(id)}
              onRemoveExercise={(id) => void handleRemoveExercise(id)}
              onFinish={() => void handleFinishWorkout()}
            />
          )}

          {view === "history" && (
            <WorkoutHistoryView
              sessions={workoutHistory}
              exerciseLookup={exerciseLookup}
              error={workoutError}
              onBrowse={() => setView("library")}
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
    </>
  );
}
