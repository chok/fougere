import type { Fields, SchemaView } from '@fougere/schema';
import { Visibility } from '@fougere/schema';
import type { HttpMethod } from '@fougere/http';
import type { HandlerEntry as CoreHandlerEntry } from '@fougere/core';
import type { OperationMeta } from './OperationMeta.js';
import type { GenerateRoutesOptions } from './GenerateRoutesOptions.js';

export interface RouteDefinition {
  method: HttpMethod;
  path: string;
  operationName: string;
  /** Where the operation answers — `checkout` in `checkout.pay`. */
  address: string;
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
type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface' | 'exposed'> & {
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
  handlers: HandlerEntry[];
  presenters: PresenterEntry[];
  surfaces?: Record<string, string[]>;
  /** What `frond.config.ts` said per op — `rest:` is read here, `graphql:` next facade. */
  operationsOverrides?: Record<string, { rest?: { method?: string; path?: string; status?: number } }>;
}

interface AppLike {
  fronds: FrondLike[];
  /** The façade an address serves to one audience — `undefined` when none. */
  facadeFor(address: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(address: string, surface?: string): Map<string, OperationMeta> | undefined;
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

/** Derive route path from the address + operation name. */
function derivePath(address: string, opName: string): string {
  const base = `/${pluralize(address)}`;

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

/** Generate REST route definitions from a fougere App — one route per operation, per address served. */
export function generateRoutes(app: AppLike, options: GenerateRoutesOptions = {}): RouteDefinition[] {
  return app.fronds.flatMap((frond) =>
    [...new Set(frond.handlers.map((handler) => handler.address))]
      .flatMap((address) => routesOf(app, frond, address, options)));
}

/** What one address answers on REST — nothing, when this surface does not serve it. */
function routesOf(
  app: AppLike,
  frond: FrondLike,
  address: string,
  options: GenerateRoutesOptions,
): RouteDefinition[] {
  const surface = options.surface;
  // Membership is core's answer, not ours — one rule, read here (see App.facadeFor).
  const facade = app.facadeFor(address, surface) as HandlerFacade | undefined;
  if (!facade) return [];
  if (options.filter && !options.filter(address, frond.name)) return [];

  const handler = (surface
    ? frond.handlers.find((one) => one.address === address && one.surface === surface)
    : undefined) ?? frond.handlers.find((one) => !one.surface && one.address === address);
  if (!surface && handler?.exposed === false) return [];

  const effectiveOperations = app.operationsFor(address, surface);
  if (!effectiveOperations) {
    throw new Error(`REST cannot project '${address}' without its EffectiveOperation table.`);
  }

  // `Crud(Post, PostPublic)` scopes every op of the handler; an op that states its own view wins.
  const view: SchemaView | undefined = handler?.outputOverride ?? handler?.ctor?.__output;

  // The resolved table defines the public operation set. This also works for remote proxy
  // facades, which intentionally cannot enumerate their keys before discovery.
  return [...effectiveOperations.keys()].map((opName) => routeFor({
    address,
    frond,
    facade,
    view,
    opName,
    meta: effectiveOperations.get(opName),
    options,
  }));
}

/** One operation at one address, and everything that decides how it is addressed. */
interface Projecting {
  address: string;
  frond: FrondLike;
  facade: HandlerFacade;
  view: SchemaView | undefined;
  opName: string;
  meta: OperationMeta | undefined;
  options: GenerateRoutesOptions;
}

function routeFor({ address, frond, facade, view, opName, meta, options }: Projecting): RouteDefinition {
  if (!meta) {
    throw new Error(
      `REST facade '${address}' exposes '${opName}' but its EffectiveOperation table does not.`,
    );
  }

  // What the FROND said, then what this call said, then the convention. The frond comes first
  // because it names the operation; a host that overrides is deciding for someone else's,
  // which is what `overrides:` is for and why it wins.
  const stated = frond.operationsOverrides?.[opName]?.rest as
    { method?: HttpMethod; path?: string; status?: number } | undefined;
  const override = { ...stated, ...(options.overrides?.[address] ?? {})[opName] } as
    { method?: HttpMethod; path?: string; status?: number };

  // Handler and method overrides are already executed by the facade, from the same
  // EffectiveOperation local and RPC use. The adapter never resolves DI itself.
  const op = facade[opName];
  if (typeof op !== 'function') {
    throw new Error(`REST EffectiveOperation table exposes '${opName}' but its facade does not.`);
  }

  return {
    method: override.method ?? deriveMethod(opName, meta.kind),
    path: (options.prefix ?? '') + (override.path ?? derivePath(address, opName)),
    operationName: opName,
    address,
    handler: (invocation) => op(invocation),
    ...inputAndOutput(meta, view),
    successStatus: override.status,
    ...(meta.description && { description: meta.description }),
  };
}

/** Both pass through the client-surface projections — write-only out, read-only in. */
function inputAndOutput(
  meta: OperationMeta,
  view: SchemaView | undefined,
): { inputFields: Fields | undefined; outputFields: Fields | undefined } {
  const output = meta.output ?? view;

  return {
    inputFields: meta.input ? Visibility.of(meta.input.getFields()).input : undefined,
    outputFields: output ? Visibility.of(output.getFields()).output : undefined,
  };
}
