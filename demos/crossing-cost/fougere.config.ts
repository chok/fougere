import { defineFougere } from '@fougere/core';

/**
 * The whole topology statement, and the only thing this demo asks you to change.
 *
 * As written, the three Fronds run in one process and `cart.checkout` costs nothing but
 * function calls. Uncomment a line and the SAME code pays a round trip for it — the handler
 * says nothing about either case, which is the claim being demonstrated.
 *
 * `ledger` is placed and nothing serves it. That is deliberate: a dependency the config declares
 * and no process ever answers is the one thing a counted graph cannot report, because a call
 * that never happened leaves no trace to count.
 */
export default defineFougere({
  processes: {
    // pricing: { url: 'http://127.0.0.1:4610', fronds: ['pricing'] },
    // catalog: { url: 'http://127.0.0.1:4620', fronds: ['catalog'] },
    ledger: { url: 'http://127.0.0.1:4630', fronds: ['ledger'] },
  },
});
