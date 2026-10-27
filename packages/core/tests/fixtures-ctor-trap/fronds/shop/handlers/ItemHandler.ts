import { Repository } from '../../../../../src/prefab/Repository.js';
import Item from '../entities/Item.js';

/** Declares a constructor of its own: the rows still come from the seat, after what it asks for. */
export default class ItemHandler extends Repository<Item> {
  constructor(private clock: Logger) { super(); }
}

declare class Logger { info(m: string): void }
