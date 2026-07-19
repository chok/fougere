import { entity, primary, text, bool, date, auto, ref, optional } from '@fougere/schema';

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
  createdAt: auto(),
  updatedAt: auto(),
}) {}

/**
 * Default Session entity — better-auth shape.
 * `token` carries the opaque session secret (cookie value).
 */
export class AuthSession extends entity({
  id: primary(),
  userId: ref(AuthUser),
  token: text(),
  expiresAt: date(),
  ipAddress: optional(text()),
  userAgent: optional(text()),
  createdAt: auto(),
  updatedAt: auto(),
}) {}

/**
 * Default Account entity — better-auth shape (single PK, accountId/providerId pair,
 * separate token columns instead of a JSON blob).
 */
export class AuthAccount extends entity({
  id: primary(),
  accountId: text(),
  providerId: text(),
  userId: ref(AuthUser),
  accessToken: optional(text()),
  refreshToken: optional(text()),
  idToken: optional(text()),
  accessTokenExpiresAt: optional(date()),
  refreshTokenExpiresAt: optional(date()),
  scope: optional(text()),
  password: optional(text()),
  createdAt: auto(),
  updatedAt: auto(),
}) {}

/**
 * Default Verification entity — better-auth shape.
 * Used for email verification, password reset, magic links, etc.
 */
export class AuthVerification extends entity({
  id: primary(),
  identifier: text(),
  value: text(),
  expiresAt: date(),
  createdAt: auto(),
  updatedAt: auto(),
}) {}
