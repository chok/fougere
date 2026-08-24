import { classNameOf, primaryFieldOf, Role } from '@fougere/schema';
/**
 * Auto-register GraphQL types and operations from a fougere App.
 *
 * Reads scanned entities + handler facades and registers
 * types, inputs, queries and mutations automatically.
 * Respects handler method-based contracts and surfaces config.
 *
 * Relations (ref/many) are auto-wired between registered types.
 */
import type SchemaBuilder from '@pothos/core';
import type { Fields, SchemaView, SchemaOrCard } from '@fougere/schema';
import { Anatomy, fieldsOf, } from '@fougere/schema';
import { registerType, registerOperations } from './pothos.js';

type HandlerFacade = Record<string, Function>;

/**
 * The relation a foreign key points at — `authorId → author`, `user_id → user`.
 * Returns undefined when the field carries no id suffix at all: there is nothing to
 * derive, and taking the scalar's own name would collide with it.
 */
function relationNameFor(fieldName: string): string | undefined {
  const stripped = fieldName.replace(/(_id|Id|ID)$/, '');
  return stripped && stripped !== fieldName ? stripped : undefined;
}

/**
 * The field a target is keyed by — what a batch read indexes its answer on. The shape
 * answers the absence and this door defaults it: `id` is what a node id falls back to.
 */
function primaryNameOf(fields: Fields): string {
  return primaryFieldOf(fields) ?? 'id';
}

interface Batch {
  keys: Set<string>;
  rows: Promise<Map<string, any>>;
}

/** The batch of ONE direction — the two sides of a relation must not share a read. */
const directionKey = (entity: string, field: string) => `${entity}#${field}`;

/**
 * How many keys go into one `list` call.
 *
 * A page has no ceiling, and `list` is the one read the ORM refuses to split (a limit
 * and an order do not recompose across statements). So the slicing happens HERE, where
 * the answer is a map being assembled and slices merge for free. Below SQL Server's
 * 2100 bindings, the lowest of the four engines — this side does not know the dialect,
 * so it takes the floor rather than guessing.
 */
const KEYS_PER_READ = 1000;

/** Read a key set in slices, merging what each answers. */
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

/** A key answers one row: a later slice never contradicts an earlier one. */
const keepEach = <R>(into: Map<string, R>, from: Map<string, R>) => {
  for (const [key, value] of from) into.set(key, value);
};

/** A key answers a group: slices of the SAME key concatenate. */
const concatEach = (into: Map<string, any[]>, from: Map<string, any[]>) => {
  for (const [key, rows] of from) {
    const held = into.get(key);
    if (held) held.push(...rows); else into.set(key, rows);
  }
};

/**
 * The keys asked for during one tick, answered by one read.
 *
 * graphql-js calls a field resolver once per parent, so a page of 50 rows asked for
 * its relation 50 times — measured, with 5 distinct keys behind those 50 calls. The
 * keys of a tick are collected and answered together, which is the shape the framework
 * already imposes one level up: a presenter receives the PAGE (`egress.ts`).
 *
 * Scoped by the request's context object, which graphql-js hands identically to every
 * resolver of one request and never shares with another — two callers must never be
 * answered out of one read. When there is no context (a resolver called directly, as
 * the tests do), the scope is a shared object and the tick alone bounds the batch.
 */
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
    // The next microtask: every sibling resolver of the page has run by then, so
    // their keys travel together. Closed first, so the following tick opens a new one.
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

// ─── Types ──────────────────────────────────────

interface OperationMeta {
  input?: SchemaView;
  output?: SchemaView;
  kind: 'query' | 'command';
  binding?: {
    name: string;
    optional: boolean;
    source:
      | { kind: 'collector' | 'context' | 'fact' }
      | { kind: 'param'; name: string }
      | { kind: 'body' | 'query' };
  }[];
  signature?: {
    name: string;
    params: { name: string; type: { raw: string; name: string; array?: boolean; nullable?: boolean; undefined?: boolean; generics?: any[] }; optional?: boolean }[];
    returnType?: { raw: string; name: string; array?: boolean; nullable?: boolean; undefined?: boolean; generics?: any[] };
  };
}

interface EntityEntry {
  name: string;
  /** A live class in-process, a card from a frond whose class never crossed. */
  entityClass: SchemaOrCard;
  exposed?: boolean;
}

interface HandlerEntry {
  /** The name the door answers to — `PostHandler` → `post`. NOT an entity name: a handler may carry none. */
  address: string;
  operations: Map<string, OperationMeta>;
  surface?: string;
  outputOverride?: SchemaView;
  /** `name` is the class's own — it names the handler when two ops claim one root field. */
  ctor?: { __output?: SchemaView; name?: string };
}

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
  surfaces?: Record<string, string[]>;
  operationsOverrides?: Record<string, {
    graphql?: string;
  }>;
}

interface AppLike {
  fronds: FrondLike[];
  /** The façade an entity exposes to one audience — `undefined` when none. */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(entity: string, surface?: string): Map<string, OperationMeta> | undefined;
  /**
   * The presenter of an entity — `undefined` when none. Asked for rather than
   * resolved by a key spelled here: this adapter used to build `${Name}Presenter`
   * itself, and a convention respelled in two places drifts silently on the day it
   * changes, exactly as `facadeFor` exists to prevent for doors.
   */
  presenterFor(entity: string): unknown | undefined;
}

// ─── Helpers ────────────────────────────────────

/**
 * The key an entity is filed under — case-folded, because the same entity is spelled
 * differently depending on where its name came from: the scan yields the registration name
 * (`authorUser`), while a card's relation target is fully lowercased by `describe`
 * (`authoruser`). Folding both is what lets one registry serve both sources.
 */
function registryKey(entityName: string): string {
  return entityName.toLowerCase();
}

/**
 * The key a relation points at. A live entity class answers with its class name; a target
 * rebuilt from a lone card is a `{ name }` stand-in and answers with the name `describe`
 * wrote. Both are names, which is the whole reason this resolves by name.
 */
function targetKey(target: unknown): string {
  return registryKey(String((target as { name?: string } | undefined)?.name ?? ''));
}

// ─── Public API ─────────────────────────────────

export interface RegisterAllOptions {
  /** Override which entities to expose. Default: all scanned entities with a handler. */
  filter?: (entity: EntityEntry, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'graphql', 'rest'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}

/**
 * Auto-register GraphQL types and operations for all entities
 * in the app that have a matching handler facade.
 *
 * Operations are driven by parsed handler signatures (from the scanner).
 * Relations (ref/many) are auto-wired between registered entity types.
 */
/**
 * The GraphQL type of a declared presenter view, built once per view class.
 *
 * Named after the field that emits it (`OrderItems`, `OrderUser`) rather than after the view
 * class, so two fields sharing one view still land on the same type and a view used twice is
 * registered once — Pothos refuses a duplicate type name and would take the schema down.
 */
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

export function registerAll(
  builder: InstanceType<typeof SchemaBuilder>,
  app: AppLike,
  options?: RegisterAllOptions,
): void {
  // Collect registered types across all fronds for relation wiring, keyed by entity NAME.
  //
  // The name is the identity everywhere else in the system — `facadeFor(entity)`,
  // `ormFor(entity)`, `schemaFor(entity)` all take one, and the table, the GraphQL type
  // and the DI match are all derived from it. This registry keyed by class OBJECT was the
  // lone dissent, and it cost a silent failure: a relation target that is not the very
  // object registered (an entity rebuilt from a card, whose `to()` leaves a `{ name }`
  // stand-in) missed the lookup, hit `if (!targetEntry) continue`, and the relation
  // vanished from the schema without a word. `schema-sql` already resolved by name.
  const typeRegistry = new Map<
    string,
    {
      name: string;
      type: any;
      facade: HandlerFacade;
      presenterFields: Set<string>;
      /** The entity's OWN fields — pass 2 wires relations from these, not from an output view. */
      fields: Fields;
    }
  >();

  // ── Pass 1: register types + operations ────────

  for (const frond of app.fronds) {
    const handlerMap = new Map(frond.handlers.filter((h) => !h.surface).map((h) => [h.address, h]));
    const presenterMap = new Map((frond.presenters ?? []).map((p) => [p.entityName, p]));

    const surfaceName = options?.surface;

    for (const entity of frond.entities) {
      // Membership is core's answer, not ours — one rule, read here (see App.facadeFor).
      const facade = app.facadeFor(entity.name, surfaceName) as HandlerFacade | undefined;
      if (!facade) continue;

      if (options?.filter && !options.filter(entity, frond.name)) continue;
      if (!surfaceName && entity.exposed === false) continue;

      const handler = (surfaceName
        ? frond.handlers.find((h) => h.address === entity.name && h.surface === surfaceName)
        : undefined) ?? handlerMap.get(entity.name);
      const typeName = classNameOf(entity.name);

      const presenterMeta = presenterMap.get(entity.name);
      let presenter: Record<string, Function> | undefined;
      if (presenterMeta) {
        presenter = app.presenterFor(entity.name) as Record<string, Function> | undefined;
      }

      // Use handler's output schema if declared, otherwise entity
      const outputSchema = handler?.outputOverride
        ?? (handler?.ctor as any)?.__output
        ?? entity.entityClass;

      const type = registerType(builder, {
        name: typeName,
        entity: outputSchema as any,
        presenter: presenter as any,
        presenterFields: presenterMeta?.fields,
        presenterFieldMeta: presenterMeta?.fieldMeta,
        presenterViews: presenterMeta?.views as any,
        viewType: (view, fieldName) => viewTypeOf(builder, view, `${typeName}${classNameOf(fieldName)}`),
      });

      // Track for relation wiring. The presenter's computed field names travel too: pass 2
      // must not derive a relation over a name the author wrote.
      typeRegistry.set(registryKey(entity.name), {
        name: typeName, type, facade,
        presenterFields: new Set(presenterMeta?.fields ?? []),
        fields: fieldsOf(entity.entityClass),
      });

      const opOverrides = frond.operationsOverrides;

      const operations = app.operationsFor(entity.name, surfaceName);
      if (!operations) {
        throw new Error(
          `GraphQL cannot project '${entity.name}' without its EffectiveOperation table.`,
        );
      }

      registerOperations(builder, {
        name: typeName,
        type,
        facade,
        operations,
        operationsOverrides: opOverrides,
        // Named so a root-field clash can say WHICH two handlers, in which fronds.
        origin: `${frond.name}/${handler?.ctor?.name ?? `${typeName}Handler`}`,
        // What an op declares as its return becomes its GraphQL type — unless that IS
        // the entity's own schema, which already has one.
        viewType: (view, opName) =>
          view === outputSchema || view === entity.entityClass
            ? type
            : viewTypeOf(builder, view, `${typeName}${classNameOf(opName)}`),
      });
    }
  }

  // ── Pass 2: auto-wire relations (ref → N:1, many → 1:N) ──

  for (const [entityName, { type, fields, presenterFields }] of typeRegistry) {
    const relationFields: Record<string, (t: any) => any> = {};

    for (const [fieldName, field] of Object.entries(fields)) {
      if (Role.of(field).isReference) {
        const target = Role.of(field).target;
        if (!target) continue;
        const targetEntry = typeRegistry.get(targetKey(target));
        if (!targetEntry) continue;

        // authorId → author, user_id → user. Both spellings, because a foreign key
        // is named by its author and `/Id$/` alone left `user_id` untouched — the
        // relation then took the scalar's own name and Pothos refused the duplicate,
        // taking the WHOLE schema down with it.
        const relationName = relationNameFor(fieldName);
        // Nothing to strip, or the name is already taken by a field of the entity or by
        // a presenter's computed field: the author named it, the author wins. Deriving
        // over it would either crash the build or shadow what they wrote.
        if (!relationName || relationName in fields || presenterFields.has(relationName)) continue;
        const nullable = Anatomy.isNullable(field.shape);

        const targetKeyName = primaryNameOf(targetEntry.fields);
        const targetList = targetEntry.facade.list;
        relationFields[relationName] = (t: any) => t.field({
          type: targetEntry.type,
          nullable,
          resolve: (parent: any, _args: unknown, ctx: unknown) => {
            const fk = parent[fieldName];
            if (fk == null) return null;
            // A door that serves no list — a handler narrowed to `findById` — keeps the
            // row-at-a-time path rather than losing the relation entirely.
            if (typeof targetList !== 'function') {
              return targetEntry.facade.findById({ params: { id: fk }, query: {}, body: undefined, state: {} });
            }
            return loadByKey(ctx, directionKey(targetKey(target), targetKeyName), String(fk), (ids) =>
              // The door the `many` dual already uses, with a SET where it names one
              // value. Nothing new is published: a criterion learned to name several.
              readInSlices(ids, async (slice) => {
                const result = await targetList.call(targetEntry.facade, {
                  params: {}, query: { where: { [targetKeyName]: slice } }, body: undefined, state: {},
                }) as any;
                const rows = Array.isArray(result) ? result : result?.items ?? result?.data ?? [];
                return new Map<string, any>(rows.map((row: any) => [String(row?.[targetKeyName]), row]));
              }, keepEach),
            () => null);
          },
        });
      }

      if (Role.of(field).isCollection) {
        const target = Role.of(field).target;
        if (!target) continue;
        const targetEntry = typeRegistry.get(targetKey(target));
        if (!targetEntry) continue;

        // Trouver la FK inverse sur l'entité cible (la relation « one » qui pointe ici).
        // Read off the registry, not off the target object: a target rebuilt from a card is
        // a `{ name }` stand-in with no fields to walk, and the registry already holds them.
        const reverseFk = Object.entries(targetEntry.fields).find(
          ([, f]) => Role.of(f).isReference
            && targetKey(Role.of(f).target) === entityName,
        );
        if (!reverseFk) continue;

        const [reverseFkName] = reverseFk;

        relationFields[fieldName] = (t: any) => t.field({
          type: [targetEntry.type],
          resolve: (parent: any, _args: unknown, ctx: unknown) => {
            const id = parent.id;
            if (id == null) return [];
            // The same batch as its `one` dual, one query for the whole page — the two
            // directions differ only in what a key answers: one row there, a group here.
            //
            // `where` — un critère se nomme. Passé à la racine de la query, il retombait
            // dans les options de `list()`, qui ignore ce qu'elle ne connaît pas : la
            // relation rendait alors TOUTE la table cible, sans un mot.
            return loadByKey(ctx, directionKey(targetKey(target), reverseFkName), String(id), (ids) =>
              readInSlices(ids, async (slice) => {
                const result = await targetEntry.facade.list({
                  params: {}, query: { where: { [reverseFkName]: slice } }, body: undefined, state: {},
                }) as any;
                const rows = Array.isArray(result) ? result : result?.items ?? result?.data ?? [];
                const grouped = new Map<string, any[]>();
                for (const row of rows) {
                  const key = String(row?.[reverseFkName]);
                  const held = grouped.get(key);
                  if (held) held.push(row); else grouped.set(key, [row]);
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
