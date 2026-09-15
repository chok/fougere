import type { Fields, SchemaView } from '@fougere/schema';
import { Visibility } from '@fougere/schema';
import type { HttpMethod } from '@fougere/http';
import type { HandlerEntry as CoreHandlerEntry } from '@fougere/core';
import type { EntityEntry } from './EntityEntry.js';
import type { OperationMeta } from './OperationMeta.js';
import type { GenerateRoutesOptions } from './GenerateRoutesOptions.js';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  operationName: string;
  entityName: string;
  /** Handler facade method to call (receives InvocationContext). */
  handler: (invocation: unknown) => Promise<unknown>;
  /** Input schema (for validation / JSON schema generation). */
  inputFields?: Fields;
  /** Output schema (for JSON schema generation). */
  outputFields?: Fields;
  /** Explicit success status. Defaults to 201 only for the canonical `create` op. */
  successStatus?: number;
  /** The operation in words — the method's own doc sentence, carried by the contract. */
  description?: string;
  // No presenter here. A route used to carry the instance and its field names so the
  // registration could enrich each row; the façade does that for every facade now
  // (`PresenterExecutor`), so the rows arrive computed and a second pass was duplicated work.
}

/** Only what this projection reads of a scanned handler — five fields of nine. */
type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface'> & {
  /** `Crud(Post, PostPublic)` — the handler-wide output view, scoping every op. */
  outputOverride?: SchemaView;
  /** The scanned constructor, which carries the same statement made on the class. */
  ctor?: (new (...args: never[]) => unknown) & { __output?: SchemaView };
};
// No `operations` here, and its absence is the point. It was declared, never read — this
// file takes its table from `app.operationsFor()` — and it carried `OperationMeta`, whose
// `kind` is REQUIRED because that is true of an EffectiveOperation. A scanned handler's
// contract leaves `kind` empty, so the narrow type was not a supertype of the real one and
// `generateRoutes(app)` did not typecheck against a real `App`. The framework's own caller
// wrote `generateRoutes(app as never, …)`, and the tests only ever passed narrow literals,
// so nothing caught it. Declaring what you consume means not declaring the rest.

interface PresenterEntry {
  entityName: string;
  fields: string[];
}

interface FrondLike {
  name: string;
  entities: EntityEntry[];
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  surfaces?: Record<string, string[]>;
  /** What `frond.config.ts` said per op — `rest:` is read here, `graphql:` next facade. */
  operationsOverrides?: Record<string, { rest?: { method?: string; path?: string; status?: number } }>;
}

interface AppLike {
  fronds: FrondLike[];
  /** The façade an entity exposes to one audience — `undefined` when none. */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(entity: string, surface?: string): Map<string, OperationMeta> | undefined;
}

type HandlerFacade = Record<string, Function>;

// ─── Naming conventions ─────────────────────────

function hasById(name: string): boolean {
  return name.includes('ById') || name === 'findById' || name === 'update' || name === 'delete';
}

function pluralize(name: string): string {
  return name.endsWith('y')
    ? name.slice(0, -1) + 'ies'
    : name + 's';
}

/** Derive HTTP method from operation name, honoring frond.config.ts overrides. */
function deriveMethod(
  opName: string,
  resolvedKind: OperationMeta['kind'],
): HttpMethod {
  if (!resolvedKind) {
    throw new Error(
      `REST cannot project '${opName}' without its resolved operation kind. `
      + 'Build routes from App.operationsFor(), the EffectiveOperation table produced by core.',
    );
  }
  if (resolvedKind === 'query') return 'GET';
  if (opName.startsWith('create')) return 'POST';
  if (opName.startsWith('update') || opName.startsWith('edit')) return 'PUT';
  if (opName.startsWith('delete') || opName.startsWith('remove')) return 'DELETE';
  return 'POST';
}

/** Derive route path from entity name + operation name. */
function derivePath(entityName: string, opName: string): string {
  const base = `/${pluralize(entityName)}`;

  // Standard CRUD
  if (opName === 'list') return base;
  if (opName === 'findById') return `${base}/:id`;
  if (opName === 'create') return base;
  if (opName === 'update') return `${base}/:id`;
  if (opName === 'delete') return `${base}/:id`;

  // Remaining operations (convention-based)
  const withId = hasById(opName);
  const cleanName = opName.replace('ById', '');
  const segment = cleanName.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase());

  return withId ? `${base}/:id/${segment}` : `${base}/${segment}`;
}

// ─── Route generation helpers ───────────────────

// Update routes carry the SAME fields: input omissibility is a projection of the
// route's MODE (operationName 'update' → patch), never forged per-field flags.
// Membership is the axes-derived `Visibility.input` projection from @fougere/schema.

// ─── Public API ─────────────────────────────────

/** Generate REST route definitions from a fougere App. */
export function generateRoutes(app: AppLike, options: GenerateRoutesOptions = {}): RouteDefinition[] {
  return app.fronds.flatMap((frond) =>
    frond.entities.flatMap((entity) => routesOf(app, frond, entity, options)));
}

/** What one entity answers on REST — nothing, when this surface does not serve it. */
function routesOf(
  app: AppLike,
  frond: FrondLike,
  entity: EntityEntry,
  options: GenerateRoutesOptions,
): RouteDefinition[] {
  const surface = options.surface;
  // Membership is core's answer, not ours — one rule, read here (see App.facadeFor).
  const facade = app.facadeFor(entity.name, surface) as HandlerFacade | undefined;
  if (!facade) return [];
  if (options.filter && !options.filter(entity, frond.name)) return [];
  if (!surface && entity.exposed === false) return [];

  const effectiveOperations = app.operationsFor(entity.name, surface);
  if (!effectiveOperations) {
    throw new Error(`REST cannot project '${entity.name}' without its EffectiveOperation table.`);
  }

  const handler = (surface
    ? frond.handlers.find((one) => one.address === entity.name && one.surface === surface)
    : undefined) ?? frond.handlers.find((one) => !one.surface && one.address === entity.name);
  // The handler's output schema if declared, otherwise the entity. A frond whose class never
  // crossed the wire arrives as one too: boot rebuilds the card before here.
  const outputSchema: SchemaView = handler?.outputOverride ?? handler?.ctor?.__output ?? entity.entityClass;

  // The resolved table defines the public operation set. This also works for remote proxy
  // facades, which intentionally cannot enumerate their keys before discovery.
  return [...effectiveOperations.keys()].map((opName) => routeFor({
    entity,
    frond,
    facade,
    fields: outputSchema.getFields(),
    opName,
    meta: effectiveOperations.get(opName),
    options,
  }));
}

/** One operation of one entity, and everything that decides how it is addressed. */
interface Projecting {
  entity: EntityEntry;
  frond: FrondLike;
  facade: HandlerFacade;
  fields: Fields;
  opName: string;
  meta: OperationMeta | undefined;
  options: GenerateRoutesOptions;
}

function routeFor({ entity, frond, facade, fields, opName, meta, options }: Projecting): RouteDefinition {
  if (!meta) {
    throw new Error(
      `REST facade '${entity.name}' exposes '${opName}' but its EffectiveOperation table does not.`,
    );
  }

  // What the FROND said, then what this call said, then the convention. The frond comes first
  // because it names the operation; a host that overrides is deciding for someone else's,
  // which is what `overrides:` is for and why it wins.
  const stated = frond.operationsOverrides?.[opName]?.rest as
    { method?: HttpMethod; path?: string; status?: number } | undefined;
  const override = { ...stated, ...(options.overrides?.[entity.name] ?? {})[opName] } as
    { method?: HttpMethod; path?: string; status?: number };

  // Handler and method overrides are already executed by the facade, from the same
  // EffectiveOperation local and RPC use. The adapter never resolves DI itself.
  const op = facade[opName];
  if (typeof op !== 'function') {
    throw new Error(`REST EffectiveOperation table exposes '${opName}' but its facade does not.`);
  }

  return {
    method: override.method ?? deriveMethod(opName, meta.kind),
    path: (options.prefix ?? '') + (override.path ?? derivePath(entity.name, opName)),
    operationName: opName,
    entityName: entity.name,
    handler: (invocation) => op(invocation),
    ...inputAndOutput(meta, fields, opName),
    successStatus: override.status,
    ...(meta.description && { description: meta.description }),
  };
}

/** Both pass through the client-surface projections — write-only out, read-only in. */
function inputAndOutput(
  meta: OperationMeta,
  fields: Fields,
  opName: string,
): { inputFields: Fields | undefined; outputFields: Fields | undefined } {
  const inputFields = meta.input?.getFields()
    ?? (opName === 'create' || opName === 'update' ? Visibility.of(fields).input : undefined);

  return {
    inputFields,
    outputFields: meta.output ? Visibility.of(meta.output.getFields()).output : Visibility.of(fields).output,
  };
}
