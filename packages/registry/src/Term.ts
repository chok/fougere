import type { Registry } from './Registry.js';

/**
 * A name and its answer, held as a value — what a `vocabulary/` file exports, and what the frond
 * stating it registers. A declaration still writes the NAME (`format: 'slug'`), which is what a card
 * carries; the answer travels with the frond, so it is imported rather than loaded for its effect.
 */
export class Term<T> {
  constructor(
    readonly registry: Registry<T>,
    readonly name: string,
    readonly answer: T,
  ) {}

  static is(value: unknown): value is Term<unknown> {
    return value instanceof Term;
  }

  register(): void {
    this.registry.register(this.name, this.answer);
  }
}
