import {
  FougereError,
  ErrorCode,
  RPC_ENTITY,
  assertIdentityCard,
  decoded,
  lowerFirst,
  type InvocationContext,
  type FrondCall,
  type FacadeName,
  type Addresses,
  type HandlerOf,
  type AnyHandler,
} from '@fougere/core/contract';
import { frameCall, unframeResponse, type RpcResponse } from '@fougere/transport-http/client';
import type { EntityClass } from './EntityClass.js';
import type { CallInput } from './CallInput.js';
import type { Fetcher } from './Fetcher.js';
import { Card, type SchemaView, type SchemaDescriptor } from '@fougere/schema';

/**
 * One facade, built from its address alone — what a project that never generated `@fronds/facade`
 * has, and what a test writes when it stands one up by hand.
 *
 * A page imports its facade instead, so a missing generated module fails to resolve rather than
 * falling back to `string` in silence. A service writes no address at all: the container
 * resolves `Facade<PostHandler>` from the type, and a browser has no container.
 */
export function facade<Address extends Addresses>(address: Address): FacadeName<HandlerOf<Address>, Address> {
  return { address };
}

/**
 * The facade an ENTITY class names — the one designation computed rather than written, because a
 * form is handed a set of FIELDS and works out where it submits from them. Its operations are
 * not known from a type, which is exactly what `AnyHandler` says.
 */
export function facadeOf(entity: EntityClass): FacadeName<AnyHandler, string> {
  return { address: entityKeyOf(entity) };
}

/** Where a call goes: a named facade, an entity class that happens to name one, or the address. */
export function addressOf(designation: Designation): string {
  if (typeof designation === 'string') return designation;

  return 'address' in designation ? designation.address : entityKeyOf(designation);
}

/** The three ways a page designates one facade. */
export type Designation = FacadeName<unknown, string> | EntityClass | string;

/** The one facade the browser knows. A named surface adds `/{surface}` to it. */
export const CALL_ENDPOINT = '/_fougere/call';

let nextId = 1;

/** The registration key an entity class designates. */
export function entityKeyOf(entity: EntityClass): string {
  return lowerFirst(entity.name);
}

export function callOf(designation: Designation, op: string): FrondCall {
  return { entity: addressOf(designation), op };
}

export function invocationOf(input?: CallInput): InvocationContext {
  return { params: {}, query: {}, input: undefined, state: {}, ...input };
}

/** The cache key of a read. */
export function queryKeyOf(entityKey: string, op: string, input?: CallInput): string {
  return `fougere:${entityKey}.${op}:${JSON.stringify(input ?? {})}`;
}

async function postCall(
  fetcher: Fetcher,
  call: FrondCall,
  invocation: InvocationContext,
  endpoint: string,
): Promise<unknown> {
  const response = await fetcher<RpcResponse>(endpoint, {
    method: 'POST',
    body: frameCall(call, invocation, nextId++),
  });

  return unframeResponse(response, call);
}

/**
 * The schemas this browser reads a row back through, asked ONCE per endpoint.
 *
 * `date-time` means a `Date` on both sides, and a page held the string: three of this repo's own
 * pages wrote `day(iso?: string)` and called `new Date(iso)` by hand, against the type their
 * composable handed them. A server-side caller has the schema by construction — a browser has
 * to ask for it, and the card already carries it (645 bytes for a seven-field entity).
 *
 * An app serving no card decodes nothing, which is what a page had before this existed.
 */
const schemas = new Map<string, Promise<Map<string, SchemaView>>>();

/** A card read as the schemas it carries, indexed the way a call names its facade. */
function schemasIn(answer: unknown, endpoint: string): Map<string, SchemaView> {
  const found = new Map<string, SchemaView>();
  const card = assertIdentityCard(answer, `The app at ${endpoint}`);
  for (const frond of card.fronds) {
    for (const facade of frond.facades) {
      if (facade.schema) found.set(facade.name, Card.fromDescriptor(facade.schema as SchemaDescriptor).toSchema());
    }
  }

  return found;
}

/**
 * Learned from a card that went past on its own, so an app already asking for one — the admin
 * panel asks before it draws a resource — pays for a single discovery rather than two.
 */
function learn(answer: unknown, endpoint: string): void {
  try { schemas.set(endpoint, Promise.resolve(schemasIn(answer, endpoint))); }
  catch { /* not a card: whatever else `rpc` answered */ }
}

function schemasOf(fetcher: Fetcher, endpoint: string): Promise<Map<string, SchemaView>> {
  const asked = schemas.get(endpoint) ?? (async () => {
    try {
      return schemasIn(await postCall(fetcher, { entity: RPC_ENTITY, op: 'discover' }, invocationOf(), endpoint), endpoint);
    } catch { /* unreachable, or an app that publishes no card */ }

    return new Map<string, SchemaView>();
  })();
  schemas.set(endpoint, asked);

  return asked;
}

export async function sendCall(
  fetcher: Fetcher,
  call: FrondCall,
  invocation: InvocationContext,
  endpoint: string = CALL_ENDPOINT,
): Promise<unknown> {
  const answer = await postCall(fetcher, call, invocation, endpoint);
  if (call.entity === RPC_ENTITY) {
    if (call.op === 'discover') learn(answer, endpoint);

    return answer;
  }

  return decoded((await schemasOf(fetcher, endpoint)).get(call.entity), answer);
}

// ── The link ─────────────────────────────────────

/** Mounted queries per entity — the command side of the link reads this. */
const mounted = new Map<string, Set<string>>();

/** Register a mounted read. Returns the unregistration, for the host's scope teardown. */
export function trackQuery(entityKey: string, key: string): () => void {
  const keys = mounted.get(entityKey) ?? new Set<string>();
  keys.add(key);
  mounted.set(entityKey, keys);
  return () => keys.delete(key);
}

/** The keys a successful command on this entity should revalidate. */
export function mountedKeys(entityKey: string): string[] {
  return [...(mounted.get(entityKey) ?? [])];
}

/** `mountedKeys` says WHICH reads a command invalidates; these say how to make one happen. */
const refetchers = new Map<string, Set<() => void>>();

/** Register a mounted read's refetch. Returns the unregistration. */
export function onRefetch(key: string, run: () => void): () => void {
  const set = refetchers.get(key) ?? new Set<() => void>();
  set.add(run);
  refetchers.set(key, set);
  return () => set.delete(run);
}

export function revalidate(keys: string[]): void {
  for (const key of keys) for (const run of refetchers.get(key) ?? []) run();
}

/** The browser's way to reach the envelope. Same-origin, so no base URL to configure. */
export const fetcher: Fetcher = async <T,>(url: string, options: { method: 'POST'; body: unknown }): Promise<T> => {
  const response = await fetch(url, {
    method: options.method,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(options.body),
  });
  return (await response.json()) as T;
};

// ── Reading a result ─────────────────────────────

/** A list result reads as items whatever the wire delivered — bare array or envelope. */
export function itemsOf<T>(data: unknown): T[] {
  if (Array.isArray(data)) return data as T[];
  if (data && typeof data === 'object' && Array.isArray((data as { items?: unknown }).items)) {
    return (data as { items: T[] }).items;
  }
  return [];
}

export function pageOf(data: unknown): { total?: number; hasMore?: boolean; endCursor?: string } {
  return (data ?? {}) as { total?: number; hasMore?: boolean; endCursor?: string };
}

/** Whatever failed, as the error the primitives promise. */
export function asFougereError(err: unknown, entityKey: string, op: string): FougereError {
  return err instanceof FougereError
    ? err
    : new FougereError({
        code: ErrorCode.SERVICE_UNAVAILABLE,
        message: (err as Error)?.message ?? String(err),
        entity: entityKey,
        operation: op,
        cause: err,
      });
}

// The form contract is host-independent too, and a form is client code — so it
// reaches the browser through this subpath rather than through the package root,
// which carries the boot.
export { errorsByField, formFieldsOf, payloadOf, tableColumnsOf, type FormEntity } from './FormEntity.js';
export { type FormField } from './FormField.js';
export { type TableColumn } from './TableColumn.js';
export { sessionViewOf, type SessionView } from './session.js';
