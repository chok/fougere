import { Validator, type OutputUnit } from '@cfworker/json-schema';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { isObject } from '../lib/utils.js';
import type { ValidationError } from '../lib/ValidationError.js';
import { locationOf } from '../lib/ValidationResult.js';

/** The one door onto the JSON Schema engine. */
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

  /** Every refusal, one per key. */
  refusalsOf(value: unknown, path: readonly string[]): ValidationError[] {
    this.every ??= new Validator(this.schema, '2020-12', false);

    const refused = refusedBy(this.every, value);

    if (!Array.isArray(refused)) return [under(path, refused)];
    if (!refused.length) return [];

    const faults = [...byKey(named(refused)).values()];

    return faults.length ? faults.map((units) => at(path, deepestOf(units))) : [at(path, refused[0])];
  }
}

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

const named = (units: readonly OutputUnit[]): OutputUnit[] =>
  units.filter((unit) => unit.keyword !== 'false');

function deepestOf(units: readonly OutputUnit[]): OutputUnit {
  return units.reduce((held, unit) => (depthOf(held) > depthOf(unit) ? held : unit));
}

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

function stated(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stated);

  if (!isObject(value)) return value;

  const present = Object.entries(value).filter(([, member]) => member !== undefined);

  return Object.fromEntries(present.map(([key, member]) => [key, stated(member)]));
}

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
