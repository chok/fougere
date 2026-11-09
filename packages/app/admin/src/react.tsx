export type { ReactAdminFieldContext } from './ReactAdminFieldContext.js';
export type { ReactAdminInputContext } from './ReactAdminInputContext.js';
export type { ReactAdminFieldRenderer } from './ReactAdminFieldRenderer.js';
export type { ReactAdminInputRenderer } from './ReactAdminInputRenderer.js';
export type { ReactAdminRenderers } from './ReactAdminRenderers.js';
export type { ReactAdminResourceComponents } from './ReactAdminResourceComponents.js';
export type { ResourceRenderOptions } from './ResourceRenderOptions.js';
export type { FougereAdminProps } from './FougereAdminProps.js';
import type { ReactAdminRenderers } from './ReactAdminRenderers.js';

import type { ResourceRenderOptions } from './ResourceRenderOptions.js';
import type { FougereAdminProps } from './FougereAdminProps.js';
'use client';
import {
  Admin, Resource, Datagrid, List, SimpleForm, Edit, Create, Show, SimpleShowLayout,
  TextField, NumberField, BooleanField, DateField, ReferenceField, FunctionField,
  TextInput, NumberInput, BooleanInput, DateTimeInput, SelectInput, ReferenceInput, AutocompleteInput,
  Toolbar, SaveButton, EditButton, DeleteButton, WrapperField, CustomRoutes,
  useTranslate, useRecordContext, useDataProvider, useRefresh, useNotify,
} from 'react-admin';
import { Route } from 'react-router-dom';
import { Box, Button, Card, CardContent, Dialog, DialogActions, DialogContent, DialogTitle, TextField as MuiTextField, Typography } from '@mui/material';
import { cloneElement, useMemo, useState, type ComponentProps, type ReactElement } from 'react';
import { createAdminRuntime } from './AdminRuntime.js';
import type { AdminExtension } from './AdminExtension.js';
import { type AdminOperation } from './AdminOperation.js';
import { actionsOf, type AdminResource } from './AdminResource.js';
import type { EditorialFacet } from './EditorialFacet.js';
import type { UsersFacet } from './UsersFacet.js';

import { Choices, formFieldsOf, type FormField, type TableColumn } from '@fougere/app/client';
import { Card as SchemaCard } from '@fougere/schema';
import { FougereLayout, fougereDarkTheme, fougereLightTheme } from './theme.js';
import { FougereTopology } from './topology-page.js';
export { FougereTopology, type FougereTopologyProps } from './topology-page.js';

import { type FougereResourceOptions } from './FougereResourceOptions.js';
import { FougereContentIcon, FougereDashboard, FougereUsersIcon } from './dashboard.js';

export {
  FougereAppBar,
  FougereLayout,
  FougereMark,
  fougereDarkTheme,
  fougereLightTheme,
} from './theme.js';
export { type FougereDashboardContextValue } from './FougereDashboardContextValue.js';
export { type FougereDashboardExtension } from './FougereDashboardExtension.js';
export { type FougereDashboardMetrics } from './FougereDashboardMetrics.js';
export { type FougereDashboardResource } from './FougereDashboardResource.js';
export { type FougereDashboardWidget } from './FougereDashboardWidget.js';
export { type FougereDashboardZone } from './FougereDashboardZone.js';
export { type FougereResourceOptions } from './FougereResourceOptions.js';
export { FOUGERE_DASHBOARD_WIDGETS, FougereContentIcon, FougereDashboard, FougereUsersIcon, applyDashboardExtensions, useFougereDashboard } from './dashboard.js';

const FIELDS = {
  text: TextField, number: NumberField, boolean: BooleanField, date: DateField,
} as const;

type Translate = (key: string, options: Record<string, unknown>) => string;
const labelOf = (t: Translate, field: { labelKey: string; label: string }): string =>
  t(field.labelKey, { _: field.label });

function defaultFieldFor(column: TableColumn, t: Translate): ReactElement {
  if (column.render === 'link') {
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

function defaultInputFor(field: FormField, t: Translate): ReactElement {
  if (field.reference) {
    const { to, label } = field.reference;

    return (
      <ReferenceInput source={field.name} reference={to} perPage={Choices.LIMIT}>
        <AutocompleteInput
          label={labelOf(t, field)} isRequired={field.required} optionText={label}
          filterToQuery={(text: string) => (text ? { [label]: { contains: text } } : {})}
        />
      </ReferenceInput>
    );
  }
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

  return <TextInput {...common} type={field.control} slotProps={{ htmlInput: field.attrs }} />;
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
    () => (
      operation.input
        ? formFieldsOf(SchemaCard.fromDescriptor(operation.input).toSchema(), operation.name)
        : []
    ),
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
      {/* `can.delete` had no reader, so a facade serving no `delete` still showed the
          selection checkboxes and the bulk Delete button — every one of them a 404. And
          a facade serving `update` but not `findById` had an inert row. */}
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

/** One facade, as the four pages the card says it serves. */
export function resourceFor(r: AdminResource, options: ResourceRenderOptions = {}): ReactElement {
  const { renderers, components = {} } = options;
  const resourceOptions: FougereResourceOptions = {
    label: r.label,
    primary: r.primary,
    facets: r.facets,
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
      recordRepresentation={
        (r.facets.editorial as EditorialFacet | undefined)?.title
        ?? (r.facets.users as UsersFacet | undefined)?.name
        ?? r.primary
      }
    />
  );
}

type BaseAdminProps = ComponentProps<typeof Admin>;

const EMPTY_EXTENSIONS: readonly AdminExtension[] = [];

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
             * The one page that renders the APP rather than a facade. It is not a resource —
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
