import { lowerFirst, upperFirst } from '@fougere/schema';
import { subjectKeyOf, subjectsOf } from './SubjectKey.js';

/** The facade in front of a handler: it takes what the handler takes, and always answers a promise. */
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
 * The address a handler answers at, read off its class name or its facade key.
 * Ex: `PostHandler` → `post`.
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
