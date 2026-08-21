import { Mirror } from '@fougere/core';
import RateCard from '../entities/RateCard.js';

/** What the partner would answer. A demo says out loud what an API would hand back. */
export const upstream: Array<Array<{ code: string; rate: number }>> = [
  [{ code: 'EUR', rate: 1.00 }, { code: 'USD', rate: 1.09 }],
];

/**
 * A copy that writes through `EntityOrm<RateCard>` — which is the whole reason a frame
 * can cover it. Nothing here knows a frame exists.
 */
export default class RateMirror extends Mirror(RateCard) {
  async *pull(): AsyncIterable<Array<Partial<RateCard>>> {
    for (const page of upstream) yield page;
  }
}
