import { Crud } from '../../../../../src/prefab/crud.js';
import Item from '../entities/Item.js';

/** Declares a constructor and forgets its storage — must be refused at boot. */
export default class ItemHandler extends Crud(Item) {
  constructor(private clock: Logger) { super(undefined as never); }
}

declare class Logger { info(m: string): void }
