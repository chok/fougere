import { Validator, format as engineFormats } from '@cfworker/json-schema';
import { Formats, type FormatPredicate } from '../axis/shape/Formats.js';
import { Shapes, type Shape } from '../axis/shape/Shape.js';
import type { Field } from '../field/Field.js';
import type { Checked } from '../result.js';

interface ShapePlan {
  validator: Validator;
  custom?: FormatPredicate;
  formatName?: string;
}

export class ValueJudge {
  private static readonly plans = new WeakMap<object, ShapePlan>();

  private constructor(private readonly field: Field) {}

  /** The shape is compiled once and reused, not rebuilt per value. */
  static of(field: Field): ValueJudge {
    return new ValueJudge(field);
  }

  validate(value: unknown): Checked {
    const shape = this.field.shape;
    const base = Shapes.of(shape).base;
    if (value !== null) {
      if (base?.type === 'object' && !base.properties) return { value };
      if (
        base?.type === 'string' &&
        base.format === 'date-time' &&
        value instanceof Date
      ) {
        return Number.isNaN(value.getTime()) ? { error: 'Invalid date' } : { value };
      }
      if (
        (base?.type === 'number' || base?.type === 'integer') &&
        typeof value === 'number' &&
        Number.isNaN(value)
      ) {
        return { error: 'Expected a number' };
      }
    }
    const plan = ValueJudge.planFor(shape);
    const result = plan.validator.validate(value);
    if (!result.valid) return { error: result.errors[0]?.error ?? 'Invalid value' };
    if (plan.custom && typeof value === 'string' && !plan.custom(value)) {
      return { error: `String does not match format "${plan.formatName}".` };
    }
    return { value };
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
      throw new Error(
        `Unknown format: '${name}'. Register it with Formats.register('${name}', …) — ` +
          `the engine judges ${Object.keys(engineFormats).length} formats natively and this is not one of them.`,
      );
    }
    return custom;
  }
}
