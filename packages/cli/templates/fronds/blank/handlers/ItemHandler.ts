import { Crud } from '@fougere/core';
import Item from '../entities/Item.js';

/** The five ops, derived. Redefine one to judge it, add a method to name an operation. */
export default class ItemHandler extends Crud(Item) {}
