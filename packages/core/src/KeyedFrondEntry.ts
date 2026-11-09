import { statesModule, type FrondAttributes, type FrondEntry, type FrondEntries } from './FrondEntries.js';
import { isFrondDescriptor, type FrondDescriptor } from './descriptor/FrondDescriptor.js';

/** One entry of the config, read whole. */
export interface KeyedFrondEntry {
  /** The key as written — a frond name, or a module specifier. */
  key: string;
  /** The frond it inherits code from, absent when it names none. */
  extends?: string;
  /** The entry that named it, for a refusal that says where to look. */
  path: string;
  /** An address for a frond that is elsewhere, an argument for a module. */
  value?: string;
  /** The frond the config built in place, which the host installs like one it scanned. */
  descriptor?: FrondDescriptor;
}

function attributesOf(entry: FrondEntry, key: string): FrondAttributes {
  if (typeof entry === 'string') {
    const written = statesModule(key) ? `{ options: '${entry}' }` : `{ remote: '${entry}' }`;
    const named = statesModule(key) ? `'${key}'` : key;
    throw new Error(`fougere.config.ts: the entry '${key}' is a string. Write ${named}: ${written}.`);
  }

  return isFrondDescriptor(entry) ? {} : entry;
}

/** Every frond the config states, the ones inheriting from nothing first. */
export function keyedFrondEntries(fronds: FrondEntries | undefined): KeyedFrondEntry[] {
  const entries = Object.entries(fronds ?? {}) as [string, FrondEntry | undefined][];

  const read = ([key, value]: [string, FrondEntry | undefined]): KeyedFrondEntry | undefined => {
    if (value === undefined) return undefined;

    const attributes = attributesOf(value, key);
    const above = attributes.extends;
    const carries = statesModule(key) ? attributes.options : attributes.remote;

    return {
      key,
      path: above !== undefined ? `${above}.${key}` : key,
      ...(above !== undefined ? { extends: above } : {}),
      ...(carries !== undefined ? { value: carries } : {}),
      ...(isFrondDescriptor(value) ? { descriptor: value } : {}),
    };
  };

  const stands = (one: KeyedFrondEntry | undefined): one is KeyedFrondEntry => one !== undefined;
  const all = entries.map(read).filter(stands);

  return [...all.filter((one) => one.extends === undefined), ...all.filter((one) => one.extends !== undefined)];
}
