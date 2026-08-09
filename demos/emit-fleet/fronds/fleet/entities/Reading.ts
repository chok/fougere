import { entity, auto, number, text } from '@fougere/schema';

/** Up the fleet. The device announces; the hub happens to listen. */
export default class Reading extends entity({
  node: text({ min: 1 }),
  celsius: number(),
  at: auto(),
}) {}
