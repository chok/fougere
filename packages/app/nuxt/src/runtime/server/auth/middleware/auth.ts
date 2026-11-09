import { defineEventHandler, getRequestHeader } from 'h3';
import { authOf, useFougereApp } from '@fougere/app';

/** Puts the session and the user the request's cookie names on `event.context`. */
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/auth/')) return;
  const cookie = getRequestHeader(event, 'cookie');
  if (!cookie) return;

  const auth = authOf(await useFougereApp());
  if (!auth) return;

  try {
    const result = await (auth.api as { getSession: (opts: { headers: Headers }) => Promise<{ session: { userId: string }; user: Record<string, unknown> } | null> })
      .getSession({ headers: event.headers });
    if (result?.session && result?.user) {
      event.context.user = result.user;
      event.context.session = result.session;
    }
  } catch {}
});
