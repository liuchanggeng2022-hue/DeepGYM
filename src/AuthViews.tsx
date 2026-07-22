import { type FormEvent, useEffect, useMemo, useState } from "react";
import appIcon from "../assets/deepgym-icon.png";
import { friendlyAuthError } from "./auth-service";
import type { AuthService, AuthUser } from "./auth-types";
import type { UserProfile } from "./profile-types";
import type { SyncState, WorkoutSession } from "./workout-types";

type AuthMode = "login" | "register" | "verify-signup" | "forgot" | "verify-recovery";

function authTitle(mode: AuthMode) {
  if (mode === "register") return "创建你的训练账号";
  if (mode === "verify-signup") return "验证你的邮箱";
  if (mode === "forgot") return "找回密码";
  if (mode === "verify-recovery") return "设置新密码";
  return "欢迎回到 DeepGYM";
}

function authSubtitle(mode: AuthMode) {
  if (mode === "register") return "注册后，训练记录会安全归入你的账号。";
  if (mode === "verify-signup") return "输入邮件中的 6 位验证码，完成注册。";
  if (mode === "forgot") return "我们会向你的邮箱发送 6 位恢复验证码。";
  if (mode === "verify-recovery") return "验证码通过后，新密码会立即生效。";
  return "登录后继续训练；断网时仍会保存到当前电脑。";
}

export function AuthGate({
  service,
  initialError,
  onAuthenticated,
}: {
  service: AuthService;
  initialError?: string;
  onAuthenticated: (user: AuthUser) => void;
}) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState(initialError || "");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(0);

  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setInterval(() => setResendSeconds((value) => Math.max(0, value - 1)), 1_000);
    return () => window.clearInterval(timer);
  }, [resendSeconds]);

  const passwordMismatch = mode === "register" && confirmation && password !== confirmation;
  const passwordTooShort = (mode === "register" || mode === "verify-recovery") && password.length > 0 && password.length < 10;
  const canSubmit = useMemo(() => {
    if (!service.configured || busy || !email.trim()) return false;
    if (mode === "forgot") return true;
    if (mode === "verify-signup") return /^\d{6}$/.test(token);
    if (mode === "verify-recovery") return /^\d{6}$/.test(token) && password.length >= 10 && password === confirmation;
    if (mode === "register") return password.length >= 10 && password === confirmation;
    return Boolean(password);
  }, [busy, confirmation, email, mode, password, service.configured, token]);

  const changeMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setNotice("");
    setToken("");
    setPassword("");
    setConfirmation("");
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const cleanEmail = email.trim().toLowerCase();
      if (mode === "login") {
        onAuthenticated(await service.signIn(cleanEmail, password));
      } else if (mode === "register") {
        const result = await service.signUp(cleanEmail, password);
        if (result.needsVerification) {
          setMode("verify-signup");
          setPassword("");
          setConfirmation("");
          setResendSeconds(60);
          setNotice("验证码已经发送，请检查收件箱和垃圾邮件。 ");
        } else if (result.user) {
          onAuthenticated(result.user);
        }
      } else if (mode === "verify-signup") {
        onAuthenticated(await service.verifySignup(cleanEmail, token));
      } else if (mode === "forgot") {
        await service.requestPasswordReset(cleanEmail);
        setMode("verify-recovery");
        setResendSeconds(60);
        setNotice("恢复验证码已经发送，请检查邮箱。 ");
      } else {
        onAuthenticated(await service.verifyRecovery(cleanEmail, token, password));
      }
    } catch (reason) {
      setError(friendlyAuthError(reason));
    } finally {
      setBusy(false);
    }
  };

  const resend = async () => {
    if (busy || resendSeconds > 0) return;
    setBusy(true);
    setError("");
    try {
      if (mode === "verify-signup") await service.resendSignup(email.trim().toLowerCase());
      else await service.requestPasswordReset(email.trim().toLowerCase());
      setResendSeconds(60);
      setNotice("新的验证码已经发送。 ");
    } catch (reason) {
      setError(friendlyAuthError(reason));
    } finally {
      setBusy(false);
    }
  };

  const needsToken = mode === "verify-signup" || mode === "verify-recovery";
  const needsPassword = mode === "login" || mode === "register" || mode === "verify-recovery";
  const needsConfirmation = mode === "register" || mode === "verify-recovery";

  return (
    <main className="auth-screen">
      <section className="auth-brand-panel" aria-label="DeepGYM 账号介绍">
        <div className="auth-brand-lockup"><img src={appIcon} alt="" /><strong>Deep<span>GYM</span></strong></div>
        <div className="auth-brand-copy">
          <p className="eyebrow">YOUR TRAINING, YOUR DATA</p>
          <h1>每一次训练，<br />都只属于你。</h1>
          <p>登录后自动保存训练记录。即使暂时断网，也能继续完成今天的训练。</p>
        </div>
        <div className="auth-trust-row"><span>本地优先</span><span>账号隔离</span><span>安全同步</span></div>
      </section>

      <section className="auth-form-panel">
        <div className="auth-card">
          <p className="eyebrow">DEEPGYM ACCOUNT</p>
          <h2>{authTitle(mode)}</h2>
          <p className="auth-subtitle">{authSubtitle(mode)}</p>

          {!service.configured && (
            <div className="auth-config-notice" role="alert">
              <strong>云端项目尚未配置</strong>
              <span>代码已经就绪。登录 Supabase 并填入项目配置后即可注册测试。</span>
            </div>
          )}

          <form className="auth-form" onSubmit={submit}>
            <label>
              <span>邮箱</span>
              <input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="name@example.com" required />
            </label>

            {needsToken && (
              <label>
                <span>6 位验证码</span>
                <input className="auth-token-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, "").slice(0, 6))} placeholder="000000" required />
              </label>
            )}

            {needsPassword && (
              <label>
                <span>{mode === "verify-recovery" ? "新密码" : "密码"}</span>
                <span className="password-input-wrap">
                  <input type={showPassword ? "text" : "password"} autoComplete={mode === "login" ? "current-password" : "new-password"} value={password} minLength={mode === "login" ? undefined : 10} onChange={(event) => setPassword(event.target.value)} placeholder={mode === "login" ? "输入密码" : "至少 10 位"} required />
                  <button type="button" onClick={() => setShowPassword((value) => !value)}>{showPassword ? "隐藏" : "显示"}</button>
                </span>
              </label>
            )}

            {needsConfirmation && (
              <label>
                <span>确认密码</span>
                <input type={showPassword ? "text" : "password"} autoComplete="new-password" value={confirmation} minLength={10} onChange={(event) => setConfirmation(event.target.value)} placeholder="再次输入密码" required />
              </label>
            )}

            {passwordTooShort && <p className="field-error">密码至少需要 10 位。</p>}
            {passwordMismatch && <p className="field-error">两次输入的密码不一致。</p>}
            {error && <div className="auth-error" role="alert">{error}</div>}
            {notice && <div className="auth-notice" role="status">{notice}</div>}

            <button className="auth-submit" type="submit" disabled={!canSubmit}>
              {busy ? "请稍候…" : mode === "login" ? "登录" : mode === "register" ? "创建账号" : mode === "forgot" ? "发送验证码" : mode === "verify-signup" ? "验证并进入" : "更新密码"}
            </button>
          </form>

          {needsToken && (
            <button className="auth-link" type="button" disabled={busy || resendSeconds > 0} onClick={() => void resend()}>
              {resendSeconds > 0 ? `${resendSeconds} 秒后可重新发送` : "重新发送验证码"}
            </button>
          )}

          <div className="auth-switches">
            {mode === "login" && <><button type="button" onClick={() => changeMode("forgot")}>忘记密码？</button><button type="button" onClick={() => changeMode("register")}>没有账号？立即注册</button></>}
            {mode !== "login" && <button type="button" onClick={() => changeMode("login")}>返回登录</button>}
          </div>
        </div>
      </section>
    </main>
  );
}

function syncLabel(state: SyncState) {
  if (state.status === "syncing") return "正在同步";
  if (state.status === "offline") return "离线保存";
  if (state.status === "error") return "同步失败";
  if (state.status === "conflict") return "存在冲突";
  return state.pendingCount > 0 ? `${state.pendingCount} 项待同步` : "已同步";
}

export function AccountMenu({
  user,
  profile,
  syncState,
  busy,
  onLogout,
  onDelete,
}: {
  user: AuthUser;
  profile: UserProfile | null;
  syncState: SyncState;
  busy: boolean;
  onLogout: () => Promise<void>;
  onDelete: (password: string) => Promise<void>;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = profile?.nickname || user.email;
  const initials = (displayName[0] || "D").toUpperCase();

  useEffect(() => setAvatarFailed(false), [profile?.avatarUrl]);

  const deleteAccount = async () => {
    if (!password || phrase !== "删除我的账号") return;
    setError("");
    setDeleting(true);
    try {
      await onDelete(password);
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const logout = async () => {
    setError("");
    try {
      await onLogout();
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  return (
    <div className="account-menu-wrap">
      <button className="avatar" type="button" aria-label="打开账号菜单" aria-expanded={open} onClick={() => setOpen((value) => !value)}>
        {profile?.avatarUrl && !avatarFailed
          ? <img src={profile.avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
          : initials}
      </button>
      {open && (
        <div className="account-popover">
          {profile?.nickname && <span className="account-display-name">{profile.nickname}</span>}
          <span className="account-email">{user.email}</span>
          <span className={`account-sync-state ${syncState.status}`}><i></i>{syncLabel(syncState)}</span>
          <button type="button" disabled={busy} onClick={() => void logout()}>退出登录</button>
          <button className="account-delete-trigger" type="button" disabled={busy} onClick={() => setDeleting(true)}>删除账号和全部数据</button>
          {error && !deleting && <div className="account-menu-error" role="alert">{error}</div>}
        </div>
      )}

      {deleting && (
        <div className="account-modal-backdrop" role="presentation">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="deleteAccountTitle">
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="deleteAccountTitle">永久删除账号？</h2>
            <p>云端训练记录、本机副本和登录凭据都会删除，无法恢复。</p>
            <label><span>当前密码</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label><span>输入“删除我的账号”确认</span><input type="text" value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="account-modal-actions">
              <button type="button" onClick={() => { setDeleting(false); setError(""); }}>取消</button>
              <button className="danger-confirm-button" type="button" disabled={busy || !password || phrase !== "删除我的账号"} onClick={() => void deleteAccount()}>{busy ? "正在删除…" : "永久删除"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function AccountSettingsView({
  user,
  profile,
  syncState,
  busy,
  profileBusy,
  profileError,
  onLogout,
  onDelete,
  onSync,
  onSaveNickname,
  onUploadAvatar,
  onRemoveAvatar,
}: {
  user: AuthUser;
  profile: UserProfile | null;
  syncState: SyncState;
  busy: boolean;
  profileBusy: boolean;
  profileError: string;
  onLogout: () => Promise<void>;
  onDelete: (password: string) => Promise<void>;
  onSync: () => Promise<void>;
  onSaveNickname: (nickname: string) => Promise<void>;
  onUploadAvatar: (file: File) => Promise<void>;
  onRemoveAvatar: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState(false);
  const [password, setPassword] = useState("");
  const [phrase, setPhrase] = useState("");
  const [error, setError] = useState("");
  const [nickname, setNickname] = useState(profile?.nickname || "");
  const [avatarFailed, setAvatarFailed] = useState(false);
  const displayName = profile?.nickname || user.email;
  const initials = (displayName[0] || "D").toUpperCase();
  const lastSynced = syncState.lastSyncedAt
    ? new Intl.DateTimeFormat("zh-CN", {
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      }).format(new Date(syncState.lastSyncedAt))
    : "等待首次同步";

  useEffect(() => setNickname(profile?.nickname || ""), [profile?.nickname]);
  useEffect(() => setAvatarFailed(false), [profile?.avatarUrl]);

  const logout = async () => {
    setError("");
    try {
      await onLogout();
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const deleteAccount = async () => {
    if (!password || phrase !== "删除我的账号") return;
    setError("");
    try {
      await onDelete(password);
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const syncNow = async () => {
    setError("");
    try {
      await onSync();
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const saveNickname = async (event: FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      await onSaveNickname(nickname);
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const uploadAvatar = async (file: File | undefined) => {
    if (!file) return;
    setError("");
    try {
      await onUploadAvatar(file);
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  const removeAvatar = async () => {
    setError("");
    try {
      await onRemoveAvatar();
    } catch (reason) {
      setError(friendlyAuthError(reason));
    }
  };

  return (
    <div className="page-wrap account-settings-page">
      <header className="subpage-header account-settings-header">
        <div>
          <p className="eyebrow">MY DEEPGYM / 我的</p>
          <h1>登录与账号设置</h1>
          <p>管理登录信息、查看训练同步状态，或安全退出当前账号。</p>
        </div>
        <div className="account-identity-mark" aria-hidden="true">
          {profile?.avatarUrl && !avatarFailed
            ? <img src={profile.avatarUrl} alt="" onError={() => setAvatarFailed(true)} />
            : initials}
        </div>
      </header>

      {(error || profileError) && <div className="workout-error" role="alert">{error || profileError}</div>}

      <div className="account-settings-grid">
        <section className="account-settings-card account-profile-card">
          <div className="account-card-heading">
            <span className="account-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4" /><path d="M4 21c.7-4.2 3.4-6 8-6s7.3 1.8 8 6" /></svg>
            </span>
            <div><p>个人资料</p><h2>昵称与头像</h2></div>
          </div>
          <div className="profile-avatar-editor">
            <div className="profile-avatar-preview" aria-label="当前头像">
              {profile?.avatarUrl && !avatarFailed
                ? <img src={profile.avatarUrl} alt="当前用户头像" onError={() => setAvatarFailed(true)} />
                : <span>{initials}</span>}
            </div>
            <div className="profile-avatar-actions">
              <label className={`profile-upload-button${profileBusy ? " disabled" : ""}`}>
                <span>{profileBusy ? "正在处理…" : profile?.avatarPath ? "更换头像" : "上传头像"}</span>
                <input type="file" accept="image/jpeg,image/png,image/webp" disabled={profileBusy} onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; void uploadAvatar(file); }} />
              </label>
              {profile?.avatarPath && <button type="button" disabled={profileBusy} onClick={() => void removeAvatar()}>移除头像</button>}
              <p>支持 JPG、PNG、WebP，最大 5 MB。头像存放在你的私有云端目录。</p>
            </div>
          </div>
          <form className="profile-nickname-form" onSubmit={(event) => void saveNickname(event)}>
            <label htmlFor="profileNickname"><span>用户昵称</span><input id="profileNickname" type="text" autoComplete="nickname" maxLength={30} value={nickname} onChange={(event) => setNickname(event.target.value)} placeholder="输入你的昵称" required /></label>
            <button className="secondary-button" type="submit" disabled={profileBusy || !nickname.trim() || nickname.trim() === (profile?.nickname || "")}>{profileBusy ? "正在保存…" : "保存昵称"}</button>
          </form>
          <dl className="account-detail-list">
            <div><dt>邮箱</dt><dd>{user.email}</dd></div>
            <div><dt>登录方式</dt><dd>邮箱与密码</dd></div>
            <div><dt>会话保护</dt><dd>系统凭据管理器</dd></div>
          </dl>
        </section>

        <section className="account-settings-card">
          <div className="account-card-heading">
            <span className="account-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M7 7h10l-2-2M17 17H7l2 2M19 7a7 7 0 0 1 1 4M5 17a7 7 0 0 1-1-4" /></svg>
            </span>
            <div><p>训练数据</p><h2>云端同步</h2></div>
          </div>
          <div className={`account-sync-summary ${syncState.status}`}>
            <span className="status-dot" aria-hidden="true"></span>
            <strong>{syncLabel(syncState)}</strong>
          </div>
          <dl className="account-detail-list compact">
            <div><dt>待同步记录</dt><dd>{syncState.pendingCount} 项</dd></div>
            <div><dt>上次同步</dt><dd>{lastSynced}</dd></div>
          </dl>
          <p className="account-settings-note">训练记录始终先保存到本机 SQLite；联网后会自动同步到当前账号。</p>
          {syncState.error && <div className="account-sync-error" role="alert">{syncState.error}</div>}
          <button className="secondary-button account-sync-button" type="button" disabled={busy || syncState.status === "syncing"} onClick={() => void syncNow()}>{syncState.status === "syncing" ? "正在同步…" : "立即同步"}</button>
        </section>

        <section className="account-settings-card account-actions-card">
          <div className="account-card-heading">
            <span className="account-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="M10 5H5v14h5M14 8l4 4-4 4M8 12h10" /></svg>
            </span>
            <div><p>账号操作</p><h2>登录管理</h2></div>
          </div>
          <p>退出前会先完成同步并清除当前账号在这台设备上的副本与登录凭据。</p>
          <div className="account-settings-actions">
            <button className="secondary-button" type="button" disabled={busy} onClick={() => void logout()}>{busy ? "正在处理…" : "退出登录"}</button>
            <button className="account-delete-button" type="button" disabled={busy} onClick={() => { setError(""); setDeleting(true); }}>删除账号和全部数据</button>
          </div>
        </section>
      </div>

      {deleting && (
        <div className="account-modal-backdrop" role="presentation">
          <section className="account-modal" role="dialog" aria-modal="true" aria-labelledby="settingsDeleteAccountTitle">
            <p className="eyebrow">PERMANENT ACTION</p>
            <h2 id="settingsDeleteAccountTitle">永久删除账号？</h2>
            <p>云端训练记录、本机副本和登录凭据都会删除，无法恢复。</p>
            <label><span>当前密码</span><input type="password" autoComplete="current-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
            <label><span>输入“删除我的账号”确认</span><input type="text" value={phrase} onChange={(event) => setPhrase(event.target.value)} /></label>
            {error && <div className="auth-error" role="alert">{error}</div>}
            <div className="account-modal-actions">
              <button type="button" onClick={() => { setDeleting(false); setError(""); setPassword(""); setPhrase(""); }}>取消</button>
              <button className="danger-confirm-button" type="button" disabled={busy || !password || phrase !== "删除我的账号"} onClick={() => void deleteAccount()}>{busy ? "正在删除…" : "永久删除"}</button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

export function ActiveWorkoutConflict({
  sessions,
  onResolve,
}: {
  sessions: WorkoutSession[];
  onResolve: (sessionId: string) => void;
}) {
  if (sessions.length < 2) return null;
  return (
    <div className="account-modal-backdrop">
      <section className="account-modal conflict-modal" role="dialog" aria-modal="true" aria-labelledby="conflictTitle">
        <p className="eyebrow">SYNC CONFLICT</p>
        <h2 id="conflictTitle">发现多份进行中的训练</h2>
        <p>两台设备都保存了训练。请选择要继续的一份，其余记录会完整保留为“未完成记录”。</p>
        <div className="conflict-list">
          {sessions.map((session) => (
            <button key={session.id} type="button" onClick={() => onResolve(session.id)}>
              <strong>{new Intl.DateTimeFormat("zh-CN", { month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(session.startedAt))}</strong>
              <span>{session.exercises.length} 个动作 · {session.deviceId ? `设备 ${session.deviceId.slice(0, 8)}` : "未知设备"}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
