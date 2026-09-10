import { entity, text, optional, created } from '@fougere/schema';

export default class PostPublished extends entity({
  id: text({ min: 1 }),
  title: text({ min: 1 }),
  email: optional(text()),
  at: created(),
}) {}
