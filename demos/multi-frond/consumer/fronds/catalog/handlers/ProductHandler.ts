import { Crud } from '@fougere/core';
import Product from '../entities/Product.js';

export default class ProductHandler extends Crud(Product) {}
