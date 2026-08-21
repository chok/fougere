import { Boundary } from '../axis/boundary/Boundary.js';
import type { Fields } from '../Field.js';

export function encodeFields(fields: Fields, record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const [key, field] of Object.entries(fields)) {
    if (!(key in record)) continue;
    const boundary = Boundary.of(field);
    if (boundary.writeOnly) { delete out[key]; continue; }
    const value = record[key];
    if (value === null || value === undefined) continue;
    out[key] = boundary.encode(value);
  }
  return out;
}
