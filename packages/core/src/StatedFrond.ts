import { statesModule, type FrondAttributes, type FrondStated, type FrondsStated } from './FrondsStated.js';

/** One entry of the config, read whole. */
export interface StatedFrond {
  /** The key as written — a frond name, or a module specifier. */
  key: string;
  /** The frond it inherits code from, absent when it names none. */
  extends?: string;
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
 * Every frond the config states, those inheriting from nothing first — which is also the order
 * a boot installs them in, since a scope hangs off the one above it.
 *
 * A partition and not a sort: with one level, a frond that inherits has nothing under it, so
 * two passes put every parent before every child without knowing the tree.
 */
export function statedFronds(stated: FrondsStated | undefined): StatedFrond[] {
  const entries = Object.entries(stated ?? {}) as [string, FrondStated | undefined][];

  const read = ([key, value]: [string, FrondStated | undefined]): StatedFrond | undefined => {
    if (value === undefined) return undefined;

    const attributes = attributesOf(value, key);
    const above = attributes.extends;
    const carries = statesModule(key) ? attributes.options : attributes.remote;

    return {
      key,
      path: above !== undefined ? `${above}.${key}` : key,
      ...(above !== undefined ? { extends: above } : {}),
      ...(carries !== undefined ? { value: carries } : {}),
    };
  };

  const stands = (one: StatedFrond | undefined): one is StatedFrond => one !== undefined;
  const all = entries.map(read).filter(stands);

  return [...all.filter((one) => one.extends === undefined), ...all.filter((one) => one.extends !== undefined)];
}
