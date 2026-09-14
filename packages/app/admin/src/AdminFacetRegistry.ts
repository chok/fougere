import type { EditorialFacet } from './EditorialFacet.js';
import type { UsersFacet } from './UsersFacet.js';

/** Open registry of the semantic projections renderers understand. */
export interface AdminFacetRegistry {
  editorial: EditorialFacet;
  users: UsersFacet;
  [facet: string]: unknown;
}
