/**
 * A provider that HOLDS something, and says so.
 *
 * `implements AsyncDisposable` is the language's own marker — the one `App` already answers, so
 * `await using app = await createApp(…)` works. On a provider it states two things at once:
 * there is ONE of it in this frond's scope, and that scope closes it.
 *
 * Say nothing and you get the other contract, which is right for a class holding nothing: one
 * instance per consumer, and its caller decides when it is done.
 */
export default class Ledger implements AsyncDisposable {
  private readonly written: string[] = [];

  constructor() {
    console.log('   [billing] Ledger opened');
  }

  record(line: string): void {
    this.written.push(line);
  }

  async [Symbol.asyncDispose](): Promise<void> {
    console.log(`   [billing] Ledger closed — ${this.written.length} line(s)`);
  }
}
