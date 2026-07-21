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
        <h3>{exerciseName(exercise)}</h3>
        <p className="card-english">{translated ? exercise.name : "中文常用名待整理"}</p>
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

function ExerciseDialog({ exercise, onClose }: { exercise: Exercise | null; onClose: () => void }) {
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
              <button className="primary-button" type="button" disabled title="今日训练将在第二阶段开发">
                加入今日训练 · 下一阶段
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
  const runningInTauri = "__TAURI_INTERNALS__" in window;

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

  return (
    <>
      <div className="app-layout">
        <aside className="sidebar" aria-label="主导航">
          <a className="brand" href="/" aria-label="DeepGYM 首页">
            <DumbbellIcon />
            <span>Deep<span>GYM</span></span>
          </a>

          <nav className="main-nav">
            <a className="nav-item active" href="#exercise-library" aria-current="page">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>
              <span>动作指导</span>
            </a>
            <button className="nav-item" type="button" disabled title="将在第二阶段开发">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v14H4V6a1 1 0 0 1 1-1Z" /></svg>
              <span>今日训练</span><span className="nav-badge">下一阶段</span>
            </button>
            <button className="nav-item" type="button" disabled title="将在第二阶段开发">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 19V9M12 19V5M19 19v-7" /></svg>
              <span>训练记录</span>
            </button>
          </nav>

          <div className="sidebar-note">
            <span className="status-dot" aria-hidden="true"></span>
            <div>
              <strong>{runningInTauri ? "Tauri 桌面模式" : "浏览器开发预览"}</strong>
              <p>元数据随应用提供，动图需要网络。</p>
            </div>
          </div>
        </aside>

        <main className="main-content" id="exercise-library">
          <header className="topbar">
            <button className="mobile-brand" type="button" aria-label="DeepGYM">
              <DumbbellIcon small /><strong>DeepGYM</strong>
            </button>
            <div className="topbar-state" aria-label="数据状态">
              <span className={`status-dot${error ? " error" : ""}`} aria-hidden="true"></span>
              <span>{error ? "动作数据加载失败" : loading ? "正在读取动作数据…" : `${exercises.length.toLocaleString("zh-CN")} 个动作已就绪`}</span>
            </div>
            <button className="avatar" type="button" disabled aria-label="个人资料将在后续开放">DG</button>
          </header>

          <div className="page-wrap">
            <section className="license-banner" aria-label="媒体许可提醒">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 9v4M12 17h.01M10.3 3.6 2.7 17a2 2 0 0 0 1.7 3h15.2a2 2 0 0 0 1.7-3L13.7 3.6a2 2 0 0 0-3.4 0Z" /></svg>
              <p><strong>开发预览</strong> · 动图版权属于 Gym visual，正式发布前需确认独立许可。</p>
              <a href="https://github.com/hasaneyldrm/exercises-dataset/blob/main/LICENSE" target="_blank" rel="noreferrer">查看说明</a>
            </section>

            <section className="hero" aria-labelledby="page-title">
              <div>
                <p className="eyebrow">EXERCISE LIBRARY / 动作库</p>
                <h1 id="page-title">练得更准，<span>每一下都有依据。</span></h1>
                <p className="hero-copy">搜索动作、查看循环示范和中文分步说明。先理解动作，再开始训练。</p>
              </div>
              <div className="hero-stat" aria-label="动作库统计">
                <strong>{loading ? "—" : exercises.length.toLocaleString("zh-CN")}</strong>
                <span>个动作可查</span><small>10 种身体部位 · 20+ 类器械</small>
              </div>
            </section>

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
          </div>
        </main>
      </div>

      <ExerciseDialog exercise={selected} onClose={() => setSelected(null)} />
    </>
  );
}
