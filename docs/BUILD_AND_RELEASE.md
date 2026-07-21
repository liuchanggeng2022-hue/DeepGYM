# DeepGYM 构建与发布说明

更新日期：2026-07-21

## 当前状态

- 技术栈：Tauri 2 + React 19 + TypeScript + Vite；
- macOS 架构：Apple Silicon（`aarch64`）；
- 应用标识：`com.deepgym.desktop`；
- 当前版本：`0.1.0`；
- 本地 `.app` 已实际启动并确认加载 1,324 条动作；
- `.dmg` 已通过 `hdiutil verify`，并完成只读挂载内容检查；
- 当前产物未签名、未公证，仅供本地开发测试。

## 常用命令

检查 TypeScript、数据完整性和原型语法：

```bash
npm run check
```

启动 Tauri 桌面开发版：

```bash
npm run dev
```

只启动 React 浏览器版：

```bash
npm run dev:web
```

构建 Web 资源：

```bash
npm run build:web
```

构建未签名的 macOS 本地测试包：

```bash
npm run build:mac:unsigned
```

正式构建命令保留为：

```bash
npm run build
```

正式发布前需要配置平台签名，不能把当前未签名结果直接交付公众。

## 当前 macOS 产物

- `src-tauri/target/release/bundle/macos/DeepGYM.app`
- `src-tauri/target/release/bundle/dmg/DeepGYM_0.1.0_aarch64.dmg`

构建检查时 `.app` 约 10 MB，压缩后的 `.dmg` 约 3.8 MB。大小会随功能、数据和媒体策略变化。

## macOS 正式发布前

需要产品所有者提供或决定：

1. Apple Developer Program 账号；
2. `Developer ID Application` 签名证书；
3. Apple 公证凭据；
4. 是否同时支持 Intel Mac。若需要，需要再下载 `x86_64-apple-darwin` Rust target 并构建 Universal Binary；
5. Gym visual 媒体许可已经覆盖应用分发方式。

没有签名和公证时，其他用户的 macOS 可能阻止直接打开应用。这不是应用代码错误，不能通过引导用户绕过系统安全警告来代替正式签名。

## Windows 构建计划

Tauri 的 Windows 安装包应在 Windows 或 Windows CI 构建机上生成。需要：

- Node.js 与 npm；
- Rust stable 的 MSVC 工具链；
- Microsoft C++ Build Tools；
- WebView2；
- Windows 代码签名证书或 Microsoft Store 发布配置。

Windows 阶段至少要验证搜索、筛选、GIF 播放、窗口缩放、安装/卸载与本地数据路径，不能只根据 macOS 结果判断 Windows 已完成。

## 媒体发布约束

产品所有者已确认取得 Gym visual 许可，并选择方案 A。当前动作媒体从固定 GitHub commit 远程加载；上游 `images/` 和 `videos/` 不进入仓库或安装包。正式发布前需完成 [数据与媒体许可说明](DATA_AND_MEDIA_LICENSE.md) 中尚未勾选的检查项，并确认本次发布与授权原文一致。
