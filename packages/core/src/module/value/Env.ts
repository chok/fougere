/**
 * Where a value is read; a link in front of it changes what a source gave.
 * Ex: `implements Partial<Env<Meili>>`.
 *
 * Documented: [values](https://fougere.dev/docs/data/values).
 */
export abstract class Env<T> {
  /** What the source holds for this value, before its defaults and its judge. */
  abstract read(): Promise<Partial<T> | undefined>;
}

/** `Env<Meili>`, keyed as written — the key no class name can take. */
export const envKeyOf = (entityClassName: string): string => `Env<${entityClassName}>`;
