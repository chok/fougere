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
  private static readonly compiled = new WeakMap<JsonSchema, JsonSchemaValidator>();

  private constructor(private readonly engine: Validator) {}

  static of(schema: JsonSchema): JsonSchemaValidator {
    let validator = this.compiled.get(schema);

    if (!validator) {
      validator = new JsonSchemaValidator(new Validator(schema, '2020-12', true));
      this.compiled.set(schema, validator);
    }

    return validator;
  }

  /** `refusalOf({ update: 'maybe' }, ['lifecycle'])` → `lifecycle.update: Instance does not match any of ["now","forbidden"].` */
  refusalOf(value: unknown, path: readonly string[]): ValidationError | undefined {
    try {
      const verdict = this.engine.validate(stated(value));
      if (verdict.valid) return undefined;

      const reason = deepestOf(verdict.errors);

      return reason
        ? { path: [...path, ...locationOf(reason.instanceLocation)], message: reason.error }
        : { path, message: 'Invalid value' };
    } catch (error) {
      return { path, message: (error as Error).message };
    }
  }
}

/**
 * The engine states its refusals outermost first: the deepest says where, and the last one
 * there is the most specific. `False boolean schema` names nothing — the unit above it
 * carries the offending key.
 */
function deepestOf(units: readonly OutputUnit[]): OutputUnit | undefined {
  return units
    .filter((unit) => unit.keyword !== 'false')
    .reduce<OutputUnit | undefined>(
      (held, unit) => (held && depthOf(held) > depthOf(unit) ? held : unit),
      undefined,
    );
}

const depthOf = (unit: OutputUnit): number => locationOf(unit.instanceLocation).length;

/** A key set to `undefined` states nothing, as in JSON — and the engine refuses to read one. */
function stated(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stated);

  if (!isObject(value) || ![Object.prototype, null].includes(Object.getPrototypeOf(value))) {
    return value;
  }

  const present = Object.entries(value).filter(([, member]) => member !== undefined);

  return Object.fromEntries(present.map(([key, member]) => [key, stated(member)]));
}
