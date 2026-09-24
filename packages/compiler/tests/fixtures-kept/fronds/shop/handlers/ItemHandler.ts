import Ledger from '../services/Ledger.js';
import Clock from '../services/Clock.js';

export default class ItemHandler {
  constructor(private ledger: Ledger, private clock: Clock) {}

  async list(): Promise<string[]> { return []; }
}
