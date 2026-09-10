import { entity, text, created } from '@fougere/schema';

/** The question. It carries no answer — that is the other entity's work. */
export default class CanBook extends entity({
  room: text({ min: 1 }),
  at: created(),
}) {}
