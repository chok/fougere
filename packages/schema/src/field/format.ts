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
 * Register a format the engine does not ship — `Formats.register('siret', luhn)`
 * makes `text({ format: 'siret' })` judged.
 *
 * Same shape as {@link registerGenerator} and {@link registerDecoder}: the field
 * declares a NAME, a module supplies the realization. That is what lets the rule
 * cross a process or a language — the card carries `"format": "siret"`, which is
 * legal JSON Schema, and each runtime registers its own implementation under that
 * name. The truth travels; the realization varies.
 *
 * The registry is OURS, not the engine's. Writing into `@cfworker/json-schema`'s
 * own `format` table would work and be one line shorter, but nothing documents it
 * as an extension point, and it would weld the framework to one engine — the very
 * thing this dependency is meant to keep replaceable (it was chosen for having no
 * `eval`, not for its API).
 *
 * Registering a name the engine ALREADY judges is legal and cumulative: both
 * predicates run and both must pass, so `Formats.register('email', stricter)` makes
 * e-mails stricter and never replaces the standard rule.
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


