import { entity, primary, text, bool, created, optional } from '@fougere/schema';

/** The user better-auth writes when the app names none — `User`, since the model is `user`. */
class User extends entity({
  id: primary(),
  name: text(),
  email: text(),
  emailVerified: bool(),
  image: optional(text()),
  createdAt: created(),
  updatedAt: created(),
}) {}

export { User as AuthUser };
