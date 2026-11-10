import { entity, primary, text, date, created } from '@fougere/schema';

class Verification extends entity({
  id: primary(),
  identifier: text(),
  value: text(),
  expiresAt: date(),
  createdAt: created(),
  updatedAt: created(),
}) {}

export { Verification as AuthVerification };
