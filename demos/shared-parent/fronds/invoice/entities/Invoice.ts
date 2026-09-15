import { entity, primary, number, text } from '@fougere/schema';

export default class Invoice extends entity({
  id: primary(),
  customer: text({ min: 1 }),
  cents: number({ min: 0 }),
}) {}
