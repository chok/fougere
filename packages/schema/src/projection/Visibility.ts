import { Boundary } from '../schema/axis/boundary/Boundary.js';
import { Lifecycle } from '../schema/axis/lifecycle/Lifecycle.js';
import { Role } from '../schema/axis/role/Role.js';
import type { Fields } from '../schema/fields/Field.js';

export class Visibility {
  private constructor(private readonly fields: Fields) {}

  /**
   * So what a client may send and what it may see are two readings of one field set.
   * FR : pour que l'envoyable et le visible soient deux lectures d'un ensemble.
   * `Visibility.of(Post.getFields()).input`
   */
  static of(fields: Fields): Visibility {
    return new Visibility(fields);
  }

  /**
   * So a form never offers a field the server writes itself.
   * FR : pour qu'un formulaire n'offre jamais un champ que le serveur écrit.
   * `{ id: primary(), title: text(), createdAt: created() }` → `{ title }`
   */
  get input(): Fields {
    const result: Fields = {};
    for (const [name, field] of Object.entries(this.fields)) {
      const role = Role.of(field);
      if (role.isPrimary) continue;
      if (Lifecycle.of(field).create === 'now') continue;
      if (role.isCollection) continue;
      if (Boundary.of(field).readOnly) continue;
      result[name] = field;
    }
    return result;
  }

  /**
   * So a secret declared write-only is absent from the type, not just from the value.
   * FR : pour qu'un secret en écriture seule soit absent du type.
   * `{ email: text(), password: writeOnly(text()) }` → `{ email }`
   */
  get output(): Fields {
    const result: Fields = {};
    for (const [name, field] of Object.entries(this.fields)) {
      if (Boundary.of(field).writeOnly) continue;
      result[name] = field;
    }
    return result;
  }

  /**
   * So a row leaves in the shape the wire expects, with write-only fields dropped on the way.
   * FR : pour qu'une ligne parte dans la forme du fil, sans les champs d'écriture seule.
   * `encode({ createdAt: new Date(…), password: 'x' })`
   * → `{ createdAt: '2026-01-01T00:00:00.000Z' }`
   */
  encode(record: Record<string, unknown>): Record<string, unknown> {
    const out: Record<string, unknown> = { ...record };
    for (const [key, field] of Object.entries(this.fields)) {
      if (!(key in record)) continue;
      const boundary = Boundary.of(field);
      if (boundary.writeOnly) {
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
