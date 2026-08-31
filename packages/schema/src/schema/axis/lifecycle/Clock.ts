/**
 * What "now" means, for the two functions that stamp it.
 *
 * The ONE place either of them reads the time, which is what makes it substitutable at
 * all: `created()`, `updated()` and `create: 'now'` are realized through this and nowhere
 * else, so a test that needs a stable instant sets it here instead of intercepting `Date`
 * globally — where Rails had to build `travel_to` over the language.
 *
 * A value rather than a mock: nothing here is a channel, and a frozen clock is a fact
 * about the run, not an interception of a call.
 */
export class Clock {
  private static reading: () => number = Date.now;

  static now(): number {
    return this.reading();
  }

  /** Freeze the instant this clock reads. Returns the gesture that restores it. */
  static freeze(at: number | Date): () => void {
    const previous = this.reading;
    const instant = at instanceof Date ? at.getTime() : at;
    this.reading = () => instant;
    return () => { this.reading = previous; };
  }
}
