# DeepGYM Supabase 配置说明

本文件记录 Dashboard 必须与仓库保持一致的配置。DeepGYM 托管项目已于 2026-07-21 在 Singapore 区域创建，数据库迁移、RLS、邮箱登录安全参数和删除账号函数已配置。当前待完成项是专用 SMTP 与邮件模板；Supabase 控制台目前不允许使用默认邮件服务的项目编辑模板。

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

## 3. 邮箱验证码

在 Authentication 中保持邮箱确认开启，将最低密码长度设为 10，并将 Email OTP length 设为 6。将邮件模板分别替换为：

- 注册确认：`supabase/email-templates/confirm-signup.html`
- 密码恢复：`supabase/email-templates/recovery.html`

模板使用 `{{ .Token }}`，应用要求输入 6 位验证码。当前 Supabase Dashboard 要求先配置 Custom SMTP 才允许编辑模板；在完成 SMTP 前，默认邮件仍会发送确认链接，无法完成应用内验证码闭环。内测时还需检查垃圾邮件目录、验证码有效期和重新发送限流是否符合预期。

## 4. 删除账号函数

在 Edge Functions 创建 `delete-account`，源码使用：

```text
supabase/functions/delete-account/index.ts
```

函数使用 `withSupabase({ auth: "user" })` 验证当前用户 JWT，并通过运行环境自动注入的 `supabaseAdmin` 删除该 Auth 用户。Dashboard 中的旧版 `Verify JWT with legacy secret` 开关保持关闭，由函数内的当前 JWT 验证承担鉴权；不要把服务端密钥复制回客户端。

## 5. 联调顺序

1. 运行 `npm run check` 与 `cargo check --manifest-path src-tauri/Cargo.toml`；
2. 启动 `npm run dev`；
3. 注册新邮箱，输入 6 位验证码并登录；
4. 创建并完成一场训练，确认本地立即可见、云端三张表均出现同一 `user_id`；
5. 断网修改一组，确认显示“离线保存”，联网后变为“已同步”；
6. 用第二个账号验证看不到第一个账号的数据；
7. 在第二台设备登录同一账号，验证历史恢复和软删除传播；
8. 验证未同步时退出会被阻止，同步后退出会清除当前账号本机副本；
9. 用测试账号完成永久删除，确认 Auth 用户、云端训练数据、本机数据和系统凭据全部消失。

## 6. 发布前仍需完成

- 配置专用 SMTP；
- 发布隐私政策和数据导出说明；
- 审查 Supabase 数据处理条款与数据区域；
- 在 Windows 真机验证 Credential Manager、登录、同步和删除账号；
- 重新生成签名后的 macOS 与 Windows 安装包。
