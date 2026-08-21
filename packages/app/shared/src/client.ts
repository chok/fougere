/**
 * The couple, minus the reactivity — everything `useQuery`/`useCommand` decide
 * before a framework's state primitives get involved.
 *
 * Designation is class + verb: the imported entity class carries the metadata,
 * its name carries the registration key. That is true in Vue and in React, and so
 * is the link — a successful command on an entity revalidates every mounted query
 * on that entity, because the entity is designated on both sides and nothing has
 * to be declared. What differs between hosts is only HOW a value becomes reactive
 * and how a revalidation is triggered, which is ~50 lines each and belongs to them.
 *
 * Browser-safe by construction: this module reaches `@fougere/core/contract` and
 * the transport's client subpath, never the boot. `@fougere/app/client` is the
 * subpath that keeps it that way.
 */
import {
  FougereError,
  ErrorCode,
  registrationKeyOf,
  type InvocationContext,
  type FrondCall,
} from '@fougere/core/contract';
import { frameCall, unframeResponse, type RpcResponse } from '@fougere/transport-http/client';

/** An entity class is a designation: its name is the registration key. */
export type EntityClass = { name: string };

/** What a page provides of an invocation — the rest is stamped server-side. */
export type CallInput = Partial<Pick<InvocationContext, 'params' | 'query' | 'body'>>;

/** The one door the browser knows. A named surface adds `/{surface}` to it. */
export const CALL_ENDPOINT = '/_fougere/call';

export type Fetcher = <T>(url: string, options: { method: 'POST'; body: unknown }) => Promise<T>;

let nextId = 1;

/** The registration key an entity class designates. */
export function entityKeyOf(entity: EntityClass): string {
  return registrationKeyOf(entity.name);
}

export function callOf(entity: EntityClass, op: string): FrondCall {
  return { entity: entityKeyOf(entity), op };
}

export function invocationOf(input?: CallInput): InvocationContext {
  return { params: {}, query: {}, body: undefined, state: {}, ...input };
}

/**
 * The cache key of a read. Same designation and same input means the same key —
 * which is what lets two components asking the same thing share one request, and
 * what the command side matches against to revalidate.
 */
export function queryKeyOf(entityKey: string, op: string, input?: CallInput): string {
  return `fougere:${entityKey}.${op}:${JSON.stringify(input ?? {})}`;
}

export async function sendCall(
  fetcher: Fetcher,
  call: FrondCall,
  invocation: InvocationContext,
  endpoint: string = CALL_ENDPOINT,
): Promise<unknown> {
  const response = await fetcher<RpcResponse>(endpoint, {
    method: 'POST',
    body: frameCall(call, invocation, nextId++),
  });
  return unframeResponse(response, call);
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

/**
 * `mountedKeys` says WHICH reads a command invalidates; these say how to make one
 * happen. Both halves turned out to be host-independent — Nuxt is the exception,
 * because `refreshNuxtData` already is this registry.
 *
 * They lived in `@fougere/react` until a second non-Nuxt client needed them, which
 * is when it became visible that nothing in them is React.
 */
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

/**
 * Whatever failed, as the error the primitives promise. A transport failure is not
 * a domain refusal, so it arrives under SERVICE_UNAVAILABLE rather than borrowing a
 * code the server never sent.
 */
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
export {
  formFieldsOf,
  tableColumnsOf,
  payloadOf,
  errorsByField,
  type FormEntity,
  type FormField,
  type TableColumn,
} from './form.js';
export { sessionViewOf, type SessionView } from './session.js';
