import type { Registry } from './Registry.js';

/**
 * A name and its answer, exported from a `vocabulary/` file.
 * Ex: `export const slug = StringFormats.term('slug', …)`.
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
