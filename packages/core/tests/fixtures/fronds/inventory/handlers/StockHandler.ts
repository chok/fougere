import { Crud } from '../../../../../src/crud.js';
import Item from '../entities/Item.js';

export class StockSearchInput {
  static getFields() {
    return { name: { __brand: 'fougere_field' as const, type: 'text', options: {}, nullable: false } };
  }
}

export class StockSearchOutput {
  static getFields() {
    return {
      id: { __brand: 'fougere_field' as const, type: 'id', options: { primary: true }, nullable: false },
      name: { __brand: 'fougere_field' as const, type: 'text', options: {}, nullable: false },
      quantity: { __brand: 'fougere_field' as const, type: 'number', options: {}, nullable: false },
    };
  }
}

/** Handler that overrides list + adds a custom op. Tests child-wins merge. */
export default class StockHandler extends Crud(Item) {
  async list(): Promise<Item[]> { return []; }

  async searchStock(input: StockSearchInput): Promise<StockSearchOutput[]> {
    return [];
  }
}
