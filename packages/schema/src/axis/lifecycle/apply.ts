import { Lifecycle } from './Lifecycle.js';
import { resolveCustomGenerator } from './Generators.js';
import { type Field, type Fields } from '../../Field.js';
import { createId } from '@paralleldrive/cuid2';

type Row = Record<string, unknown>;

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
 * What "now" means, for the two functions that stamp it.
 *
 * The ONE place either of them reads the clock, which is what makes it substitutable at
 * all: `created()`, `updated()` and `create: 'now'` are realized here and nowhere else, so
 * a test that needs a stable instant sets this instead of intercepting `Date` globally —
 * where Rails had to build `travel_to` over the language.
 *
 * A value rather than a mock: nothing here is a channel, and a frozen clock is a fact
 * about the run, not an interception of a call.
 */
let clock: () => number = Date.now;

/** Freeze the instant these two functions stamp. Returns the gesture that restores it. */
export function freezeClock(at: number | Date): () => void {
  const previous = clock;
  const instant = at instanceof Date ? at.getTime() : at;
  clock = () => instant;
  return () => { clock = previous; };
}

export function applyCreate(fields: Fields, input: Row): Row {
  const out: Row = { ...input };
  const instant = clock();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (name in out) continue;
    const rule = Lifecycle.of(field);

    if (rule.create === 'now') out[name] = new Date(instant);
    else if (rule.literal) out[name] = freshValue(rule.literal.value);
    else if (rule.generator) out[name] = generatorFor(rule.generator)();
  }

  return out;
}

function freshValue(value: unknown): unknown {
  if (value === null || typeof value !== 'object') return value;
  return structuredClone(value);
}

export function applyUpdate(fields: Fields, patch: Row): Row {
  const out: Row = { ...patch };
  const instant = clock();

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    if (Lifecycle.of(field).stampedOnUpdate && !(name in out)) out[name] = new Date(instant);
  }

  return out;
}
