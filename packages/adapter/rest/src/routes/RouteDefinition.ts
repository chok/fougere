import type { Fields } from '@fougere/schema';
import { Card, Visibility, pluralOf } from '@fougere/schema';
import type { HttpMethod } from '@fougere/http';
import { listens, RouteAddress, wordsOf, type Cardinality, type FougereFrondProtocols, type HandlerEntry as CoreHandlerEntry, type ProtocolConfig } from '@fougere/core';
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
  /**
   * What the op may answer besides its own, as OpenAPI's `responses`.
   * Ex: a door link's redirect.
   */
  responses?: RestRoute['responses'];
  /** The operation in words — the method's own doc sentence, carried by the contract. */
  description?: string;
}

type HandlerEntry = Pick<CoreHandlerEntry, 'address' | 'surface' | 'exposed'>;

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

export interface AppLike {
  fronds: FrondLike[];
  /** What `fougere.config.ts` says to each protocol — where REST is mounted, a third party's routes. */
  protocols?: ProtocolConfig;
  /** The façade an address serves to one audience — `undefined` when none. */
  facadeFor(address: string, surface?: string): Record<string, Function> | undefined;
  /** Canonical operation table produced by core. */
  operationsFor(address: string, surface?: string): Map<string, OperationMeta> | undefined;
}

type HandlerFacade = Record<string, Function>;


const CRUD = new Set(['list', 'findById', 'create', 'update', 'delete']);

const REMOVING = new Set(['delete', 'remove']);

const CARRIED = new Set(['param', 'input', 'query']);

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

function derivePath(address: string, opName: string, binding: BindingPlan = [], inBody: string[] = []): string {
  const required = binding.flatMap(({ source, optional }) =>
    source.kind === 'param' && !optional && !inBody.includes(source.name) ? [source] : []);
  const designating = required.filter((param) => param.identifies);
  const following = required.filter((param) => !param.identifies);
  const named = CRUD.has(opName) ? [] : [opName.replace(/[A-Z]/g, (letter) => '-' + letter.toLowerCase())];

  return ['', pluralOf(address), ...designating.map(segmentOf), ...named, ...following.map(segmentOf)].join('/');
}

function designates(binding: BindingPlan = []): boolean {
  return binding.some(({ source }) => source.kind === 'param' && Boolean(source.identifies));
}

function segmentOf({ name }: { name: string }): string {
  return `:${name}`;
}


/** Generate REST route definitions from a fougere App — one route per operation, per address served. */
export function generateRoutes(app: AppLike, options: GenerateRoutesOptions = {}): RouteDefinition[] {
  return app.fronds.flatMap((frond) =>
    [...new Set(frond.handlers.map((handler) => handler.address))]
      .flatMap((address) => routesOf(app, frond, address, options)));
}

function baseOf(protocols: ProtocolConfig | undefined, frond: Pick<FrondLike, 'name' | 'protocols'>): string {
  const segment = frond.protocols?.rest?.path ?? `/${frond.name}`;

  return prefixOf(protocols) + segment;
}

function statedRoute(protocols: ProtocolConfig | undefined, address: string, opName: string, meta: OperationMeta): RestRoute {
  const thirdParty = protocols?.rest?.overrides?.[new RouteAddress({ address, operation: opName }).toString()];

  return { ...meta.protocols?.rest, ...thirdParty };
}

/** Where an operation answers on REST — what was stated, else what its contract derives. */
export function routeOf(
  protocols: ProtocolConfig | undefined,
  frond: Pick<FrondLike, 'name' | 'protocols'>,
  address: string,
  opName: string,
  meta: OperationMeta,
): Pick<RouteDefinition, 'method' | 'path'> {
  const stated = statedRoute(protocols, address, opName, meta);

  return {
    method: stated.method ?? deriveMethod(opName, meta),
    path: baseOf(protocols, frond) + (stated.path ?? derivePath(address, opName, meta.binding, changeOf(meta)?.fields)),
  };
}

function routesOf(
  app: AppLike,
  frond: FrondLike,
  address: string,
  options: GenerateRoutesOptions,
): RouteDefinition[] {
  const surface = options.surface;
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

  const served = (opName: string) => {
    const meta = effectiveOperations.get(opName);

    return meta?.placement !== 'remote' && !listens(meta ?? {});
  };

  return [...effectiveOperations.keys()].filter(served).map((opName) => routeFor({
    protocols: app.protocols,
    frond,
    address,
    facade,
    opName,
    meta: effectiveOperations.get(opName),
  }));
}

interface Projecting {
  protocols: ProtocolConfig | undefined;
  frond: FrondLike;
  address: string;
  facade: HandlerFacade;
  opName: string;
  meta: OperationMeta | undefined;
}

function routeFor({ protocols, frond, address, facade, opName, meta }: Projecting): RouteDefinition {
  if (!meta) {
    throw new Error(
      `REST facade '${address}' exposes '${opName}' but its EffectiveOperation table does not.`,
    );
  }

  const op = facade[opName];
  if (typeof op !== 'function') {
    throw new Error(`REST EffectiveOperation table exposes '${opName}' but its facade does not.`);
  }

  const { method, path } = routeOf(protocols, frond, address, opName, meta);
  const stated = statedRoute(protocols, address, opName, meta);

  return {
    method,
    path,
    operationName: opName,
    address,
    handler: (invocation) => op(invocation),
    ...inputAndOutput(meta),
    successStatus: stated.status,
    ...(stated.responses && { responses: stated.responses }),
    cardinality: meta.cardinality,
    creates: method === 'POST' && meta.cardinality === 'one' && !designates(meta.binding),
    ...(meta.description && { description: meta.description }),
  };
}

function inputAndOutput(meta: OperationMeta): { inputFields: Fields | undefined; outputFields: Fields | undefined } {
  return {
    inputFields: meta.input ? Visibility.of(meta.input.getFields()).input : undefined,
    outputFields: meta.output ? Visibility.of(meta.output.getFields()).output : undefined,
  };
}
