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
 *
 * An entry is EITHER that shorthand or a set of attributes, never a mix. The fronds that
 * inherit from it are named under an attribute of their own rather than beside them: an object
 * holding both would have two natures, and telling them apart would take a reserved word no
 * frond could then be called.
 */
export type FrondStated = string | FrondAttributes;

export interface FrondAttributes {
  /** The fronds that inherit this one's code, by name. */
  fronds?: readonly (NameOf<'frond'> | (string & {}))[];
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

/** One entry of the config, read whole. */
export interface StatedFrond {
  /** The key as written — a frond name, or a module specifier. */
  key: string;
  /** Who it inherits code from, absent when nothing names it. */
  under?: string;
  /** The entry that named it, for a refusal that says where to look. */
  path: string;
  /** An address for a frond that is elsewhere, an argument for a module. */
  value?: string;
}

/** What an entry says, whichever of its two forms it was written in. */
function attributesOf(stated: FrondStated, key: string): FrondAttributes {
  if (typeof stated !== 'string') return stated;

  return statesModule(key) ? { options: stated } : { remote: stated };
}

/**
 * Every frond the config states, each before the ones that inherit from it — which is also the
 * order a boot installs them in, since a child's scope hangs off its parent's.
 *
 * A name two entries claim is reported rather than resolved: which one a frond inherits from
 * would otherwise depend on reading order.
 */
export function statedFronds(stated: FrondsStated | undefined): {
  fronds: StatedFrond[];
  twice: { key: string; paths: [string, string] }[];
} {
  const entries = Object.entries(stated ?? {}) as [string, FrondStated | undefined][];
  const fronds: StatedFrond[] = [];
  const placed = new Set<string>();
  const twice: { key: string; paths: [string, string] }[] = [];

  // Named by an entry rather than nested in one: a child is a NAME here, so what it says about
  // itself stays its own entry, wherever that sits.
  const under = new Map<string, string>();
  for (const [key, value] of entries) {
    if (value === undefined) continue;

    for (const child of attributesOf(value, key).fronds ?? []) {
      const first = under.get(child);
      if (first !== undefined) {
        twice.push({ key: child, paths: [`${first}.${child}`, `${key}.${child}`] });
        continue;
      }
      under.set(child, key);
    }
  }

  const take = (key: string, value: FrondStated | undefined): void => {
    if (value === undefined || placed.has(key)) return;

    placed.add(key);
    const parent = under.get(key);
    if (parent !== undefined && !placed.has(parent)) take(parent, stated?.[parent]);

    const attributes = attributesOf(value, key);
    const carries = statesModule(key) ? attributes.options : attributes.remote;
    fronds.push({
      key,
      path: parent !== undefined ? `${parent}.${key}` : key,
      ...(parent !== undefined ? { under: parent } : {}),
      ...(carries !== undefined ? { value: carries } : {}),
    });
  };

  for (const [key, value] of entries) take(key, value);
  // A name a family claims and no entry declares is still a frond of the tree: the refusal
  // that says so has to see it.
  for (const [child, parent] of under) {
    if (placed.has(child)) continue;

    placed.add(child);
    fronds.push({ key: child, path: `${parent}.${child}`, under: parent });
  }

  return { fronds, twice };
}

/**
 * Two levels of the cascade, folded. An entry merges by attribute, and the family ADDS — a
 * config naming one more frond under `shop` may not erase the ones the workspace named.
 */
export function mergeStated(base: FrondsStated, override: FrondsStated): FrondsStated {
  const merged: Record<string, FrondStated> = { ...base } as Record<string, FrondStated>;
  for (const [key, value] of Object.entries(override)) {
    if (value === undefined) continue;

    const mine = merged[key];
    merged[key] = typeof value === 'string' || typeof mine === 'string' || mine === undefined
      ? value
      : { ...mine, ...value, ...family(mine, value) };
  }

  return merged;
}

/** The one attribute that adds rather than replaces. */
function family(base: FrondAttributes, override: FrondAttributes): FrondAttributes {
  if (!base.fronds && !override.fronds) return {};

  return { fronds: [...new Set([...base.fronds ?? [], ...override.fronds ?? []])] };
}
