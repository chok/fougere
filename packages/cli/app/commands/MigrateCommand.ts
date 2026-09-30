import { createAppRunner } from '@fougere/core';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type { MigrationPlan } from '../../fronds/analysis/handlers/MigrateHandler.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/**
 * Bringing a database up to what `fougere freeze` recorded — or, with `--latest`, to the entities.
 *
 * Prints by default and moves nothing: what this runs renames and drops columns, so the
 * plan is read before it is agreed to. `--apply` is that agreement.
 */
export default class MigrateCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const result = (await createAppRunner(this.app)(
      { entity: 'migrate', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    )) as MigrationPlan;

    if (result.refusals.length > 0) process.exitCode = 1;
    if (machineWanted(raw)) return printMachine(result);

    if (result.refusals.length > 0) {
      const chain = result.chain.length > 0 ? ` (${result.chain.join(' → ')})` : '';
      this.ui.error(`This migration cannot be realised as it stands${chain}:`);
      for (const one of result.refusals) this.ui.step(`${pc.bold(`${one.entity}.${one.field}`)} — ${one.reason}`);

      return;
    }

    for (const change of result.changes) {
      this.ui.step(
        change.kind === 'renameColumn'
          ? `${change.table}: ${pc.bold(change.from)} → ${pc.bold(change.to)}`
          : `${change.table}: drop ${pc.bold(change.column)}`,
      );
    }
    for (const line of result.added) this.ui.step(`create ${line.replace(/ — no (table|column)$/, '')}`);
    for (const warning of result.warnings) this.ui.warn(warning);

    const planned = result.changes.length + result.added.length;
    if (planned === 0 && result.warnings.length > 0) {
      this.ui.info('Nothing to add. What is warned above stays as it is: an existing column is never altered.');

      return;
    }
    if (planned === 0) {
      this.ui.success('Up to date — the database holds what the entities declare.');

      return;
    }
    if (result.ran.length === 0) {
      this.ui.info(`${planned} change(s) — run again with ${pc.bold('--apply')} to make it so.`);

      return;
    }
    this.ui.success(`${planned} change(s) applied.`);
  }
}
