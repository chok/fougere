import { entity, primary, text, number } from '@fougere/schema';
import { Crud } from '../../../../../src/prefab/crud.js';
import Item from '../entities/Item.js';

export class StockSearchInput extends entity({
  name: text(),
}) {}

export class StockSearchOutput extends entity({
  id: primary(),
  name: text(),
  quantity: number(),
}) {}

/** Handler that overrides list + adds a custom op. Tests child-wins merge. */
export default class StockHandler extends Crud(Item) {
  async list(): Promise<Item[]> { return []; }

  async searchStock(input: StockSearchInput): Promise<StockSearchOutput[]> {
    return [];
  }
}
