import { entity, primary, text, created, oneOf, readOnly } from '@fougere/schema';

export default class Task extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  createdAt: created(),
  // Server-owned: a task is born open and flipped by the complete operation.
  status: readOnly(oneOf('open', 'done', { default: 'open' })),
}) {}
