import { defineFougere } from '@fougere/core';

/**
 * ONE line decides what a frame is worth.
 *
 * With `sources:` commented out, `Account`, `Ledger` and `RateCard` share a file and a
 * connection: `Together<[Account, Ledger]>` is a real transaction and the engine gives
 * both the unwind AND the isolation.
 *
 * Uncomment it and two things move at once. `Ledger` goes to its own database — a
 * transaction reaches one engine, so there is none, and the frame keeps the before-image of
 * every write and replays the inverses itself. And `RateCard` goes somewhere that is not a
 * database at all: one JSON per row, in a directory. It hands out no transaction either, and
 * it did not have to say so — the absence IS the statement.
 *
 * All-or-nothing survives both; isolation does not, and the boot says so, per frame.
 *
 * The handlers are not touched between the two. That is the whole demo.
 */
export default defineFougere({
  db: { path: '.data/app.db' },
  // sources: {
  //   accounting: { path: '.data/accounting.db', entities: ['Ledger'] },
  //   rates: { source: 'file', path: '.data/rates', entities: ['RateCard'] },
  // },
});
