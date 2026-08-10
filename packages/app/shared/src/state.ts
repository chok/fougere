/**
 * Who the caller is, resolved server-side from the request's own headers.
 *
 * Nuxt answers this with a Nitro middleware that stamps `event.context`; a
 * Web-standard host has no such seam on a route handler, so it resolves here
 * instead. Same source (the auth runtime mounted on `app.auth`), same result shape
 * (`{ user, session }`), so `serveRpc` and `serveRest` cannot tell hosts apart.
 *
 * What must stay true in both: this is what the SERVER resolved. A browser sits
 * outside the topology, so nothing here may come from the payload.
 */
import { useFougereApp } from './boot.js';

type SessionApi = {
  getSession: (opts: { headers: Headers }) => Promise<{ session: { userId: string }; user: Record<string, unknown> } | null>;
};

/** The request state for these headers. Empty when no auth is declared, or nobody is signed in. */
export async function stateFor(headers: Headers): Promise<Record<string, unknown>> {
  const app = await useFougereApp();
  if (!app.auth) return {};
  // No cookie, no session — asking the provider would be a round-trip for a known answer.
  if (!headers.get('cookie')) return {};

  try {
    const result = await (app.auth.api as unknown as SessionApi).getSession({ headers });
    if (result?.session && result?.user) return { user: result.user, session: result.session };
  } catch {
    // An unreachable or misconfigured provider leaves the caller anonymous rather
    // than failing the request — the same choice the Nuxt middleware makes.
  }
  return {};
}
