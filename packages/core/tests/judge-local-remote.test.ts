/**
 * The theorem: the local judge and the remote judge return the same verdict.
 *
 * The site says it, `useFormFor` depends on it, and until now nothing showed it.
 * The gradient's whole promise — a frond runs in-process or behind JSON-RPC with
 * identical user code — is worth exactly what this equality is worth: if a split
 * refuses less than a monolith, moving a frond silently widens what gets in.
 *
 * Method: one payload per branch of the decision table, sent twice — once to a
 * façade in this process, once to a façade reached through a transport. The two
 * verdicts are compared as VALUES, not eyeballed.
 */
import { describe, it, expect } from 'vitest';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { createApp, createLocalRunner, createAppRunner, FougereError } from '../src/index.js';
import type { Transport, EntityOrm, OrmFactory } from '../src/index.js';
import { EMPTY_INVOCATION } from '../src/invocation.js';
import Product from './fixtures-judge/fronds/shop/entities/Product.js';

const root = join(import.meta.dirname, 'fixtures-judge');

/**
 * A storage that accepts anything, so a refusal in this file can only come from
 * the judge — never from a driver. `create` echoes what it was handed, which is
 * what makes the accepted case observable on both sides.
 */
const ormFactory: OrmFactory = () => {
  const orm: EntityOrm = {
    list: async () => [],
    findById: async () => undefined,
    findBy: async () => undefined,
    findAllBy: async () => [],
    create: async (input: unknown) => ({ id: 'p-1', slug: 'lampe', ...(input as object) }),
    update: async (_id: unknown, input: unknown) => ({ id: 'p-1', ...(input as object) }),
    delete: async () => true,
    client: undefined,
    output: () => orm,
  } as EntityOrm;
  return orm;
};

/** Stands in for the wire: the other app's own runner, called in memory. */
async function shopOnAnotherProcess(): Promise<Transport> {
  // Plain `const` — this app must outlive the function that builds it.
  const host = await createApp({ root, createContainer, ormFactory });
  return createLocalRunner(host);
}

/** The verdict, reduced to what a caller can act on: refused or not, and why. */
type Verdict = { ok: boolean; errors: { path: string; message: string }[] };

function verdictOf(outcome: unknown, error: unknown): Verdict {
  if (!error) return { ok: true, errors: [] };
  // `details` IS the error array — `bootstrap.ts:314` passes `result.errors`
  // straight in. An earlier version of this helper looked for `details.errors`,
  // found nothing, and produced an empty list for BOTH façades; they agreed on
  // nothing at all and the test passed. The browser column is what exposed it,
  // which is the argument for having three judges rather than two.
  const err = error as FougereError;
  const raw = err.details ?? [];
  const errors = (Array.isArray(raw) ? raw : []) as { path: string; message: string }[];
  return {
    ok: false,
    errors: errors
      .map((e) => ({ path: e.path, message: e.message }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

/**
 * What a browser sees: the imported class, judged directly, with no façade and
 * no network. This is the call `useFormFor` makes.
 */
function browserVerdict(body: unknown): Verdict {
  const result = Product.validate(body) as
    | { success: true }
    | { success: false; errors: { path: string; message: string }[] };
  if (result.success) return { ok: true, errors: [] };
  return {
    ok: false,
    errors: result.errors
      .map((e) => ({ path: e.path, message: e.message }))
      .sort((a, b) => a.path.localeCompare(b.path)),
  };
}

async function judge(run: ReturnType<typeof createLocalRunner>, op: string, body: unknown): Promise<Verdict> {
  try {
    const out = await run({ entity: 'product', op }, { ...EMPTY_INVOCATION, body });
    return verdictOf(out, undefined);
  } catch (e) {
    return verdictOf(undefined, e);
  }
}

/** One payload per branch of the table in `schema/src/projections/validation.ts`. */
const CASES: { name: string; op: string; body: unknown }[] = [
  { name: 'shape — string below its minimum', op: 'create', body: { name: 'x', price: 10, status: 'draft' } },
  { name: 'shape — number above its maximum', op: 'create', body: { name: 'lampe', price: 5000, status: 'draft' } },
  { name: 'shape — value outside the bounded set', op: 'create', body: { name: 'lampe', price: 10, status: 'archived' } },
  { name: 'shape — wrong primitive type', op: 'create', body: { name: 'lampe', price: 'gratuit', status: 'draft' } },
  { name: 'boundary — a read-only field supplied inbound', op: 'create', body: { name: 'lampe', price: 10, status: 'draft', slug: 'forgé' } },
  { name: 'unknown key', op: 'create', body: { name: 'lampe', price: 10, status: 'draft', couleur: 'rouge' } },
  { name: 'required field missing', op: 'create', body: { price: 10, status: 'draft' } },
  { name: 'every refusal at once', op: 'create', body: { name: 'x', price: 5000, status: 'archived', slug: 'forgé', couleur: 'rouge' } },
  { name: 'a payload that is legal', op: 'create', body: { name: 'lampe', price: 10, status: 'draft' } },
];

describe('juge local = juge distant', () => {
  it('returns the same verdict on both sides, case by case', async () => {
    await using local = await createApp({ root, createContainer, ormFactory });
    const remoteTransport = await shopOnAnotherProcess();
    await using consumer = await createApp({
      root,
      createContainer,
      ormFactory,
      fronds: [],
      remotes: { shop: 'stub://shop' },
      remoteTransport: () => remoteTransport,
    });

    const runLocal = createLocalRunner(local);
    const runRemote = createAppRunner(consumer);

    const table: { case: string; local: Verdict; remote: Verdict; browser: Verdict }[] = [];
    for (const c of CASES) {
      table.push({
        case: c.name,
        local: await judge(runLocal, c.op, c.body),
        remote: await judge(runRemote as typeof runLocal, c.op, c.body),
        // The THIRD judge, and the one the docs actually promise: a browser has
        // no façade — `useFormFor` calls the imported class directly. If this
        // column disagreed, a form would accept what the server refuses.
        browser: browserVerdict(c.body),
      });
    }

    // Every row compared as a value. A single mismatch names the case.
    for (const row of table) {
      expect(row.remote, `remote ≠ local — case: ${row.case}`).toEqual(row.local);
      expect(row.browser, `browser ≠ local — case: ${row.case}`).toEqual(row.local);
    }

    // The theorem is empty if nothing was ever refused — guard against a run
    // where both sides accepted everything for an unrelated reason.
    expect(table.filter((r) => !r.local.ok).length).toBe(CASES.length - 1);
    expect(table.at(-1)!.local.ok).toBe(true);
  });
});
