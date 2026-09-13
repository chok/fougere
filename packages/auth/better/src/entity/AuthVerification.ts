import { entity, primary, text, bool, date, created, optional } from '@fougere/schema';

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
