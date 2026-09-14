/** How many entries a ring keeps before the oldest falls off. */
export const KEPT = 300;

/** A bounded list that counts what it drops, so a busy moment never reads as a quiet one. */
export class Ring<T extends { seq: number }> {
  protected readonly held: T[] = [];
  protected seq = 0;
  private lost = 0;

  constructor(private readonly max = KEPT) {}

  protected keep(make: (seq: number) => T): T {
    const record = make(++this.seq);
    this.held.push(record);
    if (this.held.length > this.max) this.lost += this.held.splice(0, this.held.length - this.max).length;

    return record;
  }

  since(cursor: number): { lines: T[]; cursor: number; dropped: number } {
    return { lines: this.held.filter((one) => one.seq > cursor), cursor: this.seq, dropped: this.lost };
  }
}
