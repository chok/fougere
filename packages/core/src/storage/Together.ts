import type { Storage } from './Storage.js';

/** `Together<[Account, Ledger]>` — writes that stand or fall as one. */
export interface Together<E extends readonly unknown[], P extends readonly unknown[] = []> {
  run<R>(fn: (entities: { [K in keyof E]: Storage<E[K]> }, providers: P) => Promise<R>): Promise<R>;
}
