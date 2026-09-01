/**
 * Adapter GraphQL — schema Pothos généré depuis les entités fougere
 */
import SchemaBuilder from '@pothos/core';
import { registerType, registerInput, registerOperations } from '@fougere/adapter-graphql/pothos';
import { categoryStorage, productStorage, customerStorage, orderLineStorage, orderStorage } from './db.js';
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
      resolve: (p: any) => categoryStorage.findById(p.categoryId),
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
      resolve: (p: any) => productStorage.findById(p.productId),
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
      resolve: (p: any) => customerStorage.findById(p.customerId),
    },
    lines: {
      type: OrderLineType,
      list: true,
      resolve: (p: any) => orderLineStorage.findAllBy({ orderId: p.id }),
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
      kind: 'query',
      signature: {
        name: 'list',
        params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
        returnType: { raw: 'ListResult', name: 'ListResult' },
      },
    }],
    ['findById', {
      kind: 'query',
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
    list: (ctx: any) => productStorage.list(ctx.body),
    findById: (ctx: any) => productStorage.findById(ctx.params.id),
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Category',
  type: CategoryType,
  facade: {
    list: (ctx: any) => categoryStorage.list(ctx.body),
    findById: (ctx: any) => categoryStorage.findById(ctx.params.id),
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Customer',
  type: CustomerType,
  facade: {
    list: (ctx: any) => customerStorage.list(ctx.body),
    findById: (ctx: any) => customerStorage.findById(ctx.params.id),
  },
  operations: readOnlyOps(),
});

registerOperations(builder, {
  name: 'Order',
  type: OrderType,
  facade: {
    list: (ctx: any) => orderStorage.list(ctx.body),
    findById: (ctx: any) => orderStorage.findById(ctx.params.id),
  },
  operations: readOnlyOps(),
});

// ─── Mutations ─────────────────────────────────────

builder.mutationType({});

(builder as any).mutationFields((f: any) => ({
  createProduct: f.field({
    type: ProductType,
    args: { input: f.arg({ type: CreateProductInput, required: true }) },
    resolve: async (_: any, { input }: any) => {
      const v = CreateProduct.validate(input);
      if (!v.success) throw new Error(v.errors.map((e: any) => `${e.path}: ${e.message}`).join(', '));

      // active/createdAt are realised by the storage (SQL default, auto timestamp) —
      // the caller only supplies what it owns.
      return productStorage.create(input);
    },
  }),

  updateProduct: f.field({
    type: ProductType,
    nullable: true,
    args: {
      id: f.arg.string({ required: true }),
      input: f.arg({ type: UpdateProductInput, required: true }),
    },
    resolve: async (_: any, { id, input }: any) => {
      const v = UpdateProduct.validate(input);
      if (!v.success) throw new Error(v.errors.map((e: any) => `${e.path}: ${e.message}`).join(', '));

      const updates: Record<string, unknown> = {};
      for (const [k, val] of Object.entries(input)) {
        if (val != null) updates[k] = val;
      }
      // An empty patch has no SET clause to run — just hand back the current row.
      if (Object.keys(updates).length === 0) return (await productStorage.findById(id)) ?? null;
      return productStorage.update(id, updates);
    },
  }),

  createOrder: f.field({
    type: OrderType,
    args: { input: f.arg({ type: CreateOrderInput, required: true }) },
    resolve: async (_: any, { input }: any) => {
      let total = 0;
      const lines: { productId: string; quantity: number; unitPrice: number }[] = [];

      for (const line of input.lines) {
        const product = await productStorage.findById(line.productId);
        if (!product) throw new Error(`Product ${line.productId} not found`);
        total += (product as any).price * line.quantity;
        lines.push({ productId: line.productId, quantity: line.quantity, unitPrice: (product as any).price });
      }

      const order = await orderStorage.create({
        customerId: input.customerId,
        status: 'pending',
        total,
        note: input.note ?? null,
      });

      for (const line of lines) {
        await orderLineStorage.create({ ...line, orderId: order.id });
      }

      return order;
    },
  }),
}));

export const graphqlSchema = builder.toSchema();
