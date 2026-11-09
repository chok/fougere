'use client';

import type { FougereResourceOptions } from './FougereResourceOptions.js';
import type { FougereDashboardResource } from './FougereDashboardResource.js';
import type { FougereDashboardMetrics } from './FougereDashboardMetrics.js';
import type { FougereDashboardContextValue } from './FougereDashboardContextValue.js';
import type { FougereDashboardZone } from './FougereDashboardZone.js';
import type { FougereDashboardExtension } from './FougereDashboardExtension.js';
import { Box } from '@mui/material';
import { useEffect, useMemo, useState, type ReactElement } from 'react';
import { useDataProvider, useRedirect, useResourceDefinitions, Title } from 'react-admin';
import type { EditorialFacet } from './EditorialFacet.js';
import { DashboardContext, applyDashboardExtensions } from './dashboard/context.js';
import { FOUGERE_DASHBOARD_WIDGETS, unique, useLabels } from './dashboard/widgets.js';

const EMPTY_EXTENSIONS: readonly FougereDashboardExtension[] = [];

export function FougereDashboard({ extensions = EMPTY_EXTENSIONS }: { extensions?: readonly FougereDashboardExtension[] }): ReactElement {
  const definitions = useResourceDefinitions<FougereResourceOptions>();
  const dataProvider = useDataProvider();
  const redirect = useRedirect();
  const [resources, setResources] = useState<FougereDashboardResource[]>([]);
  const [loading, setLoading] = useState(true);
  const resourceKey = Object.values(definitions).filter((definition) => definition.hasList).map((definition) => definition.name).sort().join('\u0000');

  useEffect(() => {
    let active = true;
    const listable = Object.values(definitions).filter((definition) => definition.hasList);
    if (!listable.length) {
      setResources([]);
      setLoading(false);

      return () => { active = false; };
    }
    setLoading(true);
    void Promise.all(listable.map(async (definition): Promise<FougereDashboardResource> => {
      const options = definition.options as FougereResourceOptions | undefined;
      const facets = options?.facets ?? {};
      const editorial = facets.editorial as EditorialFacet | undefined;
      const stateValues = unique([...(editorial?.state?.draft ?? []), ...(editorial?.state?.published ?? [])]);
      const primary = options?.primary ?? 'id';
      try {
        const page = await dataProvider.getList(definition.name, { pagination: { page: 1, perPage: 8 }, sort: { field: primary, order: 'DESC' }, filter: {} });
        const states = editorial?.state ? Object.fromEntries(await Promise.all(stateValues.map(async (state) => {
          try {
            const filtered = await dataProvider.getList(definition.name, { pagination: { page: 1, perPage: 1 }, sort: { field: primary, order: 'DESC' }, filter: { [editorial.state!.field]: state } });

            return [state, filtered.total ?? filtered.data.length] as const;
          } catch { return [state, 0] as const; }
        }))) : {};

        return { name: definition.name, label: options?.label ?? definition.name, primary, facets, hasCreate: !!definition.hasCreate, hasEdit: !!definition.hasEdit, hasShow: !!definition.hasShow, total: page.total ?? page.data.length, rows: page.data as Record<string, unknown>[], states };
      } catch {
        return { name: definition.name, label: options?.label ?? definition.name, primary, facets, hasCreate: !!definition.hasCreate, hasEdit: !!definition.hasEdit, hasShow: !!definition.hasShow, total: 0, rows: [], states: {} };
      }
    })).then((loaded) => { if (active) setResources(loaded); }).finally(() => { if (active) setLoading(false); });

    return () => { active = false; };
  }, [dataProvider, resourceKey]);

  const editorial = resources.filter((resource) => !!resource.facets.editorial);
  const users = resources.filter((resource) => !!resource.facets.users);
  const metrics = useMemo<FougereDashboardMetrics>(() => ({
    content: editorial.reduce((sum, resource) => sum + resource.total, 0),
    drafts: editorial.reduce((sum, resource) => {
      const facet = resource.facets.editorial as EditorialFacet;

      return sum + (facet.state?.draft ?? []).reduce((subtotal, state) => subtotal + (resource.states[state] ?? 0), 0);
    }, 0),
    published: editorial.reduce((sum, resource) => {
      const facet = resource.facets.editorial as EditorialFacet;

      return sum + (facet.state?.published ?? []).reduce((subtotal, state) => subtotal + (resource.states[state] ?? 0), 0);
    }, 0),
    users: users.reduce((sum, resource) => sum + resource.total, 0),
  }), [editorial, users]);

  const t = useLabels();
  const context = useMemo<FougereDashboardContextValue>(() => ({
    loading, resources, editorial, users, metrics,
    navigate: (view, resource, id) => redirect(view, resource, id),
  }), [loading, resources, editorial, users, metrics, redirect]);
  const widgets = useMemo(() => applyDashboardExtensions(FOUGERE_DASHBOARD_WIDGETS, extensions), [extensions]);

  const renderZone = (zone: FougereDashboardZone) => widgets.filter((widget) => widget.zone === zone).map((widget) => {
    const Widget = widget.component;
    const gridColumn = zone === 'main'
      ? {
        xs: 'span 12',
        md: `span ${Math.min(12, Math.max(6, widget.span))}`,
        lg: `span ${Math.min(12, Math.max(1, widget.span))}`,
      }
      : zone === 'metrics'
        ? { xs: 'span 1', lg: `span ${Math.min(4, Math.max(1, widget.span))}` }
        : undefined;

    return <Box key={widget.id} sx={gridColumn ? { gridColumn } : undefined}><Widget /></Box>;
  });

  return (
    <DashboardContext.Provider value={context}>
      <Title title={t('overview.title', 'Overview')} />
      <Box sx={{ width: '100%', maxWidth: 1440, mx: 'auto', pb: 4 }}>
        <Box sx={{ display: 'grid', gap: 2, mb: 3.5 }}>{renderZone('hero')}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(4,minmax(0,1fr))' }, gap: 2, mb: 3 }}>{renderZone('metrics')}</Box>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(12,minmax(0,1fr))', gap: 2 }}>{renderZone('main')}</Box>
      </Box>
    </DashboardContext.Provider>
  );
}
