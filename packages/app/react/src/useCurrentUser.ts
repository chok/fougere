'use client';
/**
 * The session: resolved once server-side, handed down through the provider, read
 * here as state. `refresh()` re-reads it after a client-side auth change (login,
 * logout) — no page reload, no hand-rolled /api/me.
 *
 * `session` is the whole view (extensible context); `user` is its everyday
 * projection. Nuxt hydrates through its own `useState` payload; React has no
 * ambient equivalent, so a layout that already resolved the session passes it to
 * `<FougereSession>` and the page arrives knowing its user. Without the provider
 * the hook fetches once, which is correct and one round-trip slower.
 */
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import type { SessionView } from '@fougere/app/client';

const SessionContext = createContext<SessionView | null>(null);

export function FougereSession({ value, children }: { value: SessionView; children: ReactNode }) {
  return createElement(SessionContext.Provider, { value }, children);
}

export function useCurrentUser<TUser = Record<string, unknown>>() {
  const hydrated = useContext(SessionContext);
  const [session, setSession] = useState<SessionView>(hydrated ?? { user: null });

  const refresh = useCallback(async (): Promise<void> => {
    const response = await fetch('/_fougere/session');
    setSession((await response.json()) as SessionView);
  }, []);

  useEffect(() => {
    if (!hydrated) void refresh();
  }, [hydrated, refresh]);

  return {
    session,
    user: (session.user ?? null) as TUser | null,
    loggedIn: session.user != null,
    refresh,
  };
}
