import { Repository } from '@fougere/core';
import Item from '../entities/Item.js';
import Line from '../entities/Line.js';

export default class CatalogRepository extends Repository(Item, Line) {}
