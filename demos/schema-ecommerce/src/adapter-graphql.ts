/**
 * Adapter GraphQL — schema Pothos généré depuis les entités fougere
 */
import SchemaBuilder from '@pothos/core';
import { eq } from 'drizzle-orm';
import { registerType, registerInput, registerOperations } from '@fougere/schema-graphql';
import { db } from './db.js';
import * as t from './adapter-drizzle.js';
import {
  Category, Product, Customer, OrderLine, Order,
  CreateProduct, UpdateProduct,
} from './entities.js';

const builder = new SchemaBuilder<{}>({});

// ─── Types ─────────────────────────────────────────

const CategoryType = registerType(builder, {
  name: 'Category',
  entity: Category,
});

const ProductType = registerType(builder, {
  name: 'Product',
  entity: Product,
  exclude: ['categoryId'],
  relations: {
    category: {
      type: CategoryType,
      resolve: (p: any) => db.select().from(t.categories).where(eq(t.categories.id, p.categoryId)).get()!,
    },
  },
});

const CustomerType = registerType(builder, {
  name: 'Customer',
  entity: Customer,
  exclude: ['email'],
});

const OrderLineType = registerType(builder, {
  name: 'OrderLine',
  entity: OrderLine,
  exclude: ['productId'],
  relations: {
    product: {
      type: ProductType,
      resolve: (p: any) => db.select().from(t.products).where(eq(t.products.id, p.productId)).get()!,
    },
  },
});

const OrderType = registerType(builder, {
  name: 'Order',
  entity: Order,
  exclude: ['customerId'],
  relations: {
    customer: {
      type: CustomerType,
      resolve: (p: any) => db.select().from(t.customers).where(eq(t.customers.id, p.customerId)).get()!,
    },
    lines: {
      type: OrderLineType,
      list: true,
      resolve: (p: any) => db.select().from(t.orderLines).where(eq(t.orderLines.orderId, p.id)).all(),
    },
  },
});

// ─── Inputs ────────────────────────────────────────

const CreateProductInput = registerInput(builder, { name: 'CreateProductInput', schema: CreateProduct });
const UpdateProductInput = registerInput(builder, { name: 'UpdateProductInput', schema: UpdateProduct });

const CreateOrderLineInput = builder.inputType('CreateOrderLineInput', {
  fields: (f) => ({
    productId: f.string({ required: true }),
    quantity:  f.int({ required: true }),
  }),
});

const CreateOrderInput = builder.inputType('CreateOrderInput', {
  fields: (f) => ({
    customerId: f.string({ required: true }),
    note:       f.string(),
    lines:      f.field({ type: [CreateOrderLineInput], required: true }),
  }),
});

// ─── Read-only operations via registerOperations ──

builder.queryType({});

/** Helper: create a read-only operations map (list + findById). */
function readOnlyOps() {
  return new Map<string, any>([
    ['list', {
      signature: {
        name: 'list',
        params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
        returnType: { raw: 'ListResult', name: 'ListResult' },
      },
    }],
    ['findById', {
      signature: {
        name: 'findById',
        params: [{ name: 'id', type: { raw: 'string', name: 'string' } }],
        returnType: { raw: 'any', name: 'any', nullable: true },
      },
    }],
  ]);
}

registerOperations(builder, {
  name: 'Product',
  type: ProductType,
  facade: {
    list: () => db.select().from(t.products).all(),
    findById: (ctx: any) => db.select().from(t.products).where(eq(t.products.id, ctx.params.id)).get() ?? null,
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Category',
  type: CategoryType,
  facade: {
    list: () => db.select().from(t.categories).all(),
    findById: (ctx: any) => db.select().from(t.categories).where(eq(t.categories.id, ctx.params.id)).get() ?? null,
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Customer',
  type: CustomerType,
  facade: {
    list: () => db.select().from(t.customers).all(),
    findById: (ctx: any) => db.select().from(t.customers).where(eq(t.customers.id, ctx.params.id)).get() ?? null,
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Order',
  type: OrderType,
  facade: {
    list: () => db.select().from(t.orders).all(),
    findById: (ctx: any) => db.select().from(t.orders).where(eq(t.orders.id, ctx.params.id)).get() ?? null,
  },
  operations: readOnlyOps(),
});

// ─── Mutations ─────────────────────────────────────

function uuid() { return crypto.randomUUID(); }

builder.mutationType({});

(builder as any).mutationFields((f: any) => ({
  createProduct: f.field({
    type: ProductType,
    args: { input: f.arg({ type: CreateProductInput, required: true }) },
    resolve: (_: any, { input }: any) => {
      const v = CreateProduct.validate(input);
      if (!v.success) throw new Error(v.errors.map((e: any) => `${e.path}: ${e.message}`).join(', '));

      const id = uuid();
      db.insert(t.products).values({
        id, ...input, active: true, createdAt: new Date().toISOString(),
      }).run();
      return db.select().from(t.products).where(eq(t.products.id, id)).get()!;
    },
  }),

  updateProduct: f.field({
    type: ProductType,
    nullable: true,
    args: {
      id: f.arg.string({ required: true }),
      input: f.arg({ type: UpdateProductInput, required: true }),
    },
    resolve: (_: any, { id, input }: any) => {
      const v = UpdateProduct.validate(input);
      if (!v.success) throw new Error(v.errors.map((e: any) => `${e.path}: ${e.message}`).join(', '));

      const updates: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(input)) {
        if (val != null) updates[k] = val;
      }
      if (Object.keys(updates).length > 0) {
        db.update(t.products).set(updates).where(eq(t.products.id, id)).run();
      }
      return db.select().from(t.products).where(eq(t.products.id, id)).get() ?? null;
    },
  }),

  createOrder: f.field({
    type: OrderType,
    args: { input: f.arg({ type: CreateOrderInput, required: true }) },
    resolve: (_: any, { input }: any) => {
      const orderId = uuid();
      let total = 0;
      const lines: Array<{ id: string; orderId: string; productId: string; quantity: number; unitPrice: number }> = [];

      for (const line of input.lines) {
        const product = db.select().from(t.products).where(eq(t.products.id, line.productId)).get();
        if (!product) throw new Error(`Product ${line.productId} not found`);
        total += product.price * line.quantity;
        lines.push({ id: uuid(), orderId, productId: line.productId, quantity: line.quantity, unitPrice: product.price });
      }

      db.insert(t.orders).values({
        id: orderId, customerId: input.customerId,
        status: 'pending', total, note: input.note ?? null,
        createdAt: new Date().toISOString(),
      }).run();

      for (const line of lines) db.insert(t.orderLines).values(line).run();

      return db.select().from(t.orders).where(eq(t.orders.id, orderId)).get()!;
    },
  }),
}));

export const graphqlSchema = builder.toSchema();
