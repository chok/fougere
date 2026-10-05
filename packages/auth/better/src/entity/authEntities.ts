import { entity, primary, text, date, created, ref, optional, type Entity, type SchemaView } from '@fougere/schema';

export function authEntities(User: Entity): {
  AuthSession: SchemaView;
  AuthAccount: SchemaView;
} {
  /**
   * Session entity — better-auth shape.
   * `token` carries the opaque session secret (cookie value).
   */
  class Session extends entity({
    id: primary(),
    userId: ref(User),
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
  class Account extends entity({
    id: primary(),
    accountId: text(),
    providerId: text(),
    userId: ref(User),
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

  return { AuthSession: Session, AuthAccount: Account };
}
