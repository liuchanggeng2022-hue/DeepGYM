# DeepGYM

DeepGYM 是一款面向健身人士的 macOS / Windows 桌面应用。产品将围绕两个核心场景展开：

1. 训练前和训练中查看动作指导；
2. 训练结束后记录组数、次数和重量，并生成当天训练总结。

当前仓库处于第一阶段：产品与技术路线已经整理，动作指导功能已经迁移为 **Tauri 2 + React + TypeScript** 桌面应用。macOS Apple Silicon 的 `.app` 与 `.dmg` 已完成本地构建和启动验证；Windows 工程配置已经具备，安装包仍需在 Windows 或 CI 构建机上生成和测试。

## 当前可用功能

- 浏览 1,324 个动作的元数据；
- 按身体部位和器械筛选；
- 按中文常用名、英文名、目标肌群搜索；
- 查看动作动图、中文分步说明、目标肌群和辅助肌群；
- 暂停/继续动图（暂停时显示静态缩略图）；
- 数据加载、空结果、动图加载失败等状态；
- 明示并保留 Gym visual 媒体署名。

## 启动桌面开发版

项目依赖和 Rust 已安装后，运行：

```bash
npm run dev
```

命令会启动 Vite，并打开 DeepGYM 的 Tauri 桌面窗口。退出开发服务时按 `Control + C`。

只在浏览器中预览 React 界面：

```bash
npm run dev:web
```

早期无框架原型仍保留在 `prototype/`，需要时运行 `npm run dev:prototype`。

检查 TypeScript、动作数据和原型语法：

```bash
npm run check
```

## 重要：动图许可

动作文字和数据结构使用 MIT 许可；图片与 GIF 不在 MIT 许可内，版权属于 Gym visual。产品所有者已于 2026-07-21 确认取得 DeepGYM 所需许可，并选择方案 A：应用从固定上游版本远程加载媒体，不将媒体复制进仓库、安装包或自有 CDN。授权证明不放入公开仓库；每次正式发布前仍需核对发布方式与授权原文一致。详见 [数据与媒体许可说明](docs/DATA_AND_MEDIA_LICENSE.md)。

## 项目文档

- [产品说明文档](docs/PRODUCT_SPEC.md)
- [技术路线与选择表](docs/TECHNICAL_ROUTES.md)
- [数据与媒体许可说明](docs/DATA_AND_MEDIA_LICENSE.md)
- [构建与发布说明](docs/BUILD_AND_RELEASE.md)

## 构建结果

产品所有者已于 2026-07-21 选择 **Tauri 2 + React + TypeScript**。本机已安装 Rust stable、Tauri 2、React、TypeScript 与 Vite，并完成下列未签名本地测试产物：

- macOS 应用：`src-tauri/target/release/bundle/macos/DeepGYM.app`
- macOS 安装镜像：`src-tauri/target/release/bundle/dmg/DeepGYM_0.1.0_aarch64.dmg`

这些产物面向 Apple Silicon，尚未使用 Apple Developer 证书签名或公证，不可作为正式公开发行包。完整命令与发布限制见 [构建与发布说明](docs/BUILD_AND_RELEASE.md)。
