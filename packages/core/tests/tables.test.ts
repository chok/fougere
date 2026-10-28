/**
 * Two fronds may each declare an `Author`: each declares the fields it cares about — a view — and the
 * table is their union. A field one leaves out is optional there; a field two declare differently is
 * one column with two shapes, which the boot refuses.
 */
import { describe, it, expect } from 'vitest';
import { createContainer } from '@fougere/container';
import { entity, number, primary, text } from '@fougere/schema';
import { createApp, createLocalRunner, frond, Invocation, Repository } from '../src/index.js';
import { tablesOf } from '../src/descriptor/tables.js';
import { memory } from './memory.js';

const named = <T extends abstract new (...args: never[]) => unknown>(ctor: T, name: string): T =>
  Object.defineProperty(ctor, 'name', { value: name });

const BlogAuthor = named(class extends entity({ id: primary(), name: text(), pen: text() }) {}, 'Author');
const ShopAuthor = named(class extends entity({ id: primary(), name: text(), vat: text() }) {}, 'Author');
const Contradicting = named(class extends entity({ id: primary(), name: number() }) {}, 'Author');

const views = (shop: typeof ShopAuthor | typeof Contradicting) => [
  { name: 'blog', entities: [{ name: 'author', entityClass: BlogAuthor }] },
  { name: 'shop', entities: [{ name: 'author', entityClass: shop }] },
];

describe('the table two fronds declare', () => {
  it('is the union of their views, what one leaves out optional', () => {
    const { tables, contradictions } = tablesOf(views(ShopAuthor));
    const table = tables.get('author')!.getFields();

    expect(Object.keys(table).sort()).toEqual(['id', 'name', 'pen', 'vat']);
    expect(contradictions).toEqual([]);
    expect(table.pen!.shape.type).toEqual(['string', 'null']);
    expect(table.name!.shape.type).toBe('string');
  });

  it('refuses the boot when one field is declared two ways, naming it and both fronds', async () => {
    class AuthorHandler extends Repository<never> {}
    class SellerHandler extends Repository<never> {}
    const booting = createApp({ createContainer, storageFactory: memory, migrates: true, fronds: [
      frond('blog', { entities: [BlogAuthor], handlers: [{ ctor: AuthorHandler, repository: BlogAuthor as never }] }),
      frond('shop', { entities: [Contradicting], handlers: [{ ctor: SellerHandler, repository: Contradicting as never }] }),
    ] } as never);

    await expect(booting).rejects.toThrow(/'blog' and 'shop' both declare author\.name, differently/);
  });

  it('is published on the card once per frond, each its own view', async () => {
    class AuthorHandler extends Repository<never> {}
    class SellerHandler extends Repository<never> {}
    await using app = await createApp({ createContainer, storageFactory: memory, migrates: true, fronds: [
      frond('blog', { entities: [BlogAuthor], handlers: [{ ctor: AuthorHandler, repository: BlogAuthor as never }] }),
      frond('shop', { entities: [ShopAuthor], handlers: [{ ctor: SellerHandler, repository: ShopAuthor as never }] }),
    ] } as never);
    const card = await createLocalRunner(app)({ address: 'rpc', op: 'discover' }, Invocation.empty) as {
      fronds: { name: string; entities: { name: string; schema: { required?: string[] } }[] }[];
    };
    const required = (frondName: string) => card.fronds.find((one) => one.name === frondName)!.entities[0]!.schema.required;

    expect(required('blog')).toEqual(expect.arrayContaining(['pen']));
    expect(required('shop')).toEqual(expect.arrayContaining(['vat']));
  });
});
