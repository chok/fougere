import { entity, primary, text, number } from '@fougere/schema';

/** The app's own domain, declared at the project root — no `fronds/` anywhere. */
export default class Product extends entity({
  id: primary(),
  name: text(),
  price: number({ min: 0 }),
}) {}
