/**
 * CLI runner — scans frond entities for flags, looks for app commands for presentation, dispatches
 * via citty.
 */
import type { App } from '@fougere/core';
import { createAppRunner } from '@fougere/core';
import { lowerFirst } from '@fougere/core/contract';
import { defineCommand, runMain } from 'citty';
import { ui } from './ui.js';
import { machineWanted } from './machine.js';
import { entityToArgs } from './bridge.js';
import { readdir } from 'node:fs/promises';
import { join } from 'node:path';

function toKebab(name: string): string {
  return name.replace(/[A-Z]/g, (c) => '-' + c.toLowerCase()).replace(/^-/, '');
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
          if (typeof def === 'object' && def) def.required = false;
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
          // JSON is a protocol: a branded intro before `{` makes it unparsable. Read from
          // the invocation's own args, so any command declaring `json` gets a clean stdout
          // — naming `explain` here is what let `graph --json` print its decorated box.
          const machineOutput = machineWanted(parsed as Record<string, unknown>);

          // `completion` is exempt by nature, not by flag: its output IS a shell script,
          // there is no invocation of it that wants decoration.
          if (cmdName !== 'completion' && !machineOutput) terminal.intro();

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
  });

  await runMain(main);
}
