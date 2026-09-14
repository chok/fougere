import type { AdminProps as BaseAdminProps } from 'react-admin';
import type { FougereDashboardExtension } from './FougereDashboardExtension.js';
import type { AdminExtension } from './AdminExtension.js';
import type { Fetcher } from '@fougere/app/client';
import type { ReactAdminRenderers } from './ReactAdminRenderers.js';
import type { ReactAdminResourceComponents } from './ReactAdminResourceComponents.js';

export type FougereAdminProps = Omit<BaseAdminProps, 'children' | 'dataProvider'> & {
  endpoint?: string;
  fetcher?: Fetcher;
  extensions?: readonly AdminExtension[];
  renderers?: ReactAdminRenderers;
  /** Add, move, resize, replace or hide widgets without snapshotting the dashboard. */
  dashboardExtensions?: readonly FougereDashboardExtension[];
  /** Explicit page-level escape hatches, scoped to one resource and one view. */
  resourceComponents?: Record<string, ReactAdminResourceComponents>;
};
