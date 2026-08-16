import { Boundary } from '../axis/boundary/Boundary.js';
import type { Fields } from '../Field.js';

/**
 * Egress: encode a domain record into its wire form, field by field — the dual of
 * `validateFields` (which decodes on ingress). A write-only field (boundary
 * `out: 'closed'`, e.g. a password) is OMITTED — it never crosses outbound.
 * Keys absent from `fields` (e.g. presenter computed fields) pass through
 * untouched; null/undefined are left as-is.
 * Shallow by design: a relation's nested rows are not deep-encoded here.
 */
export function encodeFields(fields: Fields, record: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...record };
  for (const [key, field] of Object.entries(fields)) {
    if (!(key in record)) continue;
    if (Boundary.of(field).writeOnly) { delete out[key]; continue; }
    const value = record[key];
    if (value === null || value === undefined) continue;
    out[key] = Boundary.of(field).encode(value);
  }
  return out;
}
