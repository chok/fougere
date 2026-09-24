/**
 * CLI runner — scans frond entities for flags, looks for app commands for presentation, dispatches
 * via citty.
 */
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

/** The presentation classes under app/commands/, by command name — found, not imported: a command imports its own when it runs. */
async function appCommandFiles(root: string): Promise<Map<string, string>> {
  const dir = join(root, 'app', 'commands');
  const files = await readdir(dir, { withFileTypes: true }).catch(() => []);

  return new Map(files
    .filter((f) => f.isFile() && !f.name.endsWith('.d.ts') && (f.name.endsWith('.ts') || f.name.endsWith('.js')))
    .map((f) => [toKebab(f.name.replace(/Command\.(ts|js)$/, '').replace(/\.(ts|js)$/, '')), join(dir, f.name)] as const));
}

/**
 * Every operation of an app, as a terminal command.
 *
 * `root` is where the PRESENTATION classes are looked for — `app/commands/`, one per command
 * that wants to print something of its own. It defaults to this package, which is how
 * `npx fougere` finds its fifteen; a project passes its own and gets the same treatment for
 * the operations it declares, with no class at all where a default rendering will do.
 */
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
      const appCommand = appCommands.get(cmdName);

      // App commands handle their own prompting — don't let citty reject missing args
      if (appCommand) {
        for (const def of Object.values(args)) {
          if (typeof def === 'object' && def) def.required = false;
        }
      }

      subCommands[cmdName] = defineCommand({
        meta: {
          name: cmdName,
          // `--help` reads the operation's own doc sentence, which the scan already
          // carries for every facade (`OperationContract.description`). A table here
          // would be the same fact written twice, and it drifted: it described `add`
          // and `doctor`, which do not exist, and had nothing for `call` or `serve`.
          description: handlerEntry.operations.get('execute')?.description,
        },
        args,
        run: async ({ args: parsed }) => {
          // JSON is a protocol: a branded intro before `{` makes it unparsable. Read from
          // the invocation's own args, so any command declaring `json` gets a clean stdout
          // — naming `explain` here is what let `graph --json` print its decorated box.
          const machineOutput = machineWanted(parsed as Record<string, unknown>);

          // `completion` is exempt by nature, not by flag: its output IS a shell script,
          // there is no invocation of it that wants decoration.
          if (cmdName !== 'completion' && !machineOutput) terminal.intro();

          // citty adds `_` (raw positionals) and `--` (passthrough); strip them
          // so only the entity's own fields reach the handler — read as their shape says,
          // since a flag is text.
          const input = Object.fromEntries(
            Object.entries(parsed as Record<string, unknown>)
              .filter(([key]) => key !== '_' && key !== '--')
              .map(([key, value]) => [key, Shapes.fromText(fields[key]?.shape, value)]),
          );

          try {
            await installLoader(process.cwd());
            const AppCommand = appCommand ? (await loader(appCommand)).default : undefined;
            if (typeof AppCommand === 'function') {
              const cmd = new (AppCommand as new (...a: unknown[]) => { run: (raw: Record<string, unknown>) => Promise<void> })(app, terminal);
              await cmd.run(input);
            } else {
              // Ride the call contract — the same envelope every consumer uses.
              await createAppRunner(app)(
                { entity: lowerFirst(entity.name), op: 'execute' },
                { params: {}, query: {}, input: input, state: {} },
              );
            }
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            // A machine reader parses stdout: a refusal printed there is a refusal that
            // breaks the parse instead of being read. stderr is where it belongs.
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
