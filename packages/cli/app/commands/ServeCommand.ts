import { createLocalRunner, identityFromEnv } from '@fougere/core';
import { watchPathsOf } from '@fougere/core/node';
import { installLoader } from '../../src/loader.js';
import type { Conventions } from '@fougere/core/node';
import { bootAppFromConfig } from '@fougere/defaults';
import { serve } from '@fougere/transport-http';
import { watch } from 'node:fs';
import type { App, Transport } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/** What a reload gives the calls already running before it releases the app they hold. */
const DRAIN_MS = 5_000;

/** One save fires several events; the boot must not start once per event. */
const SETTLE_MS = 60;

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

    const root = process.cwd();
    const watching = raw.watch === true;

    // Cache-free from the FIRST boot when watching, so every boot in this process reads
    // the same way rather than the first one being special.
    const conventions = await installLoader(root, watching);

    let hosted = await bootAppFromConfig(root, { fronds: [frond], topology: false });
    if (!hosted.fronds.some((f) => f.name === frond)) {
      this.ui.error(`Frond '${frond}' introuvable dans ce projet.`);
      return;
    }

    // A handle, not a binding: `serve` holds this closure for the process's life while
    // `current` moves under it, so nothing on the wire learns the app was replaced.
    let current: Transport = createLocalRunner(hosted);

    const port = raw.port != null ? Number(raw.port) : 4100;
    // A served frond admits what it can establish. With no root injected it takes the
    // state it is handed, which is why the loopback default is the other half.
    const { verify, requireIdentity } = await identityFromEnv();
    const { port: bound } = await serve((call, inv) => current(call, inv), { port, verify, requireIdentity });
    this.ui.step(`frond ${frond} servie — POST http://127.0.0.1:${bound}/_fougere/call`);
    this.ui.info(requireIdentity ? 'signed calls only (FOUGERE_ROOT_KEY is set)' : 'unsigned calls accepted — no FOUGERE_ROOT_KEY');

    if (!watching) {
      this.ui.info('Ctrl-C pour arrêter.');
      // The listening server keeps the event loop alive; the command returns and stays up.
      return;
    }

    const reload = async (): Promise<void> => {
      const started = Date.now();
      let next: App;
      try {
        next = await bootAppFromConfig(root, { fronds: [frond], topology: false });
      } catch (error) {
        // The previous app keeps serving: a dev loop that dies on a typo is worse than
        // one that holds the last state which booted.
        this.ui.error(`reload refused — ${(error as Error).message}`);
        return;
      }
      const previous = hosted;
      hosted = next;
      current = createLocalRunner(next);
      this.ui.step(`reloaded in ${Date.now() - started} ms`);
      // Drain then release, on the OLD app and in that order: a call that started before
      // the swap finishes on the app it started on.
      await previous.drain(DRAIN_MS).catch((e) => this.ui.info(`drain: ${(e as Error).message}`));
      await previous.dispose();
    };

    let settling: NodeJS.Timeout | undefined;
    let watched = 0;

    for (const path of hosted.fronds.flatMap((f) => watchPathsOf(f, root, conventions))) {
      try {
        watch(path, { recursive: true }, () => {
          clearTimeout(settling);
          settling = setTimeout(() => { void reload(); }, SETTLE_MS);
        });
        watched++;
      } catch {
        // An absent convention directory IS the convention — the same silence the scan keeps.
      }
    }

    this.ui.info(`watching ${watched} path(s) — Ctrl-C pour arrêter.`);
  }
}
