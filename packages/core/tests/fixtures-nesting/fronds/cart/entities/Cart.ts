import { entity, primary, number } from '@fougere/schema';

export default class Cart extends entity({
  id: primary(),
  cents: number({ min: 0 }),
}) {}
