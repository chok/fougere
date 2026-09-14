import { entity, text, number, primary, created, ref } from '@fougere/schema';
import RateCard from './RateCard.js';

/** The line that must exist if and only if a balance moved. */
export default class Ledger extends entity({
  id: primary(),
  from: text(),
  to: text(),
  amount: number(),
  currency: ref(RateCard),
  at: created(),
}) {}
