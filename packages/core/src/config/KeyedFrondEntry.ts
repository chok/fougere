import { statesModule, type FrondAttributes, type FrondEntry, type FrondEntries } from './FrondEntries.js';
import { isFrondDescriptor, type FrondDescriptor } from '../descriptor/FrondDescriptor.js';

/** One entry of the config, read whole. */
export interface KeyedFrondEntry {
  /** The key as written — a frond name, or a module specifier. */
  key: string;
  /** The frond it inherits code from, absent when it names none. */
  extends?: string;
  /** The entry that named it, for a refusal that says where to look. */
  path: string;
  /** What the host hands a module when it imports it. */
  value?: string;
  /** The frond the config built in place, which the host installs like one it scanned. */
  descriptor?: FrondDescriptor;
}

function attributesOf(entry: FrondEntry, key: string): FrondAttributes {
  if (typeof entry === 'string') {
    const written = statesModule(key)
      ? `Write '${key}': { options: '${entry}' }.`
      : `Where a frond answers is written in fougere.topology.yaml.`;
    throw new Error(`fougere.config.ts: the entry '${key}' is a string. ${written}`);
  }

  return isFrondDescriptor(entry) ? {} : entry;
}

/** The fronds a process loads: the ones it runs, and the ones they extend, whose code they take. */
export function withExtended(names: readonly string[], fronds: FrondEntries | undefined): string[] {
  const extended = keyedFrondEntries(fronds)
    .filter((entry) => entry.extends !== undefined && names.includes(entry.key))
    .map((entry) => entry.extends as string);

  return [...new Set([...extended, ...names])];
}

/** Every frond the config states, the ones inheriting from nothing first. */
export function keyedFrondEntries(fronds: FrondEntries | undefined): KeyedFrondEntry[] {
  const entries = Object.entries(fronds ?? {}) as [string, FrondEntry | undefined][];

  const read = ([key, value]: [string, FrondEntry | undefined]): KeyedFrondEntry | undefined => {
    if (value === undefined) return undefined;

    const attributes = attributesOf(value, key);
    const above = attributes.extends;
    const carries = statesModule(key) ? attributes.options : undefined;

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
