import { entity, primary, text, date, created, ref, optional, type SchemaView } from '@fougere/schema';

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
