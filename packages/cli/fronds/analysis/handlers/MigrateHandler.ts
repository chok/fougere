import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '@fougere/core';
import { resolveStorage } from '@fougere/defaults';
import { actualState, desiredTables, planStep, collapseChain, applyStep, type Plan, type StepChange } from '@fougere/adapter-sql';
import type { SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import type Migrate from '../entities/Migrate.js';

/** Beside the frond's source, and committed — see `FreezeHandler`. */
const VERSIONS = 'versions';

export interface MigrationPlan {
  /** Versions whose step was read, oldest first. */
  chain: string[];
  changes: StepChange[];
  refusals: Plan['refusals'];
  /** The statements actually run — empty unless `apply` was asked for. */
  ran: string[];
}

/**
 * Catching the database up with the frozen chain.
 *
 * Every step is replayed in order and what has already happened is SKIPPED, read off the
 * columns themselves rather than a ledger of applied migrations. That is what makes the
 * chain safe to replay whole: nothing here has to know which version the database sits
 * at, and a column renamed by hand is seen rather than contradicted.
 *
 * The additive pass is not repeated here — a boot already creates missing tables and
 * columns. What this adds is the half that touches live data, and only what a human
 * declared at `fougere freeze`.
 */
export default class MigrateHandler {
  constructor(private projectScan: ProjectScan) {}

  /** Realise the frozen steps this database has not caught up with. */
  async execute(input: Migrate): Promise<MigrationPlan> {
    const scan = await this.projectScan.at(input.root ?? undefined);
    const perFrond = await Promise.all(scan.fronds.map((frond) => chainOf(frond.source.path)));
    const steps = perFrond.flat();
    if (steps.length === 0) return { chain: [], changes: [], refusals: [], ran: [] };

    const config = await loadConfig(scan.root);
    const storage = resolveStorage(config.db ?? {});
    if (!storage.db) {
      return {
        chain: versionsOf(steps),
        changes: [],
        refusals: [{ entity: '*', field: '*', reason: 'no `db` in fougere.config.ts — nothing to migrate' }],
        ran: [],
      };
    }

    const tables = desiredTables(scan as never);
    // Each frond's chain is composed on its own — its versions are its own line — and the
    // results are gathered by SOURCE, because an engine is what a statement runs against.
    const composed = collapseChain(perFrond.map((chain) => collapseChain(chain.map(({ step }) => step))));
    const sourceOf = storage.sourceOf ?? (() => 'db');

    const changes: StepChange[] = [];
    const refusals: Plan['refusals'] = [];
    const ran: string[] = [];
    for (const source of storage.sources?.() ?? ['db']) {
      const db = (source === 'db' ? storage.db : storage.dbOf?.(source)) as Parameters<typeof actualState>[0];
      if (!db) continue;

      const mine = onSource(composed, source, sourceOf);
      if (Object.keys(mine.entities).length === 0) continue;

      const plan = planStep(mine, tables, { actual: await actualState(db) });
      changes.push(...plan.changes);
      refusals.push(...plan.refusals);
      // Held back: a refusal anywhere stops every engine, for the reason it stops every
      // statement — half a chain is worse across two engines than within one.
      if (input.apply && refusals.length === 0) ran.push(...(await applyStep(plan, db)));
    }

    return { chain: versionsOf(steps), changes, refusals, ran: refusals.length > 0 ? [] : ran };
  }
}

/** The versions read, oldest first and each named once however many fronds cut it. */
function versionsOf(steps: ReadonlyArray<{ version: string }>): string[] {
  return [...new Set(steps.map(({ version }) => version))].sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
}

/** The part of a step whose entities live on one engine. */
function onSource(step: SetDiff, source: string, sourceOf: (entity: string) => string): SetDiff {
  return {
    ...step,
    entities: Object.fromEntries(Object.entries(step.entities).filter(([entity]) => sourceOf(entity) === source)),
  };
}

/** Every recorded step, oldest first — the chain composes, so it is replayed whole. */
async function chainOf(frondPath: string): Promise<Array<{ version: string; step: SetDiff }>> {
  const directory = join(frondPath, VERSIONS);
  const found = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const versions = found
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));

  const chain: Array<{ version: string; step: SetDiff }> = [];
  for (const version of versions) {
    // The first version has a shape and no step — there was nothing before it to move from.
    const raw = await readFile(join(directory, version, 'from.json'), 'utf8').catch(() => undefined);
    if (raw) chain.push({ version, step: JSON.parse(raw) as SetDiff });
  }
  return chain;
}
