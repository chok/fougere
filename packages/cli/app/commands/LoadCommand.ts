import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import type { LoadScenario } from '../../fronds/analysis/handlers/LoadHandler.js';
import type { ui as createUi } from '../../src/ui.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/** Writes the load scenario the project describes; the weights, stages and thresholds are yours. */
export default class LoadCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const result = await createAppRunner(this.app)(
      { address: 'load', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    ) as LoadScenario;

    if (machineWanted(raw)) return printMachine(result);

    if (result.operations.length === 0) {
      this.ui.warn('No operation to put under load.');

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
