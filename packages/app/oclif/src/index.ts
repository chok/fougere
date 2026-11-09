import { Command, Config, handle, run as runOclif } from '@oclif/core';
import type { App, Door, DoorOutcome, FrondDescriptor } from '@fougere/core';
import { inputOf, inputToShape, paramsOf, paramsToShape, type Shape } from './bridge.js';

interface Loadable {
  id: string;
  aliases: string[];
  args: Shape['args'];
  flags: Shape['flags'];
  description?: string;
  hidden: boolean;
  pluginAlias: string;
  pluginName: string;
  pluginType: string;
  load(): Promise<typeof Command>;
}

const kebab = (name: string): string => name.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`).replace(/^-/, '');

function named<T extends Record<string, object>>(entries: T): T {
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => [name, { ...entry, name }]),
  ) as T;
}

function commandFor(id: string, answer: (parsed: Record<string, unknown>) => Promise<DoorOutcome>, shape: Shape, describe?: string) {
  const Built = class extends Command {
    static override args = shape.args;
    static override flags = shape.flags;
    static override description = describe;
    static override enableJsonFlag = true;

    async run(): Promise<unknown> {
      const { args, flags } = await this.parse(Built);
      const own = Object.fromEntries(Object.entries(flags).filter(([at]) => at in shape.flags));

      const outcome = await answer({ ...args, ...own });
      if ('refused' in outcome) throw outcome.refused;

      return this.logJson(outcome.answered);
    }
  };
  Built.id = id;

  return Built;
}

/**
 * Every operation of every frond as an oclif command, grouped by address.
 * Ex: `product:list`.
 */
export function commandsOf(app: App): Loadable[] {
  const loadables: Loadable[] = [];

  for (const frond of app.fronds as readonly FrondDescriptor[]) {
    for (const handler of frond.handlers) {
      const facade = app.facadeFor(handler.address) as Record<string, (input?: unknown) => Promise<unknown>>;

      for (const [name, contract] of handler.operations ?? []) {
        const fields = contract.input?.getFields?.();
        const params = contract.signature?.params ?? [];
        const shape = fields ? inputToShape(fields) : paramsToShape(params);
        const door: Door<Record<string, unknown>, unknown, DoorOutcome> = {
          name: 'terminal',
          trusted: true,
          decode: async (parsed) => (fields ? { input: inputOf(fields, parsed) } : { params: paramsOf(params, parsed) }),
          run: (invocation) => facade[name]!(invocation),
          encode: (outcome) => outcome,
        };
        const Built = commandFor(`${handler.address}:${kebab(name)}`, (parsed) => app.answer(door, parsed), shape, contract.description);

        loadables.push({
          id: Built.id,
          aliases: [],
          args: named(Built.args),
          flags: named(Built.flags),
          description: Built.description,
          hidden: false,
          pluginAlias: 'fougere',
          pluginName: 'fougere',
          pluginType: 'core',
          load: async () => Built,
        } as Loadable);
      }
    }
  }

  return loadables;
}

/** Runs the app's operations as a CLI. */
export async function serve(app: App, argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = await Config.load({ root: process.cwd() });
  const commands = commandsOf(app);

  const insert = config as unknown as { insertLegacyPlugins(plugins: unknown[]): void };

  insert.insertLegacyPlugins([{
    name: 'fougere',
    alias: 'fougere',
    commands,
    commandIDs: commands.map((one) => one.id),
    topics: [],
    hooks: {},
    isRoot: false,
    moduleType: 'module',
    pjson: { name: 'fougere', version: '0.0.0', oclif: {} },
    root: process.cwd(),
    type: 'core',
    valid: true,
    version: '0.0.0',
    _base: '',
    hasManifest: false,
    options: {},
    commandsDir: undefined,
    load: async () => {},
    findCommand: async (id: string) => commands.find((one) => one.id === id)?.load(),
  }]);

  await runOclif(argv, config).catch(handle);
}
