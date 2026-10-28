import { lowerFirst, upperFirst } from '@fougere/schema';
import { subjectKeyOf, subjectsOf } from './SubjectKey.js';

/**
 * The facade built in front of a handler — the framework's second port, after `Storage`.
 *
 * It takes what the handler takes: code calling it already holds the values, so nothing is
 * collected for it and nothing is presented — that is a door's work, done on what a door
 * received. A promise comes back where the handler may answer a bare value, because a facade
 * is a crossing and a crossing is awaited, whether or not a transport carries it.
 *
 * `Awaited` because a promise does not stack: `Promise.resolve(p)` IS `p`, so writing
 * `Promise<R>` over an async handler would describe a `Promise<Promise<Post>>` that no value can
 * have — `.then` would hand its callback a promise the runtime never delivers.
 */
export type Facade<T> = {
  [K in keyof T]: T[K] extends (...args: infer A) => infer R
    ? (...args: A) => Promise<Awaited<R>>
    : never;
};

/** The container key of a façade — THE one place that spells the format. */
export function facadeKeyOf(entityName: string, surface?: string): string {
  const key = subjectKeyOf('Facade', `${upperFirst(entityName)}${HANDLER}`);

  return surface ? `${surface}:${key}` : key;
}

/**
 * The address a handler answers at, read off its class name or its facade key — the dual of
 * `facadeKeyOf`. `PostHandler` → `post`, `Facade<PostHandler>` → `post`.
 */
export function addressOf(name: string): string {
  const handler = subjectsOf(name, 'Facade')?.[0] ?? name;

  return lowerFirst(handler.endsWith(HANDLER) ? handler.slice(0, -HANDLER.length) : handler);
}

/** A default facade's key — `Facade<PostHandler>`, never `admin:Facade<PostHandler>` nor `Storage<Post>`. */
export function isFacadeKey(key: string): boolean {
  return subjectsOf(key, 'Facade') !== undefined;
}

const HANDLER = 'Handler';

/** Where the contracts behind a façade live — the dual of `facadeKeyOf`. */
export function contractsKeyOf(entityName: string, surface?: string): string {
  return `${facadeKeyOf(entityName, surface)}:contracts`;
}
