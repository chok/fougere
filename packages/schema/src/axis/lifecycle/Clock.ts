export class Clock {
  private static reading: () => number = Date.now;

  static now(): number {
    return this.reading();
  }

  /**
   *
   * @returns function to restore the clock
   */
  static freeze(at: number | Date): () => void {
    const previous = this.reading;
    const instant = at instanceof Date ? at.getTime() : at;

    this.reading = () => instant;

    return () => {
      this.reading = previous;
    };
  }
}
