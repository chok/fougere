import { entity, primary, text } from '@fougere/schema';

export default class User extends entity({
  id: primary(),
  email: text(),
  role: text(),
}) {}
