import { describe, expect, it } from 'vitest';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import ProjectWriter from '../fronds/scaffold/services/ProjectWriter.js';
import Shell from '../fronds/scaffold/services/Shell.js';

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
  it('emits a pnpm 12 project with native build permissions and the Fougere check workflow', async () => {
    const parent = mkdtempSync(join(tmpdir(), 'fougere-workspace-'));
    const root = join(parent, 'forest');

    try {
      new ProjectWriter().createWorkspace(root, 'forest');
      const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')) as { packageManager?: string; pnpm?: unknown; dependencies: Record<string, string> };
      const workspace = readFileSync(join(root, 'pnpm-workspace.yaml'), 'utf8');

      expect(pkg.packageManager).toBe('pnpm@12.6.0');
      expect(pkg.pnpm).toBeUndefined();
      expect(pkg.dependencies).toHaveProperty('better-sqlite3');
      expect(workspace).toContain('better-sqlite3: false');
      expect(workspace).toContain('esbuild: true');
      expectFougereCheckWorkflow(root, 'pnpm typecheck');
    } finally {
      rmSync(parent, { recursive: true, force: true });
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
      expect(paths).toEqual({ '@/*': ['./*'], '@fronds/facade': ['./.fougere/facade.generated.ts'] });
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
      expect(read('vite.config.ts')).toMatch(/alias: \{\s*'@fronds\/facade': '\.\/\.fougere\/facade\.generated\.ts'\s*\}/);
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
