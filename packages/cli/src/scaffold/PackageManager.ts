export type Name = (typeof PackageManager.names)[number];

/**
 * What a package manager says for each gesture, in the project and in the docs alike.
 *
 * Documented: [getting started](https://fougere.dev/tutorial/1-crud).
 */
export class PackageManager {
  static readonly names = ['npm', 'pnpm', 'bun', 'yarn'] as const;

  /** Which dependencies may run their install script — one statement, written in each tool's own words. */
  static readonly builds: Record<string, boolean> = { esbuild: true, 'better-sqlite3': false };

  readonly name: Name;
  readonly version?: string;

  constructor(name: Name, version?: string) {
    this.name = name;
    this.version = version;
  }

  /** yarn 1 is not the `yarn` these commands are written for — no `dlx`, no `workspaces foreach` — so it writes an npm project. */
  static of(agent = process.env.npm_config_user_agent): PackageManager {
    const [name, version] = agent?.split(' ')[0]?.split('/') ?? [];
    const known = PackageManager.names.find((candidate) => candidate === name);
    if (!known || (known === 'yarn' && version?.startsWith('1.'))) return new PackageManager('npm');

    return new PackageManager(known, version);
  }

  /** A host's scaffolder, fetched and run once. */
  exec(command: readonly string[]): [string, string[]] {
    const runners: Record<Name, [string, string[]]> = {
      npm: ['npx', ['-y']],
      pnpm: ['pnpm', ['dlx']],
      bun: ['bunx', []],
      yarn: ['yarn', ['dlx']],
    };
    const [bin, args] = runners[this.name];

    return [bin, [...args, ...command]];
  }

  create(entry = 'fougere'): string {
    return `${this.name} create ${entry}`;
  }

  install(): string {
    return `${this.name} install`;
  }

  /** Packages added to the project — to its dev dependencies when `dev`. */
  add(packages: string, dev = false): string {
    const flag = dev ? { npm: ' -D', pnpm: ' -D', bun: ' -d', yarn: ' -D' }[this.name] : '';

    return this.name === 'npm' ? `npm install${flag} ${packages}` : `${this.name} add${flag} ${packages}`;
  }

  /** A package's binary, fetched and run once — the line a reader types, where `exec` is what this process spawns. */
  x(command: string): string {
    const runners: Record<Name, string> = { npm: 'npx', pnpm: 'pnpm dlx', bun: 'bunx', yarn: 'yarn dlx' };

    return `${runners[this.name]} ${command}`;
  }

  /** A script of the project's own `package.json`. */
  script(name: string): string {
    return this.name === 'npm' || this.name === 'bun' ? `${this.name} run ${name}` : `${this.name} ${name}`;
  }

  /** A binary the project installed, run from inside it — `npx` finds it before fetching anything, `dlx` never looks. */
  bin(command: string): string {
    const runners: Record<Name, string> = { npm: 'npx', pnpm: 'pnpm exec', bun: 'bunx', yarn: 'yarn' };

    return `${runners[this.name]} ${command}`;
  }

  /** A script of one app, run from the project's root. */
  inApp(app: string, script: string): string {
    const forms: Record<Name, string> = {
      npm: `npm run ${script} -w apps/${app}`,
      pnpm: `pnpm -C apps/${app} ${script}`,
      bun: `bun --cwd apps/${app} run ${script}`,
      yarn: `yarn workspace ${app} ${script}`,
    };

    return forms[this.name];
  }

  /** A script of every app that states it. */
  inEveryApp(script: string): string {
    const forms: Record<Name, string> = {
      npm: `npm run ${script} --workspaces --if-present`,
      pnpm: `pnpm -r --filter './apps/*' ${script}`,
      bun: `bun run --filter './apps/*' ${script}`,
      yarn: `yarn workspaces foreach -A run ${script}`,
    };

    return forms[this.name];
  }
}
