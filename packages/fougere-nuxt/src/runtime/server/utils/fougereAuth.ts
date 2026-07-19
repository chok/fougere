/**
 * Auth accessor — reads the AuthRuntime that the core mounted on the app.
 *
 * Auth is no longer a separate singleton: it lives on `app.auth`, built once
 * during boot from the `auth` field of fougere.config.ts. This accessor is a
 * thin async helper for server code (middleware, routes, /api/me).
 */
import type { AuthRuntime } from '@fougere/core';
import { useFougereApp } from './fougereApp';

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
