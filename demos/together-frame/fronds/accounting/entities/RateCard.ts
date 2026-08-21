import { entity, text, number, primary, updated } from '@fougere/schema';

/** A copy of rates this app cannot query — keyed by the source's own reference. */
export default class RateCard extends entity({
  code: primary(text()),
  rate: number(),
  pulledAt: updated(),
}) {}
