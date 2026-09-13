import { entity, primary, text, bool, date, created, optional } from '@fougere/schema';

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
