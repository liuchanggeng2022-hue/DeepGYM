# DeepGYM 技术路线与选择表

版本：0.1
状态：已选择并实现方案 A；macOS 本地测试包已验证
更新日期：2026-07-21

## 1. 先说结论

三套方案都能做 macOS 和 Windows 应用。产品所有者已于 2026-07-21 选择 **方案 A：Tauri 2 + React + TypeScript**：界面开发效率高、安装包与运行内存通常更克制，也便于复用当前 Web 原型。

当前仓库已安装并配置 Tauri 2、Rust stable、React、TypeScript 与 Vite。方案 B 和 C 保留在本文中，作为决策记录和未来复盘依据。

## 2. 方案对比

| 维度 | A. Tauri 2 + React + TypeScript（建议） | B. Electron + React + TypeScript | C. Flutter + Dart |
| --- | --- | --- | --- |
| macOS / Windows | 支持 | 支持 | 支持 |
| 界面开发 | Web 技术，组件生态成熟 | Web 技术，组件生态最成熟 | Flutter 自绘 UI，跨平台一致 |
| 当前原型复用 | 高 | 高 | 低，需要重写 UI |
| 安装包与内存 | 通常较小；复用系统 WebView | 通常较大；随应用打包 Chromium 和 Node.js | 通常介于两者之间，含 Flutter 引擎 |
| 开发门槛 | 前端 + 少量 Rust；系统工具较多 | 最容易找到开发者；主要是 JS/TS | 需要 Dart / Flutter 经验 |
| 跨系统显示一致性 | 受 macOS WKWebView / Windows WebView2 差异影响 | 很高，自带同一套 Chromium | 很高，自绘渲染 |
| 原生能力 | Rust 插件与命令，权限控制细 | Node.js / 原生扩展能力强 | 插件或 Dart FFI |
| 未来做手机端 | Tauri 2 可扩展，但生态成熟度需评估 | Electron 不适合手机 | 最有优势，可共用大量代码 |
| 更新维护 | 需维护 Rust、WebView 差异和前端依赖 | 需频繁跟进 Electron / Chromium 安全版本 | 需跟进 Flutter SDK 与插件兼容 |
| 适合 DeepGYM 的情况 | 重点是轻量桌面、本地数据、现代界面 | 最看重开发速度和成熟桌面生态 | 已确定未来必须做 iOS / Android |

## 3. 每套方案的优缺点

### 方案 A：Tauri 2 + React + TypeScript

优点：

- 可复用当前 HTML/CSS/JavaScript 的视觉和交互；
- 使用系统 WebView，不需要随应用捆绑完整 Chromium；
- Rust 后端适合本地 SQLite、文件导出、更新与系统集成；
- Tauri 2 权限模型适合逐项开放本地能力；
- 对动作库 + 本地训练记录这类应用，能力充足且相对轻量。

缺点：

- 需要安装 Rust；macOS 需要 Xcode Command Line Tools，Windows 构建需要 Microsoft C++ Build Tools；
- macOS 与 Windows 使用不同系统 WebView，必须分别做视觉与行为测试；
- 遇到深层原生问题时，需要 Rust 或平台开发知识；
- Windows 和 macOS 的正式安装包通常需要分别在对应系统或 CI 上构建、签名。

适用判断：如果目标是“桌面优先、轻量、长期维护”，选择 A。

### 方案 B：Electron + React + TypeScript

优点：

- 桌面 Web 生态成熟，资料和开发者最多；
- 自带 Chromium，macOS 与 Windows 的页面显示更一致；
- Node.js 能直接处理 SQLite、文件系统、导入导出等需求；
- 当前原型复用程度高，出现问题通常更容易找到现成方案。

缺点：

- 安装包和运行内存通常明显高于 Tauri；
- 需要持续更新 Electron，以获得 Chromium / Node 安全修复；
- 主进程、预加载脚本与渲染进程需要严格隔离，配置不当会带来安全风险；
- 对功能相对聚焦的 DeepGYM，完整 Chromium 可能偏重。

适用判断：如果最看重“最快交付、成熟生态、跨平台显示一致”，选择 B。

### 方案 C：Flutter + Dart

优点：

- Windows、macOS 桌面支持稳定；
- 自绘界面在不同系统上高度一致，动效能力好；
- 如果未来明确要做 iOS 和 Android，可以共用大部分业务与界面代码；
- 对触摸友好界面和移动端布局有天然优势。

缺点：

- 当前 Web 原型不能直接复用，需要用 Dart 重写；
- 需要安装体积较大的 Flutter SDK 和各平台构建工具；
- 部分桌面能力依赖第三方插件，选择前需逐项核对 macOS / Windows 支持；
- 若团队主要是 Web 技术背景，招聘和维护成本可能更高。

适用判断：如果“未来手机端是明确的一等目标”，选择 C。

## 4. 各方案所需工具（决策记录）

### 选择 A 后

- Rust stable 工具链；
- Tauri CLI 与项目 npm 依赖；
- macOS：Xcode Command Line Tools（如果尚未安装）；
- Windows 构建机：Microsoft C++ Build Tools；Windows 10 1803+ 通常已有 WebView2；
- 后续发布：Apple Developer 签名/公证配置、Windows 代码签名证书或商店配置。

### 选择 B 后

- Electron、React、TypeScript、构建/打包工具等 npm 依赖；
- 可能按打包器要求使用平台构建工具；
- 后续发布：Apple Developer 签名/公证配置、Windows 代码签名证书或商店配置。

### 选择 C 后

- Flutter SDK（包含 Dart）；
- macOS：Xcode / Command Line Tools；
- Windows：Visual Studio 的 Desktop development with C++ 工作负载；
- 项目所需 Flutter packages；
- 后续发布：Apple Developer 签名/公证配置、Windows 代码签名证书或商店配置。

本机当前使用 Node.js 24、npm 11、Rust 1.97 与 Tauri CLI 2.11。macOS Apple Silicon 的 `.app` 和未签名 `.dmg` 已完成构建；Windows 安装包仍需在 Windows 或 CI 构建机上生成并实测。

## 5. 与技术栈无关的目标架构

```text
界面层
  ├─ 动作库 / 搜索筛选 / 动作详情
  ├─ 今日训练 / 组记录 / 休息计时
  └─ 今日总结 / 历史 / 趋势
          │
应用服务层
  ├─ ExerciseCatalog
  ├─ WorkoutSession
  ├─ WorkoutSummary
  └─ ImportExport
          │
本地存储层
  ├─ 只读动作数据（版本化）
  ├─ SQLite 训练记录
  └─ 设置与迁移
```

关键原则：

- 动作元数据和用户训练数据分开存储；
- 动作 ID 沿用来源数据，训练记录引用动作 ID；
- 写入训练记录使用事务，防止训练中途崩溃造成半条数据；
- 数据库每次升级都有迁移版本；
- 用户数据默认本地保存，未来云同步作为可选能力；
- 媒体路径通过配置提供，开发预览、已授权本地包、未来 CDN 可切换，不写死在业务逻辑里。

## 6. 建议的数据模型（阶段 2）

| 表 | 作用 | 关键字段 |
| --- | --- | --- |
| `exercise` | 只读动作目录 | `id`, `name`, `body_part`, `equipment`, `target`, `media_path` |
| `workout_session` | 一次训练 | `id`, `started_at`, `ended_at`, `note` |
| `workout_exercise` | 本次训练中的动作与顺序 | `id`, `session_id`, `exercise_id`, `position` |
| `workout_set` | 每一组 | `id`, `workout_exercise_id`, `weight`, `reps`, `completed_at` |
| `personal_record` | 可重算的个人记录缓存 | `exercise_id`, `metric`, `value`, `achieved_at` |

重量需要同时保存数值和单位；内部可统一换算，但不能只保存展示文本。训练总结应由组记录计算得出，不另存一份可能与原始记录冲突的数据。

## 7. 当前原型与迁移方式

早期 `prototype/` 使用原生 HTML、CSS 和 JavaScript，`scripts/dev-server.mjs` 只依赖 Node.js 标准库。它保留为验收基线。正式应用代码已迁移到 `src/`，由 React + TypeScript + Vite 构建，并由 `src-tauri/` 中的 Tauri 宿主封装。

保留原型的目的有两个：

1. 在不下载或选定框架前，让动作指导功能可以运行并被确认；
2. 固化搜索、筛选、详情、媒体状态和版权署名的产品行为。

当前 React 组件已复用原型的视觉、数据映射和验收标准；后续功能直接在正式应用中迭代。

## 8. 发布与测试要求

- macOS 和 Windows 都要有真实系统测试，不能只在一台 Mac 上推断 Windows 可用；
- 自动化覆盖数据解析、搜索筛选、训练容量计算和数据库迁移；
- 端到端覆盖“找动作 → 加入训练 → 记录 → 完成 → 总结”；
- 发布前完成 macOS 签名与公证、Windows 安装包签名；
- 媒体许可未解决时，不制作公开安装包；
- 健身动作文字在正式发布前由合格教练抽样或全量审核。

## 9. 技术决策结果

- [x] A — Tauri 2 + React + TypeScript（2026-07-21 已选择）
- [ ] B — Electron + React + TypeScript
- [ ] C — Flutter + Dart

决策理由：桌面优先、希望较轻量，并最大化复用当前原型。若未来 12 个月明确要求推出 iPhone / Android 版本，需要重新评估移动端路线，但不影响当前桌面阶段开始。

## 10. 官方依据

- [Tauri 2 入门与体积说明](https://v2.tauri.app/start/)
- [Tauri 2 开发前置条件](https://v2.tauri.app/start/prerequisites/)
- [Tauri 2 进程模型与系统 WebView](https://v2.tauri.app/concept/process-model/)
- [Electron 官方介绍](https://www.electronjs.org/docs/latest/)
- [Electron 选择理由与架构说明](https://www.electronjs.org/docs/latest/why-electron)
- [Flutter 桌面支持](https://docs.flutter.dev/platform-integration/desktop)
