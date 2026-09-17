import { format as engineFormats } from '@cfworker/json-schema';
import { Boundary } from '../axis/boundary/Boundary.js';
import { type FormatPredicate } from '../axis/shape/FormatPredicate.js';
import { Formats } from '../axis/shape/Formats.js';
import { type Shape } from '../axis/shape/Shape.js';
import { Shapes } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import type { Verdict } from '../lib/Verdict.js';
import { SchemaError } from '../SchemaError.js';
import type { JsonSchema } from '../lib/JsonSchema.js';
import { JsonSchemaValidator } from './JsonSchemaValidator.js';

interface ShapePlan {
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
    const refusal = JsonSchemaValidator.of(shape as JsonSchema).refusalOf(value, []);
    if (refusal) {
      return refusal.path.length > 0 ? { message: refusal.message, path: refusal.path } : { message: refusal.message };
    }
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
