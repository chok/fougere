import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { LoadScenario } from '../../fronds/analysis/handlers/LoadHandler.js';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/**
 * The command the generated header has been naming all along.
 *
 * What it writes is derived — the operations from what the project serves, a body for each from
 * the entity's own fields, the envelope from the one function that states it. What it cannot
 * derive is what the load IS: the weights, the stages and the thresholds are facts about your
 * users, and the file says so where they sit.
 */
export default class LoadCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const result = await createAppRunner(this.app)(
      { entity: 'load', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    ) as LoadScenario;

    if (machineWanted(raw)) return printMachine(result);

    if (result.operations.length === 0) {
      this.ui.warn('No operation answers the default facade — nothing to put under load.');
      return;
    }

    if (!result.file) {
      process.stdout.write(result.script);
      return;
    }

    this.ui.step(`${pc.bold(String(result.operations.length))} operation(s) against ${pc.dim(result.facade)}`);
    this.ui.note(result.operations.map((one) => `  ${one}`).join('\n'), 'Under load');
    this.ui.info(`${pc.dim('Written to')} ${result.file}  ${pc.dim('— edit the weights, the stages and the thresholds.')}`);
    this.ui.info(`${pc.dim('Then:')} k6 run ${result.file}`);
  }
}
