import { describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ProjectWriter from '../fronds/scaffold/services/ProjectWriter.js';
import Shell from '../fronds/scaffold/services/Shell.js';
import { PackageManager } from '../src/scaffold/PackageManager.js';
import { settle } from '../src/scaffold/Scaffold.js';
import { writtenFor } from '../src/scaffold/WrittenFor.js';

/**
 * The shell each host's own tool wrote, recorded from `create-nuxt@3`, `create-next-app@16`,
 * `create-vite@9` and `sv@0.17` — so these tests reach no network. `door:check` runs the tools.
 */
class RecordedShell extends Shell {
  static readonly RECORDED = { 'create-nuxt': 'nuxt', 'create-next-app': 'next', 'create-vite': 'react', sv: 'svelte' };

  override async create(command: readonly string[], parent: string, dir: string): Promise<void> {
    const tool = command[0]!.replace(/@[^@]*$/, '') as keyof typeof RecordedShell.RECORDED;
    cpSync(join(import.meta.dirname, 'fixtures-shell', RecordedShell.RECORDED[tool]), join(parent, dir), { recursive: true });
  }
}

const writer = () => new ProjectWriter(new RecordedShell());

function expectFougereCheckWorkflow(root: string, typecheck: string): void {
  for (const file of ['CLAUDE.md', 'AGENTS.md']) {
    const guidance = readFileSync(join(root, file), 'utf8');
    expect(guidance).toContain('After every change to handlers, entities, Fronds, configuration, or topology:');
    expect(guidance).toContain('1. Run `fougere check`.');
    expect(guidance).toContain('2. Fix every deterministic error it reports before continuing.');
    expect(guidance).toContain('3. Run the relevant tests, then run');
    expect(guidance).toContain(typecheck);
  }
}

describe('workspace project scaffold', () => {
  it('emits a project whose members are its apps, and the Fougere check workflow in the words of its package manager', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-workspace-'));
    const root = join(parent, 'forest');

    try {
      new ProjectWriter().createWorkspace(root, 'forest', new PackageManager('npm'));
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { packageManager?: string; workspaces?: string[]; dependencies: Record<string, string> };

      expect(pkg.workspaces).toEqual(['apps/*']);
      expect(pkg.packageManager).toBeUndefined();
      expect(existsSync(join(root, 'pnpm-workspace.yaml'))).toBe(false);
      expect(pkg.dependencies).toHaveProperty('better-sqlite3');
      expectFougereCheckWorkflow(root, 'npm run typecheck');
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('writes which builds may run in each package manager\u2019s own file', () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-builds-'));
    const project = (manager: PackageManager) => {
      const root = join(parent, manager.name);
      new ProjectWriter().createWorkspace(root, manager.name, manager);
      settle(root, manager);

      return { root, pkg: JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as Record<string, unknown> };
    };

    try {
      const pnpm = project(new PackageManager('pnpm', '12.6.0'));
      const workspace = readFileSync(join(pnpm.root, 'pnpm-workspace.yaml'), 'utf8');
      expect(pnpm.pkg.packageManager).toBe('pnpm@12.6.0');
      expect(workspace).toContain('  - apps/*');
      expect(workspace).toContain('better-sqlite3: false');
      expect(workspace).toContain('esbuild: true');

      expect(project(new PackageManager('bun')).pkg.trustedDependencies).toEqual(['esbuild']);

      const yarn = project(new PackageManager('yarn', '4.9.1'));
      expect(yarn.pkg.dependenciesMeta).toEqual({ 'better-sqlite3': { built: false } });
      expect(readFileSync(join(yarn.root, '.yarnrc.yml'), 'utf8')).toBe('nodeLinker: node-modules\n');

      const npm = project(new PackageManager('npm'));
      expect(Object.keys(npm.pkg)).not.toContain('trustedDependencies');
      expect(existsSync(join(npm.root, 'pnpm-workspace.yaml'))).toBe(false);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('reads the package manager off whoever started the process, and npm when nobody says', () => {
    expect(PackageManager.of('pnpm/12.6.0 npm/? node/v24.12.0 darwin arm64')).toEqual(new PackageManager('pnpm', '12.6.0'));
    expect(PackageManager.of('bun/1.3.10 npm/? node/v24.3.0 darwin arm64').name).toBe('bun');
    expect(PackageManager.of('yarn/4.9.1 npm/? node/v24.12.0 darwin arm64').inApp('web', 'dev')).toBe('yarn workspace web dev');
    expect(PackageManager.of('')).toEqual(new PackageManager('npm'));
    expect(PackageManager.of('yarn/1.22.22 npm/? node/v24.12.0 darwin arm64')).toEqual(new PackageManager('npm'));
  });

  it('says what a reader types — a package added, a binary run once — in each tool\u2019s own words', () => {
    const lines = PackageManager.names.map((name) => new PackageManager(name)).map((manager) =>
      [manager.add('@fougere/testing', true), manager.add('@fougere/adapter-rest'), manager.x('fougere dev blog')]);
    expect(lines).toEqual([
      ['npm install -D @fougere/testing', 'npm install @fougere/adapter-rest', 'npx fougere dev blog'],
      ['pnpm add -D @fougere/testing', 'pnpm add @fougere/adapter-rest', 'pnpm dlx fougere dev blog'],
      ['bun add -d @fougere/testing', 'bun add @fougere/adapter-rest', 'bunx fougere dev blog'],
      ['yarn add -D @fougere/testing', 'yarn add @fougere/adapter-rest', 'yarn dlx fougere dev blog'],
    ]);
  });

  it('takes what the command stated first, then the launcher, then the project the new one sits in', async () => {
    const around = mkdtempSync(join(tmpdir(), 'fougere-around-'));
    try {
      writeFileSync(join(around, 'package.json'), JSON.stringify({ packageManager: 'bun@1.3.10' }));
      expect(await writtenFor('yarn', around, 'pnpm/12.6.0')).toEqual(new PackageManager('yarn'));
      expect(await writtenFor(undefined, around, 'pnpm/12.6.0')).toEqual(new PackageManager('pnpm', '12.6.0'));
      expect(await writtenFor(undefined, around, '')).toEqual(new PackageManager('bun', '1.3.10'));
      await expect(writtenFor('deno', around, '')).rejects.toThrow("'deno' is not a package manager Fougere writes for: npm, pnpm, bun, yarn.");
    } finally {
      rmSync(around, { recursive: true, force: true });
    }
  });
});

/**
 * `latest` reads as "whatever is current" and is not.
 *
 * pnpm answers from a metadata cache: a fresh project installed 0.6 while the registry
 * said 0.7 — measured. And an install that resolves differently on two machines was never
 * an install anyone could reproduce.
 */
/**
 * Which apps `fougere new` offers, and where their files come from.
 *
 * The CLI used to carry one starter under `templates/apps/` while six hosts were published:
 * the wiring of a Nuxt app was written both in `@fougere/nuxt` and beside it. The registry is
 * now the CLI's own `@fougere/*` dependencies that ship a `template/`, so a host appears the
 * day it is depended on and never needs to be listed.
 */
describe('the apps a host can scaffold', () => {
  it('offers every host that ships a starter, and only those', async () => {
    const offered = new ProjectWriter().listTemplates('apps');

    expect(offered).toEqual(['admin', 'next', 'nuxt', 'oclif', 'react', 'svelte']);
  });

  /** `@fougere/vite` is what React and Svelte are BUILT with, not an app to scaffold. */
  it('leaves out a package that ships no starter', async () => {
    expect(new ProjectWriter().listTemplates('apps')).not.toContain('vite');
  });

  it('names what it serves when asked for a host that ships none', async () => {
    await expect(new ProjectWriter().addApp('/tmp/nowhere', 'vite', 'web'))
      .rejects.toThrow(/No host ships a starter for 'vite'/);
  });
});

describe('the versions a fresh project depends on', () => {
  it('pins every @fougere/* to the version that scaffolded it', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-pin-'));
    const root = join(parent, 'fern');
    const pw = writer();
    pw.createWorkspace(root, 'fern');
    await pw.addApp(root, 'nuxt', 'web');
    await pw.addApp(root, 'react', 'spa');
    pw.pinVersions(root);

    const cli = JSON.parse(
      readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
    ) as { version: string };
    const app = JSON.parse(readFileSync(join(root, 'apps', 'web', 'package.json'), 'utf8')) as
      { dependencies: Record<string, string> };

    expect(app.dependencies['@fougere/core']).toBe(cli.version);
    expect(Object.values(app.dependencies)).not.toContain('latest');
    const spa = JSON.parse(readFileSync(join(root, 'apps', 'spa', 'package.json'), 'utf8')) as
      { devDependencies: Record<string, string> };
    expect(spa.devDependencies['@fougere/vite']).toBe(cli.version);
    // An app that scans states the compiler for its build: a production install leaves it out, and
    // the server boots from the statement the build wrote.
    const web = app as unknown as { devDependencies: Record<string, string> };
    expect(web.devDependencies['@fougere/compiler']).toBe(cli.version);
    expect(spa.devDependencies['@fougere/compiler']).toBe(cli.version);
    rmSync(parent, { recursive: true, force: true });
  });
});

describe('a project linked to this monorepo', () => {
  it('takes each linked host’s peers from the monorepo, so the app loads one Vue', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-local-'));
    const root = join(parent, 'shop');

    try {
      await writer().write({ name: 'shop', fronds: [], apps: [{ template: 'nuxt', name: 'web' }] }, root, { local: true });
      const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');

      expect(workspace).toMatch(/\n {2}vue: link:\/.*\/packages\/app\/nuxt\/node_modules\/vue\n/);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('finds react-dom in the monorepo when the linked host does not carry it — the admin', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-local-'));
    const root = join(parent, 'shop');

    try {
      await writer().write({ name: 'shop', fronds: [], apps: [{ template: 'admin', name: 'back' }] }, root, { local: true });

      expect(readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8')).toMatch(/\n {2}react-dom: link:\//);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });

  it('takes react-dom from where it takes react — one refuses the other of another version', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-local-'));
    const root = join(parent, 'shop');

    try {
      await writer().write({ name: 'shop', fronds: [], apps: [{ template: 'react', name: 'web' }] }, root, { local: true });
      const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');

      expect(workspace).toMatch(/\n {2}react: link:\//);
      expect(workspace).toMatch(/\n {2}react-dom: link:\//);
    } finally {
      rmSync(parent, { recursive: true, force: true });
    }
  });
});

describe('an app is the host\u2019s own shell, and Fougere adds its part', () => {
  const app = async (host: string) => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-shell-'));
    const pw = writer();
    pw.createWorkspace(parent, 'shop');
    await pw.addApp(parent, host, 'web');
    const dir = join(parent, 'apps', 'web');
    const read = (path: string) => readFileSync(join(dir, path), 'utf8');

    return { dir, read, has: (path: string) => existsSync(join(dir, path)), dispose: () => rmSync(parent, { recursive: true, force: true }) };
  };

  it('Nuxt: the module in the shell\u2019s own config, the shell\u2019s tsconfig untouched', async () => {
    const { read, dispose } = await app('nuxt');
    try {
      expect(read('nuxt.config.ts')).toMatch(/modules: \[\s*['"]@fougere\/nuxt['"]\s*\]/);
      expect(read('nuxt.config.ts')).not.toContain('root');
      expect(read('nuxt.config.ts')).toContain('compatibilityDate');
      expect(read('tsconfig.json')).toContain('.nuxt/tsconfig.app.json');
      expect(JSON.parse(read('package.json')).dependencies['@fougere/nuxt']).toBe('latest');
      expect(read('app/pages/index.vue')).toContain('Your app is running on');
    } finally { dispose(); }
  });

  it('Next: the config wrapped, a member of the workspace, and the facade on the paths', async () => {
    const { read, has, dispose } = await app('next');
    try {
      expect(read('next.config.ts')).toContain('import { withFougere } from "@fougere/next/config"');
      expect(read('next.config.ts')).toContain('export default withFougere(nextConfig);');
      expect(has('pnpm-workspace.yaml')).toBe(false);
      expect(JSON.parse(read('package.json')).packageManager).toBeUndefined();
      const paths = JSON.parse(read('tsconfig.json')).compilerOptions.paths;
      expect(paths).toEqual({
        '@/*': ['./*'],
        '@fronds/facade': ['./.fougere/facade.generated.ts'],
        '@fronds/*': ['../../fronds/*', '../../.fougere/remotes/*'],
      });
      expect(read('app/page.tsx')).toContain("import './welcome.css'");
    } finally { dispose(); }
  });

  it('React: the plugin first, the shell\u2019s leftovers gone, its comments kept', async () => {
    const { read, has, dispose } = await app('react');
    try {
      expect(read('vite.config.ts')).toContain("import { fougere } from '@fougere/vite'");
      expect(read('vite.config.ts')).toMatch(/plugins: \[\s*fougere\(\),\s*react\(\)/);
      expect(has('src/App.css')).toBe(false);
      expect(has('src/assets')).toBe(false);
      expect(read('tsconfig.app.json')).toContain('/* Bundler mode */');
      expect(read('tsconfig.app.json')).toContain('"@fronds/facade"');
      expect(read('tsconfig.app.json')).toContain('"erasableSyntaxOnly": false');
      expect(read('src/main.tsx')).toContain("import './index.css'");
      expect(JSON.parse(read('package.json')).devDependencies['@fougere/vite']).toBe('latest');
    } finally { dispose(); }
  });

  it('SvelteKit: the plugin before sveltekit(), the facade in kit.alias, and the page replaced', async () => {
    const { read, dispose } = await app('svelte');
    try {
      expect(read('vite.config.ts')).toMatch(/plugins: \[\s*fougere\(\),\s*sveltekit\(/);
      expect(read('vite.config.ts')).toMatch(/alias: \{\s*'@fronds\/facade': '\.\/\.fougere\/facade\.generated\.ts',\s*'@fronds': '\.\.\/\.\.\/fronds'\s*\}/);
      expect(read('vite.config.ts')).toContain('adapter: adapter()');
      expect(read('tsconfig.json')).not.toContain('@fronds/facade');
      expect(read('src/routes/+page.svelte')).toContain('Your app is running on');
    } finally { dispose(); }
  });

  it('oclif: no tool of its own, so the starter is copied whole', async () => {
    const { has, dispose } = await app('oclif');
    try {
      expect(has('src/main.ts')).toBe(true);
      expect(has('scaffold.json')).toBe(false);
    } finally { dispose(); }
  });

  it('puts the blog example in each app whose host has one, naming the frond as the plan did', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-example-'));
    const root = join(parent, 'shop');
    try {
      await writer().write({ name: 'shop', fronds: [{ template: 'blog', name: 'news' }], apps: [{ template: 'nuxt', name: 'web' }, { template: 'react', name: 'spa' }] }, root);

      expect(readFileSync(join(root, 'apps/web/app/pages/posts.vue'), 'utf8')).toContain("from '@fronds/news/entities/Post.js'");
      expect(readFileSync(join(root, 'apps/spa/src/App.tsx'), 'utf8')).toContain("location.pathname === '/posts'");
    } finally { rmSync(parent, { recursive: true, force: true }); }
  });

  it('puts no example when the frond is absent', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-example-'));
    const root = join(parent, 'shop');
    try {
      await writer().write({ name: 'shop', fronds: [], apps: [{ template: 'nuxt', name: 'web' }] }, root);

      expect(existsSync(join(root, 'apps/web/app/pages/posts.vue'))).toBe(false);
    } finally { rmSync(parent, { recursive: true, force: true }); }
  });
});
