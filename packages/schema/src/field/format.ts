/**
 * The `format` keyword — JSON Schema's one openly extensible vocabulary, which is why a
 * custom predicate rides here and not in a keyword of our own.
 */

export type StringFormat =
  | 'date-time'
  | 'date'
  | 'time'
  | 'email'
  | 'uuid'
  | 'uri'
  | (string & {});

// ─── Custom formats (open registry — same spirit as the other two axes) ─────

/**
 * A custom format's predicate: one value, one verdict.
 *
 * No message, deliberately — a custom format fails exactly like `email` does,
 * because the NAME is the contract and a consumer reading the card cannot tell
 * ours from the standard's.
 */
export type FormatPredicate = (value: string) => boolean;

/**
 * Register a format the engine does not ship — `Formats.register('siret', luhn)` makes
 * `text({ format: 'siret' })` judged. The field declares a NAME and a module supplies the
 * realization, so the rule crosses a process or a language: the card carries
 * `"format": "siret"`, legal JSON Schema, and each runtime resolves it locally.
 *
 * Registering a name the engine already judges is cumulative — both predicates must pass.
 */
export class Formats {
  private static readonly registry = new Map<string, FormatPredicate>();

  /** Register a format the engine does not ship — `text({ format: 'siret' })` becomes judged. */
  static register(name: string, predicate: FormatPredicate): void {
    this.registry.set(name, predicate);
  }

  /** A registered custom predicate, or undefined — the reader the judge goes through. */
  static resolve(name: string): FormatPredicate | undefined {
    return this.registry.get(name);
  }
}


