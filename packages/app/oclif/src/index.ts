/**
 * A frond's operations, as a terminal.
 *
 * oclif finds its commands in FILES at build time; a frond's are known only after the scan, so
 * they are built here and handed over as one plugin. What that buys, beside a command per
 * operation: topics (`product:list` groups under `product` on its own), `--help` per topic and
 * per command, `--json`, and a parser that refuses a missing flag or a value outside a closed
 * set before anything runs.
 *
 * It is an HOST, at the same rank as `@fougere/nuxt` — the frond decides nothing about it, and
 * `@fougere/cli` stays on citty: its fifteen commands are flat, one op each, and want none of
 * the topics that make this worth its weight.
 */
import { Command, Config, handle, run as runOclif } from '@oclif/core';
import type { App, FrondDescriptor } from '@fougere/core';
import { inputOf, inputToShape, paramsOf, paramsToShape, type Shape } from './bridge.js';

/**
 * What oclif runs: a command's shape in its cache, plus the way to reach the class.
 *
 * Written here rather than imported: `Command.Loadable` lives behind an entry `@oclif/core`
 * does not export, and what this package builds is exactly these fields.
 */
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

/** Each entry carries the key it is filed under — what a class-on-disk gets for free. */
function named<T extends Record<string, object>>(entries: T): T {
  return Object.fromEntries(
    Object.entries(entries).map(([name, entry]) => [name, { ...entry, name }]),
  ) as T;
}

/** One operation, as the class oclif runs. */
function commandFor(id: string, call: (input: Record<string, unknown>) => Promise<unknown>, shape: Shape, describe?: string) {
  const Built = class extends Command {
    static override args = shape.args;
    static override flags = shape.flags;
    static override description = describe;
    static override enableJsonFlag = true;

    async run(): Promise<unknown> {
      const { args, flags } = await this.parse(Built);
      // `--json` is oclif's own flag (`enableJsonFlag`), not a field: it reached the judge as one.
      const own = Object.fromEntries(Object.entries(flags).filter(([at]) => at in shape.flags));

      return this.logJson(await call({ ...args, ...own }));
    }
  };
  Built.id = id;

  return Built;
}

/**
 * Every operation of every frond, as oclif sees them.
 *
 * The identifier is `address:op`, which is what makes a topic: oclif groups by the part before
 * the colon, so `product:list` and `product:create` answer under `product` without anything
 * saying so.
 */
export function commandsOf(app: App): Loadable[] {
  const loadables: Loadable[] = [];

  for (const frond of app.fronds as readonly FrondDescriptor[]) {
    for (const handler of frond.handlers) {
      const facade = app.facadeFor(handler.address) as Record<string, (input?: unknown) => Promise<unknown>>;

      for (const [name, contract] of handler.operations ?? []) {
        // A view when the op names one, its signature otherwise: `findById(id: string)` takes
        // a bare parameter, and an entity-shaped derivation would offer nothing at all for it.
        const fields = contract.input?.getFields?.();
        const params = contract.signature?.params ?? [];
        const shape = fields ? inputToShape(fields) : paramsToShape(params);
        const Built = commandFor(
          `${handler.address}:${kebab(name)}`,
          (parsed) => facade[name]!(
            fields ? { input: inputOf(fields, parsed) } : { params: paramsOf(params, parsed) },
          ),
          shape,
          contract.description,
        );

        loadables.push({
          id: Built.id,
          aliases: [],
          // `--help` renders from the CACHED shapes, and oclif fills each entry's `name` when
          // it reads a class off disk. Nothing reads these off disk, so they are named here —
          // without it the renderer meets `undefined.toUpperCase()`.
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

/**
 * Run the app's operations as a CLI.
 *
 * The commands are inserted through the door oclif keeps for plugins that produce theirs at
 * runtime. Its name says `legacy` — it exists for Heroku's older plugins — and it is the only
 * entry that takes commands nobody read from disk; the alternative is writing a file per
 * operation, which is the fact this package exists to derive.
 */
export async function serve(app: App, argv: string[] = process.argv.slice(2)): Promise<void> {
  const config = await Config.load({ root: process.cwd() });
  const commands = commandsOf(app);

  // `insertLegacyPlugins` is typed private: it exists for Heroku's older plugins, and it is the
  // only entry that takes commands nobody read from disk. The cast is the whole risk this
  // package carries — the alternative is a file per operation, which is the fact it derives.
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
