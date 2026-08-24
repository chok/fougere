import { entity, primary, text, bool, date, created, ref, optional, type SchemaView } from '@fougere/schema';

/**
 * Default User entity — shipped as a fallback. Apps should declare their own
 * User entity in a frond and pass it via `auth.user` (with extra fields like roles).
 *
 * Field shape matches better-auth's expectations: name/email/emailVerified/image
 * + standard timestamps.
 */
export class AuthUser extends entity({
  id: primary(),
  name: text(),
  email: text(),
  emailVerified: bool(),
  image: optional(text()),
  createdAt: created(),
  updatedAt: created(),
}) {}

/**
 * A `ref()` target is fixed at field-declaration time. Session and Account can't
 * be static classes built once against this package's `AuthUser` — that would
 * leave `userId` pointing at the wrong table whenever an app supplies its own
 * User (`opts.user` in `betterAuth()`). `authEntities(User)` builds them fresh
 * against whichever schema was actually resolved (the app's, or `AuthUser` as
 * fallback), called from `betterAuth()` once `User` is known.
 *
 * `ref()` wants a live class — a construct signature plus `.name`, which
 * `@fougere/adapter-sql`'s FK naming reads off the target — narrower than the
 * `SchemaView` interface (`getFields()` only) this package's public options
 * take, since `opts.user` may be any app's entity and `SchemaView` is the
 * shape-only contract used to stay decoupled from a specific one. Every real
 * entity satisfies both; the cast below only crosses that type-level gap, the
 * same bridge `@fougere/schema` uses internally in `Bundle.toSchemas`
 * (`schema as unknown as EntityConstructor`).
 */
type LiveEntity = abstract new (...args: any[]) => unknown;

export function authEntities(User: SchemaView): {
  AuthSession: SchemaView;
  AuthAccount: SchemaView;
} {
  const target = User as unknown as LiveEntity;

  /**
   * Session entity — better-auth shape.
   * `token` carries the opaque session secret (cookie value).
   */
  class AuthSession extends entity({
    id: primary(),
    userId: ref(target),
    token: text(),
    expiresAt: date(),
    ipAddress: optional(text()),
    userAgent: optional(text()),
    createdAt: created(),
    updatedAt: created(),
  }) {}

  /**
   * Account entity — better-auth shape (single PK, accountId/providerId pair,
   * separate token columns instead of a JSON blob).
   */
  class AuthAccount extends entity({
    id: primary(),
    accountId: text(),
    providerId: text(),
    userId: ref(target),
    accessToken: optional(text()),
    refreshToken: optional(text()),
    idToken: optional(text()),
    accessTokenExpiresAt: optional(date()),
    refreshTokenExpiresAt: optional(date()),
    scope: optional(text()),
    password: optional(text()),
    createdAt: created(),
    updatedAt: created(),
  }) {}

  return { AuthSession, AuthAccount };
}

/**
 * Default Verification entity — better-auth shape.
 * Used for email verification, password reset, magic links, etc.
 */
export class AuthVerification extends entity({
  id: primary(),
  identifier: text(),
  value: text(),
  expiresAt: date(),
  createdAt: created(),
  updatedAt: created(),
}) {}
