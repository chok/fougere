import type { ResourceOptions } from 'react-admin';
import type { AdminFacets } from './AdminFacets.js';

export interface FougereResourceOptions extends ResourceOptions {
  primary: string;
  facets: AdminFacets;
  /** The frond that owns this facade — the card groups by it, so the panel can too. */
  frond?: string;
  /** What the facade answers, with each op's kind. `query` reads, `command` writes. */
  operations?: readonly { name: string; kind: 'query' | 'command' }[];
  /** How many columns the shape yields — a rough measure of an entity's width. */
  fieldCount?: number;
}
