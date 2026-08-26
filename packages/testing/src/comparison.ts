import { describe, it, expect } from 'vitest';
import { createLocalRunner, type App } from '@fougere/core';
import { EMPTY_INVOCATION } from '@fougere/core/contract';
import { serveRest, serveRpc, tableOf } from '@fougere/app';
import { lowerFirst, type SchemaView } from '@fougere/schema';
import { listQuery, findQuery, mutationFor, at } from './gql.js';
import { sampleInput, type SampleOptions } from './sample.js';

/**
 * The rows a door hands back, with its own envelope taken off.
 *
 * Each door wraps differently by construction — REST answers a page, GraphQL nests under
 * its field, RPC returns the value — and comparing the wrappers would compare the
 * protocols. What must agree is what is inside.
 */
function rowsOf(value: unknown): unknown {
  if (Array.isArray(value)) return [...value];
  const page = value as { items?: unknown } | null;
  return page && typeof page === 'object' && 'items' in page ? page.items : value;
}

/** Through the wire and back, so a `Date` and its ISO string are not read as a divergence. */
const wire = (value: unknown): unknown => JSON.parse(JSON.stringify(value ?? null));

/**
 * What is the SAME row seen twice, and what is merely a second row.
 *
 * A write creates a different row at each door — different id, different `createdAt` —
 * so comparing values would compare clocks. The generated fields are dropped and what the
 * caller sent is what remains, which is the part the doors must agree on.
 */
function written(value: unknown, sent: Record<string, unknown>): unknown {
  const row = value as Record<string, unknown> | null;
  if (!row || typeof row !== 'object') return wire(row);
  return wire(Object.fromEntries(Object.keys(sent).map((key) => [key, row[key]])));
}

export interface DoorOptions extends SampleOptions {
  given?: Record<string, unknown>;
  /** The audience, when the app serves named surfaces. */
  surface?: string;
}

interface Doors {
  local: (op: string, input?: DoorInput) => Promise<unknown>;
  rpc: (op: string, input?: DoorInput) => Promise<unknown>;
  rest: (op: string, input?: DoorInput) => Promise<unknown>;
  graphql: (op: string, input?: DoorInput) => Promise<unknown>;
}

export interface DoorInput { id?: string; body?: Record<string, unknown> }

export interface DoorContractCase {
  /** What this case proves — becomes the test name. */
  name: string;
  /** Any declared operation, CRUD or custom. */
  operation: string;
  input?: DoorInput;
  /** The protocol envelopes are removed before this value is compared. */
  expected: unknown;
}

/**
 * One entity, four doors, the same answers.
 *
 * The claim runs through the whole repo — a frond runs in-process or behind JSON-RPC with
 * identical user code, and REST, GraphQL and RPC are three projections of one contract —
 * and nothing compared REST to GraphQL until now. `transport-swap.test.ts` compares three
 * TRANSPORTS, which is a different sentence.
 *
 * The five CRUD operations, reads and writes. A CUSTOM op is not compared: REST addresses
 * it by a path the table states, GraphQL by a mutation whose input type is its own, and
 * matching the two means guessing which is which — a guess this file exists to avoid.
 */
export function checkDoors(app: App, entity: SchemaView, options: DoorOptions = {}): void {
  const name = lowerFirst(entity.name ?? '');
  const doors = doorsOf(app, entity, name, options.surface);
  const bodyOf = () => sampleInput(entity, options.given ?? {}, options);

  describe(`${entity.name} — the doors agree`, () => {
    it('on create, over what the caller sent', async () => {
      const sent = bodyOf();
      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((door) => doors[door]('create', { body: sent })),
      );

      const [local, ...others] = answers.map((answer) => written(answer, sent));
      for (const [index, other] of others.entries()) {
        expect(other, `${(['rpc', 'rest', 'graphql'] as const)[index]} ≠ local`).toEqual(local);
      }
    });

    it('on list', async () => {
      await doors.local('create', { body: bodyOf() });

      const local = wire(rowsOf(await doors.local('list')));
      expect(Array.isArray(local) && local.length > 0, 'nothing to compare').toBe(true);

      expect(wire(rowsOf(await doors.rpc('list'))), 'rpc ≠ local').toEqual(local);
      expect(wire(rowsOf(await doors.rest('list'))), 'rest ≠ local').toEqual(local);
      expect(wire(rowsOf(await doors.graphql('list'))), 'graphql ≠ local').toEqual(local);
    });

    it('on findById', async () => {
      const row = await doors.local('create', { body: bodyOf() }) as { id: string };

      const local = wire(await doors.local('findById', { id: row.id }));

      expect(wire(await doors.rpc('findById', { id: row.id })), 'rpc ≠ local').toEqual(local);
      expect(wire(await doors.rest('findById', { id: row.id })), 'rest ≠ local').toEqual(local);
      expect(wire(await doors.graphql('findById', { id: row.id })), 'graphql ≠ local').toEqual(local);
    });

    it('on update, over what the caller sent', async () => {
      const rows = await Promise.all([1, 2, 3, 4].map(() => doors.local('create', { body: bodyOf() }))) as { id: string }[];
      const patch = bodyOf();

      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const)
          .map((door, index) => doors[door]('update', { id: rows[index].id, body: patch })),
      );

      const [local, ...others] = answers.map((answer) => written(answer, patch));
      for (const [index, other] of others.entries()) {
        expect(other, `${(['rpc', 'rest', 'graphql'] as const)[index]} ≠ local`).toEqual(local);
      }
    });

    it('on delete', async () => {
      const rows = await Promise.all([1, 2, 3, 4].map(() => doors.local('create', { body: bodyOf() }))) as { id: string }[];

      const answers = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((door, index) => doors[door]('delete', { id: rows[index].id })),
      );

      // REST answers a deletion with no content at all, which is the protocol saying yes.
      const said = answers.map((answer) => (answer === undefined || answer === null ? true : wire(answer)));
      expect(new Set(said).size, `the doors disagree: ${JSON.stringify(said)}`).toBe(1);
    });

    it('on a refusal', async () => {
      // A refusal is where the doors diverge most, and where each is most tempted to
      // answer in its own words. What must match is that it WAS refused.
      const bad = { ...bodyOf(), __unknown__: 'x' };
      const refusals = await Promise.all(
        (['local', 'rpc', 'rest', 'graphql'] as const).map((door) => refused(() => doors[door]('create', { body: bad }))),
      );

      expect(refusals[0], 'local accepted a body outside the contract').toBe(true);
      expect(refusals, `the doors disagree: ${JSON.stringify(refusals)}`).toEqual([true, true, true, true]);
    });
  });
}

/**
 * Run one hand-written invocation contract through every door.
 *
 * `checkDoors` derives the generic CRUD gradient. This is its small explicit companion
 * for semantics only the handler can observe — notably omitted versus null input. A new
 * adapter joins the same harness instead of inventing its own interpretation.
 */
export function checkDoorContract(
  app: App,
  entity: SchemaView,
  cases: readonly DoorContractCase[],
  options: Pick<DoorOptions, 'surface'> = {},
): void {
  const name = lowerFirst(entity.name ?? '');
  const doors = doorsOf(app, entity, name, options.surface);
  const names = ['local', 'rpc', 'rest', 'graphql'] as const;

  describe(`${entity.name} — its invocation contract crosses every door`, () => {
    for (const one of cases) {
      it(one.name, async () => {
        const answers = await Promise.all(names.map((door) => doors[door](one.operation, one.input)));
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

/** The four doors, each reduced to `(op, input) => answer` so the tests above read alike. */
function doorsOf(app: App, entity: SchemaView, name: string, surface?: string): Doors {
  const run = createLocalRunner(app, surface);
  const state: Record<string, unknown> = {};

  const invocation = (input: DoorInput = {}) => ({
    ...EMPTY_INVOCATION,
    ...(input.id !== undefined ? { params: { id: input.id } } : {}),
    ...(input.body !== undefined ? { body: input.body } : {}),
  });

  return {
    local: (op, input) => run({ entity: name, op }, invocation(input)),

    rpc: async (op, input) => {
      const answer = await serveRpc(app, {
        path: '',
        body: { jsonrpc: '2.0', id: 1, method: `${name}.${op}`, params: invocation(input) },
        state,
      }) as { result?: unknown; error?: { message: string } };
      if (answer.error) throw new Error(answer.error.message);
      return answer.result;
    },

    rest: async (op, input) => {
      // The route the REST door itself would match, read from its own table — rebuilding
      // the path here would be a second opinion on where an entity lives.
      const route = tableOf(app).find((one) => one.entityName === name && one.operationName === op);
      if (!route) throw new Error(`[checkDoors] REST serves no ${name}.${op}`);
      const path = route.segments.map((segment) => (segment.startsWith(':') ? input?.id ?? '' : segment)).join('/');

      const answer = await serveRest(app, { method: route.method, path, query: {}, body: input?.body, state });
      if (answer.kind !== 'ok') throw new Error(`[checkDoors] REST answered ${answer.kind} on ${name}.${op}`);
      return answer.body;
    },

    graphql: async (op, input) => {
      const { executeOn, schemaOf } = await import('@fougere/adapter-graphql');
      const schema = schemaOf(app as never) as never;
      const built = op === 'list' ? listQuery(schema, entity)
        : op === 'findById' ? findQuery(schema, entity, input?.id ?? '')
        : mutationFor(schema, entity, op, { id: input?.id, body: input?.body });
      if (!built) throw new Error(`[checkDoors] GraphQL serves no ${entity.name} ${op}`);

      const answer = await executeOn(app as never, { query: built.query, state });
      if (answer.errors?.length) throw new Error(`[checkDoors] GraphQL: ${answer.errors[0].message}`);
      return at(answer.data, built.at);
    },
  };
}
