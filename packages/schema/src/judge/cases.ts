import { Anatomy } from '../axis/shape/Shape.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Field, Fields } from '../Field.js';
import type { SchemaView } from '../SchemaView.js';
import { Judge } from './Judge.js';

/**
 * One input, and what the judge must answer.
 *
 * `expect` carries the PATH of the field at fault and never the message. We know which
 * field must be refused because we are the ones who broke it; naming the message would
 * make this list a second judge, and the two would then have to be kept in step by hand —
 * which is the duplication the whole thing exists to remove.
 */
export interface Case {
  /** What this input does, in one clause — carried into the assertion so a failure reads. */
  why: string;
  body: unknown;
  /**
   * Judged as an update rather than a creation. The two modes refuse different things:
   * an absence is `Required` on create and legal on patch, an immutable field is legal
   * on create and refused on patch.
   */
  patch: boolean;
  expect: 'accept' | { reject: string };
}

/** A value of the wrong type for the declared shape — the one violation every field has. */
function wrongTypeFor(field: Field): unknown {
  const declared = (field.shape as { type?: string | readonly string[] }).type;
  const names = Array.isArray(declared) ? declared : [declared];
  return names.includes('string') ? 42 : 'not-a-value-of-this-shape';
}

/** Values that break a stated bound. Empty when the field states none. */
function outOfBoundsFor(field: Field): { why: string; value: unknown }[] {
  // Through `Anatomy`, not a cast: the cast admitted any keyword, and it declared
  // `maxItems` — which no branch below ever produced. In the one function whose job is
  // to be exhaustive, a bound the type does not carry is a case nobody notices missing.
  const shape = Anatomy.of(field.shape).base;
  const out: { why: string; value: unknown }[] = [];
  if (shape?.type === 'string') {
    if (typeof shape.minLength === 'number' && shape.minLength > 0)
      out.push({ why: 'shorter than min', value: 'x'.repeat(shape.minLength - 1) });
    if (typeof shape.maxLength === 'number')
      out.push({ why: 'longer than max', value: 'x'.repeat(shape.maxLength + 1) });
    if (shape.enum) out.push({ why: 'outside the stated set', value: '__not-in-enum__' });
  }
  if (shape?.type === 'number' || shape?.type === 'integer') {
    if (typeof shape.minimum === 'number') out.push({ why: 'below minimum', value: shape.minimum - 1 });
    if (typeof shape.maximum === 'number') out.push({ why: 'above maximum', value: shape.maximum + 1 });
  }
  if (shape?.type === 'array') {
    if (typeof shape.minItems === 'number' && shape.minItems > 0)
      out.push({ why: 'fewer items than min', value: [] });
    if (typeof shape.maxItems === 'number')
      out.push({ why: 'more items than max', value: Array.from({ length: shape.maxItems + 1 }, () => null) });
  }
  return out;
}

/**
 * The decision table, enumerated on the entity's own fields.
 *
 * Enumerated on the ENTITY and not on an operation's view, deliberately: built on the
 * view, the table cannot see a divergence about a field the view dropped — the blind spot
 * `same-verdict.test.ts` records having had.
 *
 * `valid` is handed IN rather than built here, and that is the line between this file and
 * `@fougere/testing`: deriving the cases needs the four axes and nothing else, while
 * inventing a value needs a generator. Merging them would have put a 426 KB faker in the
 * package a browser loads.
 */
export function casesFor(entity: SchemaView, valid: Record<string, unknown>): Case[] {
  const fields = entity.getFields();
  const cases: Case[] = [];
  const withField = (name: string, value: unknown) => ({ ...valid, [name]: value });

  cases.push({ why: 'a valid body', body: valid, patch: false, expect: 'accept' });
  cases.push({ why: 'a key outside the contract', body: { ...valid, __unknown__: 'x' }, patch: false, expect: { reject: '__unknown__' } });
  cases.push({ why: 'not an object at all', body: 'a string', patch: false, expect: { reject: '.' } });

  for (const [name, field] of Object.entries(fields) as [string, Field][]) {
    // A reference names a row that must exist; the caller supplied its id and we do not
    // get to invent a second one, so the only case we can state about it is the bound one.
    const isRef = Role.of(field).isReference;

    if (Judge.onAbsent(field) === null && name in valid) {
      const body = { ...valid };
      delete body[name];
      cases.push({ why: `${name} absent`, body, patch: false, expect: { reject: name } });
    }

    if (Boundary.of(field).readOnly) {
      cases.push({ why: `${name} supplied although read-only`, body: withField(name, wrongTypeFor(field)), patch: false, expect: { reject: name } });
    }

    if (Lifecycle.of(field).immutable && !Role.of(field).isPrimary) {
      cases.push({ why: `${name} supplied on an update`, body: { [name]: valid[name] ?? wrongTypeFor(field) }, patch: true, expect: { reject: name } });
    }

    if (name in valid && !isRef) {
      cases.push({ why: `${name} of the wrong type`, body: withField(name, wrongTypeFor(field)), patch: false, expect: { reject: name } });
      for (const { why, value } of outOfBoundsFor(field))
        cases.push({ why: `${name} ${why}`, body: withField(name, value), patch: false, expect: { reject: name } });
    }
  }

  return cases;
}

/**
 * The verdict a case expects, obtained from any judge.
 *
 * Takes the RESULT rather than the input so the same reader serves the local judge, the
 * façade and a door — the three that have to agree.
 */
export function holds(expected: Case['expect'], result: { success: boolean; errors?: { path: string }[] }): boolean {
  if (expected === 'accept') return result.success;
  if (result.success) return false;
  return (result.errors ?? []).some((error) => error.path === expected.reject);
}

/**
 * Every way `Judge.row` can refuse, read from its own source.
 *
 * The names rather than a count: a branch added there without a case above leaves the
 * table silently incomplete, and a test comparing a number says "7 became 8" where this
 * says which one appeared. Fragile to minification and loud when it breaks — the right
 * way round for a guard.
 *
 * One of them is not derivable and never will be: `decoded.error` is a NAMED boundary
 * codec refusing a value, and what breaks a user's decoder is the user's code. Same line
 * as a service's return type — what Fougere's vocabulary declares can be derived, what
 * is arbitrary code cannot.
 */
export function refusalBranches(): string[] {
  const source = Judge.row.toString();
  return [...source.matchAll(/message:\s*([^,}]+)/g)].map((match) => match[1].trim().replace(/^['"]|['"]$/g, ''));
}

/** The `Fields` of an entity, for a reader that has the entity and not its shape. */
export function fieldsOf(entity: SchemaView): Fields {
  return entity.getFields();
}
