import type { FougereOperations } from './FougereOperations.js';

type Served = keyof FougereOperations & string;

/**
 * Both halves below take the union through a type PARAMETER, which is what makes the
 * conditional distribute: `Served` is an alias, and an alias is matched whole — `'a.x' | 'b.y'`
 * does not extend `` `${string}.${string}` `` as one thing, so the naive form answers `never`.
 */
type AddressIn<Key> = Key extends `${infer Address}.${string}` ? Address : never;

/**
 * The addresses this app answers at — or any string, until a scan has said otherwise. The
 * `[Served] extends [never]` form is what keeps an ungenerated project compiling: a bare `never`
 * in a parameter position refuses every call, the correct ones included.
 */
export type Addresses = [Served] extends [never] ? string : AddressIn<Served>;
