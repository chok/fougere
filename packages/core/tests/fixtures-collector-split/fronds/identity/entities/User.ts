import { entity, primary, text } from '@fougere/schema';

export default class User extends entity({
  id: primary(),
  email: text({ min: 1 }),
  role: text({ oneOf: ['reader', 'admin'] }),
}) {}
