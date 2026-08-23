"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { fetchJson } from "@/lib/client-api";
import type { RudyoUser } from "@/lib/types";

type SessionStatus = "loading" | "authenticated" | "anonymous";
type SessionContextValue = {
  status: SessionStatus;
  user: RudyoUser | null;
  refreshSession: () => Promise<void>;
  logout: () => Promise<void>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

type SessionPayload = {
  success?: boolean;
  user?: { id: string; email: string; name: string | null };
  credits?: { balance: number; total?: number; used?: number };
};

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<SessionStatus>("loading");
  const [user, setUser] = useState<RudyoUser | null>(null);

  const refreshSession = useCallback(async () => {
    try {
      const payload = await fetchJson<SessionPayload>("/api/session", {
        cache: "no-store",
        credentials: "same-origin",
      }, 15_000);
      if (!payload.user || !payload.credits) throw new Error("Session incomplète.");
      setUser({ ...payload.user, credits: payload.credits });
      setStatus("authenticated");
    } catch {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  const logout = useCallback(async () => {
    try {
      await fetchJson<{ success?: boolean }>("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      }, 15_000);
    } finally {
      setUser(null);
      setStatus("anonymous");
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void refreshSession(), 0);
    return () => window.clearTimeout(timer);
  }, [refreshSession]);

  const value = useMemo(
    () => ({ status, user, refreshSession, logout }),
    [status, user, refreshSession, logout],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const context = useContext(SessionContext);
  if (!context) throw new Error("useSession doit être utilisé dans SessionProvider.");
  return context;
}
