import type { Format } from '@fougere/schema';
import type { FrondDescriptor } from '../../descriptor/FrondDescriptor.js';
import type { Storage } from '../../storage/Storage.js';

/** One name a keeper keeps, and what `state:` told it. */
export interface KeeperEntry<Options = unknown> {
  name: string;
  options: Options;
}

/** A name the request's calls wrote, signed — `undefined` forgets it. */
export interface WrittenName<Options = unknown> extends KeeperEntry<Options> {
  token: string | undefined;
}

/** Where a keeper reaches the rows of the fronds it brought. */
export type StorageFor = (entity: string) => Storage | undefined;

/**
 * A way to keep a caller's state between two requests — a cookie, a session — as the package that
 * brings it writes it. It reads and writes TOKENS, already signed: what a value is, core decides.
 * `over` names what it travels in, and a door carrying something else realizes none of it. It is
 * handed every name it keeps in one request at once, so names sharing one place are read and
 * written once.
 */
export interface StateKeeper<Carrier = unknown, Options = unknown> {
  /** What a door must carry for this to work — `http`, the word both sides agree on. */
  readonly over: string;
  /** What `state: { cart: { cookie: { … } } }` may say of it. */
  readonly format: Format<Options>;
  /** What it keeps rows in — brought into the app only when `state:` names it. */
  readonly fronds?: readonly FrondDescriptor[];
  read(carrier: Carrier, names: readonly KeeperEntry<Options>[], storageFor: StorageFor): Promise<Map<string, string>> | Map<string, string>;
  write(carrier: Carrier, written: readonly WrittenName<Options>[], storageFor: StorageFor): Promise<void> | void;
}
