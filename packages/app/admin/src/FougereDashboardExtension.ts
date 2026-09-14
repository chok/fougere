import type { ComponentType } from 'react';
import type { FougereDashboardZone } from './FougereDashboardZone.js';

/** A delta over stable widget ids; a component on a new id contributes a new widget. */
export interface FougereDashboardExtension {
  widget: string;
  component?: ComponentType;
  zone?: FougereDashboardZone;
  span?: number;
  hidden?: boolean;
  before?: string;
  after?: string;
}
