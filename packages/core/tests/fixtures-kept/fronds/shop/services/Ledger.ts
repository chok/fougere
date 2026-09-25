/** Holds something, and closes it — no `implements` needed: the method is what the container reads. */
export default class Ledger {
  static opened = 0;
  static closed = 0;

  constructor() { Ledger.opened += 1; }

  async [Symbol.asyncDispose](): Promise<void> { Ledger.closed += 1; }
}
