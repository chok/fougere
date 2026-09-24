import Rates from '../services/Rates.js';

export default class QuoteHandler {
  constructor(private rates: Rates) {}

  /** Quote the cart at today's rate. */
  async quote(): Promise<number> {
    return this.rates.at();
  }
}
