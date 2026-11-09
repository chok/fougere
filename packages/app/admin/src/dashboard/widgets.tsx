'use client';

import type { FougereResourceOptions } from '../FougereResourceOptions.js';
import type { FougereDashboardResource } from '../FougereDashboardResource.js';
import type { FougereDashboardWidget } from '../FougereDashboardWidget.js';
import { Box, Button, ButtonBase, Card, CardContent, Chip, Skeleton, Typography } from '@mui/material';
import { useMemo, type ReactElement } from 'react';
import { useLocaleState, useResourceDefinitions, useTranslate } from 'react-admin';
import type { EditorialFacet } from '../EditorialFacet.js';
import type { UsersFacet } from '../UsersFacet.js';
import { useFougereDashboard } from './context.js';
import { AddIcon, ArrowIcon, DraftIcon, FougereContentIcon, FougereUsersIcon, PublishedIcon } from './icons.js';

export const unique = (values: readonly (string | undefined)[]): string[] =>
  [...new Set(values.filter((value): value is string => !!value))];

export function useLabels() {
  const translate = useTranslate();

  return (key: string, fallback: string, options?: Record<string, unknown>) =>
    translate(`fougere.admin.${key}`, { _: fallback, ...options });
}

function titleOf(row: Record<string, unknown>, resource: FougereDashboardResource): string {
  const editorial = resource.facets.editorial as EditorialFacet | undefined;
  const users = resource.facets.users as UsersFacet | undefined;
  for (const key of unique([editorial?.title, users?.name, resource.primary])) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }

  return '';
}

function timestampOf(row: Record<string, unknown>, resource: FougereDashboardResource): number {
  const editorial = resource.facets.editorial as EditorialFacet | undefined;
  for (const key of unique([editorial?.updatedAt, editorial?.createdAt])) {
    const value = row[key];
    if (typeof value === 'string' || value instanceof Date) {
      const timestamp = value instanceof Date ? value.getTime() : new Date(value).getTime();
      if (!Number.isNaN(timestamp)) return timestamp;
    }
  }

  return 0;
}

const dateLabel = (timestamp: number, locale: string, fallback: string): string => timestamp
  ? new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'short' }).format(timestamp)
  : fallback;

function MetricCard({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: number;
  hint: string;
  icon: ReactElement;
}): ReactElement {
  const { loading } = useFougereDashboard();

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'text.secondary' }}>
          <Box sx={{ display: 'grid', placeItems: 'center', fontSize: 18, opacity: .7 }}>{icon}</Box>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{label}</Typography>
        </Box>
        {/* The number is the message, so it is the biggest thing in the card and the
            first one read. The icon identifies the row it belongs to; it does not
            compete for the same weight. */}
        {loading
          ? <Skeleton width={72} height={44} sx={{ mt: .75 }} />
          : (
            <Typography sx={{ mt: .5, fontSize: '2rem', lineHeight: 1.05, fontWeight: 680, letterSpacing: '-.045em', fontVariantNumeric: 'tabular-nums' }}>
              {value}
            </Typography>
          )}
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: .75 }}>{hint}</Typography>
      </CardContent>
    </Card>
  );
}

function OverviewWidget(): ReactElement {
  const { editorial, users, navigate } = useFougereDashboard();
  const t = useLabels();
  const [locale] = useLocaleState();
  const content = editorial.find((resource) => resource.hasCreate);
  const user = users.find((resource) => resource.hasCreate);
  const today = new Intl.DateTimeFormat(locale, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date());

  return (
    <Box sx={{
      display: 'flex', alignItems: { xs: 'flex-start', sm: 'flex-end' },
      justifyContent: 'space-between', flexDirection: { xs: 'column', sm: 'row' },
      gap: 2, mb: 1,
    }}>
      <Box>
        <Typography variant="overline" sx={{ color: 'text.secondary', letterSpacing: '.08em' }}>
          {today}
        </Typography>
        <Typography component="h1" sx={{ fontSize: { xs: '1.5rem', md: '1.75rem' }, fontWeight: 660, letterSpacing: '-.03em', mt: .25 }}>
          {t('overview.title', 'Overview')}
        </Typography>
      </Box>
      {/* One primary action per screen. A second would make neither of them the answer. */}
      <Box sx={{ display: 'flex', gap: 1, flexShrink: 0 }}>
        {user && (
          <Button variant="text" startIcon={<FougereUsersIcon />} onClick={() => navigate('create', user.name)}>
            {t('action.inviteUser', 'Invite a user')}
          </Button>
        )}
        {content && (
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('create', content.name)}>
            {t('action.createContent', 'Create content')}
          </Button>
        )}
      </Box>
    </Box>
  );
}

const ContentMetricWidget = () => {
  const { metrics, editorial } = useFougereDashboard();
  const t = useLabels();

  return <MetricCard label={t('metric.content', 'Content')} value={metrics.content} hint={t('metric.contentHint', `${editorial.length} collections`, { smart_count: editorial.length })} icon={<FougereContentIcon />} />;
};
const DraftMetricWidget = () => {
  const { metrics } = useFougereDashboard();
  const t = useLabels();

  return <MetricCard label={t('metric.drafts', 'Drafts')} value={metrics.drafts} hint={t('metric.draftsHint', 'To finish or review')} icon={<DraftIcon />} />;
};
const PublishedMetricWidget = () => {
  const { metrics } = useFougereDashboard();
  const t = useLabels();

  return <MetricCard label={t('metric.published', 'Published')} value={metrics.published} hint={t('metric.publishedHint', 'Currently visible')} icon={<PublishedIcon />} />;
};
const UsersMetricWidget = () => {
  const { metrics, users } = useFougereDashboard();
  const t = useLabels();

  return <MetricCard label={t('metric.users', 'Users')} value={metrics.users} hint={users.length ? t('metric.usersHint', 'Managed accounts') : t('metric.noUsersFacet', 'No users facet declared')} icon={<FougereUsersIcon />} />;
};

function RecentContentWidget(): ReactElement {
  const { loading, editorial, navigate } = useFougereDashboard();
  const t = useLabels();
  const [locale] = useLocaleState();
  const recent = useMemo(() => editorial.flatMap((resource) => resource.rows.map((row) => ({
    resource, row, date: timestampOf(row, resource),
  }))).sort((a, b) => b.date - a.date).slice(0, 6), [editorial]);

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2.25, pb: 1.75 }}>
          <Box><Typography variant="h5">{t('recent.title', 'Recent activity')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>{t('recent.subtitle', 'The most recently edited content')}</Typography></Box>
          {editorial[0] && <Button size="small" endIcon={<ArrowIcon />} onClick={() => navigate('list', editorial[0]!.name)}>{t('action.seeAll', 'See all')}</Button>}
        </Box>
        {loading ? <Box sx={{ px: 2.5, pb: 2.5 }}>{[1, 2, 3, 4].map((key) => <Skeleton key={key} height={58} />)}</Box>
          : recent.length === 0 ? <Typography color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>{t('recent.empty', 'No content yet.')}</Typography>
            : recent.map(({ resource, row, date }, index) => {
              const facet = resource.facets.editorial as EditorialFacet;
              const state = facet.state && typeof row[facet.state.field] === 'string' ? String(row[facet.state.field]) : undefined;
              const id = row.id as string | number | undefined;

              return (
                <ButtonBase key={`${resource.name}-${String(id ?? index)}`}
                  onClick={() => resource.hasShow && id !== undefined ? navigate('show', resource.name, id) : navigate('list', resource.name)}
                  sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto auto', alignItems: 'center', gap: 2, width: '100%', minHeight: 60, px: 2.5, py: 1.2, borderTop: 1, borderColor: 'divider', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: 2, outlineOffset: -2, outlineColor: 'primary.main' } }}>
                  <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 650 }}>{titleOf(row, resource)}</Typography><Typography variant="caption" color="text.secondary">{resource.label}</Typography></Box>
                  {state && <Chip label={state} size="small" />}
                  <Typography variant="caption" color="text.secondary" sx={{ minWidth: 52, textAlign: 'right' }}>{dateLabel(date, locale, t('recent.undated', 'Recently'))}</Typography>
                </ButtonBase>
              );
            })}
      </CardContent>
    </Card>
  );
}

function UsersWidget(): ReactElement {
  const { loading, users, navigate } = useFougereDashboard();
  const t = useLabels();
  const resource = users[0];
  const facet = resource?.facets.users as UsersFacet | undefined;

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', px: 2.5, pt: 2.25, pb: 1.75 }}>
          <Box><Typography variant="h5">{t('users.title', 'Users')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>{t('users.subtitle', 'Access and roles')}</Typography></Box>
          {resource?.hasCreate && <Button size="small" startIcon={<AddIcon />} onClick={() => navigate('create', resource.name)}>{t('action.invite', 'Invite')}</Button>}
        </Box>
        {loading ? <Box sx={{ px: 2.5, pb: 2.5 }}>{[1, 2, 3].map((key) => <Skeleton key={key} height={58} />)}</Box>
          : !resource || !facet ? <Typography color="text.secondary" sx={{ px: 2.5, pb: 2.5 }}>{t('users.empty', 'Declare a `users` facet to fill this panel.')}</Typography>
            : resource.rows.slice(0, 5).map((row, index) => {
              const id = row.id as string | number | undefined;
              const role = facet.role && typeof row[facet.role] === 'string' ? String(row[facet.role]) : undefined;
              const state = facet.state && typeof row[facet.state.field] === 'string' ? String(row[facet.state.field]) : undefined;

              return (
                <ButtonBase key={String(id ?? index)}
                  onClick={() => id !== undefined && resource.hasEdit ? navigate('edit', resource.name, id) : navigate('list', resource.name)}
                  sx={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center', gap: 1.5, width: '100%', minHeight: 60, px: 2.5, py: 1.1, borderTop: 1, borderColor: 'divider', textAlign: 'left', '&:hover': { bgcolor: 'action.hover' }, '&.Mui-focusVisible': { outline: 2, outlineOffset: -2, outlineColor: 'primary.main' } }}>
                  <Box sx={{ minWidth: 0 }}><Typography noWrap sx={{ fontWeight: 650 }}>{titleOf(row, resource)}</Typography><Typography variant="caption" color="text.secondary" noWrap>{role ?? (facet.email ? String(row[facet.email] ?? '') : '')}</Typography></Box>
                  {state && <Chip label={state} size="small" />}
                </ButtonBase>
              );
            })}
        {resource && <Box sx={{ borderTop: 1, borderColor: 'divider', p: 1.25 }}><Button fullWidth endIcon={<ArrowIcon />} onClick={() => navigate('list', resource.name)}>{t('action.manageUsers', 'Manage users')}</Button></Box>}
      </CardContent>
    </Card>
  );
}

function StructureWidget(): ReactElement {
  const t = useLabels();
  const definitions = useResourceDefinitions();

  const structure = useMemo(() => {
    const byFrond = new Map<string, { facades: number; queries: number; commands: number; fields: number }>();
    let queries = 0;
    let commands = 0;
    let fields = 0;
    for (const definition of Object.values(definitions)) {
      const options = definition.options as FougereResourceOptions | undefined;
      const frond = options?.frond ?? '—';
      const ops = options?.operations ?? [];
      const q = ops.filter((op) => op.kind === 'query').length;
      const c = ops.length - q;
      const width = options?.fieldCount ?? 0;
      queries += q; commands += c; fields += width;
      const held = byFrond.get(frond) ?? { facades: 0, queries: 0, commands: 0, fields: 0 };
      byFrond.set(frond, {
        facades: held.facades + 1,
        queries: held.queries + q,
        commands: held.commands + c,
        fields: held.fields + width,
      });
    }

    return {
      fronds: [...byFrond.entries()].map(([name, counts]) => ({ name, ...counts })),
      facades: Object.keys(definitions).length,
      queries, commands, fields,
    };
  }, [definitions]);

  const totals: [string, string, number][] = [
    ['structure.fronds', 'Fronds', structure.fronds.length],
    ['structure.facades', 'Facades', structure.facades],
    ['structure.queries', 'Queries', structure.queries],
    ['structure.commands', 'Commands', structure.commands],
  ];

  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 0, '&:last-child': { pb: 0 } }}>
        <Box sx={{ px: 2.5, pt: 2.25, pb: 1.75 }}>
          <Typography variant="h5">{t('structure.title', 'Structure')}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: .4 }}>
            {t('structure.subtitle', 'What the identity card announces about this app')}
          </Typography>
        </Box>

        <Box sx={{
          display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))',
          borderTop: 1, borderColor: 'divider',
        }}>
          {totals.map(([key, fallback, value], index) => (
            <Box key={key} sx={{ px: 2.5, py: 1.75, borderLeft: index ? 1 : 0, borderColor: 'divider' }}>
              <Typography sx={{ fontSize: '1.5rem', fontWeight: 680, letterSpacing: '-.04em', fontVariantNumeric: 'tabular-nums' }}>
                {value}
              </Typography>
              <Typography variant="caption" color="text.secondary">{t(key, fallback)}</Typography>
            </Box>
          ))}
        </Box>

        {structure.fronds.map((frond) => (
          <Box key={frond.name} sx={{
            display: 'grid', gridTemplateColumns: 'minmax(0,1fr) auto', alignItems: 'center',
            gap: 2, px: 2.5, py: 1.4, borderTop: 1, borderColor: 'divider',
          }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography noWrap sx={{ fontWeight: 640 }}>{frond.name}</Typography>
              <Typography variant="caption" color="text.secondary">
                {t('structure.frondDoors', `${frond.facades} facades`, { smart_count: frond.facades })}
                {' · '}
                {t('structure.frondFields', `${frond.fields} fields`, { smart_count: frond.fields })}
              </Typography>
            </Box>
            <Box sx={{ display: 'flex', gap: .75 }}>
              <Chip size="small" label={`${frond.queries} ${t('structure.read', 'read')}`} />
              <Chip size="small" label={`${frond.commands} ${t('structure.write', 'write')}`} />
            </Box>
          </Box>
        ))}

        <Box sx={{ px: 2.5, py: 1.5, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="caption" color="text.secondary">
            {t('structure.localOnly', 'Local fronds only — a card does not announce what it routes to. Topology says where a call goes.')}
          </Typography>
        </Box>
      </CardContent>
    </Card>
  );
}

function CollectionsWidget(): ReactElement {
  const t = useLabels();
  const { loading, resources, navigate } = useFougereDashboard();

  return (
    <Card><CardContent sx={{ p: 2.5, '&:last-child': { pb: 2.5 } }}>
      <Typography variant="h5">{t('collections.title', 'Collections')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .4, mb: 2 }}>{t('collections.subtitle', 'Every facade the card announced')}</Typography>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: 'repeat(2,minmax(0,1fr))', lg: 'repeat(3,minmax(0,1fr))' }, gap: 1 }}>
        {loading ? [1, 2, 3].map((key) => <Skeleton key={key} height={58} />) : resources.map((resource) => (
          <Box key={resource.name} component="button" onClick={() => navigate('list', resource.name)} sx={{ appearance: 'none', width: '100%', display: 'flex', alignItems: 'center', gap: 1.5, p: 1.25, color: 'text.primary', bgcolor: 'transparent', border: 0, borderRadius: 2, textAlign: 'left', cursor: 'pointer', font: 'inherit', '&:hover': { bgcolor: 'action.hover' } }}>
            <Box sx={{ display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 2, color: 'primary.main', bgcolor: 'action.hover' }}>{resource.facets.users ? <FougereUsersIcon fontSize="small" /> : <FougereContentIcon fontSize="small" />}</Box>
            <Box sx={{ minWidth: 0, flex: 1 }}><Typography noWrap sx={{ fontSize: '.875rem', fontWeight: 650 }}>{resource.label}</Typography><Typography variant="caption" color="text.secondary">{t('resource.rows', `${resource.total} rows`, { smart_count: resource.total })}</Typography></Box>
            <ArrowIcon fontSize="small" sx={{ color: 'text.secondary' }} />
          </Box>
        ))}
      </Box>
    </CardContent></Card>
  );
}

export const FOUGERE_DASHBOARD_WIDGETS: readonly FougereDashboardWidget[] = [
  { id: 'fougere.overview', zone: 'hero', span: 12, component: OverviewWidget },
  { id: 'fougere.content-total', zone: 'metrics', span: 1, component: ContentMetricWidget },
  { id: 'fougere.drafts', zone: 'metrics', span: 1, component: DraftMetricWidget },
  { id: 'fougere.published', zone: 'metrics', span: 1, component: PublishedMetricWidget },
  { id: 'fougere.users-total', zone: 'metrics', span: 1, component: UsersMetricWidget },
  { id: 'fougere.recent-content', zone: 'main', span: 8, component: RecentContentWidget },
  { id: 'fougere.users', zone: 'main', span: 4, component: UsersWidget },
  { id: 'fougere.structure', zone: 'main', span: 12, component: StructureWidget },
  { id: 'fougere.collections', zone: 'main', span: 12, component: CollectionsWidget },
];
