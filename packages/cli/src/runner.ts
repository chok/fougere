/**
 * CLI runner — scans frond entities for flags, looks for app commands
 * for presentation, dispatches via citty.
 *
 * Architecture:
 * - fronds/  → entities (flags) + handlers (domain logic)
 * - app/     → commands (prompts, TUI, presentation)
 * - src/     → runner + bridge (framework)
 */
import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import { toRegistrationName } from '@fougere/core/contract';
import { defineCommand, runMain } from 'citty';
import { ui } from './ui.js';
import { entityToArgs } from './bridge.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
}

function capitalize(name: string): string {
  return name.charAt(0).toUpperCase() + name.slice(1);
}

function toCamel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

/** Scan app/commands/ for command classes. */
async function loadAppCommands(
  cliRoot: string,
  loader: (path: string) => Promise<Record<string, unknown>>,
): Promise<Map<string, new (...args: unknown[]) => { run: (raw: Record<string, unknown>) => Promise<void> }>> {
  const map = new Map();
  const dir = join(cliRoot, 'app', 'commands');
  const files = await readdir(dir, { withFileTypes: true }).catch(() => []);

  for (const f of files) {
    if (!f.isFile() || !(f.name.endsWith('.ts') || f.name.endsWith('.js'))) continue;
    const name = f.name.replace(/Command\.(ts|js)$/, '').replace(/\.(ts|js)$/, '');
    const kebab = toKebab(name);
    const mod = await loader(join(dir, f.name));
    if (mod.default && typeof mod.default === 'function') {
      map.set(kebab, mod.default);
    }
  }

  return map;
}

export async function run(app: App): Promise<void> {
  const terminal = ui();
  const cliRoot = new URL('..', import.meta.url).pathname;

  // Load app commands (presentation layer)
  const { createJiti } = await import('jiti');
  const jiti = createJiti(import.meta.url, { interopDefault: true });
  const loader = (path: string) => jiti.import(path) as Promise<Record<string, unknown>>;
  const appCommands = await loadAppCommands(cliRoot, loader);

  const subCommands: Record<string, ReturnType<typeof defineCommand>> = {};

  for (const frond of app.fronds) {
    const handlerMap = new Map(frond.handlers.map((h) => [h.address, h]));

    for (const entity of frond.entities) {
      const handlerEntry = handlerMap.get(entity.name);
      if (!handlerEntry) continue;

      const handlerName = `${entity.name}Handler`;
      let handler: Record<string, Function>;
      try {
        handler = app.resolve<Record<string, Function>>(handlerName);
      } catch { continue; }

      if (typeof handler.execute !== 'function') continue;

      const cmdName = toKebab(entity.name);
      const fields = entity.entityClass.getFields();
      const args = entityToArgs(fields);

      // Check for an app command (presentation layer)
      const AppCommand = appCommands.get(cmdName);

      // App commands handle their own prompting — don't let citty reject missing args
      if (AppCommand) {
        for (const def of Object.values(args)) {
          if (typeof def === 'object' && def) (def as Record<string, unknown>).required = false;
        }
      }

      subCommands[cmdName] = defineCommand({
        meta: {
          name: cmdName,
          // `--help` reads the operation's own doc sentence, which the scan already
          // carries for every door (`OperationContract.description`). A table here
          // would be the same fact written twice, and it drifted: it described `add`
          // and `doctor`, which do not exist, and had nothing for `call` or `serve`.
          description: handlerEntry.operations.get('execute')?.description,
        },
        args,
        run: async ({ args: parsed }) => {
          if (cmdName !== 'completion') terminal.intro();

          // citty adds `_` (raw positionals) and `--` (passthrough); strip them
          // so only the entity's own fields reach the handler.
          const input = { ...(parsed as Record<string, unknown>) };
          delete input._;
          delete input['--'];

          try {
            if (AppCommand) {
              const cmd = new (AppCommand as new (...a: unknown[]) => { run: (raw: Record<string, unknown>) => Promise<void> })(app, terminal);
              await cmd.run(input);
            } else {
              // Ride the call contract — the same envelope every consumer uses.
              await createAppRunner(app)(
                { entity: toRegistrationName(entity.name), op: 'execute' },
                { params: {}, query: {}, body: input, state: {} },
              );
            }
          } catch (err) {
            terminal.error(err instanceof Error ? err.message : String(err));
            process.exit(1);
          }
        },
      });
    }
  }

  const main = defineCommand({
    meta: { name: 'fougere', description: 'Fougere CLI' },
    subCommands,
  });

  await runMain(main);
}
