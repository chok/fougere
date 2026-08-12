import { entity, primary, text, number, created } from '@fougere/schema';

export default class Reading extends entity({
  id: primary(),
  station: text({ min: 2, max: 40 }),
  celsius: number({ min: -90, max: 60 }),
  recordedAt: created(),
}) {}
