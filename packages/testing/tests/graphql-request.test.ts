/**
 * One GraphQL document is one request and several calls — one per root field. Through the door,
 * every call says which request it answers, which an observer reads to put them back together.
 */
import '@fougere/adapter-graphql';
import { afterAll, describe, expect, it } from 'vitest';
import { join } from 'node:path';
import { graphqlDoor, schemaOf } from '@fougere/adapter-graphql';
import { DispatchEvent, DoorEvent } from '@fougere/core';
import { testApp } from '../src/index.js';

const app = await testApp({ root: join(import.meta.dirname, 'fixtures'), fronds: ['press'] });
afterAll(() => app.dispose());

describe('a GraphQL document through its door', () => {
  it('makes one call per root field, all within one request', async () => {
    const schema = schemaOf(app as never);
    const fields = Object.values(schema.getQueryType()!.getFields());
    const paged = (type: unknown) => schema.getType(String(type).replace(/[![\]]/g, '')) as { getFields?: () => object } | undefined;
    const listing = fields.find((field) => 'items' in (paged(field.type)?.getFields?.() ?? {}))!.name;
    const seen: (DispatchEvent | DoorEvent)[] = [];
    const stop = app.observe((event) => seen.push(event));

    const answered = await app.answer(graphqlDoor(schema), {
      document: async () => ({ query: `{ first: ${listing} { items { id } } second: ${listing} { items { id } } }` }),
      state: {},
    });
    stop();

    expect(answered).toMatchObject({ status: 200, data: { data: expect.anything() } });
    const [request] = seen.filter((event): event is DoorEvent => event instanceof DoorEvent).map((event) => event.request);
    const calls = seen.filter((event): event is DispatchEvent => event instanceof DispatchEvent && event.stage === 'received');
    expect(request!.door).toBe('graphql');
    expect(calls.length).toBeGreaterThanOrEqual(2);
    expect(calls.every((call) => call.request === request)).toBe(true);
  });

  it('refuses a document with no query before the engine runs, in its own shape', async () => {
    const answered = await app.answer(graphqlDoor(schemaOf(app as never)), { document: async () => undefined, state: {} });

    expect(answered).toEqual({ status: 400, data: { errors: [{ message: 'Missing query', extensions: { code: 'BAD_REQUEST' } }] } });
  });
});
