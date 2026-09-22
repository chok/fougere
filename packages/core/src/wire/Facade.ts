import { lowerFirst } from '@fougere/schema';

import type { InvocationContext } from './InvocationContext.js';
import type { FougereOperations } from './FougereOperations.js';

type Served = keyof FougereOperations & string;

/**
 * Both halves below take the union through a type PARAMETER, which is what makes the
 * conditional distribute: `Served` is an alias, and an alias is matched whole — `'a.x' | 'b.y'`
 * does not extend `` `${string}.${string}` `` as one thing, so the naive form answers `never`.
 */
type AddressIn<Key> = Key extends `${infer Address}.${string}` ? Address : never;

/**
 * The facade built in front of a handler — the framework's second port, after `Storage`.
 *
 * What the handler knows is WHICH operations exist and what each one answers. The two ends are
 * the port's own: an invocation goes in where the handler takes positional arguments, and a
 * promise comes back where the handler may answer a bare value. A facade is a crossing, and a
 * crossing is awaited before any transport — the dispatch resolves a route, runs the middlewares
 * and awaits the collectors, so `readLocation(): string` was typed as answering now and never did.
 *
 * `Awaited` because a promise does not stack: `Promise.resolve(p)` IS `p`, so writing
 * `Promise<R>` over an async handler would describe a `Promise<Promise<Post>>` that no value can
 * have — `.then` would hand its callback a promise the runtime never delivers.
 */
export type Facade<T> = {
  [K in keyof T]: T[K] extends (...args: never[]) => infer R
    ? (invocation?: InvocationContext) => Promise<Awaited<R>>
    : never;
};

/** The container key of a façade — THE one place that spells the format. */
export function facadeKeyOf(entityName: string, surface?: string): string {
  return surface ? `${surface}:${entityName}Handler` : `${entityName}Handler`;
}

/**
 * The address a handler answers at, read off its class name or its facade key — the dual of
 * `facadeKeyOf`. `PostHandler` → `post`, `postHandler` → `post`.
 */
export function addressOf(name: string): string {
  return lowerFirst(name.endsWith(HANDLER) ? name.slice(0, -HANDLER.length) : name);
}

/** A default facade's key — `postHandler`, never `admin:postHandler` nor `PostStorage`. */
export function isFacadeKey(key: string): boolean {
  return key.endsWith(HANDLER) && !key.includes(':');
}

const HANDLER = 'Handler';

/** Where the contracts behind a façade live — the dual of `facadeKeyOf`. */
export function contractsKeyOf(entityName: string, surface?: string): string {
  return `${facadeKeyOf(entityName, surface)}:contracts`;
}
