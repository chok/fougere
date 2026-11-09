import { upperFirst, FieldSet, Role } from '@fougere/schema';
/** Auto-register GraphQL types and operations from a fougere App. */
import type SchemaBuilder from '@pothos/core';
import type { Fields, SchemaView } from '@fougere/schema';
import { Shapes } from '@fougere/schema';
import { type OperationMeta } from './OperationMeta.js';
import { listens, presentedFields, type ProviderEntry, type EntityEntry as CoreEntityEntry, type HandlerEntry as CoreHandlerEntry } from '@fougere/core';
import { registerOperations } from './OperationsConfig.js';
import { registerType } from './registerTypes.js';

type HandlerFacade = Record<string, Function>;

function relationNameFor(fieldName: string): string | undefined {
  const stripped = fieldName.replace(/(_id|Id|ID)$/, '');

  return stripped && stripped !== fieldName ? stripped : undefined;
}

function primaryNameOf(fields: Fields): string {
  return FieldSet.of(fields).primary ?? 'id';
}

interface Batch {
  keys: Set<string>;
  rows: Promise<Map<string, any>>;
}

const directionKey = (entity: string, field: string) => `${entity}#${field}`;

const stateIn = (ctx: unknown): Record<string, unknown> => (ctx as { state?: Record<string, unknown> } | undefined)?.state ?? {};

const KEYS_PER_READ = 1000;

async function readInSlices<R>(
  keys: string[],
  read: (slice: string[]) => Promise<Map<string, R>>,
  merge: (into: Map<string, R>, from: Map<string, R>) => void,
): Promise<Map<string, R>> {
  if (keys.length <= KEYS_PER_READ) return read(keys);
  const all = new Map<string, R>();
  for (let i = 0; i < keys.length; i += KEYS_PER_READ) {
    merge(all, await read(keys.slice(i, i + KEYS_PER_READ)));
  }

  return all;
}

const keepEach = <R>(into: Map<string, R>, from: Map<string, R>) => {
  for (const [key, value] of from) into.set(key, value);
};

const concatEach = (into: Map<string, any[]>, from: Map<string, any[]>) => {
  for (const [key, rows] of from) {
    const bucket = into.get(key);
    if (bucket) bucket.push(...rows); else into.set(key, rows);
  }
};

const batches = new WeakMap<object, Map<string, Batch>>();
const NO_CONTEXT: object = {};

function loadByKey<R>(
  ctx: unknown,
  entityKey: string,
  id: string,
  read: (ids: string[]) => Promise<Map<string, R>>,
  absent: () => R,
): Promise<R> {
  const scope = ctx && typeof ctx === 'object' ? (ctx as object) : NO_CONTEXT;
  let open = batches.get(scope);
  if (!open) { open = new Map(); batches.set(scope, open); }

  let batch = open.get(entityKey);
  if (!batch) {
    const keys = new Set<string>();
    const rows = Promise.resolve().then(() => {
      open!.delete(entityKey);

      return read([...keys]);
    });
    batch = { keys, rows };
    open.set(entityKey, batch);
  }
  batch.keys.add(id);

  return batch.rows.then((found) => found.get(id) ?? absent());
}


type EntityEntry = Pick<CoreEntityEntry, 'name' | 'entityClass'>;

type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface' | 'exposed'> & {
  operations: Map<string, OperationMeta>;
  ctor?: { name?: string };
};

interface PresenterFieldMeta {
  name: string;
  returnType?: string;
  /** The field emits a list per row, the page level of its return type removed. */
  list?: boolean;
  nullable?: boolean;
}

interface PresenterEntry {
  entityName: string;
  fields: string[];
  fieldMeta: PresenterFieldMeta[];
  /** The view each computed field emits, when the presenter declares one. */
  views?: Record<string, unknown>;
}

interface FrondLike {
  name: string;
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  /** What may stand in front of a presenter — `implements Partial<Present<Post>>` — and add its fields. */
  providers?: ProviderEntry[];
  surfaces?: Record<string, string[]>;
}

interface AppLike {
  fronds: FrondLike[];
  /** The façade an address serves to one audience — `undefined` when none. */
  facadeFor(address: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(address: string, surface?: string): Map<string, OperationMeta> | undefined;
  /** The presenter of an entity — `undefined` when none. */
  presenterFor(entity: string): unknown | undefined;
}


function registryKey(entityName: string, frond: string): string {
  return `${frond}:${entityName.toLowerCase()}`;
}

function targetName(target: unknown): string {
  return String((target as { name?: string } | undefined)?.name ?? '').toLowerCase();
}

function targetKey(target: unknown): string {
  return targetName(target);
}


export interface RegisterAllOptions {
  /** Keep only the addresses this answers true for. Default: every address served. */
  filter?: (address: string, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'graphql', 'rest'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}

const viewTypes = new WeakMap<object, any>();
function viewTypeOf(
  builder: InstanceType<typeof SchemaBuilder>,
  view: any,
  name: string,
): any {
  const known = viewTypes.get(view);
  if (known) return known;
  const type = registerType(builder, { name, entity: view });
  viewTypes.set(view, type);

  return type;
}

/** Auto-register GraphQL types and operations from a fougere App. */
export function registerAll(
  builder: InstanceType<typeof SchemaBuilder>,
  app: AppLike,
  options?: RegisterAllOptions,
): void {
  const typeRegistry = new Map<
    string,
    {
      name: string;
      type: any;
      /** The facade that lists the entity's rows — absent when no address does. */
      facade?: HandlerFacade;
      presenterFields: Set<string>;
      /** The entity's OWN fields — pass 2 wires relations from these, not from an output view. */
      fields: Fields;
      /** The frond declaring it — a relation resolves its target there first. */
      frond: string;
    }
  >();


  const entities = app.fronds.flatMap((frond) => frond.entities.map((entity) => ({ entity, frond })));
  const entityOf = (view: SchemaView): EntityEntry | undefined =>
    entities.find(({ entity }) => entity.entityClass === view)?.entity;
  const presenters = new Map(app.fronds.flatMap((frond) => (frond.presenters ?? []).map((presenter) =>
    [registryKey(presenter.entityName, frond.name), { ...presenter, fields: presentedFields(frond, presenter) }] as const)));
  const frondOfEntity = (entity: EntityEntry): string => entities.find((one) => one.entity === entity)?.frond.name ?? '';

  const entityType = (entity: EntityEntry): any => {
    const frond = frondOfEntity(entity);
    const key = registryKey(entity.name, frond);
    const known = typeRegistry.get(key);
    if (known) return known.type;

    const name = `${upperFirst(frond)}${upperFirst(entity.name)}`;
    const presenterMeta = presenters.get(key);
    const presenter = presenterMeta
      ? app.presenterFor(entity.name) as Record<string, Function> | undefined
      : undefined;
    const type = registerType(builder, {
      name,
      entity: entity.entityClass as any,
      presenter: presenter as any,
      presenterFields: presenterMeta?.fields,
      presenterFieldMeta: presenterMeta?.fieldMeta,
      presenterViews: presenterMeta?.views as any,
      viewType: (view, fieldName) => viewTypeOf(builder, view, `${name}${upperFirst(fieldName)}`),
    });
    typeRegistry.set(key, {
      name, type, frond,
      presenterFields: new Set(presenterMeta?.fields ?? []),
      fields: entity.entityClass.getFields(),
    });

    return type;
  };

  const typeOf = (view: SchemaView, name: string): any => {
    const entity = entityOf(view);

    return entity ? entityType(entity) : viewTypeOf(builder, view, name);
  };

  for (const frond of app.fronds) {
    const surfaceName = options?.surface;

    for (const address of new Set(frond.handlers.map((handler) => handler.address))) {
      const facade = app.facadeFor(address, surfaceName) as HandlerFacade | undefined;
      if (!facade) continue;
      if (options?.filter && !options.filter(address, frond.name)) continue;

      const handler = (surfaceName
        ? frond.handlers.find((h) => h.address === address && h.surface === surfaceName)
        : undefined) ?? frond.handlers.find((h) => !h.surface && h.address === address);
      if (!surfaceName && handler?.exposed === false) continue;

      const effective = app.operationsFor(address, surfaceName);
      if (!effective) {
        throw new Error(`GraphQL cannot project '${address}' without its EffectiveOperation table.`);
      }
      const operations = new Map([...effective].filter(([, meta]) => !listens(meta)));

      const name = upperFirst(address);
      const typeName = `${upperFirst(frond.name)}${name}`;
      const rows = operations.get('list')?.output ?? operations.get('findById')?.output;

      const target = rows && entityOf(rows);
      if (target) {
        entityType(target);
        typeRegistry.get(registryKey(target.name, frondOfEntity(target)))!.facade ??= facade;
      }

      registerOperations(builder, {
        name,
        typeName,
        type: rows ? typeOf(rows, typeName) : undefined,
        facade,
        operations,
        origin: `${frond.name}/${handler?.ctor?.name ?? `${name}Handler`}`,
        viewType: (view, opName) => typeOf(view, `${typeName}${upperFirst(opName)}`),
      });
    }
  }


  for (const [entityKey, { type, fields, presenterFields, frond: sourceFrond }] of typeRegistry) {
    const entryOf = (target: unknown) => {
      const declared = entities.find(({ entity }) => entity.entityClass === target);
      if (declared) return typeRegistry.get(registryKey(declared.entity.name, declared.frond.name));
      const named = targetName(target);

      return typeRegistry.get(registryKey(named, sourceFrond))
        ?? [...typeRegistry].find(([key]) => key.endsWith(`:${named}`))?.[1];
    };
    const relationFields: Record<string, (t: any) => any> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
      if (Role.of(field).isReference()) {
        const target = Role.of(field).target;
        if (!target) continue;
        const targetEntry = entryOf(target);
        const targetFacade = targetEntry?.facade;
        if (!targetEntry || !targetFacade) continue;

        const relationName = relationNameFor(fieldName);
        if (!relationName || relationName in fields || presenterFields.has(relationName)) continue;
        const nullable = Shapes.isNullable(field.shape);

        const targetKeyName = primaryNameOf(targetEntry.fields);
        const targetList = targetFacade.list;
        relationFields[relationName] = (t: any) => t.field({
          type: targetEntry.type,
          nullable,
          resolve: (parent: any, _args: unknown, ctx: unknown) => {
            const fk = parent[fieldName];
            if (fk == null) return null;
            if (typeof targetList !== 'function') {
              return targetFacade.findById({ params: { id: fk }, query: {}, input: undefined, state: stateIn(ctx) });
            }

            return loadByKey(ctx, directionKey(targetKey(target), targetKeyName), String(fk), (ids) =>
              readInSlices(ids, async (slice) => {
                const result = await targetList.call(targetFacade, {
                  params: {}, query: { where: { [targetKeyName]: slice } }, input: undefined, state: stateIn(ctx),
                }) as any;
                const rows = Array.isArray(result) ? result : result?.items ?? result?.data ?? [];

                return new Map<string, any>(rows.map((row: any) => [String(row?.[targetKeyName]), row]));
              }, keepEach),
            () => null);
          },
        });
      }

      if (Role.of(field).isCollection()) {
        const target = Role.of(field).target;
        if (!target) continue;
        const targetEntry = entryOf(target);
        const targetFacade = targetEntry?.facade;
        if (!targetEntry || !targetFacade) continue;

        const reverseFk = Object.entries(targetEntry.fields).find(
          ([, f]) => Role.of(f).isReference()
            && entryOf(Role.of(f).target) === typeRegistry.get(entityKey),
        );
        if (!reverseFk) continue;

        const [reverseFkName] = reverseFk;

        relationFields[fieldName] = (t: any) => t.field({
          type: [targetEntry.type],
          resolve: (parent: any, _args: unknown, ctx: unknown) => {
            const id = parent.id;
            if (id == null) return [];

            return loadByKey(ctx, directionKey(targetKey(target), reverseFkName), String(id), (ids) =>
              readInSlices(ids, async (slice) => {
                const result = await targetFacade.list({
                  params: {}, query: { where: { [reverseFkName]: slice } }, input: undefined, state: stateIn(ctx),
                }) as any;
                const rows = Array.isArray(result) ? result : result?.items ?? result?.data ?? [];
                const grouped = new Map<string, any[]>();
                for (const row of rows) {
                  const key = String(row?.[reverseFkName]);
                  const bucket = grouped.get(key);
                  if (bucket) bucket.push(row); else grouped.set(key, [row]);
                }

                return grouped;
              }, concatEach),
            () => []);
          },
        });
      }
    }

    if (Object.keys(relationFields).length > 0) {
      (builder as any).objectFields(type, (t: any) => {
        const result: Record<string, any> = {};
        for (const [name, factory] of Object.entries(relationFields)) {
          result[name] = factory(t);
        }

        return result;
      });
    }
  }
}
