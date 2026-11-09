import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { Bundle, type SchemaBundle, type SchemaView, type SetDiff } from '@fougere/schema';

/** One cut version: its name, and the step that reached it — absent on the first. */
export interface Version {
  name: string;
  step?: SetDiff & { previous?: string };
}

/** The versions a frond has cut, oldest first, read by following each step's `previous`. */
export async function chainOf(frondPath: string, versions: string): Promise<Version[]> {
  const directory = join(frondPath, versions);
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
    const said = roots.length === 0 ? 'none is the first' : `${roots.join(', ')} are each a first one`;
    throw new Error(`${directory}: versions must follow one another in a single line, and ${said}.`);
  }

  const next = new Map<string, string>();
  for (const [name, step] of steps) if (step?.previous !== undefined) next.set(step.previous, name);

  const chain: Version[] = [];
  const seen = new Set<string>();
  for (let at: string | undefined = roots[0]; at !== undefined && !seen.has(at); at = next.get(at)) {
    seen.add(at);
    chain.push({ name: at, step: steps.get(at) });
  }

  const adrift = names.filter((name) => !seen.has(name));
  if (adrift.length > 0) {
    throw new Error(`${directory}: ${adrift.join(', ')} do not follow any version of the line that starts at ${roots[0]}.`);
  }

  return chain;
}

/** The tip of a frond's chain and its shapes there — `except` leaves out the version being cut. */
export async function lastVersionOf(frondPath: string, versions: string, except?: string): Promise<{ name: string; bundle: SchemaBundle } | undefined> {
  const chain = (await chainOf(frondPath, versions)).filter((cut) => cut.name !== except);
  const last = chain.at(-1)?.name;
  if (!last) return undefined;

  const raw = await readFile(join(frondPath, versions, last, 'shape.json'), 'utf8').catch(() => undefined);

  return raw ? { name: last, bundle: JSON.parse(raw) as SchemaBundle } : undefined;
}

/** A frond's shapes today, keyed as a version records them. */
export function shapesOf(entities: readonly { name: string; entityClass: SchemaView }[]): SchemaBundle {
  return Bundle.fromSchemas(Object.fromEntries(entities.map((entry) => [entry.name, entry.entityClass]))).descriptor;
}
