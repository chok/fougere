import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import type { SetDiff } from '@fougere/schema';

/**
 * Where a FROND keeps what its shapes used to be — beside `entities/`, not under a dot.
 * Written by `fougere freeze`, replayed by `fougere migrate`.
 */
export const VERSIONS = 'versions';

/** One cut version: its name, and the step that reached it — absent on the first. */
export interface Version {
  name: string;
  step?: SetDiff & { previous?: string };
}

/**
 * The versions a frond has cut, oldest first — read by FOLLOWING each step's `previous`.
 *
 * That link is the fact recorded the day the version was cut. Sorting directory names is
 * a guess about the same fact, and a hotfix cut after a later version orders it wrong.
 */
export async function chainOf(frondPath: string): Promise<Version[]> {
  const directory = join(frondPath, VERSIONS);
  const found = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const names = found.filter((entry) => entry.isDirectory()).map((entry) => entry.name);
  if (names.length === 0) return [];

  const steps = new Map<string, Version['step']>();
  for (const name of names) {
    const raw = await readFile(join(directory, name, 'from.json'), 'utf8').catch(() => undefined);
    steps.set(name, raw ? (JSON.parse(raw) as Version['step']) : undefined);
  }

  const roots = names.filter((name) => steps.get(name)?.previous === undefined);
  if (roots.length !== 1) {
    const said = roots.length === 0 ? 'none starts it' : `${roots.join(', ')} each start one`;
    throw new Error(`${directory}: a frond's versions are ONE line and ${said}.`);
  }

  const next = new Map<string, string>();
  for (const [name, step] of steps) if (step?.previous !== undefined) next.set(step.previous, name);

  const chain: Version[] = [];
  const seen = new Set<string>();
  for (let at: string | undefined = roots[0]; at !== undefined && !seen.has(at); at = next.get(at)) {
    seen.add(at);
    chain.push({ name: at, step: steps.get(at) });
  }

  // One check for every way the links fail to be a line: a fork (two versions claiming
  // the same `previous`), a cycle, or a step naming a version that is not there.
  const adrift = names.filter((name) => !seen.has(name));
  if (adrift.length > 0) {
    throw new Error(`${directory}: ${adrift.join(', ')} follow no version in the chain that starts at ${roots[0]}.`);
  }
  return chain;
}
