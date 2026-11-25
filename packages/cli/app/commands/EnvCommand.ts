import { environmentOf, type App } from '@fougere/core';
import { loadConfig } from '@fougere/core/node';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/** Prints, one `KEY=value` a line, what a process is told by whoever starts it — a file `.env` and a shell both read it. */
export default class EnvCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    let environment: Record<string, string>;
    try {
      environment = environmentOf(await loadConfig(process.cwd()), raw.process as string | undefined);
    } catch (refusal) {
      this.ui.error((refusal as Error).message);

      return;
    }

    for (const [key, value] of Object.entries(environment)) process.stdout.write(`${key}='${value}'\n`);
  }
}
