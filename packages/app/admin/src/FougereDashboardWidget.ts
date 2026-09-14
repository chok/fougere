import type { ComponentType } from 'react';
import type { FougereDashboardZone } from './FougereDashboardZone.js';

export interface FougereDashboardWidget {
  id: string;
  zone: FougereDashboardZone;
  /** Twelve-column width for `main`, four-column width for `metrics`. */
  span: number;
  component: ComponentType;
  hidden?: boolean;
}
