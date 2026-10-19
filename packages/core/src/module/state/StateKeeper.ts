import type { Format } from '@fougere/schema';

/**
 * A way to keep a caller's state between two requests — a cookie, a session — as the package that
 * brings it writes it. It reads and writes TOKENS, already signed: what a value is, core decides.
 * `over` names what it travels in, and a door carrying something else realizes none of it.
 */
export interface StateKeeper<Carrier = unknown, Options = unknown> {
  /** What a door must carry for this to work — `http`, the word both sides agree on. */
  readonly over: string;
  /** What `state: { cart: { cookie: { … } } }` may say of it. */
  readonly format: Format<Options>;
  read(carrier: Carrier, name: string, options: Options): string | undefined;
  /** `undefined` forgets the name. */
  write(carrier: Carrier, name: string, token: string | undefined, options: Options): void;
}
