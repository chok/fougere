import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { loadConfig } from '@fougere/core';
import { resolveStorage } from '@fougere/defaults';
import { actualState, desiredTables, planStep, applyStep, type Plan, type StepChange } from '@fougere/adapter-sql';
import type { SetDiff } from '@fougere/schema';
import ProjectScan from '../services/ProjectScan.js';
import type Migrate from '../entities/Migrate.js';

const VERSIONS = '.fougere/versions';

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
    const steps = await chainOf(scan.root);
    if (steps.length === 0) return { chain: [], changes: [], refusals: [], ran: [] };

    const config = await loadConfig(scan.root);
    const { db } = resolveStorage(config.db ?? {}) as { db?: never };
    if (!db) {
      return {
        chain: steps.map(({ version }) => version),
        changes: [],
        refusals: [{ entity: '*', field: '*', reason: 'no `db` in fougere.config.ts — nothing to migrate' }],
        ran: [],
      };
    }

    const tables = desiredTables(scan as never);
    const actual = await actualState(db);

    // One state, read once. Every step is planned against the SAME observation, so a
    // chain of two steps touching one column proposes both — the second is not hidden
    // by the first, which has not run yet.
    const changes: StepChange[] = [];
    const refusals: Plan['refusals'] = [];
    for (const { step } of steps) {
      const plan = planStep(step, tables, { actual });
      changes.push(...plan.changes);
      refusals.push(...plan.refusals);
    }

    const chain = steps.map(({ version }) => version);
    if (!input.apply || refusals.length > 0 || changes.length === 0) {
      return { chain, changes, refusals, ran: [] };
    }
    return { chain, changes, refusals, ran: await applyStep({ changes, refusals }, db) };
  }
}

/** Every recorded step, oldest first — the chain composes, so it is replayed whole. */
async function chainOf(root: string): Promise<Array<{ version: string; step: SetDiff }>> {
  const directory = join(root, VERSIONS);
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
