import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Field, Fields } from '../field/Field.js';
import type { ValidateOptions } from './options.js';
import type { ValidationError, ValidationResult } from './result.js';
import { ValueJudge } from './ValueJudge.js';
import { RowRefusal } from './RowRefusal.js';

export class RowJudge {
  private constructor(
    private readonly fields: Fields,
    private readonly options: ValidateOptions,
  ) {}

  static of(fields: Fields, options: ValidateOptions = {}): RowJudge {
    return new RowJudge(fields, options);
  }

  onAbsent(field: Field): 'skip' | 'empty-list' | null {
    if (Boundary.of(field).readOnly) return 'skip';
    if (!Lifecycle.of(field).requiredAtCreate) return 'skip';
    if (Role.of(field).isCollection) return 'empty-list';
    return null;
  }

  /** Hands on the value it PARSED, so a handler never re-checks a row. */
  validate(input: unknown): ValidationResult<Record<string, unknown>> {
    if (typeof input !== 'object' || input === null) {
      return { success: false, errors: [{ path: '.', message: RowRefusal.notAnObject }] };
    }

    const data = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    const row: Record<string, unknown> = {};

    for (const key of Object.keys(data)) {
      if (!(key in this.fields)) {
        errors.push({ path: key, message: RowRefusal.unknownField });
      }
    }

    for (const [key, field] of Object.entries(this.fields)) {
      const path = key;
      const value = data[key];

      if (value === undefined) {
        if (this.options.patch) continue;
        const absence = this.onAbsent(field);
        if (absence === null) {
          errors.push({ path, message: RowRefusal.required });
          continue;
        }
        if (absence === 'empty-list') row[key] = [];
        continue;
      }

      const boundary = Boundary.of(field);
      if (boundary.readOnly) {
        errors.push({ path, message: RowRefusal.readOnly });
        continue;
      }
      if (this.options.patch && Lifecycle.of(field).immutable) {
        errors.push({ path, message: RowRefusal.immutable });
        continue;
      }

      const checked = ValueJudge.of(field).validate(value);
      if ('error' in checked) {
        errors.push({ path, message: checked.error });
        continue;
      }
      if (checked.value === null) {
        row[key] = null;
        continue;
      }
      const decoded = boundary.decode(checked.value);
      if ('error' in decoded) errors.push({ path, message: decoded.error });
      else row[key] = decoded.value;
    }

    if (errors.length > 0) return { success: false, errors };
    return { success: true, data: row };
  }
}
