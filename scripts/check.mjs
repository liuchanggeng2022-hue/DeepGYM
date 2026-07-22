import { access, readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataPath = resolve(root, "vendor/exercises-dataset/data/exercises.json");
const htmlPath = resolve(root, "prototype/index.html");
const reactHtmlPath = resolve(root, "index.html");
const reactAppPath = resolve(root, "src/App.tsx");
const workoutViewPath = resolve(root, "src/WorkoutViews.tsx");
const trainingHubViewPath = resolve(root, "src/TrainingHubViews.tsx");
const companionViewPath = resolve(root, "src/CompanionViews.tsx");
const companionCatalogPath = resolve(root, "src/companion-catalog.ts");
const companionGrowthPath = resolve(root, "src/companion-growth.ts");
const companionStoragePath = resolve(root, "src/companion-storage.ts");
const companionAssetBuilderPath = resolve(root, "scripts/build-companion-assets.py");
const companionAssetRoot = resolve(root, "public/companions/strong-bunny");
const workoutStoragePath = resolve(root, "src/workout-storage.ts");
const workoutMigrationPath = resolve(root, "src-tauri/migrations/0001_workouts.sql");
const accountMigrationPath = resolve(root, "src-tauri/migrations/0002_account_sync.sql");
const trainingHubMigrationPath = resolve(root, "src-tauri/migrations/0003_training_hub.sql");
const companionMigrationPath = resolve(root, "src-tauri/migrations/0004_companions.sql");
const syncTriggerRepairMigrationPath = resolve(root, "src-tauri/migrations/0005_repair_sync_triggers.sql");
const authServicePath = resolve(root, "src/auth-service.ts");
const syncServicePath = resolve(root, "src/sync-service.ts");
const profileServicePath = resolve(root, "src/profile-service.ts");
const rootViewPath = resolve(root, "src/Root.tsx");
const tauriLibPath = resolve(root, "src-tauri/src/lib.rs");
const cloudMigrationPath = resolve(root, "supabase/migrations/202607210001_auth_sync.sql");
const profileMigrationPath = resolve(root, "supabase/migrations/202607220001_profiles_avatars.sql");
const trainingHubCloudMigrationPath = resolve(root, "supabase/migrations/202607220002_training_hub.sql");
const companionCloudMigrationPath = resolve(root, "supabase/migrations/202607220003_companions.sql");
const deleteAccountPath = resolve(root, "supabase/functions/delete-account/index.ts");
const gitignorePath = resolve(root, ".gitignore");

const data = JSON.parse(await readFile(dataPath, "utf8"));
const html = await readFile(htmlPath, "utf8");
const reactHtml = await readFile(reactHtmlPath, "utf8");
const reactApp = await readFile(reactAppPath, "utf8");
const workoutView = await readFile(workoutViewPath, "utf8");
const trainingHubView = await readFile(trainingHubViewPath, "utf8");
const companionView = await readFile(companionViewPath, "utf8");
const companionCatalog = await readFile(companionCatalogPath, "utf8");
const companionGrowth = await readFile(companionGrowthPath, "utf8");
const companionStorage = await readFile(companionStoragePath, "utf8");
const companionAssetBuilder = await readFile(companionAssetBuilderPath, "utf8");
const workoutStorage = await readFile(workoutStoragePath, "utf8");
const workoutMigration = await readFile(workoutMigrationPath, "utf8");
const accountMigration = await readFile(accountMigrationPath, "utf8");
const trainingHubMigration = await readFile(trainingHubMigrationPath, "utf8");
const companionMigration = await readFile(companionMigrationPath, "utf8");
const syncTriggerRepairMigration = await readFile(syncTriggerRepairMigrationPath, "utf8");
const authService = await readFile(authServicePath, "utf8");
const syncService = await readFile(syncServicePath, "utf8");
const profileService = await readFile(profileServicePath, "utf8");
const rootView = await readFile(rootViewPath, "utf8");
const tauriLib = await readFile(tauriLibPath, "utf8");
const cloudMigration = await readFile(cloudMigrationPath, "utf8");
const profileMigration = await readFile(profileMigrationPath, "utf8");
const trainingHubCloudMigration = await readFile(trainingHubCloudMigrationPath, "utf8");
const companionCloudMigration = await readFile(companionCloudMigrationPath, "utf8");
const deleteAccount = await readFile(deleteAccountPath, "utf8");
const gitignore = await readFile(gitignorePath, "utf8");
const requiredFields = [
  "id", "name", "body_part", "equipment", "target", "instructions",
  "instruction_steps", "image", "gif_url", "attribution",
];

const failures = [];
if (data.length !== 1324) failures.push(`预期 1324 条动作，实际 ${data.length} 条。`);

const ids = new Set();
for (const [index, exercise] of data.entries()) {
  for (const field of requiredFields) {
    if (!(field in exercise)) failures.push(`第 ${index + 1} 条动作缺少字段 ${field}。`);
  }
  if (ids.has(exercise.id)) failures.push(`动作 ID 重复：${exercise.id}。`);
  ids.add(exercise.id);
  if (!exercise.attribution?.includes("Gym visual")) failures.push(`动作 ${exercise.id} 缺少 Gym visual 署名。`);
  if (!exercise.image?.startsWith("images/")) failures.push(`动作 ${exercise.id} 的缩略图路径不正确。`);
  if (!exercise.gif_url?.startsWith("videos/")) failures.push(`动作 ${exercise.id} 的动图路径不正确。`);
}

for (const expectedText of ["DeepGYM", "© Gym visual", "exerciseDialog", "searchInput"]) {
  if (!html.includes(expectedText)) failures.push(`页面缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["DeepGYM", "root", "/src/main.tsx"]) {
  if (!reactHtml.includes(expectedText)) failures.push(`React 入口缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["DeepGYM", "searchInput", "ExerciseDialog"]) {
  if (!reactApp.includes(expectedText)) failures.push(`React 应用缺少关键内容：${expectedText}。`);
}

if (reactApp.includes("gymvisual.com") || reactApp.includes("© Gym visual")) {
  failures.push("React 应用仍显示已要求移除的逐动图或页脚媒体署名链接。");
}

for (const expectedText of ["完成训练并生成总结", "训练容量", "训练记录", "确认移除", "删除这条训练"]) {
  if (!workoutView.includes(expectedText)) failures.push(`训练记录界面缺少关键内容：${expectedText}。`);
}

for (const unwantedText of ["在数据源中查看", "Tauri 桌面模式", "训练先存本机"]) {
  if (reactApp.includes(unwantedText)) failures.push(`React 应用仍显示已要求移除的装饰性说明：${unwantedText}。`);
}
if (workoutView.includes("SQLite 本地保存")) failures.push("今日训练仍显示已要求移除的 SQLite 本地保存标签。");

if (reactApp.includes("window.confirm") || companionView.includes("window.confirm")) failures.push("应用仍依赖可能被桌面 WebView 阻止的系统确认窗口。");

for (const expectedText of ["训练计划", "训练记录", "训练数据", "DayPicker", "captionLayout=\"dropdown\"", "weekStartsOn={1}", "删除这条训练"]) {
  if (!trainingHubView.includes(expectedText)) failures.push(`训练分区缺少关键内容：${expectedText}。`);
}
for (const legacyView of ['view === "today"', 'view === "history"']) {
  if (reactApp.includes(legacyView)) failures.push(`主导航仍保留旧训练入口：${legacyView}。`);
}
for (const expectedText of ["TRAINING PARTNER / 搭档", "共同成长记录", "搭档图鉴", "搭档装扮", "训练反馈", "共同训练完成"]) {
  if (!companionView.includes(expectedText)) failures.push(`搭档界面缺少关键内容：${expectedText}。`);
}
for (const expectedText of ["strong-bunny", "力力兔", "motionAssets", "STRONG_BUNNY_STAGES"]) {
  if (!companionCatalog.includes(expectedText)) failures.push(`正式搭档目录缺少关键内容：${expectedText}。`);
}
for (const expectedText of ["extract_connected_background", "build_animation", "horizontal_push", "mobility"]) {
  if (!companionAssetBuilder.includes(expectedText)) failures.push(`搭档素材构建脚本缺少关键内容：${expectedText}。`);
}
const companionStageKeys = ["initial", "adaptation", "growth", "strength", "mature", "final"];
const companionMotionKeys = ["idle", "rest", "celebrate", "recover", "horizontal_push", "vertical_push", "horizontal_pull", "vertical_pull", "squat", "hinge", "lunge", "arm_isolation", "dynamic_core", "static_core", "cardio", "mobility"];
for (const stage of companionStageKeys) {
  try { await access(resolve(companionAssetRoot, "stages", `${stage}.webp`)); } catch { failures.push(`力力兔缺少阶段图片：${stage}。`); }
  for (const motion of companionMotionKeys) {
    try { await access(resolve(companionAssetRoot, "motions", stage, `${motion}.webp`)); } catch { failures.push(`力力兔缺少动画：${stage}/${motion}。`); }
  }
}
for (const expectedText of ["DAILY_GROWTH_CAP", "WEEKLY_GROWTH_CAP", "minimumDays", "nextEligibleStage", "motionFamilyForExercise"]) {
  if (!companionGrowth.includes(expectedText)) failures.push(`搭档成长引擎缺少关键内容：${expectedText}。`);
}
for (const expectedText of ["settleWorkout", "reverseWorkoutGrowth", "getRuntimeState", "companion_growth_event", "workout_feedback"]) {
  if (!companionStorage.includes(expectedText)) failures.push(`搭档存储缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["sqlite:deepgym.db", "saveSets", "completeSession", "deleteSession", "listHistory", "canonicalTimestamp", "julianday(updated_at)"]) {
  if (!workoutStorage.includes(expectedText)) failures.push(`训练存储缺少关键内容：${expectedText}。`);
}

for (const table of ["workout_session", "workout_exercise", "workout_set"]) {
  if (!workoutMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`SQLite 迁移缺少表：${table}。`);
}

for (const expectedText of ["owner_user_id", "deleted_at", "sync_outbox", "sync_state", "device_identity"]) {
  if (!accountMigration.includes(expectedText)) failures.push(`账号 SQLite 迁移缺少关键内容：${expectedText}。`);
}

for (const table of ["training_plan", "training_plan_day", "training_plan_exercise", "training_plan_state"]) {
  if (!trainingHubMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`训练分区 SQLite 迁移缺少表：${table}。`);
}
for (const expectedText of ["source_plan_day_id", "target_reps_min", "plan_state"]) {
  if (!trainingHubMigration.includes(expectedText)) failures.push(`训练分区 SQLite 迁移缺少关键内容：${expectedText}。`);
}
for (const table of ["companion_instance", "companion_state", "companion_settings", "workout_feedback", "companion_growth_event", "companion_milestone", "companion_unlock", "workout_runtime_state"]) {
  if (!companionMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`搭档 SQLite 迁移缺少表：${table}。`);
}
for (const expectedText of ["companion_instance_id", "active_duration_seconds", "end_reason", "growth_event", "companion_settings"]) {
  if (!companionMigration.includes(expectedText)) failures.push(`搭档 SQLite 迁移缺少关键内容：${expectedText}。`);
}
for (const expectedText of ["trg_session_queue_update", "trg_plan_queue_update", "INSERT INTO sync_outbox"]) {
  if (!syncTriggerRepairMigration.includes(expectedText)) failures.push(`同步触发器修复迁移缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["AuthGate", "authService.restore", "authState.status === \"offline\""]) {
  if (!rootView.includes(expectedText)) failures.push(`账号门禁缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["credential_get", "credential_set", "credential_delete", "persistSession: true"]) {
  if (!authService.includes(expectedText)) failures.push(`安全会话存储缺少关键内容：${expectedText}。`);
}
if (authService.includes("localStorage")) failures.push("Supabase 会话不得写入 localStorage。");

for (const expectedText of ["workout_sessions", "workout_exercises", "workout_sets", "pullRemote", "resolveActiveConflict"]) {
  if (!syncService.includes(expectedText)) failures.push(`同步服务缺少关键内容：${expectedText}。`);
}
for (const table of ["training_plans", "training_plan_days", "training_plan_exercises", "training_plan_states"]) {
  if (!syncService.includes(table)) failures.push(`同步服务缺少训练计划表：${table}。`);
}
for (const table of ["companion_instances", "companion_states", "companion_settings", "workout_feedback", "companion_growth_events", "companion_milestones", "companion_unlocks"]) {
  if (!syncService.includes(table)) failures.push(`同步服务缺少搭档表：${table}。`);
}

for (const expectedText of ["profiles", "avatars", "createSignedUrl", "AVATAR_MAX_BYTES", "saveNickname", "uploadAvatar"]) {
  if (!profileService.includes(expectedText)) failures.push(`个人资料服务缺少关键内容：${expectedText}。`);
}
if (!(syncService.indexOf('push("workout_sessions"') < syncService.indexOf('push("workout_exercises"')
  && syncService.indexOf('push("workout_exercises"') < syncService.indexOf('push("workout_sets"'))) {
  failures.push("同步服务没有按训练、动作、组的父子顺序上传。");
}

for (const table of ["workout_sessions", "workout_exercises", "workout_sets"]) {
  if (!cloudMigration.includes(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`)) failures.push(`云端表未启用 RLS：${table}。`);
}
for (const expectedText of ["auth.uid()", "ON DELETE CASCADE", "ignore_stale_client_write"]) {
  if (!cloudMigration.includes(expectedText)) failures.push(`云端安全迁移缺少关键内容：${expectedText}。`);
}

for (const expectedText of [
  "CREATE TABLE IF NOT EXISTS public.profiles",
  "ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY",
  "Users read own profile",
  "Users upload own avatars",
  "Users delete own avatars",
  "5242880",
  "false",
]) {
  if (!profileMigration.includes(expectedText)) failures.push(`个人资料云端迁移缺少关键内容：${expectedText}。`);
}

for (const table of ["training_plans", "training_plan_days", "training_plan_exercises", "training_plan_states"]) {
  if (!trainingHubCloudMigration.includes(`public.${table}`)) failures.push(`训练计划云端迁移缺少表：${table}。`);
}
for (const expectedText of ["ENABLE ROW LEVEL SECURITY", "auth.uid()", "source_plan_day_id", "target_reps_min"]) {
  if (!trainingHubCloudMigration.includes(expectedText)) failures.push(`训练计划云端迁移缺少关键内容：${expectedText}。`);
}
for (const table of ["companion_instances", "companion_states", "companion_settings", "workout_feedback", "companion_growth_events", "companion_milestones", "companion_unlocks"]) {
  if (!companionCloudMigration.includes(`public.${table}`)) failures.push(`搭档云端迁移缺少表：${table}。`);
}
for (const expectedText of ["ENABLE ROW LEVEL SECURITY", "auth.uid()", "active_duration_seconds", "ON DELETE CASCADE"]) {
  if (!companionCloudMigration.includes(expectedText)) failures.push(`搭档云端迁移缺少关键内容：${expectedText}。`);
}

for (const expectedText of ["credential_get", "credential_set", "credential_delete", "keyring::Entry"]) {
  if (!tauriLib.includes(expectedText)) failures.push(`系统凭据命令缺少关键内容：${expectedText}。`);
}
if (!tauriLib.includes('version: 5') || !tauriLib.includes('0005_repair_sync_triggers.sql')) {
  failures.push("Tauri 尚未注册同步触发器修复迁移。");
}

if (!deleteAccount.includes("auth.admin.deleteUser")) failures.push("删除账号函数没有调用服务端 Auth 删除接口。");
if (
  !deleteAccount.includes("auth.getUser") &&
  !deleteAccount.includes('withSupabase({ auth: "user" }')
) {
  failures.push("删除账号函数没有先验证请求 JWT。");
}
if (!gitignore.includes(".env.local")) failures.push(".env.local 尚未被 Git 忽略。");

if (failures.length) {
  console.error(`检查失败，共 ${failures.length} 项：`);
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  if (failures.length > 30) console.error(`- 另有 ${failures.length - 30} 项未显示。`);
  process.exitCode = 1;
} else {
  console.log(`检查通过：${data.length} 条动作、${ids.size} 个唯一 ID，以及动作指导、训练中心、搭档成长、账号同步和 SQLite/Supabase 迁移结构完整。`);
}
