import { entity, primary, text, auto, oneOf, readOnly } from '@fougere/schema';

export default class Task extends entity({
  id: primary(),
  title: text({ min: 1, max: 200 }),
  createdAt: auto(),
  // Server-owned: a task is born open and flipped by the complete operation.
  status: readOnly(oneOf('open', 'done', { default: 'open' })),
}) {}
