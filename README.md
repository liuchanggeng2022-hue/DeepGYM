# DeepGYM

DeepGYM 是一款面向健身人士的 macOS / Windows 桌面应用。产品将围绕两个核心场景展开：

1. 训练前和训练中查看动作指导；
2. 训练结束后记录组数、次数和重量，并生成当天训练总结。

当前仓库已完成动作指导、训练记录 MVP，以及账号与云同步的代码实现：正式应用采用 **Tauri 2 + React + TypeScript**，训练数据先写入本机 SQLite，再通过 Supabase 同步到用户账号。新加坡 Supabase 项目、数据库 RLS、私有用户资料与头像存储、删除账号函数、Resend 专用 SMTP 与 6 位验证码邮件模板已经接通；真实注册与跨设备同步仍待使用指定测试邮箱完成端到端联调。加入账号功能后的 macOS Apple Silicon `.app` 已完成本地编译，Windows 已由 CI 编译并需在正式发布前真机测试。

## 当前可用功能

- 浏览 1,324 个动作的元数据；
- 按身体部位和器械筛选；
- 按中文常用名、英文名、目标肌群搜索；
- 查看动作动图、中文分步说明、目标肌群和辅助肌群；
- 暂停/继续动图（暂停时显示静态缩略图）；
- 数据加载、空结果、动图加载失败等状态；
- 从动作详情将动作加入今日训练；
- 记录每组重量、次数和完成状态，并可增删组；
- 自动保存进行中的训练；
- 完成训练后生成当天动作数、组数、次数、训练容量和时长总结；
- 使用 SQLite 在本机保存并查看历史训练记录；
- 邮箱密码注册、6 位验证码验证、登录和密码找回；
- macOS Keychain / Windows Credential Manager 安全保存桌面会话；
- 本地优先自动同步、跨设备恢复、软删除传播和进行中训练冲突处理；
- “我的”页面可修改用户昵称，并上传、替换或移除私有头像；
- 受保护的退出登录与账号永久删除。

## 配置账号与云同步

代码不会包含任何 Supabase 密钥。创建新加坡 Supabase 项目后，把 `.env.example` 复制为被 Git 忽略的 `.env.local`，只填入 Project URL 和 publishable key。数据库、邮件模板、删除账号函数和验收步骤见 [Supabase 配置说明](docs/SUPABASE_SETUP.md)。

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

检查 TypeScript、动作数据、训练记录关键结构和原型语法：

```bash
npm run check
```

## 重要：动图许可

动作文字和数据结构使用 MIT 许可；图片与 GIF 不在 MIT 许可内，版权属于 Gym visual。产品所有者已于 2026-07-21 确认取得 DeepGYM 所需许可，并选择媒体方案 A：应用从固定上游版本远程加载媒体，不将媒体复制进仓库、安装包或自有 CDN。授权证明不放入公开仓库；每次正式发布前仍需核对发布方式与授权原文一致。详见 [数据与媒体许可说明](docs/DATA_AND_MEDIA_LICENSE.md)。

## 项目文档

- [产品说明文档](docs/PRODUCT_SPEC.md)
- [技术路线与选择表](docs/TECHNICAL_ROUTES.md)
- [数据与媒体许可说明](docs/DATA_AND_MEDIA_LICENSE.md)
- [构建与发布说明](docs/BUILD_AND_RELEASE.md)
- [Supabase 配置说明](docs/SUPABASE_SETUP.md)

## 构建结果

产品所有者已于 2026-07-21 选择 **Tauri 2 + React + TypeScript**。本机已安装 Rust stable、Tauri 2、React、TypeScript 与 Vite，并完成下列未签名本地测试产物：

- macOS 应用：`src-tauri/target/release/bundle/macos/DeepGYM.app`
- macOS 安装镜像：`src-tauri/target/release/bundle/dmg/DeepGYM_0.1.0_aarch64.dmg`

这些产物面向 Apple Silicon，尚未使用 Apple Developer 证书签名或公证，不可作为正式公开发行包。完整命令与发布限制见 [构建与发布说明](docs/BUILD_AND_RELEASE.md)。
