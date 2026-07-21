import { useEffect, useMemo, useState } from "react";
import App from "./App";
import { AuthGate } from "./AuthViews";
import { createAuthService } from "./auth-service";
import type { AuthState } from "./auth-types";

export default function Root() {
  const authService = useMemo(() => createAuthService(), []);
  const [authState, setAuthState] = useState<AuthState>({ status: "loading", user: null });

  useEffect(() => {
    let active = true;
    void authService.restore().then((state) => {
      if (active) setAuthState(state);
    });
    const unsubscribe = authService.subscribe((state) => {
      if (active) setAuthState(state);
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [authService]);

  if (authState.status === "loading") {
    return <main className="auth-loading"><span className="auth-loading-mark">DG</span><p>正在安全地打开 DeepGYM…</p></main>;
  }

  if (!authState.user) {
    return (
      <AuthGate
        service={authService}
        initialError={authState.error}
        onAuthenticated={(user) => setAuthState({ status: "signed-in", user })}
      />
    );
  }

  return (
    <App
      authUser={authState.user}
      authService={authService}
      authOffline={authState.status === "offline"}
    />
  );
}
