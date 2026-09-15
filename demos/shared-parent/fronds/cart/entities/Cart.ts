import { entity, primary, number, text } from '@fougere/schema';

export default class Cart extends entity({
  id: primary(),
  label: text({ min: 1 }),
  cents: number({ min: 0 }),
}) {}
