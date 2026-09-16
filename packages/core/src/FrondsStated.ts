import type { NameOf } from './NameOf.js';

/**
 * What the config says about the fronds this app is made of — where each one comes from, and
 * which one it inherits code from.
 *
 * `fronds:` on an entry says ONE thing: those fronds resolve what this one declared. It says
 * nothing about placement, and nothing about the right to call — two fronds reach each other
 * through a façade or an announced fact, whatever their place here.
 *
 * The key SUGGESTS what the scan found and refuses nothing: `NameOf<'frond'>` alone would
 * close the record, and a module specifier is a legal key no scan can have seen. `string & {}`
 * is what keeps the union open while an editor still lists the names.
 *
 * Documented: [fronds](https://fougere.dev/docs/infra/fronds).
 */
export type FrondsStated = {
  readonly [frond in NameOf<'frond'> | (string & {})]?: FrondStated;
};

/**
 * Everything an entry says, or the one string that is the whole of it — an address for a frond
 * that answers elsewhere, the argument for a module key.
 */
export type FrondStated = string | FrondAttributes;

export interface FrondAttributes {
  /**
   * The frond this one inherits code from — its scope hangs off that one's.
   *
   * Said by the INHERITOR, and scalar: a name then lives in one place, so moving a frond from
   * one family to another is one edit and removing it leaves nothing dangling. It is the form
   * `tsconfig`, Maven and Kubernetes all chose for inheritance, and the one that makes
   * "one parent" a fact of the shape rather than a refusal at boot.
   *
   * ONE level: the frond it names may not inherit itself (`frond-extends-chain`). Nothing in
   * this repo has ever wanted a chain, and refusing it is also what keeps a cycle out.
   */
  extends?: NameOf<'frond'> | (string & {});
  /** Where it answers — the same thing the shorthand says. */
  remote?: string;
  /** What the host hands a module key when it imports it. */
  options?: string;
}

/**
 * A key that names a module rather than a frond. A frond's name is a directory name or the
 * `fougere.frond` field of a package, and neither can hold a separator — so the two never
 * collide, and no allow-list of short names has to be kept anywhere.
 */
export function statesModule(key: string): boolean {
  return key.includes('/') || key.startsWith('.');
}

/**
 * Two levels of the cascade, folded. An entry merges by attribute, so an app naming a frond's
 * address keeps the `extends` the workspace gave it — and an app naming a different `extends`
 * replaces it, silently, the way every scalar key of this config replaces.
 */
export function mergeStated(base: FrondsStated, override: FrondsStated): FrondsStated {
  const merged: Record<string, FrondStated> = { ...base } as Record<string, FrondStated>;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;

    const mine = merged[key];
    merged[key] = typeof value === 'string' || typeof mine === 'string' || mine === undefined
      ? value
      : { ...mine, ...value };
  }

  return merged;
}
