/** The session: */
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
