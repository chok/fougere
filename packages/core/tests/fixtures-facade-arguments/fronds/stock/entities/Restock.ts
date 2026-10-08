import { entity, number } from '@fougere/schema';

export default class Restock extends entity({
  quantity: number({ min: 1 }),
}) {}
