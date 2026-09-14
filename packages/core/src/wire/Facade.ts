import type { InvocationContext } from './InvocationContext.js';
import type { FougereOperations } from './FougereOperations.js';

type Served = keyof FougereOperations & string;

/**
 * Both halves below take the union through a type PARAMETER, which is what makes the
 * conditional distribute: `Served` is an alias, and an alias is matched whole — `'a.x' | 'b.y'`
 * does not extend `` `${string}.${string}` `` as one thing, so the naive form answers `never`.
 */
type AddressIn<Key> = Key extends `${infer Address}.${string}` ? Address : never;

/** The facade built in front of a handler — the framework's second port, after `Storage`. */
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
