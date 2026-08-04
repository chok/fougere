import { entity, primary, text, auto } from '@fougere/schema';

/** Rename it, then declare your fields — this is the whole shape of an entity. */
export default class Item extends entity({
  id: primary(),
  name: text({ min: 1, max: 200 }),
  createdAt: auto(),
}) {}
