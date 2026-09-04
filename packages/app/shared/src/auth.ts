/** Auth accessor — reads the AuthRuntime that the core mounted on the app. */
import type { AuthRuntime } from '@fougere/core';
import { useFougereApp } from './boot.js';

/** Get the auth runtime resolved at boot. Throws if no `auth` was declared in fougere.config.ts. */
export async function useFougereAuth(): Promise<AuthRuntime> {
  const app = await useFougereApp();
  if (!app.auth) {
    throw new Error(
      'Auth not configured — declare `auth: { provider, ... }` in fougere.config.ts.',
    );
  }
  return app.auth;
}
