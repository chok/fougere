import { Boundary } from '../axis/boundary/Boundary.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Role } from '../axis/role/Role.js';
import type { Fields } from '../field/Fields.js';

export class Visibility {
  private constructor(private readonly fields: Fields) {}

  static of(fields: Fields): Visibility {
    return new Visibility(fields);
  }

  /** A write-only secret is absent from the type, not just from the value. */
  get input(): Fields {
    const result: Fields = {};
    for (const [name, field] of Object.entries(this.fields)) {
      const role = Role.of(field);
      if (role.isPrimary()) continue;
      if (Lifecycle.of(field).stampedAtCreate()) continue;
      if (role.isCollection()) continue;
      if (Boundary.of(field).readOnly()) continue;
      result[name] = field;
    }

    return result;
  }

  get output(): Fields {
    const result: Fields = {};
    for (const [name, field] of Object.entries(this.fields)) {
      if (Boundary.of(field).writeOnly()) continue;
      result[name] = field;
    }

    return result;
  }

  /** The dual of `encode`, for a row a caller receives. */
  decode(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...record };
    for (const [key, field] of Object.entries(this.fields)) {
      const value = record[key];
      if (!(key in record) || value === null || value === undefined) continue;
      const verdict = Boundary.of(field).decode(value);
      if ('value' in verdict) out[key] = verdict.value;
    }

    return out;
  }

  encode(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...record };
    for (const [key, field] of Object.entries(this.fields)) {
      if (!(key in record)) continue;
      const boundary = Boundary.of(field);
      if (boundary.writeOnly()) {
        delete out[key];
        continue;
      }
      const value = record[key];
      if (value === null || value === undefined) continue;
      out[key] = boundary.encode(value);
    }

    return out;
  }
}
