import { Crud } from '@fougere/core';
import Product from '../entities/Product.js';

/** The five CRUD ops — their input contract comes from the entity, so the façade judges. */
export default class ProductHandler extends Crud(Product) {}
