/** The session view — the one place that turns the server-resolved request context (filled by the au… */

export interface SessionView {
  user: Record<string, unknown> | null;
}

export function sessionViewOf(context: Record<string, unknown>): SessionView {
  const raw = context.user as Record<string, unknown> | undefined;
  if (!raw) return { user: null };
  const { passwordHash: _passwordHash, ...user } = raw;
  return { user };
}
