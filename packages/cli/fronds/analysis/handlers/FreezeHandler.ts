import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeSet, diffSet, type SchemaBundle, type SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import type Freeze from '../entities/Freeze.js';

/** Where a project keeps what its shapes USED to be. */
const VERSIONS = '.fougere/versions';

export interface FreezeInspection {
  version: string;
  /** The version this one follows, or absent when it is the first. */
  previous?: string;
  entities: string[];
  /** What the step contains — absent when there is nothing before to step from. */
  step?: SetDiff;
  /** Per entity, the pairs the calculation refuses to decide. Empty means it was written. */
  ambiguous: Record<string, Array<{ removed: string; added: string }>>;
  /** Whether anything reached the disk — false while a question stands. */
  written: boolean;
}

/**
 * Freezing a version — the artefact three readers share.
 *
 * A snapshot alone loses the INTENT (a field gone plus a field appeared cannot be told
 * from a rename), and a step alone corrupts in silence. Both are written, and replaying
 * the step over the previous snapshot must reproduce this one — which is what catches a
 * missing step or a hand-edited file.
 *
 * Nothing is written while an ambiguity stands: the only information the code does not
 * hold is what the person who made the change meant, and this is the one place asking
 * for it is justified.
 */
export default class FreezeHandler {
  constructor(private projectScan: ProjectScan) {}

  /**
   * Record this version — or report what stops it, having written nothing.
   *
   * One op and not two: it is idempotent while it refuses, so a caller settles the
   * ambiguities and calls again with `renamed`. Splitting it would let a caller write
   * a version it never inspected.
   */
  async execute(input: Freeze & { renamed?: Record<string, Record<string, string>> }): Promise<FreezeInspection> {
    const { root, bundle, previous } = await this.read(input);
    const version = input.version;
    const entities = Object.keys(bundle.$defs ?? {});

    if (!previous) {
      await this.record(root, version, bundle);
      return { version, entities, ambiguous: {}, written: true };
    }

    const renamed = input.renamed ?? {};
    const step = diffSet(previous.bundle, bundle, { renamed });

    const ambiguous: FreezeInspection['ambiguous'] = {};
    for (const [name, answer] of Object.entries(step.entities)) {
      if (answer.ambiguous.length > 0) ambiguous[name] = answer.ambiguous;
    }
    // Nothing on disk while a question stands. The only information the code does not
    // hold is what the person who made the change meant.
    if (Object.keys(ambiguous).length > 0) {
      return { version, previous: previous.name, entities, step, ambiguous, written: false };
    }

    await this.record(root, version, bundle);
    // `previous` is recorded rather than re-derived: the chain is a fact of the moment
    // this version was cut, and a later sort of directory names is not that fact.
    await writeFile(
      join(root, VERSIONS, version, 'from.json'),
      `${JSON.stringify({ previous: previous.name, renamed, ...step }, null, 2)}\n`,
    );

    return { version, previous: previous.name, entities, step, ambiguous: {}, written: true };
  }

  private async record(root: string, version: string, bundle: SchemaBundle): Promise<void> {
    const directory = join(root, VERSIONS, version);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'shape.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  }

  /** Today's shapes, and the last version recorded before them. */
  private async read(input: Freeze) {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const schemas: Record<string, unknown> = {};
    for (const frond of scan.fronds) {
      for (const found of frond.entities) schemas[found.name] = found.entityClass;
    }
    const bundle = describeSet(schemas as Record<string, never>);
    return { root: scan.root, bundle, previous: await previousOf(scan.root, input.version) };
  }
}

/** The version recorded just before this one — by name order, and only this once. */
async function previousOf(root: string, version: string): Promise<{ name: string; bundle: SchemaBundle } | undefined> {
  const directory = join(root, VERSIONS);
  const found = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const names = found
    .filter((entry) => entry.isDirectory() && entry.name !== version)
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const last = names.at(-1);
  if (!last) return undefined;

  const raw = await readFile(join(directory, last, 'shape.json'), 'utf8').catch(() => undefined);
  return raw ? { name: last, bundle: JSON.parse(raw) as SchemaBundle } : undefined;
}
