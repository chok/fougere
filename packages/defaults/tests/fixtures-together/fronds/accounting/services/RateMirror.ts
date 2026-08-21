import { Mirror } from '@fougere/core';
import RateCard from '../entities/RateCard.js';

/** Where the pages come from — a test stands in for the partner's API. */
export const upstream: { pages: Array<Array<{ code: string; rate: number }>> } = { pages: [] };

/** A copy that writes through the port, which is what lets a frame cover it. */
export default class RateMirror extends Mirror(RateCard) {
  async *pull(): AsyncIterable<Array<Partial<RateCard>>> {
    for (const page of upstream.pages) yield page;
  }
}
