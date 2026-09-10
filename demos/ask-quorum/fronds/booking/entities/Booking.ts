import { entity, primary, text, created } from '@fougere/schema';

/** A reservation, once nobody objected. */
export default class Booking extends entity({
  id: primary(),
  room: text({ min: 1 }),
  at: created(),
}) {}
