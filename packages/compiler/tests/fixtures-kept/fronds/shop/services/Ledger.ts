/** Holds something, so it says so: one per frond, and this scope closes it. */
export default class Ledger implements AsyncDisposable {
  static opened = 0;
  static closed = 0;

  constructor() { Ledger.opened += 1; }

  async [Symbol.asyncDispose](): Promise<void> { Ledger.closed += 1; }
}
