/** Writes on one key, one after the other: a row lock for a store that has none. */
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

  /** Every key's turn at once, taken in key order, so two callers sharing keys queue instead of crossing. */
  takeAll<R>(keys: readonly string[], work: () => Promise<R>): Promise<R> {
    const [first, ...rest] = [...new Set(keys)].sort();
    if (first === undefined) return work();

    return this.take(first, () => this.takeAll(rest, work));
  }

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
