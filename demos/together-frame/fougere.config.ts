import { defineFougere } from '@fougere/core';

/**
 * ONE line decides what a frame is worth.
 *
 * With `sources:` commented out, `Account`, `Ledger` and `RateCard` share a file and a
 * connection: `Together<[Account, Ledger]>` is a real transaction and the engine gives
 * both the unwind AND the isolation.
 *
 * Uncomment it and `Ledger` moves to its own database. A transaction reaches one engine,
 * so there is none — the frame keeps the before-image of every write and replays the
 * inverses itself. All-or-nothing survives; isolation does not, and the boot says so.
 *
 * The handlers are not touched between the two. That is the whole demo.
 */
export default defineFougere({
  db: { path: '.data/app.db' },
  // sources: {
  //   accounting: { path: '.data/accounting.db', entities: ['Ledger'] },
  // },
});
