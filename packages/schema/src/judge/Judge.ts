import { Role } from '../axis/role/Role.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import type { Field, Fields } from '../Field.js';
import type { FormatPredicate } from '../axis/shape/Formats.js';
import type { Shape } from '../axis/shape/Shape.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import { Anatomy } from '../axis/shape/Shape.js';
import { Formats } from '../axis/shape/Formats.js';
import { Validator, format as engineFormats } from '@cfworker/json-schema';
import type { Checked, ValidationError, ValidationResult } from './result.js';
import type { ValidateOptions } from './options.js';
import { EXTENSION_AXES } from '../axis/Axis.js';
import { isObject } from './form.js';

interface ShapePlan {
  validator: Validator;
  custom?: FormatPredicate;
  formatName?: string;
}

export class Judge {
  private static readonly plans = new WeakMap<object, ShapePlan>();

  private static planFor(shape: Shape): ShapePlan {
    let p = this.plans.get(shape);
    if (!p) {
      const base = Anatomy.of(shape).base;
      const formatName = base?.type === 'string' ? base.format : undefined;
      p = {
        validator: new Validator(shape as object, '2020-12', true),
        custom: formatName === undefined ? undefined : this.customFormatOf(formatName),
        formatName,
      };
      this.plans.set(shape, p);
    }
    return p;
  }

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

  static value(field: Field, value: unknown): Checked {
    const shape = field.shape;
    const base = Anatomy.of(shape).base;
    if (value !== null) {
      if (base?.type === 'object' && !base.properties) return { value };
      if (base?.type === 'string' && base.format === 'date-time' && value instanceof Date) {
        return Number.isNaN(value.getTime()) ? { error: 'Invalid date' } : { value };
      }
      if ((base?.type === 'number' || base?.type === 'integer') && typeof value === 'number' && Number.isNaN(value)) {
        return { error: 'Expected a number' };
      }
    }
    const plan = this.planFor(shape);
    const result = plan.validator.validate(value);
    if (!result.valid) return { error: result.errors[0]?.error ?? 'Invalid value' };
    if (plan.custom && typeof value === 'string' && !plan.custom(value)) {
      return { error: `String does not match format "${plan.formatName}".` };
    }
    return { value };
  }

  static field(value: unknown): ValidationResult<Field> {
    if (!isObject(value)) {
      return {
        success: false,
        errors: [
          {
            path: ".",
            message: `Expected an object — got ${JSON.stringify(value)}`,
          },
        ],
      };
    }
    const errors: ValidationError[] = [];

    if (!Anatomy.is(value.shape)) {
      errors.push({
        path: "shape",
        message: `Every field states a shape — got ${JSON.stringify(value.shape)}`,
      });
    }
    for (const axis of EXTENSION_AXES) {
      const declared = (value as Record<string, unknown>)[axis.slot];
      if (declared !== undefined) axis.judge(declared, errors);
    }
    if (value.meta !== undefined) {
      if (!isObject(value.meta)) {
        errors.push({
          path: "meta",
          message: `Expected an object — got ${JSON.stringify(value.meta)}`,
        });
      } else if (
        value.meta.description !== undefined &&
        typeof value.meta.description !== "string"
      ) {
        errors.push({ path: "meta.description", message: "Expected a string" });
      }
    }

    return errors.length ? { success: false, errors } : { success: true, data: value as unknown as Field };
  }

  static onAbsent(field: Field): 'skip' | 'empty-list' | null {
    if (Boundary.of(field).readOnly) return 'skip';
    if (!Lifecycle.of(field).requiredAtCreate) return 'skip';
    if (Role.of(field).isCollection) return 'empty-list';
    return null;
  }

  static row(
    fields: Fields,
    input: unknown,
    opts: ValidateOptions = {},
    ): ValidationResult<Record<string, unknown>> {
    if (typeof input !== 'object' || input === null) {
    return { success: false, errors: [{ path: '.', message: 'Expected an object' }] };
    }

    const data = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    const out: Record<string, unknown> = {};

    for (const key of Object.keys(data)) {
    if (!(key in fields)) {
      errors.push({ path: key, message: 'Unknown field' });
    }
    }

    for (const [key, field] of Object.entries(fields)) {
    const path = key;
    const value = data[key];

    if (value === undefined) {
      if (opts.patch) continue;
      const absence = Judge.onAbsent(field);
      if (absence === null) { errors.push({ path, message: 'Required' }); continue; }
      if (absence === 'empty-list') out[key] = [];
      continue;
    }

    const boundary = Boundary.of(field);
    if (boundary.readOnly) {
      errors.push({ path, message: 'Read-only' });
      continue;
    }
    if (opts.patch && Lifecycle.of(field).immutable) {
      errors.push({ path, message: 'Immutable' });
      continue;
    }

    const checked = this.value(field, value);
    if ('error' in checked) {
      errors.push({ path, message: checked.error });
      continue;
    }
    if (checked.value === null) {
      out[key] = null;
      continue;
    }
    const decoded = boundary.decode(checked.value);
    if ('error' in decoded) errors.push({ path, message: decoded.error });
    else out[key] = decoded.value;
    }

    if (errors.length > 0) return { success: false, errors };
    return { success: true, data: out };
  }

  static isField(value: unknown): value is Field {
    return this.field(value).success;
  }
}
