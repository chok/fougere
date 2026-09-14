import type { FougereDashboardResource } from './FougereDashboardResource.js';
import type { FougereDashboardMetrics } from './FougereDashboardMetrics.js';

export interface FougereDashboardContextValue {
  loading: boolean;
  resources: FougereDashboardResource[];
  editorial: FougereDashboardResource[];
  users: FougereDashboardResource[];
  metrics: FougereDashboardMetrics;
  navigate(view: 'list' | 'show' | 'edit' | 'create', resource: string, id?: string | number): void;
}
