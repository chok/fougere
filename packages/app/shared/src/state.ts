/** Who the caller is, resolved server-side from the request's own headers. */
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
