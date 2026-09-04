import { isObject } from '@fougere/schema';
/** A semantic notion a renderer can act on, DECLARED — never guessed. */

export interface EditorialFacet {
  /** The field that carries the human-readable title. */
  title: string;
  /** The lifecycle vocabulary, grouped by meaning rather than by raw enum value. */
  state?: {
    field: string;
    draft?: readonly string[];
    published?: readonly string[];
  };
  createdAt?: string;
  updatedAt?: string;
}

export interface UsersFacet {
  name: string;
  email?: string;
  role?: string;
  state?: {
    field: string;
    active?: readonly string[];
    invited?: readonly string[];
    suspended?: readonly string[];
  };
  createdAt?: string;
}

/** Open registry of the semantic projections renderers understand. */
export interface AdminFacetRegistry {
  editorial: EditorialFacet;
  users: UsersFacet;
  [facet: string]: unknown;
}

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
