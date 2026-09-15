import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Field } from '../field/Field.js';
import type { Fields } from '../field/Fields.js';
import type { ValidationError } from '../lib/ValidationError.js';
import type { ValidationResult } from '../lib/ValidationResult.js';
import { FieldValueValidator } from './FieldValueValidator.js';
import { InputRefusal } from './InputRefusal.js';
import type { ValidateOptions } from './ValidateOptions.js';

type Admitted = { path: readonly string[]; message: string } | { value: unknown };

export class InputValidator {
  private constructor(
    private readonly fields: Fields,
    private readonly options: ValidateOptions,
  ) {}

  static of(fields: Fields, options: ValidateOptions = {}): InputValidator {
    return new InputValidator(fields, options);
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
      return {
        success: false,
        errors: [{ path: [], message: InputRefusal.notAnObject }],
      };
    }

    const data = input as Record<string, unknown>;
    const errors: ValidationError[] = this.unknownIn(data);
    const row: Record<string, unknown> = {};

    for (const [key, field] of Object.entries(this.fields)) {
      const verdict = this.admit(field, data[key]);
      if (verdict === undefined) continue;
      if ('message' in verdict) errors.push({ path: [key, ...verdict.path], message: verdict.message });
      else row[key] = verdict.value;
    }

    if (errors.length > 0) return { success: false, errors };

    return { success: true, data: row };
  }

  private unknownIn(data: Record<string, unknown>): ValidationError[] {
    return Object.keys(data)
      .filter((key) => !Object.hasOwn(this.fields, key))
      .map((key) => ({ path: [key], message: InputRefusal.unknownField }));
  }

  private admit(field: Field, value: unknown): Admitted | undefined {
    if (value === undefined) return this.whenAbsent(field);

    if (Boundary.of(field).readOnly) return { path: [], message: InputRefusal.readOnly };
    if (this.options.patch && Lifecycle.of(field).immutable) return { path: [], message: InputRefusal.immutable };

    const parsed = FieldValueValidator.of(field).parse(value);

    return 'error' in parsed
      ? { path: parsed.path ?? [], message: parsed.error }
      : { value: parsed.value };
  }

  private whenAbsent(field: Field): Admitted | undefined {
    if (this.options.patch) return undefined;

    const absence = this.onAbsent(field);
    if (absence === null) return { path: [], message: InputRefusal.required };

    return absence === 'empty-list' ? { value: [] } : undefined;
  }
}
