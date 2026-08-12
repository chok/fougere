import { entity, primary, text, email, created, oneOf, readOnly } from '@fougere/schema';

export default class User extends entity({
  id: primary(),
  name: text({ min: 1, max: 100 }),
  email: email(),
  createdAt: created(),
  // Server-owned: a user is born active and flipped by the deactivate operation.
  status: readOnly(oneOf('active', 'inactive', { default: 'active' })),
}) {}
