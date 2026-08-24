import { isObject } from '@fougere/schema';
/**
 * A semantic notion a renderer can act on, DECLARED — never guessed.
 *
 * A facet says something the schema does not: which field is the human title, which
 * enum member means "published". Both are true statements about a domain, and neither
 * is readable from a shape — `oneOf('draft', 'live')` says the set is closed, never
 * what a member MEANS.
 *
 * There was an `inferAdminFacets` here that answered it by field NAME — `title`,
 * `status`, `/^(user|users|member|account)$/`, `['draft','pending','review']`. It was
 * removed on 2026-08-21: the repo recognises a field by its FORM, never by a word, and
 * that heuristic reads an English vocabulary. An entity spelling `titre`, or a status
 * spelling `brouillon`, lost its facet and nothing said so — a wrong answer given
 * silently, where an absent one is merely absent.
 *
 * So a facet is config, and config is exceptions: no facet is the default, and a
 * renderer that finds none shows the derived table, which is already the whole
 * back-office. What is missing is upstream — the declaration has no way to say what a
 * closed set's member means, and until it has, this is where a human says it.
 */

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

/**
 * Open registry of the semantic projections renderers understand.
 *
 * Fougere ships `editorial` and `users`; a plugin adds `media`, `commerce`,
 * `moderation` without the core renderer growing another enum member.
 */
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
