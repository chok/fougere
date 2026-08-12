/**
 * The lifecycle axis, realized — once, for every storage.
 *
 * `validation.ts` states the split: the judge answers "is this value legal?" and never
 * fills a hole; filling it — stamp `'now'`, apply `{ value }`, call `{ generate }` — is
 * the storage's role at the point of persistence. The split is right. What was missing
 * is that the framework shipped the RULE and never its realization, so each storage
 * rewrote it and they drifted:
 *
 * - `schema-sql` realized `{ generate }` and `'now'` in its ORM, and `{ value }` in its
 *   DDL — as a column `DEFAULT` the database fills. A mechanism only SQL has.
 * - The Nuxt module's fallback ORM realized none of the three: its signature is
 *   `(_entity, _name)`, both ignored, so it forces the name `id` and a random uuid.
 * - A third-party adapter (MongoDB, written outside the repo on 2026-08-08) found the
 *   gap the only way available: a test that expected `'draft'` and got `undefined`.
 *
 * Measured, one entity, `oneOf('draft','published',{ default:'draft' })`: SQLite answered
 * `'draft'`, MongoDB answered `undefined`. Same declaration, same port, two answers.
 *
 * So the rule and its realization live together now, and a storage adapter calls this
 * instead of re-deriving it. `update: 'forbidden'` is NOT here: refusing a value is a
 * judgment, and the façade already does it (`validation.ts`, patch mode).
 */
import { resolveCustomGenerator, type AnyField, type Fields } from '../field/index.js';
import { createId } from '@paralleldrive/cuid2';

type Row = Record<string, unknown>;

/**
 * Resolve a generator TOKEN to a function: a custom name registered via
 * `registerGenerator` wins, then the built-ins. An unknown name throws — loud and
 * local, instead of a silent divergence between two storages.
 *
 * The built-ins used to live storage-side, which put the inversion in plain sight: a
 * generator YOU invent travelled to every adapter, and the three the framework ships
 * did not.
 */
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

  for (const [name, field] of Object.entries(fields) as [string, AnyField][]) {
    if (name in out) continue;
    const create = field.lifecycle?.create;
    if (create === 'now') {
      // One instant, one Date PER FIELD. `created()` and `updated()` on the same entity
      // would otherwise hold the same object, so mutating `updatedAt` would move an
      // immutable `createdAt` with it — invisible where a storage serializes on write
      // (SQL), lasting where it does not (an in-memory store keeps the row as handed).
      out[name] = new Date(instant);
    } else if (typeof create === 'object' && create !== null) {
      if ('value' in create) out[name] = freshValue((create as { value: unknown }).value);
      else if ('generate' in create) out[name] = generatorFor(String((create as { generate: unknown }).generate))();
    }
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
 * hatch — `createField({ lifecycle: { create: { value: {…} } } })`. Cheap insurance
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

  for (const [name, field] of Object.entries(fields) as [string, AnyField][]) {
    if (field.lifecycle?.update === 'now' && !(name in out)) out[name] = new Date(instant);
  }

  return out;
}
