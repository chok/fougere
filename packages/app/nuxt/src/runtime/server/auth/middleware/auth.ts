import { defineEventHandler, getRequestHeader } from 'h3';
import { useFougereAuth } from '../../utils/fougereAuth';

/**
 * Resolves the current session/user from the request cookie and exposes them
 * on event.context. Auth-related routes are skipped so the catch-all handles them.
 */
export default defineEventHandler(async (event) => {
  if (event.path.startsWith('/auth/')) return;
  const cookie = getRequestHeader(event, 'cookie');
  if (!cookie) return;

  let auth;
  try {
    auth = await useFougereAuth();
  } catch {
    return; // no auth configured
  }

  try {
    // event.headers, not toWebRequest(event).headers — the web request wraps
    // the body stream, and a later readBody would hang on the captured stream
    const result = await (auth.api as { getSession: (opts: { headers: Headers }) => Promise<{ session: { userId: string }; user: Record<string, unknown> } | null> })
      .getSession({ headers: event.headers });
    if (result?.session && result?.user) {
      event.context.user = result.user;
      event.context.session = result.session;
    }
  } catch {}
});
