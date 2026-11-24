import { createLocalRunner, envLevel, identityFromEnv, Protocols, setLogLevel } from '@fougere/core';
import { answer as webAnswer } from '@fougere/app/answer';
import { ALIASES, BUILD_DIRECTORY, loadConfig, registerFrondAliases, appOptionsFileIn, Topology } from '@fougere/core/node';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Registry } from '@fougere/registry';
import { serve, type ReceiveOptions } from '@fougere/transport-http';
import { watch } from 'node:fs';
import type { App, Transport } from '@fougere/core';
import type { Placement } from '@fougere/core/node';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

const DRAIN_MS = 5_000;

const SETTLE_MS = 60;

/** What a host boots, and the directories whose change boots it again — none for what a build wrote. */
export interface Hosting {
  boot(): Promise<App>;
  watched: string[];
}

/** A process of the topology — the app when none is named — served over HTTP from what `fougere build` wrote. */
export default class ServeCommand {
  static DEFAULT_PORT = 4100;
  /** Starts what `fougere build` wrote, so the runner installs no loader for the project's TypeScript. */
  static built = true;
  /** The command a usage line names. */
  protected verb = 'serve';

  constructor(private app: App, private ui: Ui) {}

  /** The port of the process's `url`, so it listens where its callers will look. */
  static portOf(url: string | undefined): number {
    if (url === undefined) return ServeCommand.DEFAULT_PORT;

    const address = new URL(url);

    return Number(address.port || (address.protocol === 'https:' ? 443 : 80));
  }

  async run(raw: Record<string, unknown>) {
    const running = (raw.process as string | undefined) ?? process.env[Topology.VARIABLE];
    const root = process.cwd();
    let placement: Placement;
    try {
      placement = Topology.of(root).placement(running);
    } catch (refusal) {
      this.ui.error((refusal as Error).message);

      return;
    }

    const hosting = await this.hosting(root, running);
    if (!hosting) return;

    setLogLevel(envLevel() ?? 'info');
    let hosted = await hosting.boot();
    let current: Transport = createLocalRunner(hosted);

    const port = raw.port != null ? Number(raw.port) : ServeCommand.portOf(placement.url);
    const { verify, requireIdentity } = await identityFromEnv();
    const beside = (request: Request) => webAnswer(hosted, request);
    const answer: ReceiveOptions['answer'] = (door, received) => hosted.answer(door, received);
    const { use } = (await loadConfig(root)).server ?? {};
    const { port: bound } = await serve((call, inv) => current(call, inv), { port, verify, requireIdentity, beside, answer, use });
    this.ui.step(`${running === undefined ? 'app' : `process ${running}`} served — POST http://127.0.0.1:${bound}/_fougere/call`);
    for (const [name, options] of Object.entries(hosted.protocols)) {
      const mountedAt = Protocols.resolve(name).mountedAt?.(options);
      if (mountedAt !== undefined) this.ui.info(`${name} under http://127.0.0.1:${bound}${mountedAt}`);
    }
    this.ui.info(requireIdentity ? 'signed calls only (FOUGERE_ROOT_KEY is set)' : 'unsigned calls accepted — no FOUGERE_ROOT_KEY');

    if (hosting.watched.length === 0) {
      this.ui.info('Ctrl-C to stop.');

      return;
    }

    const reload = async (): Promise<void> => {
      const started = Date.now();
      let next: App;
      let replaced = 0;
      try {
        next = await Registry.reloading(() => hosting.boot(), () => { replaced += 1; });
      } catch (error) {
        this.ui.error(`reload refused — ${(error as Error).message}`);

        return;
      }
      const previous = hosted;
      hosted = next;
      current = createLocalRunner(next);
      this.ui.step(`reloaded in ${Date.now() - started} ms${replaced ? ` — ${replaced} answer(s) re-registered` : ''}`);
      await previous.drain(DRAIN_MS).catch((e) => this.ui.info(`drain: ${(e as Error).message}`));
      await previous.dispose();
    };

    let settling: NodeJS.Timeout | undefined;
    let watched = 0;

    for (const path of hosting.watched) {
      try {
        watch(path, { recursive: true }, () => {
          clearTimeout(settling);
          settling = setTimeout(() => { void reload(); }, SETTLE_MS);
        });
        watched++;
      } catch {
      }
    }

    this.ui.info(`watching ${watched} path(s) — Ctrl-C to stop.`);
  }

  /** The project `fougere build` wrote, booted by Node: `@fronds/<name>` resolves through the table it left. */
  protected async hosting(root: string, running: string | undefined): Promise<Hosting | undefined> {
    const built = resolve(root, BUILD_DIRECTORY);
    if (!appOptionsFileIn(built)) {
      this.ui.error(`Nothing built in ${BUILD_DIRECTORY}/. Run \`fougere build\` first — or \`fougere dev${running === undefined ? '' : ` ${running}`}\` to run the sources.`);

      return undefined;
    }
    const table = JSON.parse(readFileSync(join(built, ALIASES), 'utf8')) as Record<string, string>;
    registerFrondAliases(Object.fromEntries(Object.entries(table).map(([alias, dir]) => [alias, join(built, dir)])));
    const { bootApp } = await import('@fougere/defaults');

    return { boot: () => bootApp(root, { process: running, built }), watched: [] };
  }
}
