import { Boundary } from '../schema/axis/boundary/Boundary.js';
import { Lifecycle } from '../schema/axis/lifecycle/Lifecycle.js';
import { Role } from '../schema/axis/role/Role.js';
import type { Field, Fields } from '../schema/fields/Field.js';
import type { ValidateOptions } from './options.js';
import type { ValidationError, ValidationResult } from './result.js';
import { ValueJudge } from './ValueJudge.js';
import { RowRefusal } from './RowRefusal.js';

export class RowJudge {
  private constructor(
    private readonly fields: Fields,
    private readonly options: ValidateOptions,
  ) {}

  /**
   * So the same field set judges a create and a patch, told apart by one option.
   * FR : pour que le même ensemble juge une création et une modification.
   * `RowJudge.of(fields, { patch: true }).check({ title: 'a' })` → no `Required` on what is absent
   */
  static of(fields: Fields, options: ValidateOptions = {}): RowJudge {
    return new RowJudge(fields, options);
  }

  /**
   * So an absent value has one answer per field, decided by the axes and not by the caller.
   * FR : pour qu'une absence ait une réponse par champ, décidée par les axes.
   * `created()` → `'skip'`; a required `list()` → `'empty-list'`; a required `text()` → `null`
   */
  onAbsent(field: Field): 'skip' | 'empty-list' | null {
    if (Boundary.of(field).readOnly) return 'skip';
    if (!Lifecycle.of(field).requiredAtCreate) return 'skip';
    if (Role.of(field).isCollection) return 'empty-list';
    return null;
  }

  /**
   * So a handler never receives a row it would have to check again — and gets parsed values.
   * FR : pour qu'un handler ne revérifie rien, et reçoive des valeurs converties.
   * `check({ title: 'a', ghost: 1 })`
   * → `{ success: false, errors: [{ path: 'ghost', message: 'Unknown field' }] }`
   */
  check(input: unknown): ValidationResult<Record<string, unknown>> {
    if (typeof input !== 'object' || input === null) {
      return { success: false, errors: [{ path: '.', message: RowRefusal.notAnObject }] };
    }

    const data = input as Record<string, unknown>;
    const errors: ValidationError[] = [];
    const out: Record<string, unknown> = {};

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
        if (absence === 'empty-list') out[key] = [];
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

      const checked = ValueJudge.of(field).check(value);
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
}
