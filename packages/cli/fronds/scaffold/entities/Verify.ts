import { entity, text, optional } from '@fougere/schema';

export default class Verify extends entity({
  name: optional(text({ description: 'Remote to verify (default: every remote in the lock)' })),
  from: optional(text({ description: 'Host to ask (default: the address recorded at sync)' })),
}) {}
