/** Who the caller is, resolved server-side from the request's own headers. */
import type { App } from '@fougere/core';
import { authOf } from './auth.js';

type SessionApi = {
  getSession: (opts: { headers: Headers }) => Promise<{ session: { userId: string; token?: string }; user: Record<string, unknown> } | null>;
};

/** The request state for these headers. Empty when no auth is declared, or nobody is signed in. */
export async function stateFor(headers: Headers, app: App): Promise<Record<string, unknown>> {
  const auth = authOf(app);
  if (!auth) return {};
  if (!headers.get('cookie')) return {};

  try {
    const result = await (auth.api as unknown as SessionApi).getSession({ headers });
    if (result?.session && result?.user) {
      const { token: _token, ...session } = result.session;

      return { user: result.user, session };
    }
  } catch {
  }

  return {};
}
