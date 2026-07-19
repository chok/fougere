import { entity, text } from '@fougere/schema';

export default class Sync extends entity({
  name: text({ description: 'Frond name to sync (e.g. blog)' }),
  from: text({ description: 'Remote URL (e.g. http://blog-service:3000)' }),
}) {}
