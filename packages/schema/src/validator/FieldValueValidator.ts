import { Validator, format as engineFormats } from '@cfworker/json-schema';
import { Boundary } from '../axis/boundary/Boundary.js';
import { type FormatPredicate } from '../axis/shape/FormatPredicate.js';
import { Formats } from '../axis/shape/Formats.js';
import { type Shape } from '../axis/shape/Shape.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import type { Verdict } from '../lib/Verdict.js';
import type { OutputUnit } from '@cfworker/json-schema';
import { SchemaError } from '../SchemaError.js';

interface ShapePlan {
  validator: Validator;
  custom?: FormatPredicate;
  formatName?: string;
}

export class FieldValueValidator {
  private static readonly plans = new WeakMap<object, ShapePlan>();

  private constructor(private readonly field: Field) {}

  /** The shape is compiled once and reused, not rebuilt per value. */
  static of(field: Field): FieldValueValidator {
    return new FieldValueValidator(field);
  }

  validate(value: unknown): Verdict {
    const shape = this.field.shape;
    const type = Shapes.typeOf(shape);
    const base = Shapes.of(shape).base;
    if (value !== null) {
      if (base?.type === 'object' && !base.properties) return { value };
      if (type === 'date' && value instanceof Date) {
        return Number.isNaN(value.getTime()) ? { message: 'Invalid date' } : { value };
      }
      if ((type === 'number' || type === 'integer') && typeof value === 'number' && Number.isNaN(value)) {
        return { message: 'Expected a number' };
      }
    }
    const plan = FieldValueValidator.planFor(shape);
    const result = plan.validator.validate(value);
    if (!result.valid) return refusalOf(result.errors);
    if (plan.custom && typeof value === 'string' && !plan.custom(value)) {
      return { message: `String does not match format "${plan.formatName}".` };
    }
    return { value };
  }

  /**
   * The value admitted, then handed back in the form the domain writes — an ISO string
   * arrives as a `Date`. `null` passes untouched, and a refusal stops before the codec.
   */
  parse(value: unknown): Verdict {
    const verdict = this.validate(value);
    if ('message' in verdict) return verdict;
    if (verdict.value === null) return { value: null };

    return Boundary.of(this.field).decode(verdict.value);
  }

  private static planFor(shape: Shape): ShapePlan {
    let plan = this.plans.get(shape);
    if (!plan) {
      const base = Shapes.of(shape).base;
      const formatName = base?.type === 'string' ? base.format : undefined;
      plan = {
        validator: new Validator(shape as object, '2020-12', true),
        custom: formatName === undefined ? undefined : this.customFormatOf(formatName),
        formatName,
      };
      this.plans.set(shape, plan);
    }
    return plan;
  }

  private static customFormatOf(name: string): FormatPredicate | undefined {
    const custom = Formats.find(name);
    if (!custom && !(name in engineFormats)) {
      throw new SchemaError(
        `Unknown format: '${name}'. Register it with Formats.register('${name}', …) — ` +
          `the engine validates ${Object.keys(engineFormats).length} formats natively and this is not one of them.`,
      );
    }
    return custom;
  }
}

/**
 * The engine states its refusals outermost first, so `errors[0]` on a nested shape is the
 * parent's `Property "street" does not match schema.` — true, and never the reason. The
 * DEEPEST one is the reason, and it is the one that says where.
 */
function refusalOf(errors: readonly OutputUnit[]): Verdict {
  const deepest = errors.reduce<OutputUnit | undefined>(
    (held, one) => (held && depthOf(held) >= depthOf(one) ? held : one),
    undefined,
  );
  if (!deepest) return { message: 'Invalid value' };
  const path = locationOf(deepest.instanceLocation);

  return path.length > 0 ? { message: deepest.error, path } : { message: deepest.error };
}

const depthOf = (unit: OutputUnit): number => locationOf(unit.instanceLocation).length;

/** `#/city/zip` — a JSON Pointer fragment, and `~1`/`~0` are how it spells `/` and `~`. */
const locationOf = (instanceLocation: string): string[] =>
  instanceLocation
    .replace(/^#/, '')
    .split('/')
    .filter(Boolean)
    .map((segment) => segment.replace(/~1/g, '/').replace(/~0/g, '~'));
