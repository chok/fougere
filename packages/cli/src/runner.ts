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
import { defineCommand, runMain } from 'citty';
import { ui } from '@fougere/cli-ui';
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
    const handlerMap = new Map(frond.handlers.map((h) => [h.entityName, h]));

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
        meta: { name: cmdName },
        args,
        run: async ({ args: parsed }) => {
          if (cmdName !== 'completion') terminal.intro();

          try {
            if (AppCommand) {
              const cmd = new (AppCommand as new (...a: unknown[]) => { run: (raw: Record<string, unknown>) => Promise<void> })(app, terminal);
              await cmd.run(parsed as Record<string, unknown>);
            } else {
              await handler.execute(parsed);
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
