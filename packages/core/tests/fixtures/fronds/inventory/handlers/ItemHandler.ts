import { Repository } from '../../../../../src/prefab/Repository.js';
import Item from '../entities/Item.js';

/** Handler that extends Repository<Item> — tests heritage clause parsing. */
export default class ItemHandler extends Repository<Item> {}
