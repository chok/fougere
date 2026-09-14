import { isObject } from '@fougere/schema';
import type { AdminFacetRegistry } from './AdminFacetRegistry.js';

export type AdminFacets = Partial<AdminFacetRegistry>;

export function defineAdminFacet<const Name extends string, const Value>(
  name: Name,
  value: Value,
): Record<Name, Value> {
  return { [name]: value } as Record<Name, Value>;
}

/** Arrays replace; semantic objects merge recursively so small project deltas stay small. */
export function mergeAdminFacets(base: AdminFacets, patch: AdminFacets): AdminFacets {
  const merge = (left: unknown, right: unknown): unknown => {
    if (!isObject(left) || !isObject(right)) return right;
    const out: Record<string, unknown> = { ...left };
    for (const [key, value] of Object.entries(right)) out[key] = merge(out[key], value);
    return out;
  };
  return merge(base, patch) as AdminFacets;
}
