import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { describeSet, diffSet, registrationKeyOf, type SchemaBundle, type SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import { VERSIONS, chainOf } from '../versions.js';
import type Freeze from '../entities/Freeze.js';

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
    const fronds = await this.read(input);
    const version = input.version;
    const entities = fronds.flatMap(({ bundle }) => Object.keys(bundle.$defs ?? {}));
    // Two entrances, one map: what the entities declare, and what a caller answered.
    // The answer wins — it is the later word on a question the declaration left open.
    const renamed = settled(fronds.map(({ declared }) => declared), input.renamed ?? {});

    // Every frond is inspected before ANY of them writes: a question standing in one
    // frond must not leave the others recorded, or a second run cuts half a version.
    const inspected = fronds.map(({ path, bundle, previous }) => ({
      path,
      bundle,
      previous,
      step: previous ? diffSet(previous.bundle, bundle, { renamed }) : undefined,
    }));

    const ambiguous: FreezeInspection['ambiguous'] = {};
    for (const { step } of inspected) {
      for (const [name, answer] of Object.entries(step?.entities ?? {})) {
        if (answer.ambiguous.length > 0) ambiguous[name] = answer.ambiguous;
      }
    }
    // Nothing on disk while a question stands. The only information the code does not
    // hold is what the person who made the change meant.
    if (Object.keys(ambiguous).length > 0) {
      return { version, previous: previousName(inspected), entities, step: merge(inspected), ambiguous, written: false };
    }

    for (const { path, bundle, previous, step } of inspected) {
      await this.record(path, version, bundle);
      if (!previous || !step) continue;
      // `previous` is recorded rather than re-derived: the chain is a fact of the moment
      // this version was cut, and a later sort of directory names is not that fact.
      await writeFile(
        join(path, VERSIONS, version, 'from.json'),
        `${JSON.stringify({ previous: previous.name, renamed, ...step }, null, 2)}\n`,
      );
    }

    return { version, previous: previousName(inspected), entities, step: merge(inspected), ambiguous: {}, written: true };
  }

  private async record(root: string, version: string, bundle: SchemaBundle): Promise<void> {
    const directory = join(root, VERSIONS, version);
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'shape.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  }

  /**
   * Today's shapes and the version before them, one entry per frond.
   *
   * `Fronds.schemas()` is deliberately flat — a fact heard in one frond is declared in
   * another — so the per-frond map is built here, where the question IS per frond.
   */
  private async read(input: Freeze) {
    const scan = await this.projectScan.at(input.root ?? undefined);
    return Promise.all(
      scan.fronds
        .filter((frond) => frond.entities.length > 0)
        .map(async (frond) => ({
          path: frond.source.path,
          bundle: describeSet(Object.fromEntries(frond.entities.map((e) => [e.name, e.entityClass]))),
          declared: declaredRenames(frond.entities),
          previous: await previousOf(frond.source.path, input.version),
        })),
    );
  }
}

type Inspected = { previous?: { name: string }; step?: SetDiff };

/**
 * What the entities state about themselves — `previous` says what a field WAS, while
 * `diff` reads old → new, so the pair is turned around here and nowhere else.
 */
function declaredRenames(
  entities: ReadonlyArray<{ name: string; entityClass: unknown }>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const { name, entityClass } of entities) {
    const previous = (entityClass as { previous?: Record<string, string> }).previous;
    // Keyed as `describeSet` keys `$defs`, which is what `diffSet` reads. Spelling the
    // convention a second way here is the defect this repo has already recorded twice.
    const key = registrationKeyOf(name);
    if (previous) out[key] = Object.fromEntries(Object.entries(previous).map(([now, was]) => [was, now]));
  }
  return out;
}

/** Every source of an answer, folded per entity — later sources win field by field. */
function settled(
  sources: ReadonlyArray<Record<string, Record<string, string>>>,
  answers: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const source of [...sources, answers]) {
    for (const [entity, pairs] of Object.entries(source)) out[entity] = { ...(out[entity] ?? {}), ...pairs };
  }
  return out;
}

/** The version every frond steps from. They are cut together, so they agree. */
function previousName(inspected: readonly Inspected[]): string | undefined {
  return inspected.find(({ previous }) => previous)?.previous?.name;
}

/**
 * One report out of several fronds — entity names are unique across a scan, so the
 * union loses nothing. Writing stays per frond; only the telling is gathered.
 */
function merge(inspected: readonly Inspected[]): SetDiff | undefined {
  const steps = inspected.map(({ step }) => step).filter((step): step is SetDiff => Boolean(step));
  if (steps.length === 0) return undefined;
  return {
    entities: Object.assign({}, ...steps.map((step) => step.entities)),
    entitiesAdded: steps.flatMap((step) => step.entitiesAdded),
    entitiesRemoved: steps.flatMap((step) => step.entitiesRemoved),
  };
}

/** The version this one steps from: the tip of the chain, the links read rather than sorted. */
async function previousOf(root: string, version: string): Promise<{ name: string; bundle: SchemaBundle } | undefined> {
  const chain = (await chainOf(root)).filter((cut) => cut.name !== version);
  const last = chain.at(-1)?.name;
  if (!last) return undefined;

  const raw = await readFile(join(root, VERSIONS, last, 'shape.json'), 'utf8').catch(() => undefined);
  return raw ? { name: last, bundle: JSON.parse(raw) as SchemaBundle } : undefined;
}
