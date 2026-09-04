/** The session: */
import { writable, derived, type Readable } from 'svelte/store';
import type { SessionView } from '@fougere/app/client';

const session = writable<SessionView>({ user: null });
let fetched = false;

/** Seed the store from what the server already resolved (a `load` function's data). */
export function hydrateSession(view: SessionView): void {
  fetched = true;
  session.set(view);
}

export async function refreshSession(): Promise<void> {
  const response = await fetch('/_fougere/session');
  fetched = true;
  session.set((await response.json()) as SessionView);
}

export function useCurrentUser<TUser = Record<string, unknown>>() {
  // Only reached in the browser, and only when a layout did not hydrate it.
  if (!fetched && typeof window !== 'undefined') void refreshSession();

  return {
    session: session as Readable<SessionView>,
    user: derived(session, ($session) => ($session.user ?? null) as TUser | null),
    loggedIn: derived(session, ($session) => $session.user != null),
    refresh: refreshSession,
  };
}
