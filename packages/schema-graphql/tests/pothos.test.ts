import { describe, it, expect } from 'vitest';
import SchemaBuilder from '@pothos/core';
import { entity, primary, text, number, bool, auto, oneOf, ref, optional, readOnly, writeOnly } from '@fougere/schema';
import { registerType, registerInput, registerOperations } from '../src/index.js';

// ─── Fixtures ──────────────────────────────────────

class Category extends entity({
  id: primary(),
  name: text({ min: 1 }),
  slug: text(),
}) {}

class Product extends entity({
  id: primary(),
  categoryId: ref(Category),
  name: text({ min: 1 }),
  price: number({ min: 0 }),
  stock: number({ min: 0, integer: true }),
  active: bool({ default: true }),
  createdAt: auto(),
}) {}

const CreateProduct = Product.pick('categoryId', 'name', 'price', 'stock');
const UpdateProduct = Product.pick('name', 'price', 'stock', 'active').partial();

// ─── In-memory store ───────────────────────────────

const categories = [
  { id: '1', name: 'Plantes', slug: 'plantes' },
];

const products = [
  { id: '1', categoryId: '1', name: 'Fougère', price: 24.99, stock: 50, active: true, createdAt: '2024-01-01' },
];

// ─── Tests ─────────────────────────────────────────

describe('registerType', () => {
  it('generates a GraphQL object type from entity', () => {
    const builder = new SchemaBuilder({});

    const CategoryType = registerType(builder, {
      name: 'Category',
      entity: Category,
    });

    builder.queryType({
      fields: (t) => ({
        categories: t.field({
          type: [CategoryType],
          resolve: () => categories,
        }),
      }),
    });

    // builder.toSchema() ne doit pas throw
    const schema = builder.toSchema();
    expect(schema).toBeDefined();

    // Vérifier les types via l'API interne
    const typeMap = schema.getTypeMap();
    expect(typeMap['Category']).toBeDefined();

    const catType = typeMap['Category'] as any;
    const fields = catType.getFields();
    expect(fields['id']).toBeDefined();
    expect(fields['name']).toBeDefined();
    expect(fields['slug']).toBeDefined();
  });

  it('excludes specified fields', () => {
    const builder = new SchemaBuilder({});

    const ProductType = registerType(builder, {
      name: 'Product',
      entity: Product,
      exclude: ['categoryId'],
    });

    builder.queryType({
      fields: (t) => ({
        products: t.field({
          type: [ProductType],
          resolve: () => products,
        }),
      }),
    });

    const schema = builder.toSchema();
    const typeMap = schema.getTypeMap();
    const prodType = typeMap['Product'] as any;
    const fields = prodType.getFields();

    expect(fields['categoryId']).toBeUndefined();
    expect(fields['name']).toBeDefined();
    expect(fields['price']).toBeDefined();
  });

  it('adds relations', () => {
    const builder = new SchemaBuilder({});

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
          resolve: (parent: any) => categories.find(c => c.id === parent.categoryId)!,
        },
      },
    });

    builder.queryType({
      fields: (t) => ({
        products: t.field({
          type: [ProductType],
          resolve: () => products,
        }),
      }),
    });

    const schema = builder.toSchema();
    const prodType = schema.getTypeMap()['Product'] as any;
    const fields = prodType.getFields();
    expect(fields['category']).toBeDefined();
  });

  it('maps field types correctly', () => {
    const builder = new SchemaBuilder({});

    const ProductType = registerType(builder, {
      name: 'Product',
      entity: Product,
    });

    builder.queryType({
      fields: (t) => ({
        products: t.field({
          type: [ProductType],
          resolve: () => products,
        }),
      }),
    });

    const schema = builder.toSchema();
    const prodType = schema.getTypeMap()['Product'] as any;
    const fields = prodType.getFields();

    // price → Float, stock → Int, active → Boolean
    // getFields().type includes NonNull wrapper only in some Pothos versions
    expect(fields['price'].type.toString()).toMatch(/Float/);
    expect(fields['stock'].type.toString()).toMatch(/Int/);
    expect(fields['active'].type.toString()).toMatch(/Boolean/);
  });

  it('encodes a date field to an ISO string on egress (codec)', () => {
    const builder = new SchemaBuilder({});
    const ProductType = registerType(builder, { name: 'Product', entity: Product });
    builder.queryType({
      fields: (t) => ({ products: t.field({ type: [ProductType], resolve: () => products }) }),
    });

    const schema = builder.toSchema();
    const fields = (schema.getTypeMap()['Product'] as any).getFields();

    // createdAt is a `date` field → String type, resolved through encode (Date → ISO).
    expect(fields['createdAt'].type.toString()).toMatch(/String/);
    const resolved = fields['createdAt'].resolve({ createdAt: new Date('2026-05-31T10:00:00.000Z') }, {}, {}, {});
    expect(resolved).toBe('2026-05-31T10:00:00.000Z');
  });
});

describe("boundary 'closed' → type membership", () => {
  it('write-only is absent from the object type, read-only absent from the input type', () => {
    const builder = new SchemaBuilder({});

    class Account extends entity({
      id: primary(),
      name: text({ min: 1 }),
      password: writeOnly(text({ min: 8 })),
      loginCount: readOnly(number({ integer: true })),
    }) {}

    const AccountType = registerType(builder, { name: 'Account', entity: Account });
    const AccountInput = registerInput(builder, { name: 'AccountInput', schema: Account });

    builder.queryType({
      fields: (t) => ({ account: t.field({ type: AccountType, resolve: () => null }) }),
    });
    builder.mutationType({
      fields: (t) => ({
        createAccount: t.field({
          type: 'Boolean',
          args: { input: t.arg({ type: AccountInput, required: true }) },
          resolve: () => true,
        }),
      }),
    });

    const typeMap = builder.toSchema().getTypeMap();
    const objFields = (typeMap['Account'] as any).getFields();
    expect(objFields['password']).toBeUndefined(); // never emitted
    expect(objFields['loginCount']).toBeDefined(); // read-only still readable

    const inFields = (typeMap['AccountInput'] as any).getFields();
    expect(inFields['loginCount']).toBeUndefined(); // never accepted
    expect(inFields['password']).toBeDefined(); // write-only still writable
  });
});

describe('registerInput', () => {
  it('generates a GraphQL input type from schema view', () => {
    const builder = new SchemaBuilder({});

    const CreateProductInput = registerInput(builder, {
      name: 'CreateProductInput',
      schema: CreateProduct,
    });

    builder.queryType({
      fields: (t) => ({
        ok: t.boolean({ resolve: () => true }),
      }),
    });
    builder.mutationType({
      fields: (t) => ({
        createProduct: t.field({
          type: 'Boolean',
          args: { input: t.arg({ type: CreateProductInput, required: true }) },
          resolve: () => true,
        }),
      }),
    });

    const schema = builder.toSchema();
    const inputType = schema.getTypeMap()['CreateProductInput'] as any;
    expect(inputType).toBeDefined();

    const fields = inputType.getFields();
    expect(fields['categoryId']).toBeDefined();
    expect(fields['name']).toBeDefined();
    expect(fields['price']).toBeDefined();
    expect(fields['stock']).toBeDefined();
  });

  it('makes partial fields nullable in inputs', () => {
    const builder = new SchemaBuilder({});

    const UpdateProductInput = registerInput(builder, {
      name: 'UpdateProductInput',
      schema: UpdateProduct,
    });

    builder.queryType({
      fields: (t) => ({
        ok: t.boolean({ resolve: () => true }),
      }),
    });
    builder.mutationType({
      fields: (t) => ({
        updateProduct: t.field({
          type: 'Boolean',
          args: { input: t.arg({ type: UpdateProductInput, required: true }) },
          resolve: () => true,
        }),
      }),
    });

    const schema = builder.toSchema();
    const inputType = schema.getTypeMap()['UpdateProductInput'] as any;
    const fields = inputType.getFields();

    // Partial = nullable = pas de "!" dans le type
    expect(fields['name'].type.toString()).toBe('String');
    expect(fields['price'].type.toString()).toBe('Float');
    expect(fields['stock'].type.toString()).toBe('Int');
    expect(fields['active'].type.toString()).toBe('Boolean');
  });
});

describe('registerOperations', () => {
  it('generates queries and mutations from signatures', () => {
    const builder = new SchemaBuilder({});

    const CategoryType = registerType(builder, {
      name: 'Category',
      entity: Category,
    });

    builder.queryType({});
    builder.mutationType({});

    const facade = {
      list: () => categories,
      findById: (ctx: any) => categories.find(c => c.id === ctx.params.id) ?? null,
      create: (ctx: any) => ({ id: String(categories.length + 1), ...ctx.body }),
    };

    const operations = new Map<string, any>([
      ['list', {
        signature: {
          name: 'list',
          params: [{ name: 'options', type: { raw: 'ListOptions', name: 'ListOptions' }, optional: true }],
          returnType: { raw: 'ListResult<Category>', name: 'ListResult', generics: [{ raw: 'Category', name: 'Category' }] },
        },
      }],
      ['findById', {
        signature: {
          name: 'findById',
          params: [{ name: 'id', type: { raw: 'string', name: 'string' } }],
          returnType: { raw: 'Category | undefined', name: 'Category', nullable: true },
        },
      }],
      ['create', {
        input: Category,
        signature: {
          name: 'create',
          params: [{ name: 'input', type: { raw: 'Category', name: 'Category' } }],
          returnType: { raw: 'Category', name: 'Category' },
        },
      }],
    ]);

    registerOperations(builder, {
      name: 'Category',
      type: CategoryType,
      facade,
      operations,
    });

    const schema = builder.toSchema();
    const queryType = schema.getQueryType()!;
    const queryFields = queryType.getFields();

    expect(queryFields['categories']).toBeDefined();
    expect(queryFields['category']).toBeDefined();

    const mutationType = schema.getMutationType()!;
    const mutationFields = mutationType.getFields();
    expect(mutationFields['createCategory']).toBeDefined();
  });

  it('validates input on create mutation', () => {
    const createSchema = Category.pick('name', 'slug');
    const result = createSchema.validate({ name: '', slug: 'test' });
    expect(result.success).toBe(false);
  });
});

describe('value list (list())', () => {
  it('exposes a list field as a GraphQL list of its item scalar', async () => {
    const { list } = await import('@fougere/schema');
    class Tagged extends entity({ id: primary(), tags: list(text()), scores: list(number({ integer: true })) }) {}
    const builder = new SchemaBuilder({});
    const TaggedType = registerType(builder, { name: 'Tagged', entity: Tagged });
    builder.queryType({
      fields: (t) => ({ tagged: t.field({ type: [TaggedType], resolve: () => [] }) }),
    });
    const fields = (builder.toSchema().getTypeMap()['Tagged'] as any).getFields();
    expect(fields['tags'].type.toString()).toBe('[String!]!');
    expect(fields['scores'].type.toString()).toBe('[Int!]!');
  });

  it('accepts a list field in inputs', async () => {
    const { list } = await import('@fougere/schema');
    class Tagged extends entity({ id: primary(), tags: list(text()) }) {}
    const builder = new SchemaBuilder({});
    registerInput(builder, { name: 'CreateTaggedInput', schema: Tagged.pick('tags') });
    builder.queryType({ fields: (t) => ({ ok: t.boolean({ resolve: () => true }) }) });
    const input = (builder.toSchema().getTypeMap()['CreateTaggedInput'] as any).getFields();
    expect(input['tags'].type.toString()).toBe('[String!]!');
  });
});
