import { Repository } from '@fougere/core';
import Product from '../entities/Product.js';

/** At ONE entity a repository IS that entity's storage, and forwards every gesture. */
export default class ProductRepository extends Repository(Product) {}
