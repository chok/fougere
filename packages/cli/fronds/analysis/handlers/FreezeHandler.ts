import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { resolveConventions } from '@fougere/core';
import { Bundle, lowerFirst, type SchemaBundle, type SchemaView, type SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import { lastVersionOf, shapesOf } from '../versions.js';
import type Freeze from '../entities/Freeze.js';

export interface FreezeInspection {
  version: string;
  /** The version this one follows, or absent when it is the first. */
  previous?: string;
  entities: string[];
  /** What the step contains — absent when there is nothing before to step from. */
  step?: SetDiff;
  /** Per entity, the pairs the calculation refuses to decide. Empty means it was written. */
  ambiguous: Record<string, { removed: string; added: string }[]>;
  /** Whether anything reached the disk — false while a question stands. */
  written: boolean;
}

/** Freezing a version — the artefact three readers share. */
export default class FreezeHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Record this version — or report what stops it, having written nothing. */
  async execute(input: Omit<Freeze, 'json'> & { renamed?: Record<string, Record<string, string>> }): Promise<FreezeInspection> {
    const { fronds, versions } = await this.read(input);
    const version = input.version;
    const entities = fronds.flatMap(({ bundle }) => Object.keys(bundle.$defs ?? {}));
    const renamed = settled(fronds.map(({ declared }) => declared), input.renamed ?? {});

    const inspected = fronds.map(({ path, bundle, previous }) => ({
      path,
      bundle,
      previous,
      step: previous
        ? Bundle.fromDescriptor(previous.bundle).diff(Bundle.fromDescriptor(bundle), { renamed })
        : undefined,
    }));

    const ambiguous: FreezeInspection['ambiguous'] = {};
    for (const { step } of inspected) {
      for (const [name, answer] of Object.entries(step?.entities ?? {})) {
        if (answer.ambiguous.length > 0) ambiguous[name] = answer.ambiguous;
      }
    }
    if (Object.keys(ambiguous).length > 0) {
      return { version, previous: previousName(inspected), entities, step: merge(inspected), ambiguous, written: false };
    }

    for (const { path, bundle, previous, step } of inspected) {
      await this.record(join(path, versions, version), bundle);
      if (!previous || !step) continue;
      await writeFile(
        join(path, versions, version, 'from.json'),
        `${JSON.stringify({ previous: previous.name, renamed, ...step }, null, 2)}\n`,
      );
    }

    return { version, previous: previousName(inspected), entities, step: merge(inspected), ambiguous: {}, written: true };
  }

  private async record(directory: string, bundle: SchemaBundle): Promise<void> {
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, 'shape.json'), `${JSON.stringify(bundle, null, 2)}\n`);
  }

  private async read(input: Omit<Freeze, 'json'>) {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const { versions } = resolveConventions(scan.config.conventions).dirs;
    const fronds = await Promise.all(
      scan.fronds
        .filter((frond) => frond.entities.length > 0)
        .map(async (frond) => ({
          path: frond.source.path,
          bundle: shapesOf(frond.entities),
          declared: declaredRenames(frond.entities),
          previous: await lastVersionOf(frond.source.path, versions, input.version),
        })),
    );

    return { fronds, versions };
  }
}

type Inspected = { previous?: { name: string }; step?: SetDiff };

function declaredRenames(
  entities: readonly { name: string; entityClass: unknown }[],
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const { name, entityClass } of entities) {
    const previous = (entityClass as SchemaView).previous;
    const key = lowerFirst(name);
    if (previous) out[key] = Object.fromEntries(Object.entries(previous).map(([now, was]) => [was, now]));
  }

  return out;
}

function settled(
  sources: readonly Record<string, Record<string, string>>[],
  answers: Record<string, Record<string, string>>,
): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  for (const source of [...sources, answers]) {
    for (const [entity, pairs] of Object.entries(source)) out[entity] = { ...out[entity], ...pairs };
  }

  return out;
}

function previousName(inspected: readonly Inspected[]): string | undefined {
  return inspected.find(({ previous }) => previous)?.previous?.name;
}

function merge(inspected: readonly Inspected[]): SetDiff | undefined {
  const steps = inspected.map(({ step }) => step).filter((step): step is SetDiff => Boolean(step));
  if (steps.length === 0) return undefined;

  return {
    entities: Object.assign({}, ...steps.map((step) => step.entities)),
    entitiesAdded: steps.flatMap((step) => step.entitiesAdded),
    entitiesRemoved: steps.flatMap((step) => step.entitiesRemoved),
  };
}
