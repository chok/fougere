/**
 * Query or mutation is decided by what the method DOES, not by what it is called.
 *
 * `isReadOp` matches seven prefixes — list, find, get, search, count, exists, stats.
 * An app that names its reads in domain terms meets none of them: measured on an
 * eight-frond app, thirteen of twenty operation names were reads and every one was
 * announced as a GraphQL mutation and a REST POST. Naming is a naming choice; writing
 * is a fact, and the body carries it.
 *
 * `readOnly: true` is PROOF, never a guess: every call the method makes on `this` names
 * a read gesture. Anything this cannot classify — a façade, an emission, a service —
 * leaves the question open, and an open question answers `mutation`, because announcing
 * a write as a query lets it be cached and sent over GET.
 */
import { describe, it, expect } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { parseAllHandlerMethods } from '../src/handler-parser.js';
import { resolveIsReadOp } from '../src/operation.js';

async function parse(body: string): Promise<Map<string, boolean | undefined>> {
  const dir = mkdtempSync(join(tmpdir(), 'fougere-readonly-'));
  const file = join(dir, 'ThingHandler.ts');
  mkdirSync(dir, { recursive: true });
  writeFileSync(file, `export default class ThingHandler {\n${body}\n}\n`);
  try {
    const { methods } = await parseAllHandlerMethods(file);
    return new Map(methods.map((m) => [m.name, m.readOnly]));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe('a body that only reads', () => {
  it('is proven read-only, whatever the method is called', async () => {
    const seen = await parse(`
      async ofBook(bookId: string) {
        const all = await this.orm.list();
        return all.filter((c) => c.bookId === bookId).sort((a, b) => a.rank - b.rank);
      }
      async roots() { return (await this.orm.list()).filter((c) => c.depth === 0); }
    `);
    expect(seen.get('ofBook')).toBe(true);
    expect(seen.get('roots')).toBe(true);
  });

  it('is not confused by calls on an array or a promise — those are not the port', async () => {
    const seen = await parse(`
      async shared(bookId: string) {
        const rows = await this.orm.findAllByKeys('bookId', [bookId]);
        return [...(rows.get(bookId) ?? [])].map((n) => n.body).join(', ').trim();
      }
    `);
    expect(seen.get('shared')).toBe(true);
  });
});

describe('a body this cannot see through', () => {
  it('answers mutation when a write gesture is there', async () => {
    const seen = await parse(`
      async getEverything(id: string) {
        const row = await this.orm.findById(id);
        return this.orm.update(id, { seen: true });
      }
    `);
    // Named `get…`, so the convention said query. The body says otherwise and wins.
    expect(seen.get('getEverything')).toBe(false);
    expect(resolveIsReadOp('getEverything', undefined, false)).toBe(false);
  });

  it('answers mutation on an emission — a write on someone else’s storage', async () => {
    const seen = await parse(`
      async findLatest(id: string) {
        const row = await this.orm.findById(id);
        await this.published({ id });
        return row;
      }
    `);
    expect(seen.get('findLatest')).toBe(false);
  });

  it('answers mutation on a façade call, because it cannot follow one', async () => {
    const seen = await parse(`
      async listReadable(userId: string) {
        const allowed = await this.access.mayRead({ userId });
        return allowed ? this.orm.list() : [];
      }
    `);
    expect(seen.get('listReadable')).toBe(false);
  });
});

describe('the three producers of a kind', () => {
  it('lets the author state it over the body AND the name', () => {
    // The escape hatch for exactly the case above: a read reached through a façade.
    expect(resolveIsReadOp('listReadable', { listReadable: { kind: 'query' } }, false)).toBe(true);
    expect(resolveIsReadOp('getThing', { getThing: { kind: 'command' } }, true)).toBe(false);
  });

  it('falls back to the name only when there is no body to read', () => {
    expect(resolveIsReadOp('ofBook', undefined, undefined)).toBe(false);
    expect(resolveIsReadOp('findThing', undefined, undefined)).toBe(true);
  });
});
