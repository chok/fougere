import type { Answer } from '@fougere/core';
import type CanBook from '../../booking/entities/CanBook.js';

/** One responder. Its signature IS its subscription — nothing registers it. */
export default class BillingHandler {
  async check(question: Answer<CanBook>): Promise<CanBook> {
    // The one that refuses, so the demo shows a real answer and not a chorus.
    const owing = question.room === 'atrium';

    return { ...question, from: 'billing', ok: !owing, ...(owing ? { because: 'unpaid invoice' } : {}) } as CanBook;
  }
}
