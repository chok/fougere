import { entity, primary, text, number } from '@fougere/schema';

/** Test entity for Crud inheritance tests. */
export default class Item extends entity({
  id: primary(),
  name: text(),
  quantity: number(),
}) {}
