import { describe, it, expect } from 'vitest';
import { createLocalRunner, type App } from '@fougere/core';
import { Invocation } from '@fougere/core/contract';
import { serveRest, serveRpc, tableOf } from '@fougere/app';
import { lowerFirst, type SchemaView } from '@fougere/schema';
import { listQuery, findQuery, mutationFor, at } from './gql.js';
import { sampleInput } from './sample.js';
import type { DoorOptions } from './DoorOptions.js';
import type { DoorInput } from './DoorInput.js';

/** The rows a facade hands back, with its own envelope taken off. */
function rowsOf(value: unknown): unknown {
  if (Array.isArray(value)) return [...value];
  const page = value as { items?: unknown } | null;
  return page && typeof page === 'object' && 'items' in page ? page.items : value;
}

/** Through the wire and back, so a `Date` and its ISO string are not read as a divergence. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));

/** What is the SAME row seen twice, and what is merely a second row. */
function written(value: unknown, sent: Record<string, unknown>): unknown {
  const row = value as Record<string, unknown> | null;
  if (!row || typeof row !== 'object') return wire(row);
  return wire(Object.fromEntries(Object.keys(sent).map((key) => [key, row[key]])));
}

interface Facades {
  local: (op: string, call?: DoorInput) => Promise<unknown>;
  rpc: (op: string, call?: DoorInput) => Promise<unknown>;
  rest: (op: string, call?: DoorInput) => Promise<unknown>;
  graphql: (op: string, call?: DoorInput) => Promise<unknown>;
}

export interface DoorContractCase {
  /** What this case proves — becomes the test name. */
  name: string;
  /** Any declared operation, CRUD or custom. */
  operation: string;
  input?: DoorInput;
  /** The protocol envelopes are removed before this value is compared. */
  expected: unknown;
}

/** One entity, four facades, the same answers. */
export function checkDoors(app: App, entity: SchemaView, options: DoorOptions = {}): void {
  const name = lowerFirst(entity.name ?? '');
  const facades = facadesOf(app, entity, name, options.surface);
  const inputOf = () => sampleInput(entity, options.given ?? {}, options);

  describe(`${entity.name} — the facades agree`, () => {
    it('on create, over what the caller sent', async () => {
      const sent = inputOf();
      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((facade) => facades[facade]('create', { input: sent })),
      );

      const [local, ...others] = answers.map((answer) => written(answer, sent));
      for (const [index, other] of others.entries()) {
        expect(other, `${(['rpc', 'rest', 'graphql'] as const)[index]} ≠ local`).toEqual(local);
      }
    });

    it('on list', async () => {
      await facades.local('create', { input: inputOf() });

      const local = wire(rowsOf(await facades.local('list')));
      expect(Array.isArray(local) && local.length > 0, 'nothing to compare').toBe(true);

      expect(wire(rowsOf(await facades.rpc('list'))), 'rpc ≠ local').toEqual(local);
      expect(wire(rowsOf(await facades.rest('list'))), 'rest ≠ local').toEqual(local);
      expect(wire(rowsOf(await facades.graphql('list'))), 'graphql ≠ local').toEqual(local);
    });

    it('on findById', async () => {
      const row = await facades.local('create', { input: inputOf() }) as { id: string };

      const local = wire(await facades.local('findById', { id: row.id }));

      expect(wire(await facades.rpc('findById', { id: row.id })), 'rpc ≠ local').toEqual(local);
      expect(wire(await facades.rest('findById', { id: row.id })), 'rest ≠ local').toEqual(local);
      expect(wire(await facades.graphql('findById', { id: row.id })), 'graphql ≠ local').toEqual(local);
    });

    it('on update, over what the caller sent', async () => {
      const rows = await Promise.all([1, 2, 3, 4].map(() => facades.local('create', { input: inputOf() }))) as { id: string }[];
      const patch = inputOf();

      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const)
          .map((facade, index) => facades[facade]('update', { id: rows[index].id, input: patch })),
      );

      const [local, ...others] = answers.map((answer) => written(answer, patch));
      for (const [index, other] of others.entries()) {
        expect(other, `${(['rpc', 'rest', 'graphql'] as const)[index]} ≠ local`).toEqual(local);
      }
    });

    it('on delete', async () => {
      const rows = await Promise.all([1, 2, 3, 4].map(() => facades.local('create', { input: inputOf() }))) as { id: string }[];

      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((facade, index) => facades[facade]('delete', { id: rows[index].id })),
      );

      // REST answers a deletion with no content at all, which is the protocol saying yes.
      const onTheWire = answers.map((answer) => (answer === undefined || answer === null ? true : wire(answer)));
      expect(new Set(onTheWire).size, `the facades disagree: ${JSON.stringify(onTheWire)}`).toBe(1);
    });

    it('on a refusal', async () => {
      // A refusal is where the facades diverge most, and where each is most tempted to
      // answer in its own words. What must match is that it WAS refused.
      const bad = { ...inputOf(), __unknown__: 'x' };
      const refusals = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((facade) => refused(() => facades[facade]('create', { input: bad }))),
      );

      expect(refusals[0], 'local accepted a body outside the contract').toBe(true);
      expect(refusals, `the facades disagree: ${JSON.stringify(refusals)}`).toEqual([true, true, true, true]);
    });
  });
}

/** Run one hand-written invocation contract through every facade. */
export function checkDoorContract(
  app: App,
  entity: SchemaView,
  cases: readonly DoorContractCase[],
  options: Pick<DoorOptions, 'surface'> = {},
): void {
  const name = lowerFirst(entity.name ?? '');
  const facades = facadesOf(app, entity, name, options.surface);
  const names = ['local', 'rpc', 'rest', 'graphql'] as const;

  describe(`${entity.name} — its invocation contract crosses every facade`, () => {
    for (const one of cases) {
      it(one.name, async () => {
        const answers = await Promise.all(names.map((facade) => facades[facade](one.operation, one.input)));
        for (const [index, answer] of answers.entries()) {
          expect(wire(answer), `${names[index]} disagrees with the canonical invocation`).toEqual(wire(one.expected));
        }
      });
    }
  });
}

async function refused(call: () => Promise<unknown>): Promise<boolean> {
  try { await call(); return false; } catch { return true; }
}

/** The four facades, each reduced to `(op, input) => answer` so the tests above read alike. */
function facadesOf(app: App, entity: SchemaView, name: string, surface?: string): Facades {
  const run = createLocalRunner(app, surface);
  const state: Record<string, unknown> = {};

  const invocation = (call: DoorInput = {}) => ({
    ...Invocation.empty,
    ...(call.id !== undefined ? { params: { id: call.id } } : {}),
    ...(call.input !== undefined ? { input: call.input } : {}),
  });

  return {
    local: (op, call) => run({ entity: name, op }, invocation(call)),

    rpc: async (op, call) => {
      const answer = await serveRpc(app, {
        path: '',
        body: { jsonrpc: '2.0', id: 1, method: `${name}.${op}`, params: invocation(call) },
        state,
      }) as { result?: unknown; error?: { message: string } };
      if (answer.error) throw new Error(answer.error.message);
      return answer.result;
    },

    rest: async (op, call) => {
      // The route the REST facade itself would match, read from its own table — rebuilding
      // the path here would be a second opinion on where an entity lives.
      const route = tableOf(app).find((one) => one.entityName === name && one.operationName === op);
      if (!route) throw new Error(`[checkDoors] REST serves no ${name}.${op}`);
      const path = route.segments.map((segment) => (segment.startsWith(':') ? call?.id ?? '' : segment)).join('/');

      const answer = await serveRest(app, { method: route.method, path, query: {}, body: call?.input, state });
      if (answer.kind !== 'ok') throw new Error(`[checkDoors] REST answered ${answer.kind} on ${name}.${op}`);
      return answer.body;
    },

    graphql: async (op, call) => {
      const { executeOn, schemaOf } = await import('@fougere/adapter-graphql');
      const schema = schemaOf(app as never) as never;
      const built = op === 'list' ? listQuery(schema, entity)
        : op === 'findById' ? findQuery(schema, entity, call?.id ?? '')
        : mutationFor(schema, entity, op, { id: call?.id, input: call?.input });
      if (!built) throw new Error(`[checkDoors] GraphQL serves no ${entity.name} ${op}`);

      const answer = await executeOn(app as never, { query: built.query, state });
      if (answer.errors?.length) throw new Error(`[checkDoors] GraphQL: ${answer.errors[0].message}`);
      return at(answer.data, built.at);
    },
  };
}
