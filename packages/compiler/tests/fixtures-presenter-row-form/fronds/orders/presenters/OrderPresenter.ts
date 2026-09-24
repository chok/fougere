import Order from '../entities/Order.js';
import { Presenter } from '@fougere/core';

/**
 * One method in each form. `label` is the shape that compiles and dies at the first
 * call — it asks for a row where the executor hands the page.
 */
export default class OrderPresenter extends Presenter(Order) {
  label(order: Order): string {
    return String(order.holder);
  }

  shouted(orders: Order[]): string[] {
    return orders.map((order) => String(order.holder).toUpperCase());
  }
}
