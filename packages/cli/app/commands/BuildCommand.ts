import { createAppRunner } from '@fougere/core';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';
import type { BuildReport } from '../../fronds/analysis/handlers/BuildHandler.js';
import pc from 'picocolors';
import { machineWanted, printMachine } from '../../src/machine.js';

type Ui = ReturnType<typeof createUi>;

/** `fougere build`, reporting what the module holds. */
export default class BuildCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const built = (await createAppRunner(this.app)(
      { address: 'build', op: 'execute' },
      { params: {}, query: {}, input: raw, state: {} },
    )) as BuildReport;

    if (machineWanted(raw)) return printMachine(built);

    if (built.fronds.length === 0) {
      this.ui.warn('No fronds found. Run this from a Fougere project root.');

      return;
    }

    this.ui.success(`${built.path} — ${built.fronds.length} frond(s), ${built.entities} entities, ${built.handlers} handlers`);
    this.ui.step(built.fronds.map((name) => pc.bold(name)).join(', '));
    this.ui.step(`${built.built}/ — ${built.files} file(s) of JavaScript, what \`fougere serve\` starts`);

    for (const diagnostic of built.diagnostics) this.ui.warn(diagnostic);

    this.ui.step(pc.dim('hand its fronds and its vocabulary to createApp — nothing reads a disk after this'));
  }
}
