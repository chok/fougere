/**
 * @fougere/schema-rest — generates REST route definitions from fougere handlers.
 *
 * Framework-agnostic: produces RouteDefinition[], consumed by an adapter (Fastify, Express, etc).
 */
import type { Field, Fields, SchemaLike } from '@fougere/schema';
import { inputFields as clientInputFields, outputFields as clientOutputFields } from '@fougere/schema';
import { resolveIsReadOp } from '@fougere/core';

// ─── Types ──────────────────────────────────────

// Le vocabulaire des verbes appartient au routeur, pas à la projection : le redéclarer ici
// avait produit deux listes à tenir d'accord à la main, qui ont divergé au premier verbe ajouté.
export type { HttpMethod } from '@fougere/http';
import type { HttpMethod } from '@fougere/http';

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
  /** Presenter instance for computed fields (resolved from DI). */
  presenter?: Record<string, (parent: any) => any>;
  /** Computed field names from the presenter. */
  presenterFieldNames?: string[];
}

interface OperationMeta {
  input?: SchemaLike;
  output?: SchemaLike;
}

interface EntityEntry {
  name: string;
  entityClass: SchemaLike;
  exposed?: boolean;
}

interface HandlerEntry {
  entityName: string;
  operations: Map<string, OperationMeta>;
}

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
  operationsOverrides?: Record<string, {
    kind?: 'query' | 'command';
    handlerName?: string;
    method?: string;
    policy?: string;
  }>;
}

interface AppLike {
  fronds: FrondLike[];
  resolve<T>(name: string): T;
  /** The façade an entity exposes to one audience — `undefined` when none. */
  facadeFor(entity: string, surface?: string): Record<string, Function> | undefined;
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
  overrides?: Record<string, { kind?: 'query' | 'command' }>,
): HttpMethod {
  if (resolveIsReadOp(opName, overrides)) return 'GET';
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
// Membership is the axes-derived `inputFields` projection from @fougere/schema.

// ─── Public API ─────────────────────────────────

export interface GenerateRoutesOptions {
  /** Base path prefix (e.g. '/api'). Default: ''. */
  prefix?: string;
  /** Override route config per entity. */
  overrides?: Record<string, Record<string, { method?: HttpMethod; path?: string }>>;
  /** Filter entities. */
  filter?: (entity: EntityEntry, frondName: string) => boolean;
  /** Surface name for filtering (e.g. 'rest', 'graphql'). Uses frond.config.ts surfaces if set. */
  surface?: string;
}

/**
 * Generate REST route definitions from a fougere App.
 *
 * Conventions:
 * - Entity name → pluralized base path (/posts, /authors)
 * - list → GET /posts
 * - findById → GET /posts/:id
 * - create → POST /posts
 * - update → PUT /posts/:id
 * - delete → DELETE /posts/:id
 * - Custom: searchByTitle → GET /posts/search-by-title
 * - Custom with ById: archiveById → POST /posts/:id/archive
 * - Override any route via options.overrides
 */
export function generateRoutes(app: AppLike, options?: GenerateRoutesOptions): RouteDefinition[] {
  const prefix = options?.prefix ?? '';
  const overrides = options?.overrides ?? {};
  const routes: RouteDefinition[] = [];

  for (const frond of app.fronds) {
    const handlerMap = new Map(frond.handlers.filter((h: any) => !h.surface).map((h) => [h.entityName, h]));

    const surfaceName = options?.surface;

    for (const entity of frond.entities) {
      // Membership is core's answer, not ours — one rule, read here (see App.facadeFor).
      const facade = app.facadeFor(entity.name, surfaceName) as HandlerFacade | undefined;
      if (!facade) continue;

      if (options?.filter && !options.filter(entity, frond.name)) continue;
      if (!surfaceName && entity.exposed === false) continue;

      const handler = (surfaceName
        ? frond.handlers.find((h: any) => h.entityName === entity.name && h.surface === surfaceName)
        : undefined) ?? handlerMap.get(entity.name);
      // Use facade keys (includes inherited ops like CRUD), fallback to handler.operations
      const opNames = Object.keys(facade);
      const entityOverrides = overrides[entity.name] ?? {};
      // Use handler's output schema if declared, otherwise entity
      const outputSchema = (handler as any)?.outputOverride
        ?? (handler as any)?.ctor?.__output
        ?? entity.entityClass;
      const fields = outputSchema.getFields();

      // Resolve presenter (if any)
      const presenterMap = new Map((frond.presenters ?? []).map((p) => [p.entityName, p]));
      const presenterMeta = presenterMap.get(entity.name);
      let presenter: Record<string, (parent: any) => any> | undefined;
      let presenterFieldNames: string[] | undefined;
      if (presenterMeta) {
        try {
          presenter = app.resolve<Record<string, Function>>(`${entity.name[0].toUpperCase()}${entity.name.slice(1)}Presenter`) as any;
          presenterFieldNames = presenterMeta.fields;
        } catch { /* no presenter */ }
      }

      for (const opName of opNames) {
        const meta = handler?.operations.get(opName);
        const override = entityOverrides[opName];
        const method = override?.method ?? deriveMethod(opName, frond.operationsOverrides);
        const path = prefix + (override?.path ?? derivePath(entity.name, opName));

        // Input/output fields: use meta if available, fallback to entity fields for CRUD.
        // Both pass through the client-surface projections (write-only out, read-only in).
        let inputFields: Fields | undefined;
        let outputFields: Fields | undefined = clientOutputFields(fields);
        if (meta?.input) {
          inputFields = meta.input.getFields();
        } else if (opName === 'create' || opName === 'update') {
          inputFields = clientInputFields(fields);
        }
        if (meta?.output) outputFields = clientOutputFields(meta.output.getFields());

        // Per-op handler override: redirect to a different class+method resolved from DI.
        const opOverride = frond.operationsOverrides?.[opName];
        let op: Function | undefined = facade[opName];
        if (opOverride?.handlerName) {
          try {
            const altFacade = app.resolve<HandlerFacade>(opOverride.handlerName);
            const altMethod = opOverride.method ?? opName;
            if (typeof altFacade[altMethod] === 'function') {
              op = altFacade[altMethod].bind(altFacade);
            }
          } catch { /* alternate handler not in DI — fall back to default */ }
        }
        if (!op) continue;

        routes.push({
          method,
          path,
          operationName: opName,
          entityName: entity.name,
          handler: (invocation) => op(invocation),
          inputFields,
          outputFields,
          presenter,
          presenterFieldNames,
        });
      }
    }
  }

  return routes;
}
