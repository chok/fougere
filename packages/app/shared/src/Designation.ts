import {
  FougereError,
  ErrorCode,
  RPC_ADDRESS,
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
import { Card, type SchemaView } from '@fougere/schema';

/** One facade from its address alone, for a project that generated none, or a test. */
export function facade<Address extends Addresses>(address: Address): FacadeName<HandlerOf<Address>, Address> {
  return { address };
}

/** The facade an entity class names, from which a form works out where it submits. */
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
  return { address: addressOf(designation), op };
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

const schemas = new Map<string, Promise<Map<string, SchemaView>>>();

function schemasIn(answer: unknown, endpoint: string): Map<string, SchemaView> {
  const found = new Map<string, SchemaView>();
  const card = assertIdentityCard(answer, `The app at ${endpoint}`);
  for (const frond of card.fronds) {
    for (const facade of frond.facades) {
      for (const op of facade.ops) {
        if (op.output) found.set(`${facade.name}.${op.name}`, Card.fromDescriptor(op.output).toSchema());
      }
    }
  }

  return found;
}

function learn(answer: unknown, endpoint: string): void {
  try { schemas.set(endpoint, Promise.resolve(schemasIn(answer, endpoint))); }
  catch { /* not a card: whatever else `rpc` answered */ }
}

function schemasOf(fetcher: Fetcher, endpoint: string): Promise<Map<string, SchemaView>> {
  const asked = schemas.get(endpoint) ?? (async () => {
    try {
      return schemasIn(await postCall(fetcher, { address: RPC_ADDRESS, op: 'discover' }, invocationOf(), endpoint), endpoint);
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
  if (call.address === RPC_ADDRESS) {
    if (call.op === 'discover') learn(answer, endpoint);

    return answer;
  }

  return decoded((await schemasOf(fetcher, endpoint)).get(`${call.address}.${call.op}`), answer);
}


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
        address: entityKey,
        operation: op,
        cause: err,
      });
}

export { errorsByField, formFieldsOf, openingOf, payloadOf, tableColumnsOf } from './FormEntity.js';
export type { SchemaView } from '@fougere/schema';
export { type FormField } from './FormField.js';
export { type TableColumn } from './TableColumn.js';
