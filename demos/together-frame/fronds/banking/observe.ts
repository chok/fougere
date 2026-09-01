/**
 * Demo scaffolding — a reader on a SEPARATE connection, installed by `src/main.ts`.
 *
 * It exists because the one thing the two realizations do not share cannot be seen from
 * inside: whether anybody else can observe the block half-done. A read through the app's
 * own storage would not answer it — that is the same connection, and a connection always sees
 * its own uncommitted writes. Nothing here is part of Fougere.
 */
export let observe: (() => Promise<string>) | undefined;

/** Called once by the demo, with a reader it opened itself. */
export function observeWith(reader: () => Promise<string>): void {
  observe = reader;
}
