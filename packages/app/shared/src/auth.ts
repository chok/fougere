import { AUTH, type App, type AuthRuntime } from '@fougere/core';
import { useFougereApp } from './boot.js';

/** The runtime an auth extension registered — absent when `fougere.config.ts` declares no `auth`. */
export function authOf(app: App): AuthRuntime | undefined {
  return app.container.has(AUTH) ? app.container.resolve<AuthRuntime>(AUTH) : undefined;
}

/** Get the auth runtime resolved at boot. Throws if no `auth` was declared in fougere.config.ts. */
export async function useFougereAuth(): Promise<AuthRuntime> {
  const auth = authOf(await useFougereApp());
  if (!auth) throw new Error('Auth not configured — declare `auth: betterAuth({ … })` in fougere.config.ts.');

  return auth;
}
