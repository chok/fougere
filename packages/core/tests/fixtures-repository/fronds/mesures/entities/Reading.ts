import { entity, primary, number, created } from '@fougere/schema';

export default class Reading extends entity({
  id: primary(),
  db: number({ min: 0, max: 120 }),
  at: created(),
}) {}
