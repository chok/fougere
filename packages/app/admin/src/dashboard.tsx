'use client';

import {
  Box,
  Button,
  ButtonBase,
  Card,
  CardContent,
  Chip,
  Skeleton,
  SvgIcon,
  Typography,
  type SvgIconProps,
} from '@mui/material';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ComponentType,
  type ReactElement,
} from 'react';
import {
  useDataProvider,
  useLocaleState,
  useRedirect,
  useResourceDefinitions,
  useTranslate,
  Title,
  type ResourceOptions,
} from 'react-admin';
import type { AdminFacets, EditorialFacet, UsersFacet } from './facets.js';

export interface FougereResourceOptions extends ResourceOptions {
  primary: string;
  facets: AdminFacets;
  /** The frond that owns this door — the card groups by it, so the panel can too. */
  frond?: string;
  /** What the door answers, with each op's kind. `query` reads, `command` writes. */
  operations?: readonly { name: string; kind: 'query' | 'command' }[];
  /** How many columns the shape yields — a rough measure of an entity's width. */
  fieldCount?: number;
}

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

export interface FougereDashboardMetrics {
  content: number;
  drafts: number;
  published: number;
  users: number;
}

export interface FougereDashboardContextValue {
  loading: boolean;
  resources: FougereDashboardResource[];
  editorial: FougereDashboardResource[];
  users: FougereDashboardResource[];
  metrics: FougereDashboardMetrics;
  navigate(view: 'list' | 'show' | 'edit' | 'create', resource: string, id?: string | number): void;
}

const DashboardContext = createContext<FougereDashboardContextValue | undefined>(undefined);

/** Data shared by built-in and contributed widgets. */
export function useFougereDashboard(): FougereDashboardContextValue {
  const context = useContext(DashboardContext);
  if (!context) throw new Error('useFougereDashboard must be used inside FougereDashboard');
  return context;
}

export type FougereDashboardZone = 'hero' | 'metrics' | 'main';

export interface FougereDashboardWidget {
  id: string;
  zone: FougereDashboardZone;
  /** Twelve-column width for `main`, four-column width for `metrics`. */
  span: number;
  component: ComponentType;
  hidden?: boolean;
}

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

export function applyDashboardExtensions(
  defaults: readonly FougereDashboardWidget[],
  extensions: readonly FougereDashboardExtension[] = [],
): FougereDashboardWidget[] {
  const widgets = defaults.map((widget) => ({ ...widget }));
  for (const extension of extensions) {
    let index = widgets.findIndex((widget) => widget.id === extension.widget);
    if (index === -1) {
      if (!extension.component) {
        throw new Error(`Dashboard widget '${extension.widget}' does not exist; a new widget needs a component`);
      }
      widgets.push({
        id: extension.widget,
        component: extension.component,
        zone: extension.zone ?? 'main',
        span: extension.span ?? 4,
        hidden: extension.hidden,
      });
      index = widgets.length - 1;
    } else {
      const current = widgets[index]!;
      widgets[index] = {
        ...current,
        ...(extension.component ? { component: extension.component } : {}),
        ...(extension.zone ? { zone: extension.zone } : {}),
        ...(extension.span !== undefined ? { span: extension.span } : {}),
        ...(extension.hidden !== undefined ? { hidden: extension.hidden } : {}),
      };
    }

    const anchorId = extension.before ?? extension.after;
    if (!anchorId) continue;
    const moving = widgets.splice(index, 1)[0]!;
    const anchor = widgets.findIndex((widget) => widget.id === anchorId);
    if (anchor === -1) widgets.push(moving);
    else widgets.splice(anchor + (extension.after ? 1 : 0), 0, moving);
  }
  return widgets.filter((widget) => !widget.hidden);
}

type IconProps = SvgIconProps;

export const FougereContentIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M6 2h9l5 5v15H6a2 2 0 0 1-2-2V4c0-1.1.9-2 2-2Zm8 2H6v16h12V8h-4V4Zm-6 7h8v2H8v-2Zm0 4h8v2H8v-2Z" /></SvgIcon>
);
const DraftIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm1 11H7v-2h4V5h2v8Z" /></SvgIcon>
);
const PublishedIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4L9 16.2Z" /></SvgIcon>
);
export const FougereUsersIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M16 11c1.66 0 3-1.34 3-3s-1.34-3-3-3-3 1.34-3 3 1.34 3 3 3Zm-8 0c1.66 0 3-1.34 3-3S9.66 5 8 5 5 6.34 5 8s1.34 3 3 3Zm0 2c-2.33 0-7 1.17-7 3.5V19h10v-2.5c0-.87.34-1.62.91-2.26C10.55 13.41 8.9 13 8 13Zm8 0c-.9 0-2.55.41-3.91 1.24.57.64.91 1.39.91 2.26V19h10v-2.5c0-2.33-4.67-3.5-7-3.5Z" /></SvgIcon>
);
const ArrowIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="m9.3 5.3 6.7 6.7-6.7 6.7-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4Z" /></SvgIcon>
);
const AddIcon = (props: IconProps) => (
  <SvgIcon {...props}><path d="M11 5h2v14h-2zM5 11h14v2H5z" /></SvgIcon>
);

const unique = (values: readonly (string | undefined)[]): string[] =>
  [...new Set(values.filter((value): value is string => !!value))];

/**
 * Every visible sentence, under a key, with the English wording as its fallback.
 *
 * The keys live under `fougere.admin.*` — react-admin's own namespace is
 * `resources.*` and `ra.*`, and writing into it would collide with what it ships.
 * This is the same convention `FormField.labelKey` states for a field: the schema
 * carries no display text, and neither does a widget.
 */
function useLabels() {
  const translate = useTranslate();
  return (key: string, fallback: string, options?: Record<string, unknown>) =>
    translate(`fougere.admin.${key}`, { _: fallback, ...options });
}

/**
 * What names a row, and nothing is guessed.
 *
 * A declared facet says which field is the title; the primary key is the fallback,
 * because a row always has one and it identifies without pretending to describe.
 * The list here used to continue `'title', 'name', 'email'` — recognition by an
 * English word, which is what this package stopped doing on 2026-08-21: an entity
 * spelling `titre` got its id, and nothing said the facet was missing.
 */
function titleOf(row: Record<string, unknown>, resource: FougereDashboardResource): string {
  const editorial = resource.facets.editorial as EditorialFacet | undefined;
  const users = resource.facets.users as UsersFacet | undefined;
  for (const key of unique([editorial?.title, users?.name, resource.primary])) {
    const value = row[key];
    if (typeof value === 'string' || typeof value === 'number') return String(value);
  }
  return '';
}

/** When a row last moved — from the declared facet only, for the reason `titleOf` gives. */
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

/**
 * The viewer's locale, never a fixed one: react-admin already holds which language is
 * on, and `Intl` is the only thing here that formats without a translation key.
 */
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

/**
 * What the application IS, as opposed to what it holds.
 *
 * Every other widget counts rows; this one counts the shape that produced them —
 * fronds, doors, operations split by kind, and how wide each entity is. All of it comes
 * from the same card the menu was built from, so it costs no query at all.
 *
 * **Remotes are not in it, and the card is why.** `identityCardOf` maps `app.fronds`,
 * which holds what this process scanned; a frond named in `remotes:` lives in a separate
 * index (`boot/remote.ts`), discovered lazily at the first miss. So a consumer's card
 * announces its own fronds and never the ones it routes to. Saying "1 frond" while three
 * answer would be a lie the panel invented, so the count is labelled for what it is.
 */
function StructureWidget(): ReactElement {
  const t = useLabels();
  const definitions = useResourceDefinitions();

  const structure = useMemo(() => {
    const byFrond = new Map<string, { doors: number; queries: number; commands: number; fields: number }>();
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
      const held = byFrond.get(frond) ?? { doors: 0, queries: 0, commands: 0, fields: 0 };
      byFrond.set(frond, {
        doors: held.doors + 1,
        queries: held.queries + q,
        commands: held.commands + c,
        fields: held.fields + width,
      });
    }
    return {
      fronds: [...byFrond.entries()].map(([name, counts]) => ({ name, ...counts })),
      doors: Object.keys(definitions).length,
      queries, commands, fields,
    };
  }, [definitions]);

  const totals: [string, string, number][] = [
    ['structure.fronds', 'Fronds', structure.fronds.length],
    ['structure.doors', 'Doors', structure.doors],
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
                {t('structure.frondDoors', `${frond.doors} doors`, { smart_count: frond.doors })}
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
      <Typography variant="h5">{t('collections.title', 'Collections')}</Typography><Typography variant="body2" color="text.secondary" sx={{ mt: .4, mb: 2 }}>{t('collections.subtitle', 'Every door the card announced')}</Typography>
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
