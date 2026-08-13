import { createLocalRunner } from '@fougere/core';
import { bootAppFromConfig } from '@fougere/defaults';
import { serve } from '@fougere/transport-http';
import type { App } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/**
 * The host end of the gradient: one frond, alone in this process, reachable
 * over HTTP. `topology: false` — a served frond IS the host, it never routes
 * back out through `remotes:`. The same fronds/** an app runs in-process;
 * only the runtime moves.
 */
export default class ServeCommand {
  constructor(private app: App, private ui: Ui) {}

  async run(raw: Record<string, unknown>) {
    const frond = raw.frond as string | undefined;
    if (!frond) { this.ui.error('Usage: fougere serve <frond>'); return; }

    const app = await bootAppFromConfig(process.cwd(), { fronds: [frond], topology: false });
    if (!app.fronds.some((f) => f.name === frond)) {
      this.ui.error(`Frond '${frond}' introuvable dans ce projet.`);
      return;
    }

    const port = raw.port != null ? Number(raw.port) : 4100;
    const { port: bound } = await serve(createLocalRunner(app), { port });
    this.ui.step(`frond ${frond} servie — POST http://127.0.0.1:${bound}/_fougere/call`);
    this.ui.info('Ctrl-C pour arrêter.');
    // The listening server keeps the event loop alive; the command returns and stays up.
  }
}
