/**
 * The lifecycle axis, realized — once, for every storage.
 *
 * The judge answers "is this value legal" and never fills a hole; filling it — stamp
 * `'now'`, apply `{ value }`, call `{ generate }` — belongs to the storage at the point of
 * persistence. Shipping the rule without its realization made each storage rewrite it, and
 * they drifted: one entity with a `default` answered `'draft'` on SQL and `undefined` on
 * Mongo. `update: 'forbidden'` is NOT here — refusing is a judgment.
 */
import { Lifecycle } from './Lifecycle.js';
import { resolveCustomGenerator } from './Generators.js';
import { type Field, type Fields } from '../../Field.js';
import { createId } from '@paralleldrive/cuid2';

type Row = Record<string, unknown>;

/** Resolve a generator TOKEN to a function — a registered name wins over a built-in. */
function generatorFor(ref: string): () => string {
  const custom = resolveCustomGenerator(ref);
  if (custom) return custom;
  switch (ref) {
    case 'cuid2': return createId;
    case 'uuid': return () => globalThis.crypto.randomUUID();
    case 'nanoid': {
      return () => {
        const bytes = new Uint8Array(21);
        globalThis.crypto.getRandomValues(bytes);
        const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';
        return Array.from(bytes, (b) => alphabet[b & 63]).join('');
      };
    }
    default:
      throw new Error(`Unknown generator '${ref}' — register it with registerGenerator('${ref}', fn)`);
  }
}

/**
 * Fill what the entity says the system writes at creation.
 *
 * A value the caller supplied is never touched, including `null` — presence is the
 * test, not truthiness, so `archivedAt: null` stays null rather than being re-filled.
 *
 * `'now'` produces a `Date`, the value the field declares. The storage converts it if
 * its driver needs something else (`schema-sql/src/values.ts` does exactly that) —
 * which is the same direction every other value travels.
 */
export function applyCreate(fields: Fields, input: Row): Row {
  const out: Row = { ...input };
  const instant = Date.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in out) continue;
    const rule = Lifecycle.of(field);

    // One instant, one Date PER FIELD. `created()` and `updated()` on the same entity
    // would otherwise hold the same object, so mutating `updatedAt` would move an
    // immutable `createdAt` with it — invisible where a storage serializes on write
    // (SQL), lasting where it does not (an in-memory store keeps the row as handed).
    if (rule.create === 'now') out[name] = new Date(instant);
    else if (rule.literal) out[name] = freshValue(rule.literal.value);
    else if (rule.generator) out[name] = generatorFor(rule.generator)();
    // `'optional'` and an absent rule both mean: the system writes nothing here.
  }

  return out;
}

/**
 * A declared default is written into every row, so handing out the declaration itself
 * would alias every row to it — mutate one, mutate the field and all its siblings.
 *
 * Every default the vocabulary can express is a primitive (`text`, `number`, `bool`,
 * `oneOf`; `list` and `json` take none), so this only pays for itself under the escape
 * hatch — `new Field({ shape, lifecycle: { create: { value: {…} } } })`. Cheap insurance
 * against the one failure mode nobody would ever debug from the symptom.
 */
function freshValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return structuredClone(value);
}

/**
 * Fill what the entity says the system writes at every update — `updated()`, and
 * nothing else. A supplied value wins, same rule as create.
 */
export function applyUpdate(fields: Fields, patch: Row): Row {
  const out: Row = { ...patch };
  const instant = Date.now();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (Lifecycle.of(field).stampedOnUpdate && !(name in out)) out[name] = new Date(instant);
  }

  return out;
}
