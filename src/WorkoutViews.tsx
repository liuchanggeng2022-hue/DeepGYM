import { useState } from "react";
import { exerciseName, mediaUrl } from "./exercise-data";
import { summarizeSessions } from "./workout-summary";
import type { IndexedExercise } from "./types";
import type { WorkoutSession, WorkoutSet, WorkoutSummary } from "./workout-types";

type ExerciseLookup = Map<string, IndexedExercise>;

function formatTime(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(new Date(value));
}

function formatVolume(value: number) {
  return `${value.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} kg`;
}

function formatDuration(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} 小时 ${remainder} 分钟` : `${hours} 小时`;
}

function nonNegativeNumber(value: string) {
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, parsed) : null;
}

function positiveInteger(value: string) {
  const parsed = nonNegativeNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
}

function MetricCards({ summary }: { summary: WorkoutSummary }) {
  const metrics = [
    ["训练动作", `${summary.exerciseCount} 个`],
    ["完成组数", `${summary.setCount} 组`],
    ["总次数", `${summary.repCount} 次`],
    ["训练容量", formatVolume(summary.volumeKg)],
  ];
  return (
    <div className="workout-metrics">
      {metrics.map(([label, value]) => (
        <div className="metric-card" key={label}><span>{label}</span><strong>{value}</strong></div>
      ))}
    </div>
  );
}

function EmptyWorkout({ onBrowse }: { onBrowse: () => void }) {
  return (
    <section className="workout-empty">
      <span className="workout-empty-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24"><path d="M4 9v6M7 6v12M17 6v12M20 9v6M7 12h10" /></svg>
      </span>
      <p className="eyebrow">READY WHEN YOU ARE</p>
      <h2>今天还没有进行中的训练</h2>
      <p>从动作库选择动作，DeepGYM 会自动创建今日训练并准备三组空白记录。</p>
      <button className="primary-button" type="button" onClick={onBrowse}>去动作库选择动作</button>
    </section>
  );
}

function DailySummary({ summary, lookup }: { summary: WorkoutSummary; lookup: ExerciseLookup }) {
  if (summary.sessionCount === 0) return null;
  return (
    <section className="daily-summary" aria-labelledby="dailySummaryTitle">
      <div className="summary-success">
        <span aria-hidden="true">✓</span>
        <div><p className="eyebrow">TODAY COMPLETE</p><h2 id="dailySummaryTitle">今天练得不错，记录已经保存。</h2></div>
      </div>
      <MetricCards summary={summary} />
      <div className="summary-detail-grid">
        <div>
          <span>今日训练次数</span><strong>{summary.sessionCount} 次</strong>
        </div>
        <div>
          <span>累计训练时间</span><strong>{formatDuration(summary.durationMinutes)}</strong>
        </div>
      </div>
      <div className="summary-exercises">
        <h3>动作完成情况</h3>
        {summary.exercises.map((item) => {
          const exercise = lookup.get(item.exerciseId);
          return (
            <div className="summary-exercise-row" key={item.exerciseId}>
              <div><strong>{exercise ? exerciseName(exercise) : `动作 ${item.exerciseId}`}</strong><span>{item.setCount} 组 · {item.repCount} 次</span></div>
              <strong>{formatVolume(item.volumeKg)}</strong>
            </div>
          );
        })}
      </div>
    </section>
  );
}

interface TodayWorkoutProps {
  session: WorkoutSession | null;
  todaySummary: WorkoutSummary;
  exerciseLookup: ExerciseLookup;
  busy: boolean;
  error: string;
  storageMode: "sqlite" | "browser-preview" | null;
  lastSavedAt: Date | null;
  onBrowse: () => void;
  onSetChange: (setId: string, patch: Partial<WorkoutSet>) => void;
  onAddSet: (workoutExerciseId: string) => void;
  onDeleteSet: (setId: string) => void;
  onRemoveExercise: (workoutExerciseId: string) => void;
  onFinish: () => void;
}

export function TodayWorkoutView({
  session,
  todaySummary,
  exerciseLookup,
  busy,
  error,
  storageMode,
  lastSavedAt,
  onBrowse,
  onSetChange,
  onAddSet,
  onDeleteSet,
  onRemoveExercise,
  onFinish,
}: TodayWorkoutProps) {
  const [pendingRemovalId, setPendingRemovalId] = useState<string | null>(null);
  const draftSummary = session ? summarizeSessions([session]) : null;
  const hasCompletedSet = Boolean(session?.exercises.some((exercise) => exercise.sets.some((set) => set.completed)));

  return (
    <div className="page-wrap workout-page">
      <header className="subpage-header">
        <div><p className="eyebrow">TODAY'S WORKOUT / 今日训练</p><h1>把每一组，认真记下来。</h1><p>重量统一使用 kg；自重动作可以把重量留空或填写 0。</p></div>
        <div className="storage-pill">
          <span className={`status-dot${error ? " error" : ""}`}></span>
          {storageMode === "sqlite" ? "SQLite 本地保存" : storageMode === "browser-preview" ? "浏览器预览存储" : "正在准备存储"}
        </div>
      </header>

      {error && <div className="workout-error" role="alert">{error}</div>}

      {!session && <EmptyWorkout onBrowse={onBrowse} />}
      {!session && <DailySummary summary={todaySummary} lookup={exerciseLookup} />}

      {session && (
        <>
          <section className="active-workout-bar">
            <div><span>开始时间</span><strong>{formatTime(session.startedAt)}</strong></div>
            <div><span>动作</span><strong>{session.exercises.length} 个</strong></div>
            <div><span>已完成</span><strong>{draftSummary?.setCount || 0} 组</strong></div>
            <p>{lastSavedAt ? `${formatTime(lastSavedAt.toISOString())} 已自动保存` : "输入内容会自动保存"}</p>
          </section>

          <div className="workout-exercise-list">
            {session.exercises.map((workoutExercise) => {
              const exercise = exerciseLookup.get(workoutExercise.exerciseId);
              return (
                <article className="workout-exercise-card" key={workoutExercise.id}>
                  <header>
                    <div className="workout-exercise-title">
                      {exercise && <img src={mediaUrl(exercise.image)} alt="" />}
                      <div><span>动作 {workoutExercise.position + 1}</span><h2>{exercise ? exerciseName(exercise) : `动作 ${workoutExercise.exerciseId}`}</h2><p>{exercise?.name || "动作信息加载中"}</p></div>
                    </div>
                    {pendingRemovalId === workoutExercise.id ? (
                      <div className="remove-exercise-confirm" role="group" aria-label="确认移除动作">
                        <span>同时删除该动作的组记录？</span>
                        <button
                          className="danger-confirm-button"
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            setPendingRemovalId(null);
                            onRemoveExercise(workoutExercise.id);
                          }}
                        >确认移除</button>
                        <button className="cancel-remove-button" type="button" disabled={busy} onClick={() => setPendingRemovalId(null)}>取消</button>
                      </div>
                    ) : (
                      <button className="danger-text-button" type="button" disabled={busy} onClick={() => setPendingRemovalId(workoutExercise.id)}>移除动作</button>
                    )}
                  </header>

                  <div className="set-table" role="table" aria-label={`${exercise ? exerciseName(exercise) : "动作"}组记录`}>
                    <div className="set-row set-header" role="row">
                      <span>组</span><span>重量（kg）</span><span>次数</span><span>完成</span><span></span>
                    </div>
                    {workoutExercise.sets.map((set, index) => (
                      <div className={`set-row${set.completed ? " completed" : ""}`} role="row" key={set.id}>
                        <strong>{index + 1}</strong>
                        <label><span className="sr-only">第 {index + 1} 组重量</span><input type="number" min="0" step="0.5" inputMode="decimal" value={set.weightKg ?? ""} placeholder="自重" onChange={(event) => onSetChange(set.id, { weightKg: nonNegativeNumber(event.target.value) })} /></label>
                        <label><span className="sr-only">第 {index + 1} 组次数</span><input type="number" min="1" step="1" inputMode="numeric" value={set.reps ?? ""} placeholder="次数" onChange={(event) => {
                          const reps = positiveInteger(event.target.value);
                          onSetChange(set.id, reps && reps > 0
                            ? { reps }
                            : { reps, completed: false, completedAt: null });
                        }} /></label>
                        <button className="set-complete-button" type="button" disabled={!set.reps || set.reps < 1} aria-pressed={set.completed} title={!set.reps ? "请先填写次数" : set.completed ? "标记为未完成" : "标记为已完成"} onClick={() => onSetChange(set.id, { completed: !set.completed, completedAt: set.completed ? null : new Date().toISOString() })}><span aria-hidden="true">✓</span><span className="sr-only">{set.completed ? "已完成" : "未完成"}</span></button>
                        <button className="delete-set-button" type="button" disabled={busy || workoutExercise.sets.length === 1} aria-label={`删除第 ${index + 1} 组`} onClick={() => onDeleteSet(set.id)}>×</button>
                      </div>
                    ))}
                  </div>

                  <button className="add-set-button" type="button" disabled={busy} onClick={() => onAddSet(workoutExercise.id)}>＋ 添加一组</button>
                </article>
              );
            })}
          </div>

          <section className="finish-workout-panel">
            <div><p className="eyebrow">FINISH WORKOUT</p><h2>完成今天的训练</h2><p>只有标记为完成的组会计入总结；未完成的组仍会保留在本次历史记录中。</p></div>
            <button className="primary-button finish-button" type="button" disabled={busy || !hasCompletedSet} title={!hasCompletedSet ? "至少完成一组后才能结束训练" : "生成今日训练总结"} onClick={onFinish}>{busy ? "正在保存…" : "完成训练并生成总结"}</button>
          </section>
        </>
      )}
    </div>
  );
}

interface HistoryProps {
  sessions: WorkoutSession[];
  exerciseLookup: ExerciseLookup;
  error: string;
  busy: boolean;
  onBrowse: () => void;
  onDeleteSession: (sessionId: string) => void;
}

export function WorkoutHistoryView({ sessions, exerciseLookup, error, busy, onBrowse, onDeleteSession }: HistoryProps) {
  const [pendingDeletionId, setPendingDeletionId] = useState<string | null>(null);

  return (
    <div className="page-wrap workout-page">
      <header className="subpage-header">
        <div><p className="eyebrow">WORKOUT HISTORY / 训练记录</p><h1>每一次完成，都留在这里。</h1><p>记录会先保存在本机，联网后自动同步到你的账号。</p></div>
        <div className="history-count"><strong>{sessions.length}</strong><span>条训练记录</span></div>
      </header>
      {error && <div className="workout-error" role="alert">{error}</div>}
      {sessions.length === 0 && (
        <section className="workout-empty"><p className="eyebrow">NO HISTORY YET</p><h2>还没有已完成的训练</h2><p>完成第一场训练后，这里会显示动作、组数、次数和训练容量。</p><button className="primary-button" type="button" onClick={onBrowse}>去选择第一个动作</button></section>
      )}
      <div className="history-list">
        {sessions.map((session) => {
          const summary = summarizeSessions([session]);
          return (
            <details className="history-card" key={session.id}>
              <summary>
                <div><span>{session.endedAt ? formatDate(session.endedAt) : "未完成记录"}</span><strong>{formatTime(session.startedAt)} – {session.endedAt ? formatTime(session.endedAt) : "已保留"}</strong></div>
                <div className="history-summary-metrics"><span>{summary.exerciseCount} 个动作</span><span>{summary.setCount} 组</span><span>{summary.repCount} 次</span><span>{formatVolume(summary.volumeKg)}</span></div>
                <span className="history-expand" aria-hidden="true">⌄</span>
              </summary>
              <div className="history-detail">
                <div className="history-detail-toolbar">
                  <p>训练时长：{formatDuration(summary.durationMinutes)}</p>
                  {pendingDeletionId === session.id ? (
                    <div className="history-delete-confirm" role="group" aria-label="确认删除训练记录">
                      <span>删除后会同步到其他设备</span>
                      <button className="danger-confirm-button" type="button" disabled={busy} onClick={() => { setPendingDeletionId(null); onDeleteSession(session.id); }}>确认删除</button>
                      <button className="cancel-remove-button" type="button" disabled={busy} onClick={() => setPendingDeletionId(null)}>取消</button>
                    </div>
                  ) : (
                    <button className="danger-text-button" type="button" disabled={busy} onClick={() => setPendingDeletionId(session.id)}>删除这条训练</button>
                  )}
                </div>
                {session.exercises.map((workoutExercise) => {
                  const exercise = exerciseLookup.get(workoutExercise.exerciseId);
                  const completedSets = workoutExercise.sets.filter((set) => set.completed && set.reps && set.reps > 0);
                  return (
                    <div className="history-exercise" key={workoutExercise.id}>
                      <strong>{exercise ? exerciseName(exercise) : `动作 ${workoutExercise.exerciseId}`}</strong>
                      <div>{completedSets.length ? completedSets.map((set, index) => <span key={set.id}>第 {index + 1} 组 · {set.weightKg ? `${set.weightKg} kg` : "自重"} × {set.reps || 0}</span>) : <span>没有完成的组</span>}</div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        })}
      </div>
    </div>
  );
}
