import type { RepositoryOf } from '@fougere/core';
import type Invoice from '../entities/Invoice.js';

/** The neighbour's rows — written the same way, and nobody is standing in front of them. */
export default class InvoiceHandler {
  constructor(private invoices: RepositoryOf<Invoice>) {}

  /** Record one invoice. */
  async record(reference: string): Promise<unknown> {
    return this.invoices.create({ id: reference, reference });
  }
}
