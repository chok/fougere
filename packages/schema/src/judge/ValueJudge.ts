import { Validator, format as engineFormats } from '@cfworker/json-schema';
import { Formats, type FormatPredicate } from '../schema/axis/shape/Formats.js';
import { Anatomy, type Shape } from '../schema/axis/shape/Shape.js';
import type { Field } from '../schema/fields/Field.js';
import type { Checked } from './result.js';

interface ShapePlan {
  validator: Validator;
  custom?: FormatPredicate;
  formatName?: string;
}

export class ValueJudge {
  private static readonly plans = new WeakMap<object, ShapePlan>();

  private constructor(private readonly field: Field) {}

  /**
   * So a value is judged against the field that declares it, and against nothing else.
   * FR : pour qu'une valeur soit jugée face au champ qui la déclare.
   * `ValueJudge.of(email).check('a@b.c')` → `{ value: 'a@b.c' }`
   */
  static of(field: Field): ValueJudge {
    return new ValueJudge(field);
  }

  /**
   * So what JSON Schema cannot see — a `Date`, a `NaN` — reads like the rest.
   * FR : pour que ce que JSON Schema ne voit pas se lise comme le reste.
   * `check(new Date('nope'))` on a `date-time` field → `{ error: 'Invalid date' }`
   */
  check(value: unknown): Checked {
    const shape = this.field.shape;
    const base = Anatomy.of(shape).base;
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

  /**
   * So a shape is compiled once and reused, instead of a validator built per value checked.
   * FR : pour qu'une forme soit compilée une fois, pas à chaque valeur.
   */
  private static planFor(shape: Shape): ShapePlan {
    let plan = this.plans.get(shape);
    if (!plan) {
      const base = Anatomy.of(shape).base;
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

  /**
   * So a format nobody registered is refused at first use, not a field that quietly passes.
   * FR : pour qu'un format non enregistré soit refusé dès le premier usage.
   * `format: 'siret'`, unregistered
   * → throws `Unknown format: 'siret'. Register it with Formats.register('siret', …)`
   */
  private static customFormatOf(name: string): FormatPredicate | undefined {
    const custom = Formats.resolve(name);
    if (!custom && !(name in engineFormats)) {
      throw new Error(
        `Unknown format: '${name}'. Register it with Formats.register('${name}', …) — ` +
          `the engine judges ${Object.keys(engineFormats).length} formats natively and this is not one of them.`,
      );
    }
    return custom;
  }
}
