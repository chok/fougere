import { entity, primary, text, number } from '@fougere/schema';
import { Repository } from '../../../../../src/prefab/Repository.js';
import type { ListResult } from '../../../../../src/storage/ListResult.js';
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
export default class StockHandler extends Repository<Item> {
  async list(): Promise<ListResult<Item>> { return []; }

  async searchStock(input: StockSearchInput): Promise<StockSearchOutput[]> {
    return [];
  }
}
