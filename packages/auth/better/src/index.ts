import { betterAuth as betterAuthLib } from 'better-auth';
import { createId } from '@paralleldrive/cuid2';
import { AUTH, frond, type App, type AuthRuntime, type FrondDescriptor, type Storage } from '@fougere/core';
import { json, lowerFirst, type Schema, type SchemaView } from '@fougere/schema';
import { AuthUser } from './entity/AuthUser.js';
import { AuthVerification } from './entity/AuthVerification.js';
import { authEntities } from './entity/authEntities.js';
import { fougereAdapter, type StorageMap } from './adapter.js';
import { translateCredential, translatePlugins, translateSocial, type FougereProviders } from './FougereProviders.js';

export { AuthUser } from './entity/AuthUser.js';

/** What `fronds: { '@fougere/auth-better': { … } }` hands the factory in fougere.config.ts. */
export interface BetterAuthOptions {
  user?: SchemaView;
  secret: string;
  baseUrl?: string;
  basePath?: string;
  providers?: FougereProviders;
  trustedOrigins?: string[];
  sessionTtl?: number;
  session?: SchemaView;
  account?: SchemaView;
  verification?: SchemaView;
}

/**
 * The auth provider, as a frond: its rows — the user too, when the app names none — and the
 * extension that rises where it is served, declaring what a signed-in call carries and
 * registering the runtime under `AUTH`. Placed like any frond: a process whose `only:` leaves it
 * out starts no engine and migrates no session table. The session travels without its
 * `token`: a process trusts the one that called it, never the cookie of whoever is behind it.
 */
export function betterAuth(opts: BetterAuthOptions): FrondDescriptor {
  const user = opts.user ?? AuthUser;
  const { AuthSession, AuthAccount } = authEntities(user);
  const models: Record<string, SchemaView> = {
    user,
    session: opts.session ?? AuthSession,
    account: opts.account ?? AuthAccount,
    verification: opts.verification ?? AuthVerification,
  };
  const brought = Object.values(models).filter((schema) => schema !== opts.user);
  const providers = opts.providers ?? {};
  const basePath = opts.basePath ?? '/auth';

  return frond('auth', {
    entities: brought,
    extensions: [{
      name: 'auth',
      state: { user: json(user as typeof Schema), session: json((models.session as typeof Schema).omit('token')) },
      up(app: App) {
        const engine = betterAuthLib({
          database: fougereAdapter(storagesOf(app, models)),
          secret: opts.secret,
          baseURL: opts.baseUrl,
          basePath,
          trustedOrigins: opts.trustedOrigins,
          advanced: { database: { generateId: () => createId() } },
          session: opts.sessionTtl ? { expiresIn: opts.sessionTtl / 1000 } : undefined,
          emailAndPassword: translateCredential(providers),
          socialProviders: translateSocial(providers),
          plugins: translatePlugins(providers),
        });
        const runtime: AuthRuntime = { handler: engine.handler, api: engine.api as Record<string, unknown>, basePath };

        app.container.registerValue(AUTH, runtime);
      },
    }],
  });
}

export default betterAuth;

function storagesOf(app: App, models: Record<string, SchemaView>): StorageMap {
  return new Map(Object.entries(models).map(([model, schema]) => {
    const entity = lowerFirst(schema.name);
    const storage: Storage | undefined = app.storageFor(entity);
    if (!storage) throw new Error(`[auth] no frond in this process holds '${entity}', the ${model} better-auth writes.`);

    return [model, storage];
  }));
}
