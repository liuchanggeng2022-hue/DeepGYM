import { lazy, Suspense, type FormEvent, useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { zhCN } from "react-day-picker/locale";
import "react-day-picker/style.css";
import { exerciseName, normalize } from "./exercise-data";
import { summarizeSessions } from "./workout-summary";
import type { IndexedExercise } from "./types";
import type {
  TrainingPlan,
  TrainingPlanInput,
  TrainingPlanState,
  TrainingSection,
  WorkoutSession,
} from "./workout-types";

const WEEKDAYS = [
  { value: 1, short: "周一", label: "星期一" },
  { value: 2, short: "周二", label: "星期二" },
  { value: 3, short: "周三", label: "星期三" },
  { value: 4, short: "周四", label: "星期四" },
  { value: 5, short: "周五", label: "星期五" },
  { value: 6, short: "周六", label: "星期六" },
  { value: 7, short: "周日", label: "星期日" },
];

const DayPicker = lazy(() => import("react-day-picker").then((module) => ({ default: module.DayPicker })));

const weekdayLabel = (value: number) => WEEKDAYS.find((day) => day.value === value)?.short || `第 ${value} 天`;
const currentWeekday = () => new Date().getDay() || 7;

function createDraft(plan?: TrainingPlan): TrainingPlanInput {
  return plan ? {
    id: plan.id,
    name: plan.name,
    days: plan.days.map((day) => ({
      id: day.id,
      weekday: day.weekday,
      title: day.title,
      position: day.position,
      exercises: day.exercises.map((exercise) => ({
        id: exercise.id,
        exerciseId: exercise.exerciseId,
        position: exercise.position,
        targetSets: exercise.targetSets,
        targetRepsMin: exercise.targetRepsMin,
        targetRepsMax: exercise.targetRepsMax,
      })),
    })),
  } : { name: "", days: [] };
}

export function TrainingTabs({ section, onChange }: { section: TrainingSection; onChange: (section: TrainingSection) => void }) {
  const tabs: Array<{ id: TrainingSection; label: string; caption: string }> = [
    { id: "plan", label: "训练计划", caption: "安排每周训练" },
    { id: "record", label: "训练记录", caption: "记录今天每一组" },
    { id: "data", label: "训练数据", caption: "按日期回顾" },
  ];
  return (
    <nav className="training-tabs" aria-label="训练功能">
      {tabs.map((tab) => (
        <button key={tab.id} type="button" className={section === tab.id ? "active" : ""} aria-current={section === tab.id ? "page" : undefined} onClick={() => onChange(tab.id)}>
          <strong>{tab.label}</strong><span>{tab.caption}</span>
        </button>
      ))}
    </nav>
  );
}

function PlanExercisePicker({
  exercises,
  excludedIds,
  onPick,
}: {
  exercises: IndexedExercise[];
  excludedIds: Set<string>;
  onPick: (exerciseId: string) => void;
}) {
  const [query, setQuery] = useState("");
  const matches = useMemo(() => {
    const token = normalize(query);
    if (!token) return [];
    return exercises.filter((exercise) => !excludedIds.has(exercise.id) && exercise.searchIndex.includes(token)).slice(0, 6);
  }, [excludedIds, exercises, query]);
  return (
    <div className="plan-exercise-picker">
      <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索并添加动作" aria-label="搜索计划动作" />
      {query && (
        <div className="plan-exercise-results">
          {matches.map((exercise) => <button type="button" key={exercise.id} onClick={() => { onPick(exercise.id); setQuery(""); }}>{exerciseName(exercise)}<span>{exercise.name}</span></button>)}
          {matches.length === 0 && <p>没有可添加的匹配动作</p>}
        </div>
      )}
    </div>
  );
}

function PlanEditor({
  plan,
  exercises,
  busy,
  onClose,
  onSave,
}: {
  plan?: TrainingPlan;
  exercises: IndexedExercise[];
  busy: boolean;
  onClose: () => void;
  onSave: (input: TrainingPlanInput) => Promise<void>;
}) {
  const [step, setStep] = useState<1 | 2>(1);
  const [draft, setDraft] = useState<TrainingPlanInput>(() => createDraft(plan));
  const [error, setError] = useState("");
  const lookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);

  const toggleDay = (weekday: number) => {
    setDraft((current) => {
      const existing = current.days.find((day) => day.weekday === weekday);
      if (existing) return { ...current, days: current.days.filter((day) => day.weekday !== weekday).map((day, position) => ({ ...day, position })) };
      const day = { weekday, title: `${weekdayLabel(weekday)}训练`, position: current.days.length, exercises: [] };
      return { ...current, days: [...current.days, day].sort((a, b) => a.weekday - b.weekday).map((item, position) => ({ ...item, position })) };
    });
  };

  const updateDay = (weekday: number, patch: Partial<TrainingPlanInput["days"][number]>) => {
    setDraft((current) => ({ ...current, days: current.days.map((day) => day.weekday === weekday ? { ...day, ...patch } : day) }));
  };

  const addExercise = (weekday: number, exerciseId: string) => {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => day.weekday === weekday ? {
        ...day,
        exercises: [...day.exercises, { exerciseId, position: day.exercises.length, targetSets: 3, targetRepsMin: 8, targetRepsMax: 12 }],
      } : day),
    }));
  };

  const updateExercise = (weekday: number, exerciseId: string, patch: Partial<TrainingPlanInput["days"][number]["exercises"][number]>) => {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => day.weekday === weekday ? {
        ...day,
        exercises: day.exercises.map((exercise) => exercise.exerciseId === exerciseId ? { ...exercise, ...patch } : exercise),
      } : day),
    }));
  };

  const moveExercise = (weekday: number, index: number, direction: -1 | 1) => {
    setDraft((current) => ({
      ...current,
      days: current.days.map((day) => {
        if (day.weekday !== weekday) return day;
        const next = [...day.exercises];
        const target = index + direction;
        if (target < 0 || target >= next.length) return day;
        const currentExercise = next[index];
        const targetExercise = next[target];
        if (!currentExercise || !targetExercise) return day;
        next[index] = targetExercise;
        next[target] = currentExercise;
        return { ...day, exercises: next.map((exercise, position) => ({ ...exercise, position })) };
      }),
    }));
  };

  const continueToExercises = () => {
    setError("");
    if (!draft.name.trim()) return setError("请填写计划名称。");
    if (draft.days.length === 0) return setError("请至少选择一个训练日。");
    setStep(2);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    if (draft.days.some((day) => !day.title.trim() || day.exercises.length === 0)) return setError("每个训练日都需要名称和至少一个动作。");
    try { await onSave(draft); } catch (reason) { setError(reason instanceof Error ? reason.message : "训练计划保存失败。"); }
  };

  return (
    <div className="account-modal-backdrop plan-editor-backdrop" role="presentation">
      <form className="plan-editor" role="dialog" aria-modal="true" aria-labelledby="planEditorTitle" onSubmit={submit}>
        <header><div><p className="eyebrow">STEP {step} / 2</p><h2 id="planEditorTitle">{plan ? "编辑训练计划" : "创建训练计划"}</h2></div><button type="button" aria-label="关闭计划编辑器" onClick={onClose}>×</button></header>
        {step === 1 ? (
          <div className="plan-editor-step">
            <label className="plan-name-field"><span>计划名称</span><input autoFocus maxLength={50} value={draft.name} onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))} placeholder="例如：每周增肌计划" /></label>
            <fieldset className="weekday-picker"><legend>每周训练日</legend><div>{WEEKDAYS.map((day) => <button key={day.value} type="button" className={draft.days.some((item) => item.weekday === day.value) ? "active" : ""} aria-pressed={draft.days.some((item) => item.weekday === day.value)} onClick={() => toggleDay(day.value)}><strong>{day.short}</strong><span>{draft.days.some((item) => item.weekday === day.value) ? "训练" : "休息"}</span></button>)}</div></fieldset>
          </div>
        ) : (
          <div className="plan-days-editor">
            {draft.days.map((day) => {
              const excluded = new Set(day.exercises.map((exercise) => exercise.exerciseId));
              return <section className="plan-day-editor" key={day.weekday}>
                <header><strong>{weekdayLabel(day.weekday)}</strong><input maxLength={30} value={day.title} onChange={(event) => updateDay(day.weekday, { title: event.target.value })} aria-label={`${weekdayLabel(day.weekday)}训练日名称`} /></header>
                <div className="planned-exercise-editor-list">
                  {day.exercises.map((planned, index) => {
                    const exercise = lookup.get(planned.exerciseId);
                    return <article key={planned.exerciseId}>
                      <div className="planned-exercise-name"><strong>{exercise ? exerciseName(exercise) : planned.exerciseId}</strong><span>{exercise?.name}</span></div>
                      <label><span>组</span><input type="number" min={1} max={20} value={planned.targetSets} onChange={(event) => updateExercise(day.weekday, planned.exerciseId, { targetSets: Number(event.target.value) })} /></label>
                      <label><span>最低次数</span><input type="number" min={1} max={100} value={planned.targetRepsMin} onChange={(event) => updateExercise(day.weekday, planned.exerciseId, { targetRepsMin: Number(event.target.value) })} /></label>
                      <label><span>最高次数</span><input type="number" min={1} max={100} value={planned.targetRepsMax} onChange={(event) => updateExercise(day.weekday, planned.exerciseId, { targetRepsMax: Number(event.target.value) })} /></label>
                      <div className="planned-exercise-controls"><button type="button" disabled={index === 0} aria-label="上移动作" onClick={() => moveExercise(day.weekday, index, -1)}>↑</button><button type="button" disabled={index === day.exercises.length - 1} aria-label="下移动作" onClick={() => moveExercise(day.weekday, index, 1)}>↓</button><button type="button" aria-label="移除动作" onClick={() => updateDay(day.weekday, { exercises: day.exercises.filter((item) => item.exerciseId !== planned.exerciseId).map((item, position) => ({ ...item, position })) })}>×</button></div>
                    </article>;
                  })}
                </div>
                <PlanExercisePicker exercises={exercises} excludedIds={excluded} onPick={(exerciseId) => addExercise(day.weekday, exerciseId)} />
              </section>;
            })}
          </div>
        )}
        {error && <div className="auth-error" role="alert">{error}</div>}
        <footer>{step === 2 && <button className="secondary-button" type="button" onClick={() => setStep(1)}>上一步</button>}<button className="secondary-button" type="button" onClick={onClose}>取消</button>{step === 1 ? <button className="primary-button compact" type="button" onClick={continueToExercises}>下一步：安排动作</button> : <button className="primary-button compact" type="submit" disabled={busy}>{busy ? "正在保存…" : "保存计划"}</button>}</footer>
      </form>
    </div>
  );
}

export function TrainingPlanView({
  plans,
  planState,
  exercises,
  activeSession,
  busy,
  error,
  onSave,
  onActivate,
  onDuplicate,
  onDelete,
  onStartDay,
}: {
  plans: TrainingPlan[];
  planState: TrainingPlanState;
  exercises: IndexedExercise[];
  activeSession: WorkoutSession | null;
  busy: boolean;
  error: string;
  onSave: (input: TrainingPlanInput) => Promise<void>;
  onActivate: (planId: string | null) => Promise<void>;
  onDuplicate: (planId: string) => Promise<void>;
  onDelete: (planId: string) => Promise<void>;
  onStartDay: (dayId: string) => Promise<void>;
}) {
  const [editing, setEditing] = useState<TrainingPlan | "new" | null>(null);
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [pendingStart, setPendingStart] = useState<string | null>(null);
  const activePlan = plans.find((plan) => plan.id === planState.activePlanId) || null;
  const lookup = useMemo(() => new Map(exercises.map((exercise) => [exercise.id, exercise])), [exercises]);
  const today = currentWeekday();

  const start = async (dayId: string) => {
    if (activeSession) return setPendingStart(dayId);
    await onStartDay(dayId);
  };

  return (
    <div className="training-section-page plan-page">
      <header className="training-section-header"><div><p className="eyebrow">TRAINING PLAN / 训练计划</p><h1>让每一周，都有清晰安排。</h1><p>设置训练日、动作、目标组数和次数范围；实际重量在训练时记录。</p></div><button className="primary-button compact" type="button" onClick={() => setEditing("new")}>添加训练计划</button></header>
      {error && <div className="workout-error" role="alert">{error}</div>}
      {activePlan ? (
        <section className="active-plan-card">
          <header><div><span>当前计划</span><h2>{activePlan.name}</h2></div><button className="secondary-button compact" type="button" onClick={() => setEditing(activePlan)}>编辑计划</button></header>
          <div className="active-plan-week">
            {WEEKDAYS.map((weekday) => {
              const day = activePlan.days.find((item) => item.weekday === weekday.value);
              return <article key={weekday.value} className={`${day ? "scheduled" : "rest"}${weekday.value === today ? " today" : ""}`}><span>{weekday.short}{weekday.value === today ? " · 今天" : ""}</span>{day ? <><strong>{day.title}</strong><p>{day.exercises.length} 个动作</p><button type="button" disabled={busy} onClick={() => void start(day.id)}>开始训练</button></> : <><strong>休息</strong><p>恢复与准备</p></>}</article>;
            })}
          </div>
        </section>
      ) : <section className="workout-empty plan-empty"><p className="eyebrow">NO ACTIVE PLAN</p><h2>还没有正在执行的计划</h2><p>创建一套周期计划，或从已保存计划中选择一套启用。</p><button className="primary-button" type="button" onClick={() => setEditing("new")}>创建第一套计划</button></section>}

      {plans.length > 0 && <section className="saved-plans"><div className="section-heading"><div><h2>已保存计划</h2><p>可以保存多套计划，但同一时间只启用一套。</p></div></div><div className="saved-plan-grid">{plans.map((plan) => <article className={plan.id === activePlan?.id ? "active" : ""} key={plan.id}><div><span>{plan.id === activePlan?.id ? "当前计划" : `${plan.days.length} 个训练日`}</span><h3>{plan.name}</h3><p>{plan.days.map((day) => weekdayLabel(day.weekday)).join(" · ")}</p></div><div className="saved-plan-actions">{plan.id === activePlan?.id ? <button type="button" onClick={() => void onActivate(null)}>停用</button> : <button type="button" onClick={() => void onActivate(plan.id)}>设为当前</button>}<button type="button" onClick={() => setEditing(plan)}>编辑</button><button type="button" onClick={() => void onDuplicate(plan.id)}>复制</button>{pendingDelete === plan.id ? <><button className="danger-confirm-button" type="button" onClick={() => { setPendingDelete(null); void onDelete(plan.id); }}>确认删除</button><button type="button" onClick={() => setPendingDelete(null)}>取消</button></> : <button className="danger-text-button" type="button" onClick={() => setPendingDelete(plan.id)}>删除</button>}</div></article>)}</div></section>}

      {editing && <PlanEditor plan={editing === "new" ? undefined : editing} exercises={exercises} busy={busy} onClose={() => setEditing(null)} onSave={async (input) => { await onSave(input); setEditing(null); }} />}
      {pendingStart && <div className="account-modal-backdrop" role="presentation"><section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="mergePlanTitle"><p className="eyebrow">ACTIVE WORKOUT</p><h2 id="mergePlanTitle">合并到正在进行的训练？</h2><p>计划中尚未加入的动作会添加到当前训练，已有动作和组数不会被覆盖。</p><div className="account-modal-actions"><button type="button" onClick={() => setPendingStart(null)}>取消</button><button className="primary-button compact" type="button" onClick={() => { const id = pendingStart; setPendingStart(null); void onStartDay(id); }}>合并计划动作</button></div></section></div>}
    </div>
  );
}

function localDayBounds(day: Date) {
  const start = new Date(day.getFullYear(), day.getMonth(), day.getDate());
  const end = new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function monthBounds(month: Date) {
  const start = new Date(month.getFullYear(), month.getMonth(), 1);
  const end = new Date(month.getFullYear(), month.getMonth() + 1, 1);
  return { startAt: start.toISOString(), endAt: end.toISOString() };
}

function sessionDateKey(session: WorkoutSession) {
  return format(new Date(session.endedAt || session.updatedAt), "yyyy-MM-dd");
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

export function TrainingDataView({
  exerciseLookup,
  refreshKey,
  initialDate,
  loadSessions,
  onInitialDateConsumed,
  onDeleteSession,
}: {
  exerciseLookup: Map<string, IndexedExercise>;
  refreshKey: number;
  initialDate: Date | null;
  loadSessions: (startAt: string, endAt: string) => Promise<WorkoutSession[]>;
  onInitialDateConsumed: () => void;
  onDeleteSession: (sessionId: string) => Promise<void>;
}) {
  const [month, setMonth] = useState(() => initialDate || new Date());
  const [monthSessions, setMonthSessions] = useState<WorkoutSession[]>([]);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(initialDate || undefined);
  const [selectedSessions, setSelectedSessions] = useState<WorkoutSession[]>([]);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    const bounds = monthBounds(month);
    void loadSessions(bounds.startAt, bounds.endAt).then((sessions) => { if (active) setMonthSessions(sessions); }).catch((reason) => { if (active) setError(reason instanceof Error ? reason.message : "训练数据读取失败。"); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [loadSessions, month, refreshKey]);

  useEffect(() => {
    if (!initialDate) return;
    setMonth(initialDate);
    setSelectedDate(initialDate);
    const bounds = localDayBounds(initialDate);
    void loadSessions(bounds.startAt, bounds.endAt).then(setSelectedSessions);
    onInitialDateConsumed();
  }, [initialDate, loadSessions, onInitialDateConsumed, refreshKey]);

  const trainingDates = useMemo(() => [...new Set(monthSessions.map(sessionDateKey))].map((key) => {
    const [year = 0, monthValue = 1, day = 1] = key.split("-").map(Number);
    return new Date(year, monthValue - 1, day);
  }), [monthSessions]);

  const selectDate = async (date: Date | undefined) => {
    if (!date) return;
    setSelectedDate(date);
    const bounds = localDayBounds(date);
    try { setSelectedSessions(await loadSessions(bounds.startAt, bounds.endAt)); setError(""); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "训练数据读取失败。"); }
  };

  const summary = summarizeSessions(selectedSessions);
  return (
    <div className="training-section-page training-data-page">
      <header className="training-section-header"><div><p className="eyebrow">TRAINING DATA / 训练数据</p><h1>从日历里，看见每一次积累。</h1><p>选择任意日期，查看当天完成的动作、组数、重量和次数。</p></div><div className="calendar-legend"><i></i><span>有训练记录</span></div></header>
      {error && <div className="workout-error" role="alert">{error}</div>}
      <section className="training-calendar-card" aria-busy={loading}>
        <Suspense fallback={<div className="training-calendar-loading">正在打开日历…</div>}>
          <DayPicker mode="single" selected={selectedDate} onSelect={(date) => void selectDate(date)} month={month} onMonthChange={setMonth} captionLayout="dropdown" locale={zhCN} weekStartsOn={1} timeZone={timeZone} startMonth={new Date(new Date().getFullYear() - 10, 0)} endMonth={new Date(new Date().getFullYear() + 2, 11)} modifiers={{ trained: trainingDates }} modifiersClassNames={{ trained: "training-calendar-day--trained" }} />
        </Suspense>
        <aside><span>{format(month, "yyyy 年 M 月")}</span><strong>{monthSessions.length}</strong><p>次已完成训练</p><div><b>{summarizeSessions(monthSessions).setCount}</b><small>完成组数</small></div><div><b>{summarizeSessions(monthSessions).volumeKg.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} kg</b><small>训练容量</small></div></aside>
      </section>
      {selectedDate && <div className="account-modal-backdrop training-data-dialog-backdrop" role="presentation"><section className="training-data-dialog" role="dialog" aria-modal="true" aria-labelledby="trainingDataDialogTitle"><header><div><p className="eyebrow">DAILY RECORD</p><h2 id="trainingDataDialogTitle">{format(selectedDate, "yyyy 年 M 月 d 日")}</h2></div><button type="button" aria-label="关闭训练数据" onClick={() => { setPendingDeleteId(null); setSelectedDate(undefined); }}>×</button></header>{selectedSessions.length ? <><div className="daily-data-summary"><div><span>训练</span><strong>{summary.sessionCount}</strong></div><div><span>动作</span><strong>{summary.exerciseCount}</strong></div><div><span>组数</span><strong>{summary.setCount}</strong></div><div><span>次数</span><strong>{summary.repCount}</strong></div><div><span>容量</span><strong>{summary.volumeKg.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} kg</strong></div></div>{selectedSessions.map((session, sessionIndex) => <section className="daily-session-table" key={session.id}><div className="daily-session-heading"><div><strong>训练 {sessionIndex + 1}</strong><span>{format(new Date(session.startedAt), "HH:mm")} – {session.endedAt ? format(new Date(session.endedAt), "HH:mm") : "—"} · {formatDuration(summarizeSessions([session]).durationMinutes)}</span></div>{pendingDeleteId === session.id ? <div className="history-delete-confirm"><span>删除后会同步到其他设备</span><button className="danger-confirm-button" type="button" onClick={async () => { try { await onDeleteSession(session.id); setPendingDeleteId(null); await selectDate(selectedDate); } catch (reason) { setError(reason instanceof Error ? reason.message : "删除训练记录失败。"); } }}>确认删除</button><button type="button" className="cancel-remove-button" onClick={() => setPendingDeleteId(null)}>取消</button></div> : <button className="danger-text-button" type="button" onClick={() => setPendingDeleteId(session.id)}>删除这条训练</button>}</div><div className="training-table-wrap"><table><thead><tr><th>动作</th><th>组次</th><th>重量</th><th>次数</th></tr></thead><tbody>{session.exercises.flatMap((workoutExercise) => workoutExercise.sets.filter((set) => set.completed && set.reps && set.reps > 0).map((set, index) => <tr key={set.id}><td>{exerciseLookup.get(workoutExercise.exerciseId) ? exerciseName(exerciseLookup.get(workoutExercise.exerciseId)!) : workoutExercise.exerciseId}</td><td>第 {index + 1} 组</td><td>{set.weightKg ? `${set.weightKg} kg` : "自重"}</td><td>{set.reps}</td></tr>))}</tbody></table></div></section>)}</> : <div className="training-data-empty"><span>—</span><h3>这一天没有已完成训练</h3><p>完成训练后，动作和每一组数据会出现在这里。</p></div>}</section></div>}
    </div>
  );
}
