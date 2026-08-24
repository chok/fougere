/**
 * @fougere/adapter-rest — generates REST route definitions from fougere handlers.
 *
 * Framework-agnostic: produces RouteDefinition[], consumed by an adapter (Fastify, Express, etc).
 */
import type { Field, Fields, SchemaOrCard } from '@fougere/schema';
import { fieldsOf, inputFields as clientInputFields, outputFields as clientOutputFields } from '@fougere/schema';
import type { HandlerEntry as CoreHandlerEntry } from '@fougere/core';

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
  /** Explicit success status. Defaults to 201 only for the canonical `create` op. */
  successStatus?: number;
  /**
   * The operation in words — the method's own doc sentence, carried by the contract.
   *
   * A route is what an OpenAPI `summary` is generated FROM, and the sentence reached
   * this file already through core's `EffectiveOperation` table;
   * only this type had no name for it, so every generated route was undocumented while
   * the sentence sat one property away. Carried, not rendered: emitting OpenAPI is a
   * reader's job, and this is what it reads.
   */
  description?: string;
  // No presenter here. A route used to carry the instance and its field names so the
  // registration could enrich each row; the façade does that for every door now
  // (`presentEgress`), so the rows arrive computed and a second pass was duplicated work.
}

interface OperationMeta {
  input?: SchemaOrCard;
  output?: SchemaOrCard;
  /** Canonical kind from core's EffectiveOperation. */
  kind: 'query' | 'command';
  /** The operation in words — see `RouteDefinition.description`. */
  description?: string;
}

interface EntityEntry {
  name: string;
  /** A live class in-process, a card from a frond whose class never crossed. */
  entityClass: SchemaOrCard;
  exposed?: boolean;
}

/**
 * Only what this projection reads of a scanned handler — five fields of nine.
 *
 * The narrowness is deliberate: a consumer that declares what it consumes accepts a
 * minimal literal in a test and does not break when a field it ignores moves. What was
 * NOT deliberate is that the two names it does read were spelled again here, so renaming
 * `entityName` to `address` in core left this file compiling against a field the runtime
 * object no longer carried — a silent break, caught only because the same commit touched
 * the reads. `Pick` keeps the narrow view and makes core the one place the names live.
 *
 * `schema-graphql` holds a copy of this shape and cannot do the same: it depends on
 * `@fougere/schema` and `@fougere/http`, never on core, which is what lets a projection
 * package stay structurally typed. There the duplication is the doctrine, not an oversight.
 */
type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface'> & {
  /** `Crud(Post, PostPublic)` — the handler-wide output view, scoping every op. */
  outputOverride?: SchemaOrCard;
  /**
   * The scanned constructor, which carries the same statement made on the class.
   *
   * Typed as a constructor that MAY carry the static, not as `{ __output?: … }` alone:
   * a type whose every property is optional is weak, and TS refuses a constructor that
   * happens not to carry it — *has no properties in common*. So the narrow view was
   * unassignable from the real entry for a second reason after `operations`.
   */
  ctor?: (new (...args: never[]) => unknown) & { __output?: SchemaOrCard };
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
// Membership is the axes-derived `inputFields` projection from @fougere/schema.

// ─── Public API ─────────────────────────────────

export interface GenerateRoutesOptions {
  /** Base path prefix (e.g. '/api'). Default: ''. */
  prefix?: string;
  /** Override route config per entity. */
  overrides?: Record<string, Record<string, { method?: HttpMethod; path?: string; status?: number }>>;
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
    const handlerMap = new Map(frond.handlers.filter((h) => !h.surface).map((h) => [h.address, h]));

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
      const effectiveOperations = app.operationsFor(entity.name, surfaceName);
      if (!effectiveOperations) {
        throw new Error(
          `REST cannot project '${entity.name}' without its EffectiveOperation table.`,
        );
      }
      // The resolved table defines the public operation set. This also works for remote
      // proxy facades, which intentionally cannot enumerate their keys before discovery.
      const opNames = [...effectiveOperations.keys()];
      const entityOverrides = overrides[entity.name] ?? {};
      // Use handler's output schema if declared, otherwise entity. A live class or a
      // card — `fieldsOf` takes both, so a frond whose class never crossed the wire
      // projects the same routes as a local one.
      const outputSchema: SchemaOrCard = handler?.outputOverride
        ?? handler?.ctor?.__output
        ?? entity.entityClass;
      const fields = fieldsOf(outputSchema);

      for (const opName of opNames) {
        const meta = effectiveOperations.get(opName);
        if (!meta) {
          throw new Error(
            `REST facade '${entity.name}' exposes '${opName}' but its EffectiveOperation table does not.`,
          );
        }
        const override = entityOverrides[opName];
        const method = override?.method ?? deriveMethod(opName, meta?.kind);
        const path = prefix + (override?.path ?? derivePath(entity.name, opName));

        // Input/output fields: use meta if available, fallback to entity fields for CRUD.
        // Both pass through the client-surface projections (write-only out, read-only in).
        let inputFields: Fields | undefined;
        let outputFields: Fields | undefined = clientOutputFields(fields);
        if (meta?.input) {
          inputFields = fieldsOf(meta.input);
        } else if (opName === 'create' || opName === 'update') {
          inputFields = clientInputFields(fields);
        }
        if (meta?.output) outputFields = clientOutputFields(fieldsOf(meta.output));

        // Handler/method overrides are already executed by the facade from the same
        // EffectiveOperation local and RPC use. The adapter never resolves DI itself.
        const op = facade[opName];
        if (typeof op !== 'function') {
          throw new Error(
            `REST EffectiveOperation table exposes '${opName}' but its facade does not.`,
          );
        }

        routes.push({
          method,
          path,
          operationName: opName,
          entityName: entity.name,
          handler: (invocation) => op(invocation),
          inputFields,
          outputFields,
          successStatus: override?.status,
          ...(meta?.description && { description: meta.description }),
        });
      }
    }
  }

  return routes;
}
