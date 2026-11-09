import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { defineCommand, runMain, showUsage } from 'citty';
import { ui } from './ui.js';
import { installLoader } from './loader.js';
import { machineWanted } from './machine.js';
import { Shapes } from '@fougere/schema';
import { entityToArgs } from './bridge.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
}

function toCamel(kebab: string): string {
  return kebab.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

async function appCommandFiles(root: string): Promise<Map<string, string>> {
  const dir = join(root, 'app', 'commands');
  const files = await readdir(dir, { withFileTypes: true }).catch(() => []);

  return new Map(files
    .filter((f) => f.isFile() && !f.name.endsWith('.d.ts') && (f.name.endsWith('.ts') || f.name.endsWith('.js')))
    .map((f) => [toKebab(f.name.replace(/Command\.(ts|js)$/, '').replace(/\.(ts|js)$/, '')), join(dir, f.name)] as const));
}

/** Every operation of an app, as a terminal command; `root` is where the presentation classes are looked for. */
export async function run(app: App, root = new URL('..', import.meta.url).pathname): Promise<void> {
  const terminal = ui();

  const loader = async (path: string): Promise<Record<string, unknown>> => {
    if (!path.endsWith('.ts')) return await import(pathToFileURL(path).href) as Record<string, unknown>;
    const { createJiti } = await import('jiti');

    return createJiti(import.meta.url, { interopDefault: true }).import(path) as Promise<Record<string, unknown>>;
  };
  const appCommands = await appCommandFiles(root);

  const subCommands: Record<string, ReturnType<typeof defineCommand>> = {};

  for (const frond of app.fronds) {
    const handlerMap = new Map(frond.handlers.map((h) => [h.address, h]));

    for (const entity of frond.entities) {
      const handlerEntry = handlerMap.get(entity.name);
      if (!handlerEntry) continue;

      const handler = app.facadeFor(entity.name);
      if (typeof handler?.execute !== 'function') continue;

      const cmdName = toKebab(entity.name);
      const fields = entity.entityClass.getFields();
      const args = entityToArgs(fields);

      const appCommand = appCommands.get(cmdName);

      if (appCommand) {
        for (const def of Object.values(args)) {
          if (typeof def === 'object' && def) def.required = false;
        }
      }

      subCommands[cmdName] = defineCommand({
        meta: {
          name: cmdName,
          description: handlerEntry.operations.get('execute')?.description,
        },
        args,
        run: async ({ args: parsed }) => {
          const machineOutput = machineWanted(parsed as Record<string, unknown>);

          if (cmdName !== 'completion' && !machineOutput) terminal.intro();

          const input = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
              .filter(([key]) => key !== '_' && key !== '--')
              .map(([key, value]) => [key, Shapes.fromText(fields[key]?.shape, value)]),
          );

          try {
            const AppCommand = appCommand ? (await loader(appCommand)).default : undefined;
            if (!(AppCommand as { built?: boolean } | undefined)?.built) await installLoader(process.cwd());
            if (typeof AppCommand === 'function') {
              const cmd = new (AppCommand as new (...a: unknown[]) => { run: (raw: Record<string, unknown>) => Promise<void> })(app, terminal);
              await cmd.run(input);
            } else {
              await createAppRunner(app)(
                { address: lowerFirst(entity.name), op: 'execute' },
                { params: {}, query: {}, input: input, state: {} },
              );
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            if (machineOutput) process.stderr.write(message + '\n');
            else terminal.error(message);
            process.exit(1);
          }
        },
      });
    }
  }

  const main = defineCommand({
    meta: { name: 'fougere', description: 'Fougere CLI' },
    subCommands,
    run: async ({ rawArgs }) => { if (rawArgs.length === 0) await showUsage(main); },
  });

  await runMain(main);
}
