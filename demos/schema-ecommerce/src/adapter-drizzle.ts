/**
 * Adapter Drizzle — tables SQLite générées depuis les entités fougere
 */
import { toSqliteTables } from '@fougere/schema-drizzle';
import { Category, Product, Customer, OrderLine, Order } from './entities.js';

export const {
  categories,
  products,
  customers,
  orderLines,
  orders,
} = toSqliteTables({
  categories: Category,
  products: Product,
  customers: Customer,
  orderLines: OrderLine,
  orders: Order,
});
