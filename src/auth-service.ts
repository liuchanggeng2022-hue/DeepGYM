import { invoke } from "@tauri-apps/api/core";
import { createClient, type Session, type SupabaseClient, type User } from "@supabase/supabase-js";
import type { AuthService, AuthState, AuthUser, SignUpResult } from "./auth-types";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL?.trim() || "";
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() || "";
const LAST_USER_KEY = "deepgym.auth.last-user";
const browserMemory = new Map<string, string>();

function runningInTauri() {
  return "__TAURI_INTERNALS__" in window;
}

const secureStorage = {
  async getItem(key: string) {
    if (!runningInTauri()) return browserMemory.get(key) || null;
    return invoke<string | null>("credential_get", { key });
  },
  async setItem(key: string, value: string) {
    if (!runningInTauri()) {
      browserMemory.set(key, value);
      return;
    }
    await invoke("credential_set", { key, value });
  },
  async removeItem(key: string) {
    if (!runningInTauri()) {
      browserMemory.delete(key);
      return;
    }
    await invoke("credential_delete", { key });
  },
};

function authUser(user: User): AuthUser {
  return { id: user.id, email: user.email || "" };
}

function configured() {
  return /^https:\/\/.+\.supabase\.co$/i.test(SUPABASE_URL)
    && SUPABASE_PUBLISHABLE_KEY.startsWith("sb_publishable_");
}

let client: SupabaseClient | null = null;

function getClient() {
  if (!configured()) throw new Error("DeepGYM 尚未连接 Supabase 项目。");
  if (!client) {
    client = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        storage: secureStorage,
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}

async function rememberUser(user: AuthUser | null) {
  if (user) await secureStorage.setItem(LAST_USER_KEY, JSON.stringify(user));
  else await secureStorage.removeItem(LAST_USER_KEY);
}

async function rememberedUser() {
  const stored = await secureStorage.getItem(LAST_USER_KEY);
  if (!stored) return null;
  try {
    const value = JSON.parse(stored) as AuthUser;
    return value.id && value.email ? value : null;
  } catch {
    return null;
  }
}

function requireUser(session: Session | null) {
  if (!session?.user) throw new Error("登录会话没有创建成功，请重试。");
  return authUser(session.user);
}

export function friendlyAuthError(reason: unknown) {
  const message = reason instanceof Error ? reason.message : String(reason || "");
  const normalized = message.toLowerCase();
  if (normalized.includes("invalid login credentials")) return "邮箱或密码不正确。";
  if (normalized.includes("email not confirmed")) return "请先输入邮箱中的 6 位验证码完成注册。";
  if (normalized.includes("user already registered")) return "这个邮箱已经注册，可以直接登录。";
  if (normalized.includes("password") && normalized.includes("weak")) return "密码强度不足，请使用至少 10 位密码。";
  if (normalized.includes("token") && (normalized.includes("expired") || normalized.includes("invalid"))) return "验证码无效或已经过期，请重新获取。";
  if (normalized.includes("rate limit")) return "请求过于频繁，请稍后再试。";
  if (normalized.includes("failed to fetch") || normalized.includes("network")) return "网络连接失败，请检查网络后重试。";
  return message || "账号操作失败，请重试。";
}

class SupabaseAuthService implements AuthService {
  readonly configured = configured();

  getClient() {
    return getClient();
  }

  async restore(): Promise<AuthState> {
    if (!this.configured) return { status: "unconfigured", user: null };
    try {
      const { data, error } = await getClient().auth.getSession();
      if (error) throw error;
      if (!data.session) {
        const cached = await rememberedUser();
        if (!navigator.onLine && cached) return { status: "offline", user: cached };
        return {
          status: "signed-out",
          user: null,
          error: navigator.onLine ? undefined : "当前无网络，且这台设备没有可用的登录会话。",
        };
      }
      const user = requireUser(data.session);
      await rememberUser(user);
      return { status: navigator.onLine ? "signed-in" : "offline", user };
    } catch (reason) {
      const cached = await rememberedUser();
      if (!navigator.onLine && cached) return { status: "offline", user: cached };
      return { status: "signed-out", user: null, error: friendlyAuthError(reason) };
    }
  }

  subscribe(listener: (state: AuthState) => void) {
    if (!this.configured) return () => undefined;
    const { data } = getClient().auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION" || event === "PASSWORD_RECOVERY") return;
      if (event === "SIGNED_OUT" || !session?.user) {
        void rememberUser(null);
        listener({ status: "signed-out", user: null });
        return;
      }
      const user = authUser(session.user);
      void rememberUser(user);
      listener({ status: "signed-in", user });
    });
    return () => data.subscription.unsubscribe();
  }

  async signUp(email: string, password: string): Promise<SignUpResult> {
    const { data, error } = await getClient().auth.signUp({ email, password });
    if (error) throw error;
    const user = data.user ? authUser(data.user) : null;
    if (data.session && user) await rememberUser(user);
    return { needsVerification: !data.session, user };
  }

  async verifySignup(email: string, token: string) {
    const { data, error } = await getClient().auth.verifyOtp({ email, token, type: "signup" });
    if (error) throw error;
    const user = requireUser(data.session);
    await rememberUser(user);
    return user;
  }

  async resendSignup(email: string) {
    const { error } = await getClient().auth.resend({ email, type: "signup" });
    if (error) throw error;
  }

  async signIn(email: string, password: string) {
    const { data, error } = await getClient().auth.signInWithPassword({ email, password });
    if (error) throw error;
    const user = requireUser(data.session);
    await rememberUser(user);
    return user;
  }

  async requestPasswordReset(email: string) {
    const { error } = await getClient().auth.resetPasswordForEmail(email);
    if (error) throw error;
  }

  async verifyRecovery(email: string, token: string, newPassword: string) {
    const { data, error } = await getClient().auth.verifyOtp({ email, token, type: "recovery" });
    if (error) throw error;
    const user = requireUser(data.session);
    const update = await getClient().auth.updateUser({ password: newPassword });
    if (update.error) throw update.error;
    await rememberUser(user);
    return user;
  }

  async signOut() {
    const { error } = await getClient().auth.signOut();
    if (error) throw error;
    await rememberUser(null);
  }

  async deleteAccount(password: string) {
    const { data: userData, error: userError } = await getClient().auth.getUser();
    if (userError || !userData.user?.email) throw userError || new Error("没有找到当前账号。");
    const reauth = await getClient().auth.signInWithPassword({ email: userData.user.email, password });
    if (reauth.error) throw reauth.error;
    const result = await getClient().functions.invoke("delete-account", { body: {} });
    if (result.error) throw result.error;
    await getClient().auth.signOut({ scope: "local" });
    await rememberUser(null);
  }
}

export function createAuthService(): AuthService {
  return new SupabaseAuthService();
}
