import { Validator, type OutputUnit } from '@cfworker/json-schema';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { isObject } from '../lib/utils.js';
import type { ValidationError } from '../lib/ValidationError.js';
import { locationOf } from '../lib/ValidationResult.js';

/**
 * The one door onto the engine: a field's value against its shape, a declaration against the
 * format of its key. The format is DATA, not a TypeScript interface: an interface is erased
 * before a JS caller, a config or a card from another language could be measured against it.
 */
export class JsonSchemaValidator {
  private static readonly held = new WeakMap<JsonSchema, JsonSchemaValidator>();

  private first?: Validator;
  private every?: Validator;

  private constructor(private readonly schema: JsonSchema) {}

  static of(schema: JsonSchema): JsonSchemaValidator {
    let validator = this.held.get(schema);

    if (!validator) {
      validator = new JsonSchemaValidator(schema);
      this.held.set(schema, validator);
    }

    return validator;
  }

  /** `refusalOf({ update: 'maybe' }, ['lifecycle'])` → `lifecycle.update: Instance does not match any of ["now","forbidden"].` */
  refusalOf(value: unknown, path: readonly string[]): ValidationError | undefined {
    this.first ??= new Validator(this.schema, '2020-12', true);

    const refused = refusedBy(this.first, value);

    if (!Array.isArray(refused)) return under(path, refused);
    if (!refused.length) return undefined;

    const reasons = named(refused);

    return at(path, reasons.length ? deepestOf(reasons) : refused[0]);
  }

  /**
   * One refusal per key, so a declaration hears every fault at once. It reads through an engine
   * of its own: the other stops at the first, which is what a single value wants.
   */
  refusalsOf(value: unknown, path: readonly string[]): ValidationError[] {
    this.every ??= new Validator(this.schema, '2020-12', false);

    const refused = refusedBy(this.every, value);

    if (!Array.isArray(refused)) return [under(path, refused)];
    if (!refused.length) return [];

    const faults = [...byKey(named(refused)).values()];

    return faults.length ? faults.map((units) => at(path, deepestOf(units))) : [at(path, refused[0])];
  }
}

/** What it refused on, or the member JSON cannot hold — the engine throws on one rather than refusing. */
function refusedBy(engine: Validator, value: unknown): OutputUnit[] | ValidationError {
  const json = stated(value);

  try {
    const verdict = engine.validate(json);

    return verdict.valid ? [] : verdict.errors;
  } catch {
    const where = unreadableIn(json) ?? { path: [], value: json };

    return { path: where.path, message: `Expected a JSON value — got ${typeof where.value}` };
  }
}

/** `False boolean schema` names nothing: the unit above it carries the offending key. */
const named = (units: readonly OutputUnit[]): OutputUnit[] =>
  units.filter((unit) => unit.keyword !== 'false');

/** The engine states its refusals outermost first: the deepest says where, the last one is why. */
function deepestOf(units: readonly OutputUnit[]): OutputUnit {
  return units.reduce((held, unit) => (depthOf(held) > depthOf(unit) ? held : unit));
}

/**
 * The units of one fault, addressed by the key they happened under. A unit on the value ITSELF
 * points at a key when another one is deeper — `Property "lifecycle" does not match schema.` —
 * so it is kept only when it is all there is.
 */
function byKey(units: readonly OutputUnit[]): Map<string, OutputUnit[]> {
  const held = new Map<string, OutputUnit[]>();

  for (const unit of units) {
    const key = locationOf(unit.instanceLocation)[0] ?? '';
    held.set(key, [...(held.get(key) ?? []), unit]);
  }

  if (held.size > 1) held.delete('');

  return held;
}

const at = (path: readonly string[], unit: OutputUnit): ValidationError => ({
  path: [...path, ...locationOf(unit.instanceLocation)],
  message: unit.error,
});

const under = (path: readonly string[], refusal: ValidationError): ValidationError => ({
  path: [...path, ...refusal.path],
  message: refusal.message,
});

const depthOf = (unit: OutputUnit): number => locationOf(unit.instanceLocation).length;

/** A key set to `undefined` states nothing, as in JSON — and the engine refuses to read one. */
function stated(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stated);

  if (!isObject(value)) return value;

  const present = Object.entries(value).filter(([, member]) => member !== undefined);

  return Object.fromEntries(present.map(([key, member]) => [key, stated(member)]));
}

/** Where the engine stopped: a function, a symbol or a bigint is not a value JSON holds. */
function unreadableIn(
  value: unknown,
  path: readonly string[] = [],
): { path: readonly string[]; value: unknown } | undefined {
  if (['function', 'symbol', 'bigint'].includes(typeof value)) return { path, value };

  if (Array.isArray(value)) {
    return value.flatMap((member, index) => unreadableIn(member, [...path, String(index)]) ?? [])[0];
  }

  if (!isObject(value)) return undefined;

  return Object.entries(value).flatMap(([key, member]) => unreadableIn(member, [...path, key]) ?? [])[0];
}
