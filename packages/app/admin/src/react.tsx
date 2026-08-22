'use client';
/**
 * The rendering half — a column becomes a field, a form field becomes an input.
 *
 * Two maps and a loop. Everything that DECIDES lives in `resources.ts`; what is here
 * only spells the decision in react-admin's vocabulary, which is why this file has no
 * conditional beyond the two lookups: a `render` that had to be interpreted would mean
 * the interpretation belonged upstream, in the projection that produced it.
 */
import {
  Admin, Resource, Datagrid, List, SimpleForm, Edit, Create, Show, SimpleShowLayout,
  TextField, NumberField, BooleanField, DateField, ReferenceField, FunctionField,
  TextInput, NumberInput, BooleanInput, DateTimeInput, SelectInput,
  Toolbar, SaveButton, EditButton, DeleteButton, WrapperField, CustomRoutes,
  useTranslate, useRecordContext, useDataProvider, useRefresh, useNotify,
} from 'react-admin';
import { Route } from 'react-router-dom';
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, TextField as MuiTextField, Typography } from '@mui/material';
import { cloneElement, useMemo, useState, type ComponentProps, type ComponentType, type ReactElement } from 'react';
import { createAdminRuntime } from './runtime.js';
import type { AdminExtension } from './extensions.js';
import { actionsOf, type AdminOperation, type AdminResource } from './resources.js';
import type { EditorialFacet, UsersFacet } from './facets.js';
import type { Fetcher } from '@fougere/app/client';
import { formFieldsOf, type FormField, type TableColumn } from '@fougere/app/client';
import { reconstruct } from '@fougere/schema';
import { FougereLayout, fougereDarkTheme, fougereLightTheme } from './theme.js';
import { FougereTopology } from './topology-page.js';
export { FougereTopology, type FougereTopologyProps } from './topology-page.js';
import {
  FougereContentIcon,
  FougereDashboard,
  FougereUsersIcon,
  type FougereDashboardExtension,
  type FougereResourceOptions,
} from './dashboard.js';

export {
  FougereAppBar,
  FougereLayout,
  FougereMark,
  fougereDarkTheme,
  fougereLightTheme,
} from './theme.js';
export {
  FOUGERE_DASHBOARD_WIDGETS,
  FougereContentIcon,
  FougereDashboard,
  FougereUsersIcon,
  applyDashboardExtensions,
  useFougereDashboard,
  type FougereDashboardContextValue,
  type FougereDashboardExtension,
  type FougereDashboardMetrics,
  type FougereDashboardResource,
  type FougereDashboardWidget,
  type FougereDashboardZone,
  type FougereResourceOptions,
} from './dashboard.js';

const FIELDS = {
  text: TextField, number: NumberField, boolean: BooleanField, date: DateField,
} as const;

/**
 * A field's visible name — its i18n key, and the derived name when nothing fills it.
 *
 * `labelKey` is `entity.field`, the convention `FormField` states, and both projections
 * carry it beside the fallback. Passing `label` alone (which is what this file did until
 * 2026-08-21) throws the key away at the last step: a translated admin was impossible
 * from a contract that had said how to translate it all along.
 *
 * react-admin re-translates whatever `label` receives, with itself as the default, so
 * handing it a resolved string is a no-op rather than a second lookup.
 */
type Translate = (key: string, options: Record<string, unknown>) => string;
const labelOf = (t: Translate, field: { labelKey: string; label: string }): string =>
  t(field.labelKey, { _: field.label });

function defaultFieldFor(column: TableColumn, t: Translate): ReactElement {
  if (column.render === 'link') {
    // `to` is the target's registration key, which is also its resource name — the
    // card writes both with `registrationKeyOf`, so no mapping is needed here.
    // No child on purpose: with one, `ReferenceField` prints whatever the child names —
    // here the foreign id, twice over. Without one it renders the target's
    // `recordRepresentation`, which is the human name, and brings a loading and an error
    // state for free.
    return (
      <ReferenceField key={column.name} source={column.name} reference={column.to!} label={labelOf(t, column)} />
    );
  }
  if (column.render === 'json') {
    return (
      <FunctionField
        key={column.name} source={column.name} label={labelOf(t, column)}
        render={(row: Record<string, unknown>) => JSON.stringify(row[column.name])}
      />
    );
  }
  const Field = FIELDS[column.render];
  return <Field key={column.name} source={column.name} label={labelOf(t, column)} />;
}

/**
 * The bounds ride along under the names a browser already enforces — the same
 * `attrs` a Vue form spreads onto its input. The judge reads the same shape either
 * way; stating them here only means the refusal arrives while typing.
 */
function defaultInputFor(field: FormField, t: Translate): ReactElement {
  if (field.control === 'select') {
    return (
      <SelectInput
        source={field.name} label={labelOf(t, field)} isRequired={field.required}
        choices={(field.options ?? []).map((id) => ({ id, name: id }))}
      />
    );
  }
  const common = {
    source: field.name,
    label: labelOf(t, field),
    isRequired: field.required,
    defaultValue: field.default,
  };
  if (field.control === 'number') {
    return <NumberInput {...common} min={field.attrs?.min} max={field.attrs?.max} />;
  }
  if (field.control === 'boolean') return <BooleanInput {...common} />;
  if (field.control === 'date') return <DateTimeInput {...common} />;

  const { minlength, maxlength, ...attrs } = field.attrs ?? {};
  return (
    <TextInput
      {...common}
      type={field.control}
      slotProps={{
        htmlInput: {
          ...attrs,
          ...(minlength !== undefined ? { minLength: minlength } : {}),
          ...(maxlength !== undefined ? { maxLength: maxlength } : {}),
        },
      }}
    />
  );
}

export interface ReactAdminFieldContext {
  resource: AdminResource;
  column: TableColumn;
  /** The maintained Fougere renderer. Call it to wrap rather than replace it. */
  defaultRender(): ReactElement;
}

export interface ReactAdminInputContext {
  resource: AdminResource;
  field: FormField;
  defaultRender(): ReactElement;
}

export type ReactAdminFieldRenderer = (context: ReactAdminFieldContext) => ReactElement;
export type ReactAdminInputRenderer = (context: ReactAdminInputContext) => ReactElement;

export interface ReactAdminRenderers {
  /** Exact `resource.field` keys. Unmentioned and future fields keep the default renderer. */
  fields?: Record<string, ReactAdminFieldRenderer>;
  inputs?: Record<string, ReactAdminInputRenderer>;
}

export interface ReactAdminResourceComponents {
  list?: ComponentType;
  show?: ComponentType;
  edit?: ComponentType;
  create?: ComponentType;
  icon?: ComponentType;
}

export interface ResourceRenderOptions {
  renderers?: ReactAdminRenderers;
  components?: ReactAdminResourceComponents;
}

function fieldFor(resource: AdminResource, column: TableColumn, t: Translate, renderers?: ReactAdminRenderers): ReactElement {
  const defaultRender = () => defaultFieldFor(column, t);
  const renderer = renderers?.fields?.[`${resource.name}.${column.name}`];
  const rendered = renderer ? renderer({ resource, column, defaultRender }) : defaultRender();
  return cloneElement(rendered, { key: column.name });
}

function inputFor(resource: AdminResource, field: FormField, t: Translate, renderers?: ReactAdminRenderers): ReactElement {
  const defaultRender = () => defaultInputFor(field, t);
  const renderer = renderers?.inputs?.[`${resource.name}.${field.name}`];
  const rendered = renderer ? renderer({ resource, field, defaultRender }) : defaultRender();
  return cloneElement(rendered, { key: field.name });
}

/**
 * A business operation, as a button.
 *
 * This is the only thing the panel has that a generic CRUD admin has not, and until now
 * it had no reader at all: `AdminResource.operations` fed the stats widget and nothing
 * else. In the demo that was demonstrable — `publish` is announced by the card, the
 * extension gives it a label and a confirmation sentence, and there was no way to publish
 * an article from the back-office.
 *
 * Three things are derived and none is declared per entity: WHICH ops (everything the
 * door serves beyond the five verbs), WHETHER it asks for input (`op.input` — then the
 * dialog's form is `formFieldsOf` over the reconstructed schema, the same projection an
 * ordinary form uses), and WHETHER it confirms (`op.confirm`, from an extension).
 */
function OperationButton({
  resource,
  operation,
}: {
  resource: AdminResource;
  operation: AdminOperation;
}): ReactElement {
  const record = useRecordContext();
  const dataProvider = useDataProvider();
  const refresh = useRefresh();
  const notify = useNotify();
  const t = useTranslate();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});

  const fields = useMemo(
    () => (operation.input ? formFieldsOf(reconstruct(operation.input) as never, operation.name) : []),
    [operation],
  );
  const asks = fields.length > 0 || !!operation.confirm;
  const label = t(operation.label, { _: operation.label });

  const run = async () => {
    setBusy(true);
    try {
      await (dataProvider as unknown as {
        invoke: (r: string, p: { op: string; id?: string | number; data?: Record<string, unknown> }) => Promise<unknown>;
      }).invoke(resource.name, {
        op: operation.name,
        ...(record?.id !== undefined ? { id: record.id } : {}),
        ...(fields.length ? { data: values } : {}),
      });
      notify(t('fougere.admin.action.done', { _: '%{name} done', name: label }), { type: 'success' });
      setOpen(false);
      refresh();
    } catch (error) {
      notify((error as Error)?.message ?? String(error), { type: 'error' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size="small" onClick={() => (asks ? setOpen(true) : void run())} disabled={busy}>
        {label}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>{label}</DialogTitle>
        <DialogContent>
          {operation.confirm && (
            <Typography variant="body2" color="text.secondary" sx={{ mb: fields.length ? 2 : 0 }}>
              {t(operation.confirm, { _: operation.confirm })}
            </Typography>
          )}
          {fields.map((field) => (
            <MuiTextField
              key={field.name}
              label={t(field.labelKey, { _: field.label })}
              required={field.required}
              fullWidth
              margin="dense"
              onChange={(event) => setValues((v) => ({ ...v, [field.name]: event.target.value }))}
            />
          ))}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpen(false)}>{t('ra.action.cancel', { _: 'Cancel' })}</Button>
          <Button variant="contained" onClick={() => void run()} disabled={busy}>{label}</Button>
        </DialogActions>
      </Dialog>
    </>
  );
}

/** Row-level actions: the verbs the door serves, then everything else it serves. */
function RowActions({ resource }: { resource: AdminResource }): ReactElement {
  const actions = useMemo(() => actionsOf(resource.operations), [resource]);
  return (
    <Box sx={{ display: 'flex', gap: .5, justifyContent: 'flex-end' }}>
      {actions.filter((op) => op.kind === 'command').map((op) => (
        <OperationButton key={op.name} resource={resource} operation={op} />
      ))}
      {resource.can.edit && <EditButton />}
      {resource.can.delete && <DeleteButton />}
    </Box>
  );
}

const listFor = (r: AdminResource, renderers?: ReactAdminRenderers) => function ResourceList() {
  const t = useTranslate();
  return (
    <List>
      {/* `can.delete` had no reader, so a door serving no `delete` still showed the
          selection checkboxes and the bulk Delete button — every one of them a 404. And
          a door serving `update` but not `findById` had an inert row. */}
      <Datagrid
        rowClick={r.can.show ? 'show' : r.can.edit ? 'edit' : false}
        bulkActionButtons={r.can.delete ? undefined : false}
      >
        {r.columns.map((column) => fieldFor(r, column, t, renderers))}
        {/* Real links and real buttons — a Datagrid row is a bare `<tr onClick>` with no
            tabIndex, so this column is also the only way to reach a row from a keyboard. */}
        <WrapperField label="" source="__actions"><RowActions resource={r} /></WrapperField>
      </Datagrid>
    </List>
  );
};
const showFor = (r: AdminResource, renderers?: ReactAdminRenderers) => function ResourceShow() {
  const t = useTranslate();
  return (
    <Show>
      <SimpleShowLayout>{r.columns.map((column) => fieldFor(r, column, t, renderers))}</SimpleShowLayout>
    </Show>
  );
};
/**
 * `pessimistic`, and the reason is the provider's own work.
 *
 * react-admin edits `undoable` by default: it redirects at once, sends the call five
 * seconds later, and reports a failure in a toast — by which time the form is unmounted.
 * `useEditController` says it outright (`if (!hasValidationErrors || mutationMode !==
 * 'pessimistic')`), so the per-field refusals `asAdminError` builds from
 * `VALIDATION_FAILED` were computed, sent, and thrown away on every edit. Create was
 * always pessimistic, which is why the same form judged differently depending on whether
 * the row existed.
 */
const editFor = (r: AdminResource, renderers?: ReactAdminRenderers) => function ResourceEdit() {
  const t = useTranslate();
  return (
    <Edit mutationMode="pessimistic">
      <SimpleForm toolbar={r.can.delete ? undefined : <Toolbar><SaveButton /></Toolbar>}>
        {r.fields.map((field) => inputFor(r, field, t, renderers))}
      </SimpleForm>
    </Edit>
  );
};
const createFor = (r: AdminResource, renderers?: ReactAdminRenderers) => function ResourceCreate() {
  const t = useTranslate();
  return <Create><SimpleForm>{r.fields.map((field) => inputFor(r, field, t, renderers))}</SimpleForm></Create>;
};

/** One door, as the four pages the card says it serves. */
export function resourceFor(r: AdminResource, options: ResourceRenderOptions = {}): ReactElement {
  const { renderers, components = {} } = options;
  const resourceOptions: FougereResourceOptions = {
    label: r.label,
    primary: r.primary,
    facets: r.facets,
    // The frond it belongs to and what it answers — the card said both, and a widget
    // reporting on the app's own shape had no other way to reach them.
    frond: r.frond,
    operations: r.operations.map(({ name, kind }) => ({ name, kind })),
    fieldCount: r.columns.length,
  };
  return (
    <Resource
      key={r.name}
      name={r.name}
      list={components.list ?? (r.can.list ? listFor(r, renderers) : undefined)}
      show={components.show ?? (r.can.show ? showFor(r, renderers) : undefined)}
      edit={components.edit ?? (r.can.edit ? editFor(r, renderers) : undefined)}
      create={components.create ?? (r.can.create ? createFor(r, renderers) : undefined)}
      icon={components.icon ?? (r.facets.users
        ? FougereUsersIcon
        : r.facets.editorial
          ? FougereContentIcon
          : undefined)}
      options={resourceOptions}
      // What names a row everywhere react-admin needs a name: the Show/Edit page title,
      // an autocomplete label, the target of a reference. The declared facet says which
      // field that is; the key is the fallback, and it was the only value used before —
      // so every one of those places printed `post_1`.
      recordRepresentation={
        (r.facets.editorial as EditorialFacet | undefined)?.title
        ?? (r.facets.users as UsersFacet | undefined)?.name
        ?? r.primary
      }
    />
  );
}

/**
 * The whole back-office — derived defaults first, deltas and renderers second.
 *
 * `<Admin>` accepts a function child returning a promise of resources, so the menu is
 * built at LOAD time from `rpc.discover` rather than at build time from a generator.
 * Which is what lets this bundle be compiled once and shipped: no entity of the host
 * app enters it, so there is nothing per-project left to build.
 */
type BaseAdminProps = ComponentProps<typeof Admin>;

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

const EMPTY_EXTENSIONS: readonly AdminExtension[] = [];

/**
 * What the panel shows when it could not ask what to show.
 *
 * The card IS the application as far as this bundle is concerned, so a refused
 * `rpc.discover` leaves nothing to render — and react-admin's async children have no
 * rejection path of their own: the promise rejects, `status` stays `'loading'`, and the
 * operator watches a spinner with no message and no way out. That is the only state
 * where the panel says nothing at all, so it is the one worth building by hand.
 */
function DiscoveryError({ error, onRetry }: { error: unknown; onRetry: () => void }): ReactElement {
  const t = useTranslate();
  const label = (key: string, fallback: string) => t(`fougere.admin.${key}`, { _: fallback });
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', minHeight: '60vh', p: 3 }}>
      <Card sx={{ maxWidth: 460, width: '100%' }}>
        <CardContent sx={{ p: 3, '&:last-child': { pb: 3 } }}>
          <Typography variant="h3" sx={{ mb: 1 }}>
            {label('error.discoveryTitle', 'This app did not answer')}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {label('error.discoveryBody', 'The panel asks the app what it hosts before it can render anything. Check that the endpoint serves a Fougere app, and that it is running.')}
          </Typography>
          <Typography
            variant="caption"
            component="pre"
            sx={{ mt: 2, p: 1.5, borderRadius: 1.5, bgcolor: 'action.hover', color: 'text.secondary', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
          >
            {(error as Error)?.message ?? String(error)}
          </Typography>
          <Button variant="contained" onClick={onRetry} sx={{ mt: 2.5 }}>
            {label('error.retry', 'Try again')}
          </Button>
        </CardContent>
      </Card>
    </Box>
  );
}

export function FougereAdmin({
  endpoint,
  fetcher,
  extensions = EMPTY_EXTENSIONS,
  renderers,
  dashboardExtensions,
  resourceComponents,
  theme = fougereLightTheme,
  darkTheme = fougereDarkTheme,
  layout = FougereLayout,
  dashboard: dashboardOverride,
  ...adminProps
}: FougereAdminProps): ReactElement {
  // A retry rebuilds the runtime, which is what makes it a retry: the previous one
  // holds a cleared slot, but react-admin only re-runs its async child when the tree
  // changes, and this key is the change.
  const [attempt, setAttempt] = useState(0);
  const runtime = useMemo(
    () => createAdminRuntime({ endpoint, fetcher, extensions }),
    [endpoint, fetcher, extensions, attempt],
  );
  const dashboard = useMemo<BaseAdminProps['dashboard']>(() => {
    if (dashboardOverride !== undefined) return dashboardOverride;
    const DerivedDashboard = () => <FougereDashboard extensions={dashboardExtensions} />;
    return DerivedDashboard;
  }, [dashboardOverride, dashboardExtensions]);

  return (
    <Admin
      {...adminProps}
      dataProvider={runtime.dataProvider as BaseAdminProps['dataProvider']}
      theme={theme}
      darkTheme={darkTheme}
      layout={layout}
      dashboard={dashboard}
    >
      {async () => {
        try {
          return [
            ...(await runtime.load()).resources.map((resource) => resourceFor(resource, {
              renderers,
              components: resourceComponents?.[resource.name],
            })),
            /*
             * The one page that renders the APP rather than a door. It is not a resource —
             * there is no row behind it — so it rides a route, and its data comes from
             * `rpc.topology` rather than from the card.
             */
            <CustomRoutes key="fougere.routes">
              <Route
                path="/topology"
                element={<FougereTopology {...(endpoint ? { endpoint } : {})} {...(fetcher ? { fetcher } : {})} />}
              />
            </CustomRoutes>,
          ];
        } catch (error) {
          return (
            <CustomRoutes>
              <Route path="*" element={<DiscoveryError error={error} onRetry={() => setAttempt((n) => n + 1)} />} />
            </CustomRoutes>
          );
        }
      }}
    </Admin>
  );
}
