/** Call contract — a frond call is a value. */
import { Card, type SchemaDescriptor } from '@fougere/schema';
import { factsAnnouncedBy } from '../emit.js';
import { Invocation, type InvocationContext, type InvocationInput } from './Invocation.js';
import type { RouteAddress } from './RouteAddress.js';
import { FougereError, ErrorCode } from './errors.js';

/** One normalized request, frozen: where it goes and what the caller supplied. */
export class Call {
  readonly address: RouteAddress;
  readonly invocation: Invocation;

  constructor(address: RouteAddress, invocation?: InvocationInput) {
    this.address = address;
    this.invocation = Invocation.from(invocation);
    Object.freeze(this);
  }
}

/** Target of a call — which façade operation, wherever it lives. */
export interface FrondCall {
  /** Frond name, when the caller knows it. Routing hint only. */
  frond?: string;
  /** Entity registration key (e.g. 'product'). */
  entity: string;
  /** Façade operation name (e.g. 'findById', 'search'). */
  op: string;
}

/** A transport executes a call somewhere else. Failures surface as thrown FougereError. */
export type Transport = (call: FrondCall, invocation: InvocationContext) => Promise<unknown>;

/** Reserved namespace — calls the runner answers itself, never a façade. */
/** What a receiver accepts before it stops reading a body. */
export const MAX_BODY_BYTES = 1024 * 1024;

export const RPC_ENTITY = 'rpc';

/** What an `rpc` op answers — the door for what the app says about ITSELF, never about a row. */
export type RpcAnswer = (invocation: InvocationContext, surface?: string) => unknown;

/** Everything a caller's envelope covers — the call as the sender meant it. */
export interface SignedCall {
  entity: string;
  op: string;
  params?: Record<string, unknown>;
  query?: Record<string, unknown>;
  body?: unknown;
  state?: Record<string, unknown>;
}

/** One operation, as a stranger meets it — its name, what it is for, what it takes and whether it re… */
export interface CardOp {
  name: string;
  /** The author's own doc sentence, when the method carries one. */
  description?: string;
  /** JSON Schema of what it accepts, when the contract names a view. */
  input?: SchemaDescriptor;
  /** JSON Schema of what it emits, when the contract names one. */
  output?: SchemaDescriptor;
  /** `query` reads, `command` writes — the same call REST turns into GET vs POST. */
  kind: 'query' | 'command';
  /** How much `output` describes: */
  cardinality?: 'one' | 'maybe' | 'many' | 'page' | 'none';
}

/** What an app hosts — the wire projection of its scanned fronds. */
export interface IdentityCard {
  fronds: {
    name: string;
    doors: {
      name: string;
      ops: CardOp[];
      /** The shape stored under this name — **absent when nothing is**. */
      schema?: SchemaDescriptor;
    }[];
    /** The facts this frond ANNOUNCES — one entry per `Emit<T>` its handlers inject. */
    facts: { name: string; schema?: SchemaDescriptor }[];
  }[];
}

/** A frond this process knows about, and whether it runs here. */
export interface FrondPlacement {
  frond: string;
  placement: 'local' | 'remote';
  entities: number;
  doors: number;
}

/** One frond calling another — an edge of the graph, counted where the call was made. */
export interface Edge {
  from: string;
  to: string;
  count: number;
  errors: number;
}

/** The shape of the system as ONE process discovered it — the answer to `rpc.topology`. */
export interface TopologyReport {
  /** When this process started counting — an edge count is read against it. */
  since: number;
  /** Calls running right now: the one signal a static shape cannot carry. */
  active: number;
  fronds: FrondPlacement[];
  edges: Edge[];
}

/** The shape a card must have to be walked — `fronds`, and each frond's `doors`. */
export function assertIdentityCard(value: unknown, source: string): IdentityCard {
  const card = value as IdentityCard | undefined;
  const fronds = Array.isArray(card?.fronds) ? card.fronds : undefined;
  if (!fronds) throw cardRefusal(source, 'no fronds array');
  for (const frond of fronds) {
    if (!frond || typeof frond.name !== 'string') throw cardRefusal(source, 'a frond with no name');
    if (!Array.isArray(frond.doors)) throw cardRefusal(source, `frond '${frond.name}' has no valid doors array`);
  }
  return card as IdentityCard;
}

function cardRefusal(source: string, what: string): FougereError {
  return new FougereError({
    code: ErrorCode.INTERNAL_ERROR,
    message:
      `${source} answered an invalid identity card: ${what}.\n`
      + `  A card is what tells this process what the other one hosts, so nothing can be routed from it.\n`
      + `  - Check that the address serves a Fougere app, and that its version still speaks this card.`,
  });
}

/** A façade as the runtime holds it: op names to functions, nothing typed about them. */

/** The door built in front of a handler — the framework's second port, after `Storage`. */
export type Facade<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? (invocation?: InvocationContext) => R
    : never;
};

/** The container key of a façade — THE one place that spells the format. */
export function facadeKeyOf(entityName: string, surface?: string): string {
  return surface ? `${surface}:${entityName}Handler` : `${entityName}Handler`;
}

/** Where the contracts behind a façade live — the dual of `facadeKeyOf`. */
export function contractsKeyOf(entityName: string, surface?: string): string {
  return `${facadeKeyOf(entityName, surface)}:contracts`;
}
