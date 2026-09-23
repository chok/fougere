import { AUTH, type App, type AuthRuntime } from '@fougere/core';
import { useFougereApp } from './boot.js';

export function authOf(app: App): AuthRuntime | undefined {
  return app.container.has(AUTH) ? app.container.resolve<AuthRuntime>(AUTH) : undefined;
}

/** Get the auth runtime resolved at boot. Throws when no process-local frond brought one. */
export async function useFougereAuth(): Promise<AuthRuntime> {
  const auth = authOf(await useFougereApp());
  if (!auth) throw new Error("Auth not configured — declare `fronds: { '@fougere/auth-better': { … } }` in fougere.config.ts.");

  return auth;
}
