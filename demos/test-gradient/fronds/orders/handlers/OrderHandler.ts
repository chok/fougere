import { Crud } from '@fougere/core';
import Order from '../entities/Order.js';

export default class OrderHandler extends Crud(Order) {}
