import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("..", import.meta.url)));
const dataPath = resolve(root, "vendor/exercises-dataset/data/exercises.json");
const htmlPath = resolve(root, "prototype/index.html");
const reactHtmlPath = resolve(root, "index.html");
const reactAppPath = resolve(root, "src/App.tsx");

const data = JSON.parse(await readFile(dataPath, "utf8"));
const html = await readFile(htmlPath, "utf8");
const reactHtml = await readFile(reactHtmlPath, "utf8");
const reactApp = await readFile(reactAppPath, "utf8");
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

for (const expectedText of ["DeepGYM", "© Gym visual", "searchInput", "ExerciseDialog"]) {
  if (!reactApp.includes(expectedText)) failures.push(`React 应用缺少关键内容：${expectedText}。`);
}

if (failures.length) {
  console.error(`检查失败，共 ${failures.length} 项：`);
  for (const failure of failures.slice(0, 30)) console.error(`- ${failure}`);
  if (failures.length > 30) console.error(`- 另有 ${failures.length - 30} 项未显示。`);
  process.exitCode = 1;
} else {
  console.log(`检查通过：${data.length} 条动作、${ids.size} 个唯一 ID、媒体署名与页面关键结构完整。`);
}
