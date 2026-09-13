/**
 * What this project contains, as TYPES — the names an operator writes in a config file.
 *
 * `fougere.config.ts` and `frond.config.ts` name classes, entities and fronds by string:
 * `ports: { Payment: 'StripePayment' }` is two of them, and neither is tied to the class it
 * designates. Renaming `StripePayment` leaves the config untouched, and the app says so at boot.
 * Everywhere else the declaration carries its own type, so this is the last place a name is
 * written without anything reading it back.
 *
 * These interfaces are EMPTY here and filled by the generated file, the way `FougereOperations`
 * is: the scan already knows every name, and core must not hold a list that a project would have
 * to keep in step.
 *
 * Documented: [config](https://fougere.dev/docs/config).
 */

/** The names the scan found, per kind. Augmented from the generated file, empty otherwise. */
export interface FougereNames {}

/**
 * Each port, and the classes that extend it — a RELATION, not two lists.
 *
 * Two unions would accept `ports: { Payment: 'FileStorage' }`: both names exist, and nothing
 * would say that one does not answer the other. What the boot refuses, the type refuses first.
 */
export interface FougerePorts {}

/**
 * One kind's union, or `string` where nothing was generated.
 *
 * A conditional and never `Partial<FougereNames>`: an un-augmented interface makes that
 * `Partial<{}>`, which in TypeScript means "anything non-nullish" — the silent hole `adapters:`
 * already has. Falling back to `string` is what a config had before this file existed.
 */
export type NameOf<K extends string> = FougereNames extends Record<K, infer Found extends string>
  ? Found
  : string;

/** What may answer a port — its own realizations, or any class name where nothing was generated. */
export type AnswerFor<Port extends string> = FougerePorts extends Record<Port, infer Answers extends string>
  ? Answers
  : NameOf<'handler'>;

/**
 * The ports of this app, each mapped to what may answer it.
 *
 * `keyof FougerePorts` is `never` before generation, and a mapped type over `never` is `{}` —
 * which would refuse every key rather than accept any. So the empty case widens to the plain
 * record the config had, and only a generated file narrows it.
 */
export type PortChoice = keyof FougerePorts extends never
  ? Record<string, string | readonly string[]>
  : { [Port in keyof FougerePorts]?: AnswerFor<Port & string> | readonly AnswerFor<Port & string>[] };
