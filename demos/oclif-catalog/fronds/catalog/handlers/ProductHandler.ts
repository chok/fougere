import { Crud } from '@fougere/core';
import Product from '../entities/Product.js';

/**
 * Nothing here knows about a terminal.
 *
 * `Crud(Product)` gives the five operations, and `@fougere/oclif` turns each into a command:
 * `product:list`, `product:create`, `product:find-by-id`. The topic `product` forms itself
 * from the address — no table, no registration.
 */
export default class ProductHandler extends Crud(Product) {}
