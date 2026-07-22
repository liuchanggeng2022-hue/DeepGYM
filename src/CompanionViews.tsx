import { useEffect, useMemo, useRef, useState } from "react";
import { stageDefinitions, stageName } from "./companion-growth";
import type {
  CompanionDefinition,
  CompanionInstance,
  CompanionMilestone,
  CompanionMotionKey,
  CompanionProgress,
  CompanionSettings,
  CompanionSettlement,
  RecoveryFeeling,
  WorkoutFeeling,
  WorkoutRuntimeState,
} from "./companion-types";
import type { WorkoutSummary } from "./workout-types";

type CompanionPage = "home" | "catalog" | "growth" | "timeline" | "collection" | "wardrobe" | "manage" | "settings";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("zh-CN", { year: "numeric", month: "long", day: "numeric" }).format(new Date(value));
}

function formatMinutes(minutes: number) {
  if (minutes < 60) return `${minutes} 分钟`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours} 小时 ${rest} 分钟` : `${hours} 小时`;
}

function useSystemReducedMotion() {
  const [reduced, setReduced] = useState(() => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

function CompanionVisual({ companion, definition, className = "", motion = "idle", reduceMotion = false }: {
  companion: CompanionInstance;
  definition: CompanionDefinition | null;
  className?: string;
  motion?: CompanionMotionKey;
  reduceMotion?: boolean;
}) {
  const systemReducedMotion = useSystemReducedMotion();
  const stage = stageDefinitions(definition).find((item) => item.key === companion.currentStage);
  const source = reduceMotion || systemReducedMotion
    ? stage?.previewAsset || null
    : stage?.motionAssets?.[motion] || definition?.motionAssets[motion] || stage?.idleAsset || stage?.previewAsset || null;
  if (!source) return null;
  return <img className={`companion-visual motion-${motion} ${className}`} src={source} alt={`${companion.displayName}${stage?.name || "当前"}形态`} />;
}

function LockedFeature({ title, description, onBack }: { title: string; description: string; onBack: () => void }) {
  return (
    <section className="partner-locked page-wrap">
      <button className="partner-back" type="button" onClick={onBack}>返回搭档主页</button>
      <div className="partner-locked-card">
        <p className="eyebrow">COMING WITH PARTNER ASSETS</p>
        <h1>{title}</h1>
        <p>{description}</p>
        <span>将在真实训练成就和正式角色素材接入后开放</span>
      </div>
    </section>
  );
}

interface CompanionViewProps {
  catalog: CompanionDefinition[];
  instances: CompanionInstance[];
  active: CompanionInstance | null;
  progress: CompanionProgress | null;
  settings: CompanionSettings;
  milestones: CompanionMilestone[];
  busy: boolean;
  error: string;
  recoverySessionId: string | null;
  onCreate: (definition: CompanionDefinition, displayName: string) => Promise<void>;
  onSwitch: (companionId: string) => Promise<void>;
  onDelete: (companionId: string) => Promise<void>;
  onSaveSettings: (settings: CompanionSettings) => Promise<void>;
  onRecovery: (sessionId: string, recovery: RecoveryFeeling) => Promise<void>;
  onGoTrain: () => void;
}

export function CompanionView({
  catalog,
  instances,
  active,
  progress,
  settings,
  milestones,
  busy,
  error,
  recoverySessionId,
  onCreate,
  onSwitch,
  onDelete,
  onSaveSettings,
  onRecovery,
  onGoTrain,
}: CompanionViewProps) {
  const [page, setPage] = useState<CompanionPage>(active ? "home" : "catalog");
  const [selectedDefinition, setSelectedDefinition] = useState<CompanionDefinition | null>(null);
  const [name, setName] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [settingsDraft, setSettingsDraft] = useState(settings);
  const definition = active ? catalog.find((item) => item.id === active.definitionId) || null : null;

  useEffect(() => setSettingsDraft(settings), [settings]);
  useEffect(() => {
    if (active && page === "catalog" && !selectedDefinition) setPage("home");
    if (!active && page !== "catalog") setPage("catalog");
  }, [active, page, selectedDefinition]);

  if (page === "collection") return <LockedFeature title="搭档图鉴" description="查看已经遇见的搭档、成长路线和最终形态线索。" onBack={() => setPage("home")} />;
  if (page === "wardrobe") return <LockedFeature title="搭档装扮" description="运动服、装备、场景和完成特效将通过真实训练成就解锁。" onBack={() => setPage("home")} />;

  if (page === "catalog") {
    if (selectedDefinition) {
      const stages = stageDefinitions(selectedDefinition);
      return (
        <div className="page-wrap partner-page">
          <button className="partner-back" type="button" onClick={() => { setSelectedDefinition(null); setConfirming(false); }}>返回搭档选择</button>
          <section className="partner-preview">
            <div className="partner-preview-visual">
              {stages[0]?.previewAsset && <img src={stages[0].previewAsset} alt={`${selectedDefinition.name}初始形态`} />}
            </div>
            <div className="partner-preview-copy">
              <p className="eyebrow">MEET YOUR PARTNER / 搭档预览</p>
              <h1>{selectedDefinition.name}</h1>
              <p>{selectedDefinition.introduction}</p>
              <dl>
                <div><dt>成长方向</dt><dd>{selectedDefinition.growthDirection}</dd></div>
                <div><dt>成长周期</dt><dd>至少 {selectedDefinition.growthCycleDays} 天</dd></div>
                <div><dt>擅长训练</dt><dd>{selectedDefinition.specialties.join("、")}</dd></div>
                <div><dt>性格特点</dt><dd>{selectedDefinition.personality.join("、")}</dd></div>
              </dl>
              <div className="partner-stage-route">
                {stages.map((stage, index) => (
                  <div className={index === stages.length - 1 ? "locked" : ""} key={stage.key}>
                    <span>{String(index + 1).padStart(2, "0")}</span><strong>{index === stages.length - 1 ? "最终形态待探索" : stage.name}</strong>
                  </div>
                ))}
              </div>
              {!confirming ? (
                <button className="primary-button" type="button" onClick={() => { setConfirming(true); setName(selectedDefinition.name); }}>选择这名搭档</button>
              ) : (
                <form className="partner-confirm-form" onSubmit={(event) => { event.preventDefault(); void onCreate(selectedDefinition, name); }}>
                  <label><span>给搭档一个名字</span><input value={name} maxLength={24} autoFocus onChange={(event) => setName(event.target.value)} /></label>
                  <p>创建时间将成为共同成长的起点，之前的训练不会补算成长值。</p>
                  <div><button className="primary-button" type="submit" disabled={busy || !name.trim()}>{busy ? "正在创建…" : "确认创建"}</button><button className="secondary-button" type="button" onClick={() => setConfirming(false)}>再想想</button></div>
                </form>
              )}
            </div>
          </section>
        </div>
      );
    }
    return (
      <div className="page-wrap partner-page">
        <header className="partner-page-header">
          <div><p className="eyebrow">TRAINING PARTNER / 搭档</p><h1>每次训练，都有人和你一起成长。</h1><p>搭档只会读取创建之后的真实训练，并用状态、等级和成长阶段回应你的坚持。</p></div>
        </header>
        {error && <div className="workout-error" role="alert">{error}</div>}
        {catalog.length === 0 ? (
          <section className="partner-catalog-empty">
            <div>
              <p className="eyebrow">FIRST PARTNERS ARE GETTING READY</p>
              <h2>第一批搭档即将到来</h2>
              <p>角色资料与动画接入后，你可以在这里查看成长路线并创建专属搭档。你的训练记录会继续正常保存。</p>
            </div>
            <div className="partner-feature-preview">
              <article><span>01</span><strong>真实训练成长</strong><p>组数、时长、计划完成度和个人进步都会形成清晰的成长记录。</p></article>
              <article><span>02</span><strong>同步训练陪伴</strong><p>开始本组、组间休息和训练完成时，搭档会呈现对应状态。</p></article>
              <article><span>03</span><strong>六阶段探索</strong><p>时间和训练条件都满足后才会进化，不会因暂停训练而降级。</p></article>
            </div>
          </section>
        ) : (
          <div className="partner-catalog-grid">
            {catalog.map((item) => {
              const initial = stageDefinitions(item)[0];
              return <button key={item.id} type="button" onClick={() => setSelectedDefinition(item)}>
                {initial?.previewAsset && <img src={initial.previewAsset} alt="" />}
                <span>{item.growthDirection}</span><h2>{item.name}</h2><p>{item.introduction}</p><strong>查看成长路线</strong>
              </button>;
            })}
          </div>
        )}
      </div>
    );
  }

  if (!active || !progress) return null;

  if (page === "growth") {
    const stages = stageDefinitions(definition);
    return (
      <div className="page-wrap partner-page">
        <button className="partner-back" type="button" onClick={() => setPage("home")}>返回搭档主页</button>
        <header className="partner-subpage-header"><div><p className="eyebrow">GROWTH PROGRESS / 成长进度</p><h1>{active.displayName} 正在稳稳地变强。</h1></div><strong>{active.growthXp}<span>成长值</span></strong></header>
        <section className="partner-condition-card">
          <div className="partner-progress-heading"><div><span>当前阶段</span><strong>{stageName(active.currentStage, definition)}</strong></div><div><span>下一阶段</span><strong>{progress.nextStage?.name || "已到最终形态"}</strong></div></div>
          <div className="partner-progress-track"><span style={{ width: `${Math.round(progress.stageProgress * 100)}%` }} /></div>
          {progress.nextStage ? <div className="partner-condition-grid">
            <div><span>时间条件</span><strong>{progress.remainingDays ? `还需 ${progress.remainingDays} 天` : "已满足"}</strong><small>至少 {progress.nextStage.minimumDays} 天</small></div>
            <div><span>训练条件</span><strong>{progress.remainingWorkouts ? `还需 ${progress.remainingWorkouts} 次` : "已满足"}</strong><small>累计 {progress.workoutCount} 次</small></div>
            <div><span>成长条件</span><strong>{progress.remainingGrowth ? `还需 ${progress.remainingGrowth} 点` : "已满足"}</strong><small>目标 {progress.nextStage.minimumGrowth} 点</small></div>
          </div> : <p className="partner-final-note">形态成长已经完成，之后的训练会继续增加羁绊等级和纪念成就。</p>}
        </section>
        <section className="partner-growth-route"><h2>六阶段成长路线</h2>{stages.map((stage, index) => <article className={index <= progress.currentStageIndex ? "reached" : ""} key={stage.key}><span>{String(index + 1).padStart(2, "0")}</span><div><strong>{stage.name}</strong><p>{stage.description}</p></div><small>{index <= progress.currentStageIndex ? "已解锁" : `${stage.minimumDays} 天 · ${stage.minimumWorkouts} 次 · ${stage.minimumGrowth} 点`}</small></article>)}</section>
        <section className="partner-recent-growth"><h2>最近成长来源</h2>{progress.recentEvents.length ? progress.recentEvents.map((event) => <div key={event.id}><span>{formatDate(event.occurredAt)} · {event.reason}</span><strong>+{event.xpDelta}</strong></div>) : <p>完成第一次共同训练后，这里会说明每一份成长值来自哪里。</p>}</section>
      </div>
    );
  }

  if (page === "timeline") {
    return (
      <div className="page-wrap partner-page">
        <button className="partner-back" type="button" onClick={() => setPage("home")}>返回搭档主页</button>
        <header className="partner-subpage-header"><div><p className="eyebrow">GROWING TOGETHER / 共同成长记录</p><h1>属于你和 {active.displayName} 的时间线。</h1></div></header>
        <div className="partner-timeline">
          {milestones.map((item) => <article key={item.id}><time>{formatDate(item.occurredAt)}</time><div><span>{stageName(item.stage, definition)}</span><h2>{item.title}</h2><p>{item.description}</p><small>“每一步都算数，我们继续一起练。”</small></div></article>)}
          {!milestones.length && <section className="partner-simple-empty"><h2>共同回忆正在开始</h2><p>第一次共同训练后，这里会记录重要节点。</p></section>}
        </div>
      </div>
    );
  }

  if (page === "manage") {
    return (
      <div className="page-wrap partner-page">
        <button className="partner-back" type="button" onClick={() => setPage("home")}>返回搭档主页</button>
        <header className="partner-subpage-header"><div><p className="eyebrow">PARTNER MANAGEMENT / 搭档管理</p><h1>共同成长的进度都会被保留。</h1><p>同一时间只有一名搭档能获得本次训练的成长值。</p></div></header>
        <div className="partner-manage-list">{instances.map((item) => <article key={item.id}><div><span>{item.id === active.id ? "当前共同训练" : "已保存"}</span><h2>{item.displayName}</h2><p>{stageName(item.currentStage, catalog.find((entry) => entry.id === item.definitionId) || null)} · Lv.{item.level} · {item.growthXp} 成长值</p></div><div>{pendingDeleteId === item.id ? <div className="partner-delete-confirm"><span>删除后会同步移除成长数据</span><button className="danger-confirm-button" type="button" disabled={busy} onClick={() => { setPendingDeleteId(null); void onDelete(item.id); }}>确认删除</button><button className="cancel-remove-button" type="button" disabled={busy} onClick={() => setPendingDeleteId(null)}>取消</button></div> : <>{item.id !== active.id && <button className="secondary-button" type="button" disabled={busy} onClick={() => void onSwitch(item.id)}>设为当前搭档</button>}<button className="danger-text-button" type="button" disabled={busy} onClick={() => setPendingDeleteId(item.id)}>删除</button></>}</div></article>)}</div>
        <button className="primary-button" type="button" onClick={() => setPage("catalog")}>选择新的搭档</button>
      </div>
    );
  }

  if (page === "settings") {
    return (
      <div className="page-wrap partner-page">
        <button className="partner-back" type="button" onClick={() => setPage("home")}>返回搭档主页</button>
        <header className="partner-subpage-header"><div><p className="eyebrow">PARTNER SETTINGS / 搭档设置</p><h1>让陪伴保持自然，不打扰训练。</h1></div></header>
        <form className="partner-settings" onSubmit={(event) => { event.preventDefault(); void onSaveSettings(settingsDraft); }}>
          <label className="partner-setting-toggle"><div><strong>文字提示</strong><span>训练节点显示简短、积极的搭档反馈。</span></div><input type="checkbox" checked={settingsDraft.textPromptsEnabled} onChange={(event) => setSettingsDraft({ ...settingsDraft, textPromptsEnabled: event.target.checked })} /></label>
          <label><span>互动频率</span><select value={settingsDraft.interactionFrequency} onChange={(event) => setSettingsDraft({ ...settingsDraft, interactionFrequency: event.target.value as CompanionSettings["interactionFrequency"] })}><option value="low">低</option><option value="standard">标准</option><option value="high">高</option></select></label>
          <label><span>动画强度</span><select value={settingsDraft.animationIntensity} onChange={(event) => setSettingsDraft({ ...settingsDraft, animationIntensity: Number(event.target.value) })}><option value="0">安静</option><option value="1">柔和</option><option value="2">完整</option></select></label>
          <label className="partner-setting-toggle"><div><strong>减少动态效果</strong><span>保留状态变化，但减少循环动画和进化特效。</span></div><input type="checkbox" checked={settingsDraft.reduceMotion} onChange={(event) => setSettingsDraft({ ...settingsDraft, reduceMotion: event.target.checked })} /></label>
          <label><span>默认组间休息</span><select value={settingsDraft.defaultRestSeconds} onChange={(event) => setSettingsDraft({ ...settingsDraft, defaultRestSeconds: Number(event.target.value) })}><option value="60">60 秒</option><option value="90">90 秒</option><option value="120">120 秒</option><option value="180">180 秒</option></select></label>
          <label className="partner-setting-toggle"><div><strong>恢复模式</strong><span>暂停期待训练的提示，搭档会陪你专注休息和恢复。</span></div><input type="checkbox" checked={settingsDraft.recoveryMode} onChange={(event) => setSettingsDraft({ ...settingsDraft, recoveryMode: event.target.checked })} /></label>
          <button className="primary-button" type="submit" disabled={busy}>{busy ? "正在保存…" : "保存搭档设置"}</button>
        </form>
      </div>
    );
  }

  const moodText = progress.mood === "proud" ? "为今天的训练感到骄傲" : progress.mood === "resting" ? "正在轻松恢复" : progress.mood === "waiting" ? "期待从轻松活动重新开始" : progress.mood === "recovering" ? "陪你安心恢复" : "准备好一起训练";
  return (
    <div className="page-wrap partner-page partner-home">
      {error && <div className="workout-error" role="alert">{error}</div>}
      <section className="partner-hero">
        <div className="partner-character-stage">
          <CompanionVisual
            companion={active}
            definition={definition}
            motion={progress.mood === "proud" ? "celebrate" : progress.mood === "resting" ? "rest" : progress.mood === "recovering" ? "recover" : "idle"}
            reduceMotion={settings.reduceMotion || settings.animationIntensity === 0}
          />
          {!definition && <div className="partner-asset-note"><span>角色素材待接入</span><p>成长数据与训练记录已经准备好，正式形象加入后会显示在这里。</p></div>}
          <div className="partner-status-bubble">{moodText}</div>
        </div>
        <div className="partner-hero-copy">
          <p className="eyebrow">YOUR TRAINING PARTNER / 我的搭档</p>
          <div className="partner-name-row"><div><h1>{active.displayName}</h1><p>{stageName(active.currentStage, definition)} · Lv.{active.level}</p></div><button className="secondary-button compact" type="button" onClick={() => setPage("manage")}>切换与管理</button></div>
          <div className="partner-progress-card"><div><span>距离{progress.nextStage?.name || "下一段共同成长"}</span><strong>{Math.round(progress.stageProgress * 100)}%</strong></div><div className="partner-progress-track"><span style={{ width: `${Math.round(progress.stageProgress * 100)}%` }} /></div><p>{progress.nextStage ? `${progress.remainingDays ? `还需 ${progress.remainingDays} 天 · ` : ""}${progress.remainingWorkouts ? `还需 ${progress.remainingWorkouts} 次训练 · ` : ""}${progress.remainingGrowth ? `还需 ${progress.remainingGrowth} 成长值` : "训练条件已满足"}` : "继续训练可以提升羁绊等级并解锁长期纪念。"}</p></div>
          <div className="partner-hero-actions"><button className="primary-button" type="button" onClick={onGoTrain}>进入训练</button><button className="secondary-button" type="button" onClick={() => setPage("growth")}>查看成长条件</button></div>
        </div>
      </section>
      <section className="partner-stats"><article><span>今日训练</span><strong>{progress.todayCompleted ? "已完成" : "等待开始"}</strong></article><article><span>连续共同训练</span><strong>{progress.sharedStreakDays} 天</strong></article><article><span>累计共同训练</span><strong>{progress.workoutCount} 次</strong></article><article><span>共同训练时长</span><strong>{formatMinutes(progress.totalMinutes)}</strong></article></section>
      {recoverySessionId && <RecoveryCheckIn disabled={busy} onSelect={(value) => void onRecovery(recoverySessionId, value)} />}
      <section className="partner-home-grid"><article className="partner-task-card"><span>今日推荐任务</span><h2>{settings.recoveryMode ? "今天先照顾好恢复" : progress.todayCompleted ? "训练完成，记得补水和休息" : "从计划中的下一次训练开始"}</h2><p>{settings.recoveryMode ? "恢复也是共同成长的重要部分，不需要勉强完成高强度训练。" : "搭档不会奖励极端训练，稳定完成比一次练得过多更重要。"}</p><button className="text-button" type="button" onClick={onGoTrain}>打开训练记录</button></article><nav className="partner-shortcuts" aria-label="搭档功能"><button type="button" onClick={() => setPage("timeline")}><strong>共同成长记录</strong><span>查看重要节点与纪念卡</span></button><button type="button" onClick={() => setPage("wardrobe")}><strong>搭档装扮</strong><span>训练奖励与装备</span></button><button type="button" onClick={() => setPage("collection")}><strong>搭档图鉴</strong><span>成长路线与探索线索</span></button><button type="button" onClick={() => setPage("settings")}><strong>搭档设置</strong><span>互动、动画与恢复模式</span></button></nav></section>
    </div>
  );
}

function RecoveryCheckIn({ disabled, onSelect }: { disabled: boolean; onSelect: (value: RecoveryFeeling) => void }) {
  return <section className="partner-recovery-check"><div><span>次日恢复反馈</span><h2>今天身体感觉怎么样？</h2><p>这不会奖励更高强度，只帮助搭档给出更合适的休息提醒。</p></div><div>{([['recovered','恢复良好'],['mild_soreness','轻微酸痛'],['fatigued','明显疲劳'],['pain','疼痛或受伤']] as Array<[RecoveryFeeling,string]>).map(([value,label]) => <button key={value} type="button" disabled={disabled} onClick={() => onSelect(value)}>{label}</button>)}</div></section>;
}

export function TrainingCompanionPanel({ companion, definition, runtime, settings, exerciseLabel, onOpenPartner, onPause, onResume, onSkipRest }: {
  companion: CompanionInstance | null;
  definition: CompanionDefinition | null;
  runtime: WorkoutRuntimeState | null;
  settings: CompanionSettings;
  exerciseLabel: string | null;
  onOpenPartner: () => void;
  onPause: () => void;
  onResume: () => void;
  onSkipRest: () => void;
}) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (runtime?.phase !== "resting") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 1000);
    return () => window.clearInterval(timer);
  }, [runtime?.phase]);
  const remaining = runtime?.restEndsAt ? Math.max(0, Math.ceil((new Date(runtime.restEndsAt).getTime() - Date.now()) / 1000)) : 0;
  const phaseText = runtime?.phase === "preparing" ? "准备这一组" : runtime?.phase === "working" ? "正在和你一起训练" : runtime?.phase === "resting" ? "调整呼吸，准备下一组" : runtime?.phase === "paused" ? "训练已暂停" : "等待一起开始";
  const motion: CompanionMotionKey = runtime?.phase === "resting" ? "rest"
    : runtime?.phase === "paused" ? "recover"
      : runtime?.phase === "completed" ? "celebrate"
        : runtime?.phase === "working" || runtime?.phase === "preparing" ? runtime.motionFamily || "idle"
          : "idle";
  return <aside className="training-partner-panel">
    <div className="training-partner-heading"><span>共同训练搭档</span><button type="button" onClick={onOpenPartner}>查看主页</button></div>
    {companion ? <>
      <div className="training-partner-visual"><CompanionVisual companion={companion} definition={definition} motion={motion} reduceMotion={settings.reduceMotion || settings.animationIntensity === 0} /><div><strong>{companion.displayName}</strong><span>{stageName(companion.currentStage, definition)} · Lv.{companion.level}</span></div></div>
      <div className={`training-partner-state phase-${runtime?.phase || "idle"}`}><span>{phaseText}</span><strong>{runtime?.phase === "resting" ? `${remaining} 秒` : exerciseLabel || "选择一组开始"}</strong></div>
      {settings.textPromptsEnabled && <p className="training-partner-message">{runtime?.phase === "working" ? "保持自己的节奏，动作稳定比速度更重要。" : runtime?.phase === "resting" ? "先放松握力，喝口水，再准备下一组。" : "今天我们一起把每一组认真完成。"}</p>}
      <div className="training-partner-controls">{runtime?.phase === "working" && <button type="button" onClick={onPause}>暂停</button>}{runtime?.phase === "paused" && <button type="button" onClick={onResume}>继续训练</button>}{runtime?.phase === "resting" && <button type="button" onClick={onSkipRest}>跳过休息</button>}</div>
    </> : <div className="training-partner-empty"><strong>还没有当前搭档</strong><p>正式角色上线并创建搭档后，训练状态会显示在这里。</p></div>}
  </aside>;
}

export function WorkoutFeedbackDialog({ open, busy, onSubmit, onSkip, onCancel }: {
  open: boolean;
  busy: boolean;
  onSubmit: (rpe: number, feeling: WorkoutFeeling) => void;
  onSkip: () => void;
  onCancel: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const [rpe, setRpe] = useState(6);
  const [feeling, setFeeling] = useState<WorkoutFeeling>("steady");
  useEffect(() => { if (open && !ref.current?.open) ref.current?.showModal(); if (!open && ref.current?.open) ref.current.close(); }, [open]);
  return <dialog className="feedback-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); onCancel(); }}><form method="dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(rpe, feeling); }}><p className="eyebrow">QUICK CHECK-IN / 训练反馈</p><h2>完成前，记录一下今天的感受</h2><p>强度不会直接增加成长值，它只帮助搭档理解你的训练状态。</p><label className="rpe-field"><span>主观训练强度 RPE</span><strong>{rpe}</strong><input type="range" min="1" max="10" value={rpe} onChange={(event) => setRpe(Number(event.target.value))} /><small>1 很轻松 · 10 接近极限</small></label><fieldset><legend>训练后的感受</legend>{([['great','状态很好'],['steady','刚刚好'],['tired','有些疲惫'],['uncomfortable','感到不适']] as Array<[WorkoutFeeling,string]>).map(([value,label]) => <button className={feeling === value ? "selected" : ""} type="button" key={value} onClick={() => setFeeling(value)}>{label}</button>)}</fieldset>{feeling === "uncomfortable" && <aside>如果出现持续疼痛或明显不适，请停止训练并咨询合格专业人士。</aside>}<div className="feedback-actions"><button className="primary-button" type="submit" disabled={busy}>{busy ? "正在结算…" : "保存反馈并完成"}</button><button className="secondary-button" type="button" disabled={busy} onClick={onSkip}>跳过反馈并完成</button><button className="text-button" type="button" disabled={busy} onClick={onCancel}>继续训练</button></div></form></dialog>;
}

export function CompanionSettlementDialog({ settlement, summary, definition, settings, onClose }: { settlement: CompanionSettlement | null; summary: WorkoutSummary | null; definition: CompanionDefinition | null; settings: CompanionSettings; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => { if (settlement && !ref.current?.open) ref.current?.showModal(); if (!settlement && ref.current?.open) ref.current.close(); }, [settlement]);
  const details = useMemo(() => settlement ? [
    ["完成训练", settlement.breakdown.completion], ["有效组数", settlement.breakdown.sets], ["训练时长", settlement.breakdown.duration],
    ["计划完成", settlement.breakdown.plan], ["新动作", settlement.breakdown.newExercises], ["个人进步", settlement.breakdown.personalRecords],
  ].filter(([, value]) => Number(value) > 0) : [], [settlement]);
  return <dialog className="settlement-dialog" ref={ref} onCancel={(event) => { event.preventDefault(); onClose(); }}>{settlement && <div className={settlement.evolved ? "settlement-shell evolved" : "settlement-shell"}><p className="eyebrow">WE GREW TOGETHER / 共同训练完成</p><h2>{settlement.evolved ? `你的搭档进入了${stageName(settlement.currentStage, definition)}` : "今天的成长值已经收到啦"}</h2><p>{settlement.evolved ? "新的形态、动作表现与成长纪念已经解锁。" : "稳定训练正在让你和搭档一起变得更好。"}</p><div className="settlement-partner-visual"><CompanionVisual companion={settlement.companion} definition={definition} motion="celebrate" reduceMotion={settings.reduceMotion || settings.animationIntensity === 0} /><span>{settlement.companion.displayName}</span></div><div className="settlement-score"><span>本次获得</span><strong>+{settlement.growthEarned}</strong><small>成长值 · 羁绊 +{settlement.bondEarned}</small></div>{summary && <div className="settlement-metrics"><span>{summary.exerciseCount} 个动作</span><span>{summary.setCount} 组</span><span>{summary.repCount} 次</span><span>{summary.volumeKg.toLocaleString("zh-CN", { maximumFractionDigits: 1 })} kg</span></div>}<div className="settlement-breakdown">{details.map(([label,value]) => <div key={String(label)}><span>{label}</span><strong>+{value}</strong></div>)}</div>{settlement.evolved && <section className="evolution-reveal"><span>新的变化</span><strong>{stageName(settlement.currentStage, definition)}</strong><p>“谢谢你一直带着我训练，我们又变强了一点。”</p></section>}<button className="primary-button" type="button" onClick={onClose}>收下今天的成长</button></div>}</dialog>;
}
