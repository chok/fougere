'use client';
/** The session. */
import { createContext, createElement, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { fetcher, sessionOf, type SessionView } from '@fougere/app/client';

const SessionContext = createContext<SessionView | null>(null);

export function FougereSession({ value, children }: { value: SessionView; children: ReactNode }) {
  return createElement(SessionContext.Provider, { value }, children);
}

export function useCurrentUser<TUser = Record<string, unknown>>() {
  const hydrated = useContext(SessionContext);
  const [session, setSession] = useState<SessionView>(hydrated ?? { user: null });

  const refresh = useCallback(async (): Promise<void> => {
    setSession(await sessionOf(fetcher));
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
