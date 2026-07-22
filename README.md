# DeepGYM

DeepGYM 是一款面向健身人士的 macOS / Windows 桌面应用。产品围绕四个核心场景展开：

1. 训练前和训练中查看动作指导；
2. 安排周期训练计划并记录每组次数与重量；
3. 训练结束后生成总结，并按日历查询历史数据。
4. 与虚拟健身搭档共同训练，让真实训练形成长期、可解释的成长反馈。

当前仓库已完成动作指导、训练记录 MVP，以及账号与云同步的代码实现：正式应用采用 **Tauri 2 + React + TypeScript**，训练数据先写入本机 SQLite，再通过 Supabase 同步到用户账号。新加坡 Supabase 项目、数据库 RLS、私有用户资料与头像存储、删除账号函数、Resend 专用 SMTP 与 6 位验证码邮件模板已经接通；真实注册与跨设备同步仍待使用指定测试邮箱完成端到端联调。加入账号功能后的 macOS Apple Silicon `.app` 已完成本地编译，Windows 已由 CI 编译并需在正式发布前真机测试。

## 当前可用功能

- 浏览 1,324 个动作的元数据；
- 按身体部位和器械筛选；
- 按中文常用名、英文名、目标肌群搜索；
- 查看动作动图、中文分步说明、目标肌群和辅助肌群；
- 暂停/继续动图（暂停时显示静态缩略图）；
- 数据加载、空结果、动图加载失败等状态；
- 统一“训练”分区：训练计划、训练记录和训练数据；
- 创建、编辑、复制、启用、停用和软删除周期训练计划；
- 按周安排训练日、动作、目标组数和次数范围，并一键开始当天训练；
- 从动作详情将动作加入训练记录；
- 记录每组重量、次数和完成状态，并可增删组；
- 自动保存进行中的训练；
- 完成训练后生成当天动作数、组数、次数、训练容量和时长总结；
- 使用 SQLite 在本机保存记录，通过中文日历按日期查看同日多场训练；
- 邮箱密码注册、6 位验证码验证、登录和密码找回；
- macOS Keychain / Windows Credential Manager 安全保存桌面会话；
- 本地优先自动同步、跨设备恢复、软删除传播和进行中训练冲突处理；
- “我的”页面可修改用户昵称，并上传、替换或移除私有头像；
- 一级“搭档”分区、角色选择/创建流程和首个正式角色“力力兔”；
- 六阶段、至少 12 周的“时间条件＋训练条件”成长引擎；
- 训练中的“开始本组—组间休息—完成结算”节奏控制和 12 类动作状态映射；
- 训练后 RPE/感受反馈、次日恢复反馈、成长明细、里程碑时间轴和搭档切换管理；
- 搭档实例、设置、反馈、成长账本和里程碑的 SQLite 本地优先存储及 Supabase RLS 同步；
- 受保护的退出登录与账号永久删除。

首个正式搭档“力力兔”包含六阶段形象，以及每阶段独立的待机、休息、庆祝、恢复和 12 类训练动作动画。素材构建脚本为 `scripts/build-companion-assets.py`，仅用于制作透明 WebP，不增加应用运行依赖。

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
