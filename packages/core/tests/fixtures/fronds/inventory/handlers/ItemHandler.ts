import { Crud } from '../../../../../src/crud.js';
import Item from '../entities/Item.js';

/** Handler that extends Crud(Item) — tests heritage clause parsing. */
export default class ItemHandler extends Crud(Item) {}
