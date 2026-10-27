import { Repository } from '@fougere/core';
import Item from '../entities/Item.js';

/** Handler that extends Repository<Item> — tests heritage clause parsing. */
export default class ItemHandler extends Repository<Item> {}
