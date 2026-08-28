import { createAppRunner } from '@fougere/core';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type { MigrationPlan } from '../../fronds/analysis/handlers/MigrateHandler.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/**
 * Catching a database up with the frozen chain.
 *
 * Prints by default and moves nothing: what this runs drops and renames columns, so the
 * plan is read before it is agreed to. `--apply` is that agreement.
 */
export default class MigrateCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const result = (await createAppRunner(this.app)(
      { entity: 'migrate', op: 'execute' },
      { params: {}, query: {}, body: raw, state: {} },
    )) as MigrationPlan;

    if (machineWanted(raw)) return printMachine(result);

    if (result.chain.length === 0) {
      this.ui.warn('No frozen step to apply. `fougere freeze <version>` records one.');
      return;
    }

    if (result.refusals.length > 0) {
      this.ui.error(`This chain cannot be realised as it stands (${result.chain.join(' → ')}):`);
      for (const one of result.refusals) this.ui.step(`${pc.bold(`${one.entity}.${one.field}`)} — ${one.reason}`);
      return;
    }

    if (result.changes.length === 0) {
      this.ui.success(`Up to date — ${result.chain.join(' → ')} already realised.`);
      return;
    }

    for (const change of result.changes) {
      this.ui.step(
        change.kind === 'renameColumn'
          ? `${change.table}: ${pc.bold(change.from)} → ${pc.bold(change.to)}`
          : `${change.table}: drop ${pc.bold(change.column)}`,
      );
    }

    if (result.ran.length === 0) {
      this.ui.info(`${result.changes.length} statement(s) — run again with ${pc.bold('--apply')} to make it so.`);
      return;
    }
    this.ui.success(`${result.ran.length} statement(s) run.`);
  }
}
