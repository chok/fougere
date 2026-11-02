/**
 * Writes on one key, one after the other — what a row lock is to a store that has none. Held per
 * store, so every storage a source builds over the same rows waits in the same line.
 */
export class Turns {
  private static held = new WeakMap<object, Turns>();

  static of(store: object): Turns {
    const found = Turns.held.get(store);
    if (found) return found;

    const turns = new Turns();
    Turns.held.set(store, turns);

    return turns;
  }

  private last = new Map<string, Promise<unknown>>();

  take<R>(key: string, work: () => Promise<R>): Promise<R> {
    const before = this.last.get(key) ?? Promise.resolve();
    const mine = before.then(work);
    const settled = mine.then(() => undefined, () => undefined);
    this.last.set(key, settled);
    void settled.then(() => {
      if (this.last.get(key) === settled) this.last.delete(key);
    });

    return mine;
  }
}
