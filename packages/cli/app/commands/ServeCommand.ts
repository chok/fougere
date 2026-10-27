import { createLocalRunner, envLevel, identityFromEnv, serves, setLogLevel } from '@fougere/core';
import { prefixOf } from '@fougere/adapter-rest';
import { answer as webAnswer } from '@fougere/app/answer';
import { ALIASES, BUILD_DIRECTORY, loadConfig, registerFrondAliases, remotesOf, statementFileIn } from '@fougere/core/node';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { Registry } from '@fougere/registry';
import { serve, type ReceiveOptions } from '@fougere/transport-http';
import { watch } from 'node:fs';
import type { App, Transport } from '@fougere/core';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/** What a reload gives the calls already running before it releases the app they hold. */
const DRAIN_MS = 5_000;

/** One save fires several events; the boot must not start once per event. */
const SETTLE_MS = 60;

/** What a host boots, and the directories whose change boots it again — none for what a build wrote. */
export interface Hosting {
  boot(): Promise<App>;
  watched: string[];
}

/**
 * The host end of the gradient: one frond, alone in this process, reachable
 * over HTTP, and reaching the fronds `fronds:` places elsewhere. The same
 * fronds/** an app runs in-process; only the runtime moves.
 *
 * `serve` starts what `fougere build` wrote, with Node alone; `dev` (`DevCommand`) starts the sources.
 */
export default class ServeCommand {
  static DEFAULT_PORT = 4100;
  /** Starts what `fougere build` wrote, so the runner installs no loader for the project's TypeScript. */
  static built = true;
  /** The command a usage line names. */
  protected verb = 'serve';

  constructor(private app: App, private ui: Ui) {}

  /** Where `fronds:` places this frond, so the process listens where its callers will look. */
  static async portStated(root: string, frond: string): Promise<number> {
    const address = remotesOf(await loadConfig(root))[frond];
    if (!address) return ServeCommand.DEFAULT_PORT;

    const url = new URL(address);

    return Number(url.port || (url.protocol === 'https:' ? 443 : 80));
  }

  async run(raw: Record<string, unknown>) {
    const frond = raw.frond as string | undefined;




    if (!frond) { this.ui.error(`Usage: fougere ${this.verb} <frond>`); return; }

    const root = process.cwd();
    const hosting = await this.hosting(root, frond);
    if (!hosting) return;

    setLogLevel(envLevel() ?? 'info');
    let hosted = await hosting.boot();
    if (!hosted.fronds.some((f) => f.name === frond)) {
      this.ui.error(`No frond '${frond}' in this project.`);

      return;
    }

    // A handle, not a binding: `serve` holds this closure for the process's life while
    // `current` moves under it, so nothing on the wire learns the app was replaced.
    let current: Transport = createLocalRunner(hosted);

    const port = raw.port != null ? Number(raw.port) : await ServeCommand.portStated(root, frond);
    // A served frond admits what it can establish. With no root injected it takes the
    // state it is handed, which is why the loopback default is the other half.
    const { verify, requireIdentity } = await identityFromEnv();
    // The REST door of the frond this process hosts, beside the call envelope: a frond moved
    // here takes its door with it, and the process it left no longer answers for it.
    const beside = (request: Request) => webAnswer(hosted, request);
    const answer: ReceiveOptions['answer'] = (door, received) => hosted.answer(door, received);
    const { port: bound } = await serve((call, inv) => current(call, inv), { port, verify, requireIdentity, beside, answer });
    this.ui.step(`frond ${frond} served — POST http://127.0.0.1:${bound}/_fougere/call`);
    if (serves(hosted.protocols, 'rest')) this.ui.info(`REST under http://127.0.0.1:${bound}${prefixOf(hosted.protocols)}`);
    this.ui.info(requireIdentity ? 'signed calls only (FOUGERE_ROOT_KEY is set)' : 'unsigned calls accepted — no FOUGERE_ROOT_KEY');

    if (hosting.watched.length === 0) {
      this.ui.info('Ctrl-C to stop.');

      // The listening server keeps the event loop alive; the command returns and stays up.
      return;
    }

    const reload = async (): Promise<void> => {
      const started = Date.now();
      let next: App;
      let replaced = 0;
      try {
        next = await Registry.reloading(() => hosting.boot(), () => { replaced += 1; });
      } catch (error) {
        // The previous app keeps serving: a dev loop that dies on a typo is worse than
        // one that holds the last state which booted.
        this.ui.error(`reload refused — ${(error as Error).message}`);

        return;
      }
      const previous = hosted;
      hosted = next;
      current = createLocalRunner(next);
      this.ui.step(`reloaded in ${Date.now() - started} ms${replaced ? ` — ${replaced} answer(s) re-registered` : ''}`);
      // Drain then release, on the OLD app and in that order: a call that started before
      // the swap finishes on the app it started on.
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
        // An absent convention directory IS the convention — the same silence the scan keeps.
      }
    }

    this.ui.info(`watching ${watched} path(s) — Ctrl-C to stop.`);
  }

  /** The project `fougere build` wrote, booted by Node: `@fronds/<name>` resolves through the table it left. */
  protected async hosting(root: string, frond: string): Promise<Hosting | undefined> {
    const built = resolve(root, BUILD_DIRECTORY);
    if (!statementFileIn(built)) {
      this.ui.error(`Nothing built in ${BUILD_DIRECTORY}/. Run \`fougere build\` first — or \`fougere dev ${frond}\` to run the sources.`);

      return undefined;
    }
    const table = JSON.parse(readFileSync(join(built, ALIASES), 'utf8')) as Record<string, string>;
    registerFrondAliases(Object.fromEntries(Object.entries(table).map(([alias, dir]) => [alias, join(built, dir)])));
    const { bootApp } = await import('@fougere/defaults');

    return { boot: () => bootApp(root, { only: [frond], built }), watched: [] };
  }
}
