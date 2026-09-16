import type { RepositoryOf } from '@fougere/core';
import type Invoice from '../entities/Invoice.js';
import Ledger from '../services/Ledger.js';

/** The neighbour's rows — written the same way, and nobody is standing in front of them. */
export default class InvoiceHandler {
  /** The SAME `Ledger` as CheckoutHandler's — one per frond, because it states so. */
  constructor(private invoices: RepositoryOf<Invoice>, private ledger: Ledger) {}

  /** Record one invoice. */
  async record(reference: string): Promise<unknown> {
    this.ledger.record(reference);

    return this.invoices.create({ id: reference, reference });
  }
}
