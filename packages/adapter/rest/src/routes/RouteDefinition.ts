import type { Fields } from '@fougere/schema';
import { Card, Visibility } from '@fougere/schema';
import type { HttpMethod } from '@fougere/http';
import { RouteAddress, wordsOf, type Cardinality, type FougereFrondProtocols, type HandlerEntry as CoreHandlerEntry, type ProtocolConfig } from '@fougere/core';
import type { BindingPlan } from '@fougere/core/descriptor';
import type { OperationMeta } from './OperationMeta.js';
import type { GenerateRoutesOptions } from './GenerateRoutesOptions.js';
import { prefixOf, type RestRoute } from '../RestProtocol.js';

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
  /** Explicit success status, from `protocols.rest.status` — it wins over what the contract reads as. */
  successStatus?: number;
  /** How much the op answers — a page goes out as `{ items, total, hasMore, endCursor }`, a missing row as 404. */
  cardinality?: Cardinality;
  /** A POST on the collection answering one row: what it answers did not exist before, so 201. */
  creates?: boolean;
  /** The operation in words — the method's own doc sentence, carried by the contract. */
  description?: string;
  // No presenter here. A route used to carry the instance and its field names so the
  // registration could enrich each row; the façade does that for every facade now
  // (`PresenterExecutor`), so the rows arrive computed and a second pass was duplicated work.
}

/** Only what this projection reads of a scanned handler. */
type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface' | 'exposed'>;
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
  protocols?: FougereFrondProtocols;
}

interface AppLike {
  fronds: FrondLike[];
  /** What `fougere.config.ts` says to each protocol — where REST is mounted, a third party's routes. */
  protocols?: ProtocolConfig;
  /** The façade an address serves to one audience — `undefined` when none. */
  facadeFor(address: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(address: string, surface?: string): Map<string, OperationMeta> | undefined;
}

type HandlerFacade = Record<string, Function>;

// ─── Naming conventions ─────────────────────────

/** The five a Crud handler brings answer at the collection or the row, never under their own name. */
const CRUD = new Set(['list', 'findById', 'create', 'update', 'delete']);

function pluralize(name: string): string {
  return name.endsWith('y')
    ? name.slice(0, -1) + 'ies'
    : name + 's';
}

/** The verbs whose op makes the row it designates disappear — the one method still read off the name. */
const REMOVING = new Set(['delete', 'remove']);

/** Where a request puts what it carries — the path, the query string, the body. */
const CARRIED = new Set(['param', 'input', 'query']);

/**
 * What an op that designates one row does to it, read off its contract: hand the row whole — a
 * replacement — or hand what changes, a `Partial<Post>` or parameters that are all its fields.
 * Those `fields` travel in the body: the path designates, the body carries the change.
 */
interface Change {
  kind: 'replacement' | 'modification';
  fields: string[];
}

function changeOf({ binding = [], input }: OperationMeta): Change | undefined {
  const designated = new Set(binding.flatMap(({ source }) => (source.kind === 'param' && source.identifies ? [source.identifies] : [])));
  if (designated.size !== 1) return undefined;
  const [entity] = designated;

  const carried = binding.filter(({ source }) => CARRIED.has(source.kind) && !(source.kind === 'param' && source.identifies));
  if (carried.some(({ source }) => source.kind === 'input')) {
    if (!input || Card.titleOf(input) !== entity) return undefined;
    if (input.getOpts().patch) return { kind: 'modification', fields: [] };

    return input.derivation ? undefined : { kind: 'replacement', fields: [] };
  }

  const fields = carried.flatMap(({ source }) => (source.kind === 'param' && source.field?.entity === entity ? [source.name] : []));

  return fields.length > 0 && fields.length === carried.length ? { kind: 'modification', fields } : undefined;
}

/**
 * Read off the contract: a query is a GET, an op whose verb removes the row a DELETE, a change of
 * one row a PATCH or a PUT — and anything else a POST, which promises nothing and so cannot lie.
 */
function deriveMethod(opName: string, meta: OperationMeta): HttpMethod {
  if (!meta.kind) {
    throw new Error(
      `REST cannot project '${opName}' without its resolved operation kind. `
      + 'Build routes from App.operationsFor(), the EffectiveOperation table produced by core.',
    );
  }
  if (meta.kind === 'query') return 'GET';
  if (REMOVING.has(wordsOf(opName)[0] ?? '')) return 'DELETE';

  const change = changeOf(meta)?.kind;
  if (change === 'modification') return 'PATCH';

  return change === 'replacement' ? 'PUT' : 'POST';
}

/**
 * Read off the signature: what designates a row comes before the op, the other required values
 * after it, and an optional one is left to the query string — save the fields a change carries,
 * which the body holds. `publish(id: Post['id'])` → `/posts/:id/publish`,
 * `move(id: Post['id'], position: number)` → `/posts/:id/move/:position`,
 * `retitle(id: Post['id'], title: Post['title'])` → `/posts/:id/retitle`, `byTag(tag: string)` → `/posts/by-tag/:tag`.
 */
function derivePath(address: string, opName: string, binding: BindingPlan = [], inBody: string[] = []): string {
  const required = binding.flatMap(({ source, optional }) =>
    source.kind === 'param' && !optional && !inBody.includes(source.name) ? [source] : []);
  const designating = required.filter((param) => param.identifies);
  const following = required.filter((param) => !param.identifies);
  const named = CRUD.has(opName) ? [] : [opName.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())];

  return ['', pluralize(address), ...designating.map(segmentOf), ...named, ...following.map(segmentOf)].join('/');
}

function designates(binding: BindingPlan = []): boolean {
  return binding.some(({ source }) => source.kind === 'param' && Boolean(source.identifies));
}

function segmentOf({ name }: { name: string }): string {
  return `:${name}`;
}

// ─── Public API ─────────────────────────────────

/** Generate REST route definitions from a fougere App — one route per operation, per address served. */
export function generateRoutes(app: AppLike, options: GenerateRoutesOptions = {}): RouteDefinition[] {
  return app.fronds.flatMap((frond) =>
    [...new Set(frond.handlers.map((handler) => handler.address))]
      .flatMap((address) => routesOf(app, frond, address, options)));
}

/** `/api/blog` — where the app mounts REST, then the segment the frond answers under. */
function baseOf(app: AppLike, frond: FrondLike): string {
  const segment = frond.protocols?.rest?.path ?? `/${frond.name}`;

  return prefixOf(app.protocols) + segment;
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

  // The resolved table defines the public operation set. This also works for remote proxy
  // facades, which intentionally cannot enumerate their keys before discovery.
  return [...effectiveOperations.keys()].map((opName) => routeFor({
    address,
    base: baseOf(app, frond),
    facade,
    opName,
    meta: effectiveOperations.get(opName),
    thirdParty: app.protocols?.rest?.overrides?.[new RouteAddress({ address, operation: opName }).toString()],
  }));
}

/** One operation at one address, and everything that decides how it is addressed. */
interface Projecting {
  address: string;
  /** `/api/blog` — what every path of this frond starts with. */
  base: string;
  facade: HandlerFacade;
  opName: string;
  meta: OperationMeta | undefined;
  /** What `fougere.config.ts` says of this op — only ever a frond the project cannot edit. */
  thirdParty: RestRoute | undefined;
}

function routeFor({ address, base, facade, opName, meta, thirdParty }: Projecting): RouteDefinition {
  if (!meta) {
    throw new Error(
      `REST facade '${address}' exposes '${opName}' but its EffectiveOperation table does not.`,
    );
  }

  // What the app said of a frond it cannot edit, then what the frond said, then the contract.
  const override: RestRoute = { ...meta.protocols?.rest, ...thirdParty };

  // Handler and method overrides are already executed by the facade, from the same
  // EffectiveOperation local and RPC use. The adapter never resolves DI itself.
  const op = facade[opName];
  if (typeof op !== 'function') {
    throw new Error(`REST EffectiveOperation table exposes '${opName}' but its facade does not.`);
  }

  const method = override.method ?? deriveMethod(opName, meta);

  return {
    method,
    path: base + (override.path ?? derivePath(address, opName, meta.binding, changeOf(meta)?.fields)),
    operationName: opName,
    address,
    handler: (invocation) => op(invocation),
    ...inputAndOutput(meta),
    successStatus: override.status,
    cardinality: meta.cardinality,
    creates: method === 'POST' && meta.cardinality === 'one' && !designates(meta.binding),
    ...(meta.description && { description: meta.description }),
  };
}

/** Both pass through the client-surface projections — write-only out, read-only in. */
function inputAndOutput(meta: OperationMeta): { inputFields: Fields | undefined; outputFields: Fields | undefined } {
  return {
    inputFields: meta.input ? Visibility.of(meta.input.getFields()).input : undefined,
    outputFields: meta.output ? Visibility.of(meta.output.getFields()).output : undefined,
  };
}
