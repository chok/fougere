import { defineFougere } from '@fougere/core';

/**
 * The whole topology statement, and the only thing this demo asks you to change.
 *
 * With it commented out, the three Fronds run in one process and `cart.checkout` costs nothing
 * but function calls. Uncomment a line and the SAME code pays a round trip for it — the handler
 * says nothing about either case, which is the claim being demonstrated.
 *
 * `ledger` is named and nothing serves it. That is deliberate: a dependency the config declares
 * and no process ever answers is the one thing a counted graph cannot report, because a call
 * that never happened leaves no trace to count.
 */
export default defineFougere({
  fronds: {
    // pricing: 'http://127.0.0.1:4610',
    // catalog: 'http://127.0.0.1:4620',
    ledger: 'http://127.0.0.1:4630',
  },
});
