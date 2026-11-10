import { entity, primary, text, bool, created, optional } from '@fougere/schema';

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
