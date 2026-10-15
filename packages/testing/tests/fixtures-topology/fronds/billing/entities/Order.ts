import { entity, primary, number } from '@fougere/schema';

export default class Order extends entity({
  id: primary(),
  cents: number({ integer: true, min: 1 }),
}) {}
