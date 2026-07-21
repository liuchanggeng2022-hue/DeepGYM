# DeepGYM Supabase 配置说明

本文件记录 Dashboard 必须与仓库保持一致的配置。DeepGYM 托管项目已于 2026-07-21 在 Singapore 区域创建，数据库迁移、RLS、邮箱登录安全参数、删除账号函数、专用 SMTP 和邮件验证码模板均已配置。当前待完成项是真实邮箱端到端联调。

## 1. 创建项目与本机环境

1. 在 Supabase 创建新项目并选择 Singapore 区域；
2. 从项目设置复制 Project URL 与 publishable key；
3. 将仓库根目录 `.env.example` 复制为 `.env.local`，只填写：
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
4. 不要将 secret key、legacy service role 或数据库密码写进 `.env.local`、客户端源码、日志或 Git。

`.env.local` 已被 `.gitignore` 排除。浏览器开发预览不会持久保存真实会话；正式 Tauri 应用才会调用系统凭据管理器。

## 2. 数据库与 RLS

在 SQL Editor 完整执行：

```text
supabase/migrations/202607210001_auth_sync.sql
```

执行后确认 `workout_sessions`、`workout_exercises`、`workout_sets` 均已启用 RLS，且 authenticated 角色只能以 `auth.uid() = user_id` 读写。不要为了调试关闭 RLS。

## 3. 专用 SMTP

2026-07-21 已完成以下生产配置：

- 域名：`auth.deepgymapp.com`，在 Resend Tokyo 区域验证通过；
- DNS：Cloudflare 中已配置 Resend 要求的 DKIM、SPF、MX，以及 `_dmarc.deepgymapp.com` 的监控策略；
- Supabase Custom SMTP：主机 `smtp.resend.com`、端口 `465`、用户名 `resend`；
- 发件人：`DeepGYM <no-reply@auth.deepgymapp.com>`；
- SMTP 密码使用 Resend 的 Sending access API key，并限制到 `auth.deepgymapp.com`。密钥只保存在 Resend 和 Supabase 的加密配置中，不写入本仓库或本机环境文件。

不要用 Full access 密钥替换此凭据，也不要把 SMTP 密码复制到 `.env.local`、客户端源码、日志或 Git。

## 4. 邮箱验证码

在 Authentication 中保持邮箱确认开启，将最低密码长度设为 10，并将 Email OTP length 设为 6。将邮件模板分别替换为：

- 注册确认：`supabase/email-templates/confirm-signup.html`
- 密码恢复：`supabase/email-templates/recovery.html`

模板使用 `{{ .Token }}`，应用要求输入 6 位验证码。Dashboard 已保存以下主题：

- 注册确认：`DeepGYM 注册验证码`
- 密码恢复：`DeepGYM 密码重置验证码`

真实邮箱联调时仍需检查发件人显示、垃圾邮件目录、验证码有效期和重新发送限流是否符合预期。

## 5. 删除账号函数

在 Edge Functions 创建 `delete-account`，源码使用：

```text
supabase/functions/delete-account/index.ts
```

函数使用 `withSupabase({ auth: "user" })` 验证当前用户 JWT，并通过运行环境自动注入的 `supabaseAdmin` 删除该 Auth 用户。Dashboard 中的旧版 `Verify JWT with legacy secret` 开关保持关闭，由函数内的当前 JWT 验证承担鉴权；不要把服务端密钥复制回客户端。

## 6. 联调顺序

1. 运行 `npm run check` 与 `cargo check --manifest-path src-tauri/Cargo.toml`；
2. 启动 `npm run dev`；
3. 注册新邮箱，输入 6 位验证码并登录；
4. 创建并完成一场训练，确认本地立即可见、云端三张表均出现同一 `user_id`；
5. 断网修改一组，确认显示“离线保存”，联网后变为“已同步”；
6. 用第二个账号验证看不到第一个账号的数据；
7. 在第二台设备登录同一账号，验证历史恢复和软删除传播；
8. 验证未同步时退出会被阻止，同步后退出会清除当前账号本机副本；
9. 用测试账号完成永久删除，确认 Auth 用户、云端训练数据、本机数据和系统凭据全部消失。

## 7. 发布前仍需完成

- 使用明确指定的测试邮箱完成注册、密码找回和发信到达率联调；
- 发布隐私政策和数据导出说明；
- 审查 Supabase 数据处理条款与数据区域；
- 在 Windows 真机验证 Credential Manager、登录、同步和删除账号；
- 重新生成签名后的 macOS 与 Windows 安装包。
