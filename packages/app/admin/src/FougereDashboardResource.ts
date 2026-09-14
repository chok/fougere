import type { AdminFacets } from './AdminFacets.js';

export interface FougereDashboardResource {
  name: string;
  label: string;
  primary: string;
  facets: AdminFacets;
  hasCreate: boolean;
  hasEdit: boolean;
  hasShow: boolean;
  total: number;
  rows: Record<string, unknown>[];
  states: Record<string, number>;
}
