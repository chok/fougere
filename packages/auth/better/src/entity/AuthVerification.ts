import { entity, primary, text, date, created } from '@fougere/schema';

/**
 * Default Verification entity — better-auth shape.
 * Used for email verification, password reset, magic links, etc.
 */
class Verification extends entity({
  id: primary(),
  identifier: text(),
  value: text(),
  expiresAt: date(),
  createdAt: created(),
  updatedAt: created(),
}) {}

export { Verification as AuthVerification };
