import { Repository } from '@fougere/core';
import Item from '../entities/Item.js';
import Line from '../entities/Line.js';

export default class StockRepository extends Repository(Item, Line) {}
