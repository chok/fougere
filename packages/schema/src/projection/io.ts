import { Role } from '../axis/role/Role.js';
import { Lifecycle } from '../axis/lifecycle/Lifecycle.js';
import { Boundary } from '../axis/boundary/Boundary.js';
import type { Fields } from '../Field.js';

export function inputFields(fields: Fields): Fields {
  const result: Fields = {};
  for (const [name, field] of Object.entries(fields)) {
    const role = Role.of(field);
    if (role.isPrimary) continue;
    if (Lifecycle.of(field).create === 'now') continue;
    if (role.isCollection) continue;
    if (Boundary.of(field).readOnly) continue;
    result[name] = field;
  }
  return result;
}

export function outputFields(fields: Fields): Fields {
  const result: Fields = {};
  for (const [name, field] of Object.entries(fields)) {
    if (Boundary.of(field).writeOnly) continue;
    result[name] = field;
  }
  return result;
}
