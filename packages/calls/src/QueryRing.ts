import { Ring } from './Ring.js';
import type { QueryLine } from './QueryLine.js';

export class QueryRing extends Ring<QueryLine> {
  record(event: Omit<QueryLine, 'seq'>): void {
    this.keep((seq) => ({ ...event, seq }));
  }
}
