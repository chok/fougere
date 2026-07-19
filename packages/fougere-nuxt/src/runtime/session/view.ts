/**
 * The session view — the one place that turns the server-resolved
 * request context (filled by the auth middleware) into what the client
 * is allowed to see. One resolution, three readers: the page by
 * hydration, the refresh route over the wire, handlers by invocation.
 *
 * The app-declared context (viewer enrichment) will attach here when
 * a real case lands — this function is the seam.
 */

export interface SessionView {
  user: Record<string, unknown> | null;
}

export function sessionViewOf(context: Record<string, unknown>): SessionView {
  const raw = context.user as Record<string, unknown> | undefined;
  if (!raw) return { user: null };
  const { passwordHash: _passwordHash, ...user } = raw;
  return { user };
}
