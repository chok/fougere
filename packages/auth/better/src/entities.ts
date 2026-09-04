import { entity, primary, text, bool, date, created, ref, optional, type SchemaView } from '@fougere/schema';

/** Default User entity — shipped as a fallback. */
export class AuthUser extends entity({
  id: primary(),
  name: text(),
  email: text(),
  emailVerified: bool(),
  image: optional(text()),
  createdAt: created(),
  updatedAt: created(),
}) {}

/** A `ref()` target is fixed at field-declaration time. */
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
