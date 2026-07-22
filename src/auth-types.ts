import type { SupabaseClient } from "@supabase/supabase-js";

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthStatus = "loading" | "signed-out" | "signed-in" | "offline" | "unconfigured";

export interface AuthState {
  status: AuthStatus;
  user: AuthUser | null;
  error?: string;
}

export interface SignUpResult {
  needsVerification: boolean;
  user: AuthUser | null;
}

export interface AuthService {
  readonly configured: boolean;
  restore(): Promise<AuthState>;
  subscribe(listener: (state: AuthState) => void): () => void;
  signUp(email: string, password: string): Promise<SignUpResult>;
  verifySignup(email: string, token: string): Promise<AuthUser>;
  resendSignup(email: string): Promise<void>;
  signIn(email: string, password: string): Promise<AuthUser>;
  requestPasswordReset(email: string): Promise<void>;
  verifyRecovery(email: string, token: string, newPassword: string): Promise<AuthUser>;
  signOut(): Promise<void>;
  deleteAccount(password: string): Promise<void>;
  getClient(): SupabaseClient;
}
