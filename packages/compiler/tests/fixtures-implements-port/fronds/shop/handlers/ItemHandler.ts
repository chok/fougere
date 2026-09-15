import { Crud } from '@fougere/core';
import Item from '../entities/Item.js';

export default class ItemHandler extends Crud(Item) {}
