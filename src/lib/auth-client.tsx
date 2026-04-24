import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import {
  apiLogin,
  apiRegister,
  apiMe,
  apiLogout,
  apiGoogleSession,
  type AuthUser,
} from "@/lib/api";

export const AUTH_CONFIG = {
  authEnabled: true,
  emailPasswordEnabled: true,
  googleEnabled: true,
  signupEnabled: true,
  anonymousEnabled: false,
};

// Session shape kept compatible with the previous Better Auth contract:
// `session.user` exposes { _id, email, name, image }
export type Session = {
  user: {
    _id: string;
    email: string;
    name: string;
    image?: string | null;
    role: string;
  };
} | null;

type AuthState = {
  data: Session;
  isPending: boolean;
  refresh: () => Promise<void>;
  setUser: (u: AuthUser | null) => void;
};

const AuthCtx = createContext<AuthState | null>(null);

function toSession(u: AuthUser | null): Session {
  if (!u) return null;
  return {
    user: {
      _id: u.user_id,
      email: u.email,
      name: u.name,
      image: u.picture ?? null,
      role: u.role,
    },
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<Session>(null);
  const [isPending, setPending] = useState(true);
  const processedSession = useRef(false);

  const refresh = useCallback(async () => {
    const u = await apiMe();
    setData(toSession(u));
    setPending(false);
  }, []);

  const setUser = useCallback((u: AuthUser | null) => {
    setData(toSession(u));
    setPending(false);
  }, []);

  // Handle Emergent OAuth #session_id= on landing, then /auth/me
  useEffect(() => {
    const onChanged = () => refresh();
    window.addEventListener("worksoy:auth-changed", onChanged);

    const hash = window.location.hash;
    const isCallback = hash.includes("session_id=");
    if (isCallback && !processedSession.current) {
      processedSession.current = true;
      const match = hash.match(/session_id=([^&]+)/);
      const sid = match?.[1];
      if (sid) {
        (async () => {
          try {
            const { user } = await apiGoogleSession(sid);
            setUser(user);
          } catch {
            setPending(false);
          } finally {
            history.replaceState(null, "", window.location.pathname + window.location.search);
          }
        })();
        return () => window.removeEventListener("worksoy:auth-changed", onChanged);
      }
    }
    refresh();
    return () => window.removeEventListener("worksoy:auth-changed", onChanged);
  }, [refresh, setUser]);

  return (
    <AuthCtx.Provider value={{ data, isPending, refresh, setUser }}>
      {children}
    </AuthCtx.Provider>
  );
}

export function useSession() {
  const ctx = useContext(AuthCtx);
  if (!ctx) return { data: null as Session, isPending: false };
  return { data: ctx.data, isPending: ctx.isPending };
}

export function useAuth() {
  const ctx = useContext(AuthCtx);
  if (!ctx) throw new Error("useAuth must be used inside <AuthProvider>");
  return ctx;
}

// ---------- Imperative helpers (match previous API) ----------
export type AuthResult = { success: boolean; error?: { message: string; code?: string } };

async function runWithRefresh(fn: () => Promise<{ user: AuthUser }>): Promise<AuthResult> {
  try {
    await fn();
    // Force a full refresh via hard navigation is unnecessary — callers re-read `useSession`.
    window.dispatchEvent(new Event("worksoy:auth-changed"));
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Request failed";
    return { success: false, error: { message: msg } };
  }
}

export async function signInWithEmail(email: string, password: string): Promise<AuthResult> {
  return runWithRefresh(() => apiLogin(email, password));
}

export async function signUpWithEmail(
  email: string,
  password: string,
  name?: string
): Promise<AuthResult> {
  return runWithRefresh(() => apiRegister(email, password, name ?? ""));
}

export async function signInWithGoogle(callbackURL?: string): Promise<AuthResult> {
  // REMINDER: DO NOT HARDCODE THE URL, OR ADD ANY FALLBACKS OR REDIRECT URLS, THIS BREAKS THE AUTH
  const redirectUrl = window.location.origin + (callbackURL ?? "/dashboard");
  window.location.href = `https://auth.emergentagent.com/?redirect=${encodeURIComponent(redirectUrl)}`;
  return { success: true };
}

export async function signOutUser(): Promise<AuthResult> {
  try {
    await apiLogout();
    window.dispatchEvent(new Event("worksoy:auth-changed"));
    return { success: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Sign out failed";
    return { success: false, error: { message: msg } };
  }
}
