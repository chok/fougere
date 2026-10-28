/**
 * A link in front of `Present<Order>` adds fields of its own, and GraphQL types the chain's: the
 * presenter's fields and the link's, read off the frond rather than off the presenter alone.
 */
import SchemaBuilder from '@pothos/core';
import { describe, expect, it } from 'vitest';
import { entity, primary, text } from '@fougere/schema';
import { registerAll } from '../src/auto-register.js';
import { served } from './served.js';

class Order extends entity({ id: primary(), label: text() }) {}

class Badges {
  constructor(readonly inner: unknown) {}
  async badges(rows: unknown[]) { return rows.map(() => 'new'); }
}

const facade = { list: async () => [], findById: async () => undefined };

const app = {
  fronds: [{
    name: 'shop',
    entities: [{ name: 'order', entityClass: Order }],
    handlers: [{ address: 'order', operations: new Map() }],
    providers: [{ ctor: Badges, deps: ['Present<Order>'], implements: ['Present<Order>'], filePath: 'services/Badges.ts' }],
    presenters: [{ entityName: 'order', fields: ['total_cents'] }],
  }],
  // The chain's outermost link, as `presenterFor` hands it: its own field, and the presenter's forwarded.
  presenterFor: () => new (class {
    async total_cents() { return 0; }
    async badges() { return []; }
  })(),
  resolve: () => { throw new Error('no such registration'); },
  facadeFor: () => facade,
  operationsFor: () => served(facade, Order),
} as never;

describe('a Present<Order> chain', () => {
  it('types the fields of the presenter and of the link in front of it', () => {
    const builder = new SchemaBuilder({});
    builder.queryType({});
    builder.mutationType({});
    registerAll(builder, app);
    const fields = (builder.toSchema().getTypeMap()['ShopOrder'] as never as { getFields(): Record<string, unknown> }).getFields();

    expect(Object.keys(fields)).toEqual(expect.arrayContaining(['total_cents', 'badges']));
  });
});
