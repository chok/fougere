import { betterAuth as betterAuthLib } from 'better-auth';
import { createId } from '@paralleldrive/cuid2';
import type { AuthConfig, AuthContext, AuthRuntime } from '@fougere/core';
import type { SchemaView } from '@fougere/schema';
import { AuthVerification, AuthUser, authEntities } from './entities.js';
import { fougereAdapter, type OrmMap } from './adapter.js';
import {
  translateCredential,
  translateSocial,
  translatePlugins,
  type FougereProviders,
} from './translate.js';

export { AuthUser, AuthVerification, authEntities } from './entities.js';
export type { FougereProviders, OIDCProviderConfig } from './translate.js';

/**
 * Options accepted by the betterAuth() factory in fougere.config.ts.
 *
 * `user` should come from the app's own frond (roles, extra columns, its own
 * table — Session/Account are built against it, see `authEntities`). Omitting
 * it falls back to the package's `AuthUser`. Other entities default to the
 * shapes shipped by this package and can be overridden too.
 */
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
 * Factory used in fougere.config.ts:
 *
 * ```ts
 * export default defineFougere({
 *   auth: betterAuth({ user: User, secret, providers: {...} }),
 * });
 * ```
 *
 * Returns a lazy AuthConfig — the better-auth engine is only constructed when
 * the core calls `create(ctx)` at boot, with the resolved db + ormFactory.
 */
export function betterAuth(opts: BetterAuthOptions): AuthConfig {
  const userSchema = opts.user ?? AuthUser;
  const { AuthSession, AuthAccount } = authEntities(userSchema);
  const sessionSchema = opts.session ?? AuthSession;
  const accountSchema = opts.account ?? AuthAccount;
  const verificationSchema = opts.verification ?? AuthVerification;
  const providers = opts.providers ?? {};
  const basePath = opts.basePath ?? '/auth';

  return {
    entities: {
      user: userSchema,
      session: sessionSchema,
      account: accountSchema,
      verification: verificationSchema,
    },
    create({ ormFactory }: AuthContext): AuthRuntime {
      const ormMap: OrmMap = new Map([
        ['user', ormFactory(userSchema, 'user')],
        ['session', ormFactory(sessionSchema, 'session')],
        ['account', ormFactory(accountSchema, 'account')],
        ['verification', ormFactory(verificationSchema, 'verification')],
      ]);

      const engine = betterAuthLib({
        database: fougereAdapter(ormMap),
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

      return {
        entities: {
          user: userSchema,
          session: sessionSchema,
          account: accountSchema,
          verification: verificationSchema,
        },
        orms: Object.fromEntries(ormMap),
        handler: engine.handler,
        api: engine.api as Record<string, unknown>,
        basePath,
      };
    },
  };
}
