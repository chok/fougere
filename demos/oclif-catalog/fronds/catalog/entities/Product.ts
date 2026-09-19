import { entity, primary, text, number, oneOf, optional } from '@fougere/schema';

/**
 * One declaration, and the terminal reads every word of it: `--sku` is required because the
 * axes say a caller writes it, `--state` lists its three values because `oneOf` named them,
 * and `--cents` reaches the handler as a number because the shape is one.
 */
export default class Product extends entity({
  id: primary(),
  sku: text({ min: 3, max: 20, description: 'Warehouse reference' }),
  name: text({ min: 1, max: 120 }),
  cents: number({ description: 'Price, in cents' }),
  state: optional(oneOf('draft', 'listed', 'archived', { default: 'draft' })),
}) {}
