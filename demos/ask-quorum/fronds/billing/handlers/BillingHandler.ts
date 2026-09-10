import type { Fact } from '@fougere/core';
import type CanBook from '../../booking/entities/CanBook.js';
import type Verdict from '../../booking/entities/Verdict.js';

/** The one that refuses, so the demo shows an answer and not a chorus. */
export default class BillingHandler {
  async check(question: Fact<CanBook>): Promise<Verdict> {
    const owing = question.room === 'atrium';

    return { from: 'billing', ok: !owing, ...(owing ? { because: 'unpaid invoice' } : {}) } as Verdict;
  }
}
