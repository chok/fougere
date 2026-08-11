import { entity, primary, number } from '@fougere/schema';

export default class Invoice extends entity({
  id: primary(),
  cents: number({ min: 0 }),
}) {}
