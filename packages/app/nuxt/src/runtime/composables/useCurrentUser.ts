/**
 * The session: resolved once server-side, hydrated with the page, read
 * here as reactive state. refresh() re-reads it after a client-side
 * auth change (login, logout) — no page reload, no hand-rolled /api/me.
 *
 * `session` is the whole view (extensible context); `user` is its
 * everyday projection.
 */
import { useState, useRequestFetch } from '#imports';
import { computed } from 'vue';
import type { SessionView } from '@fougere/app/client';

export function useCurrentUser<TUser = Record<string, unknown>>() {
  const session = useState<SessionView>('fougere:session', () => ({ user: null }));
  const fetcher = useRequestFetch();

  const user = computed(() => (session.value.user ?? null) as TUser | null);
  const loggedIn = computed(() => session.value.user != null);

  async function refresh(): Promise<void> {
    session.value = await fetcher<SessionView>('/_fougere/session');
  }

  return { session, user, loggedIn, refresh };
}
