import { connect } from 'node:net';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { concurrently, type ConcurrentlyCommandInput } from 'concurrently';
import { ServiceTypes, addressVariableOf, environmentOf, serviceAddressOf, type App, type ServiceBase } from '@fougere/core';
import { APPS, appsIn, loadConfig } from '@fougere/core/node';
import { PackageManager } from '../../src/scaffold/PackageManager.js';
import type { ui as createUi } from '../../src/ui.js';

type Ui = ReturnType<typeof createUi>;

/** Starts the services the app needs, waits until each answers, then every process of `processes:` and every app. */
export default class UpCommand {
  static READY_MS = 60_000;
  static POLL_MS = 250;

  constructor(private app: App, private ui: Ui) {}

  async run() {
    const root = process.cwd();
    const config = await loadConfig(root);
    const services = Object.entries(config.services ?? {}) as [string, ServiceBase][];
    const started = services.filter(([name]) => {
      const given = process.env[addressVariableOf(name)];
      if (given) this.ui.info(`${name} — ${addressVariableOf(name)} is given (${given}), not started`);

      return !given;
    });

    let commands: ConcurrentlyCommandInput[];
    try {
      commands = started.map(([name, entry]) => ({ name, command: ServiceTypes.commandOf(entry, name) }));
    } catch (refusal) {
      this.ui.error((refusal as Error).message);

      return;
    }
    const running = commands.length > 0 ? [concurrently(commands, { prefix: 'name', killOthersOn: ['failure'] })] : [];
    await Promise.all(started.map(([name, entry]) => this.ready(name, entry)));

    const environment = environmentOf(config);
    const cli = `"${process.execPath}" "${process.argv[1]}"`;
    const processes = Object.keys(config.processes ?? {}).map((name): ConcurrentlyCommandInput => ({
      name,
      command: `${cli} dev ${name}`,
      env: environmentOf(config, name),
    }));
    const apps = appsIn(root).filter((app) => scriptsOf(join(root, APPS, app)).dev).map((app): ConcurrentlyCommandInput => ({
      name: app,
      command: PackageManager.of().script('dev'),
      cwd: join(root, APPS, app),
      env: environment,
    }));
    const hosts = apps.length > 0 ? apps : [{ name: 'app', command: `${cli} dev`, env: environment }];

    running.push(concurrently([...processes, ...hosts], { prefix: 'name', killOthersOn: ['failure'] }));
    await Promise.allSettled(running.map((one) => one.result));
  }

  private async ready(name: string, entry: ServiceBase): Promise<void> {
    const deadline = Date.now() + UpCommand.READY_MS;
    while (Date.now() < deadline) {
      if (await answers(entry)) {
        this.ui.step(`${name} ready — ${addressVariableOf(name)}=${serviceAddressOf(entry)}`);

        return;
      }
      await new Promise((wake) => setTimeout(wake, UpCommand.POLL_MS));
    }
    this.ui.error(`${name} did not answer on :${entry.port}${entry.health ?? ''} within ${UpCommand.READY_MS / 1000}s — starting the rest anyway.`);
  }
}

function scriptsOf(dir: string): Record<string, string> {
  const manifest = join(dir, 'package.json');

  return existsSync(manifest) ? (JSON.parse(readFileSync(manifest, 'utf8')) as { scripts?: Record<string, string> }).scripts ?? {} : {};
}

async function answers(entry: ServiceBase): Promise<boolean> {
  if (entry.health !== undefined) {
    return fetch(`http://127.0.0.1:${entry.port}${entry.health}`).then((response) => response.ok, () => false);
  }

  return new Promise((settle) => {
    const socket = connect(entry.port, '127.0.0.1');
    socket.once('connect', () => { socket.end(); settle(true); });
    socket.once('error', () => settle(false));
  });
}
