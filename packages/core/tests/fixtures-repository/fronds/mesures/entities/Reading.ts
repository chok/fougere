import { entity, primary, number, auto } from '@fougere/schema';

export default class Reading extends entity({
  id: primary(),
  db: number({ min: 0, max: 120 }),
  at: auto(),
}) {}
