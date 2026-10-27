/**
 * Where a value is read — `Env<Meili>` — the port a link stands in front of to change what a source
 * gave before it is judged: `class MeiliFromVault implements Partial<Env<Meili>>`, asking for
 * `inner: Env<Meili>`, touches Meili and nothing else. The value is read through it ONCE, at boot,
 * and handed to whoever names `Meili`.
 *
 * Documented: [values](https://fougere.dev/docs/business/values).
 */
export abstract class Env<T> {
  /** What the source holds for this value, before its defaults and its judge. */
  abstract read(): Promise<Partial<T> | undefined>;
}

/** `Env<Meili>`, keyed as written — the key no class name can take. */
export const envKeyOf = (entityClassName: string): string => `Env<${entityClassName}>`;
