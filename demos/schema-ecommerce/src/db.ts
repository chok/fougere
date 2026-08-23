/**
 * Storage — Kysely/SQLite wired from the entities, no hand-written DDL.
 */
import { migrate, toTableName } from '@fougere/adapter-sql';
import { setupSqlite } from '@fougere/adapter-sql/sqlite';
import { Category, Product, Customer, OrderLine, Order } from './entities.js';

// 'category' → 'categories' is the one irregular plural the default
// convention (+s) gets wrong — every other entity name already pluralizes right.
const IRREGULAR_PLURALS: Record<string, string> = { category: 'categories' };
const tableName = (name: string) => IRREGULAR_PLURALS[name] ?? toTableName(name);

const { db, ormFactory } = setupSqlite({
  path: 'demo.db',
  ormFactoryOptions: { tableName },
});

export { db };

const entities = [
  { name: 'category', entityClass: Category },
  { name: 'product', entityClass: Product },
  { name: 'customer', entityClass: Customer },
  { name: 'orderLine', entityClass: OrderLine },
  { name: 'order', entityClass: Order },
];

// Bring the schema up to date from the entities — additive, replaces the
// hand-written CREATE TABLE block.
await migrate({ fronds: [{ name: 'ecommerce', entities }] }, db, { tableName });

export const categoryOrm = ormFactory(Category, 'category');
export const productOrm = ormFactory(Product, 'product');
export const customerOrm = ormFactory(Customer, 'customer');
export const orderLineOrm = ormFactory(OrderLine, 'orderLine');
export const orderOrm = ormFactory(Order, 'order');
