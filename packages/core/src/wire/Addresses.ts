import type { FougereOperations } from './FougereOperations.js';

type Generated = keyof FougereOperations & string;

type AddressIn<Key> = Key extends `${infer Address}.${string}` ? Address : never;

/** The addresses this app answers at, or any string until a scan has said otherwise. */
export type Addresses = [Generated] extends [never] ? string : AddressIn<Generated>;
