import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataPath = resolve(root, "vendor/exercises-dataset/data/exercises.json");
const htmlPath = resolve(root, "prototype/index.html");
const reactHtmlPath = resolve(root, "index.html");
const reactAppPath = resolve(root, "src/App.tsx");
const workoutViewPath = resolve(root, "src/WorkoutViews.tsx");
const workoutStoragePath = resolve(root, "src/workout-storage.ts");
const workoutMigrationPath = resolve(root, "src-tauri/migrations/0001_workouts.sql");
const accountMigrationPath = resolve(root, "src-tauri/migrations/0002_account_sync.sql");
const authServicePath = resolve(root, "src/auth-service.ts");
const syncServicePath = resolve(root, "src/sync-service.ts");
const profileServicePath = resolve(root, "src/profile-service.ts");
const rootViewPath = resolve(root, "src/Root.tsx");
const tauriLibPath = resolve(root, "src-tauri/src/lib.rs");
const cloudMigrationPath = resolve(root, "supabase/migrations/202607210001_auth_sync.sql");
const profileMigrationPath = resolve(root, "supabase/migrations/202607220001_profiles_avatars.sql");
const deleteAccountPath = resolve(root, "supabase/functions/delete-account/index.ts");
const gitignorePath = resolve(root, ".gitignore");

const data = JSON.parse(await readFile(dataPath, "utf8"));
const html = await readFile(htmlPath, "utf8");
const reactHtml = await readFile(reactHtmlPath, "utf8");
const reactApp = await readFile(reactAppPath, "utf8");
const workoutView = await readFile(workoutViewPath, "utf8");
const workoutStorage = await readFile(workoutStoragePath, "utf8");
const workoutMigration = await readFile(workoutMigrationPath, "utf8");
const accountMigration = await readFile(accountMigrationPath, "utf8");
const authService = await readFile(authServicePath, "utf8");
const syncService = await readFile(syncServicePath, "utf8");
const profileService = await readFile(profileServicePath, "utf8");
const rootView = await readFile(rootViewPath, "utf8");
const tauriLib = await readFile(tauriLibPath, "utf8");
const cloudMigration = await readFile(cloudMigrationPath, "utf8");
const profileMigration = await readFile(profileMigrationPath, "utf8");
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

for (const expectedText of ["完成训练并生成总结", "SQLite 本地保存", "训练容量", "训练记录", "确认移除", "删除这条训练"]) {
  if (!workoutView.includes(expectedText)) failures.push(`训练记录界面缺少关键内容：${expectedText}。`);
}

if (reactApp.includes("window.confirm")) failures.push("训练记录仍依赖可能被桌面 WebView 阻止的系统确认窗口。");

for (const expectedText of ["sqlite:deepgym.db", "saveSets", "completeSession", "deleteSession", "listHistory", "canonicalTimestamp", "julianday(updated_at)"]) {
  if (!workoutStorage.includes(expectedText)) failures.push(`训练存储缺少关键内容：${expectedText}。`);
}

for (const table of ["workout_session", "workout_exercise", "workout_set"]) {
  if (!workoutMigration.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) failures.push(`SQLite 迁移缺少表：${table}。`);
}

for (const expectedText of ["owner_user_id", "deleted_at", "sync_outbox", "sync_state", "device_identity"]) {
  if (!accountMigration.includes(expectedText)) failures.push(`账号 SQLite 迁移缺少关键内容：${expectedText}。`);
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

for (const expectedText of ["credential_get", "credential_set", "credential_delete", "keyring::Entry"]) {
  if (!tauriLib.includes(expectedText)) failures.push(`系统凭据命令缺少关键内容：${expectedText}。`);
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
  console.log(`检查通过：${data.length} 条动作、${ids.size} 个唯一 ID、媒体来源数据、训练记录界面与 SQLite 迁移结构完整。`);
}
