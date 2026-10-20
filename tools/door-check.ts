/**
 * Does the PUBLISHED facade open? `publish:check` asks what a tarball promises in its
 * `exports`; nothing asked what it RESOLVES at runtime. A Nuxt module resolves its
 * runtime by path when the host boots, so a file absent from the tarball — or present
 * but uncompiled — is invisible to every check that reads the workspace, where pnpm's
 * links make `src/` and `dist/` equally reachable.
 *
 * Found on its first run: `@fougere/nuxt` shipped `src/runtime/*.ts` raw and pointed
 * the host at it, so `nuxt dev` died in Rollup on the first published version and on
 * the three that followed. Four releases, one command away from being caught.
 *
 * Every host the composer offers is opened, because each app's shell is written by the host's
 * own tool — `create-nuxt`, `create-next-app`, `create-vite`, `sv` — and this is the one check
 * that runs them: a major that changed what it writes is seen here, not by a user.
 *
 * The scaffold is built OUTSIDE the repo on purpose: inside, pnpm resolves a workspace
 * link and the question cannot be asked at all.
 *
 * And once per package manager: the project is written for the one that ran `create`, so each
 * writes its own workspace file, scripts and build permissions — and installs through its own
 * resolver. `DOOR_HOSTS` and `DOOR_MANAGERS` narrow the matrix (`nuxt,react`, `npm,bun`).
 */
import { execFileSync, spawn, type ChildProcess, type ExecFileSyncOptions } from 'node:child_process';
import { appendFileSync, chmodSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { CHECKED } from '../packages/cli/src/composer/Offered.ts';
import { PackageManager } from '../packages/cli/src/scaffold/PackageManager.ts';

const ROOT = process.cwd();
const PORT = process.env.DOOR_PORT ?? '3210';
const BOOT_MS = 180_000;

const work = mkdtempSync(path.join(tmpdir(), 'fougere-facade-'));
const store = path.join(work, 'tarballs');

/** yarn 4 comes through corepack: a `yarn` on PATH is yarn 1 often enough, and the scripts call `yarn` by name. */
const shims = path.join(work, 'bin');
mkdirSync(shims, { recursive: true });
writeFileSync(path.join(shims, 'yarn'), '#!/bin/sh\nexec corepack yarn "$@"\n');
chmodSync(path.join(shims, 'yarn'), 0o755);
const env = { ...process.env, PATH: `${shims}${path.delimiter}${process.env.PATH}`, YARN_ENABLE_IMMUTABLE_INSTALLS: 'false' };

const run = (cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string =>
  execFileSync(cmd, args, { env, ...opts, encoding: 'utf8', stdio: opts.stdio ?? 'pipe' });
const shell = (line: string, cwd: string): string => run('sh', ['-c', line], { cwd, stdio: 'inherit' });

const managers = (process.env.DOOR_MANAGERS?.split(',') ?? [...PackageManager.names]) as PackageManager['name'][];
const hosts = process.env.DOOR_HOSTS?.split(',') ?? CHECKED;

/** What `create` would have handed over, had this manager run it. */
const agentOf = (name: PackageManager['name']): string => {
  const version = run(name, ['--version'], { cwd: tmpdir() }).trim().split('\n').at(-1);

  return `${name}/${version} npm/? node/${process.version} ${process.platform} ${process.arch}`;
};

/** The app's `dev`, on the port this check listens on — each manager forwards arguments its own way. */
const devOf: Record<PackageManager['name'], string[]> = {
  npm: ['npm', 'run', 'dev', '--', '--port', PORT],
  pnpm: ['pnpm', 'dev', '--port', PORT],
  bun: ['bun', 'run', 'dev', '--port', PORT],
  yarn: ['yarn', 'dev', '--port', PORT],
};

/**
 * Every `@fougere/*` the project names, pointed at this commit's tarball — directly, and as an override
 * for the packages that name each other. npm refuses an override that disagrees with a direct dependency,
 * so both say the same `file:`.
 */
function fromTarballs(app: string, manager: PackageManager, tarball: Record<string, string>): void {
  const manifests = [path.join(app, 'package.json'), ...readdirSync(path.join(app, 'apps')).map((dir) => path.join(app, 'apps', dir, 'package.json'))];
  for (const file of manifests.filter((candidate) => existsSync(candidate))) {
    const pkg = JSON.parse(readFileSync(file, 'utf8')) as Record<string, Record<string, string> | undefined>;
    for (const list of ['dependencies', 'devDependencies'] as const) {
      for (const name of Object.keys(pkg[list] ?? {})) if (tarball[name]) pkg[list]![name] = `file:${tarball[name]}`;
    }
    writeFileSync(file, JSON.stringify(pkg, null, 2) + '\n');
  }

  const specs = Object.fromEntries(Object.entries(tarball).map(([name, file]) => [name, `file:${file}`]));
  if (manager.name === 'pnpm') {
    // pnpm 11 stopped reading `overrides` from package.json: they belong in the workspace file.
    const lines = Object.entries(specs).map(([name, spec]) => `  '${name}': ${spec}`).join('\n');
    appendFileSync(path.join(app, 'pnpm-workspace.yaml'), `\noverrides:\n${lines}\n`);

    return;
  }
  const root = path.join(app, 'package.json');
  const pkg = JSON.parse(readFileSync(root, 'utf8')) as Record<string, unknown>;
  pkg[manager.name === 'yarn' ? 'resolutions' : 'overrides'] = specs;
  writeFileSync(root, JSON.stringify(pkg, null, 2) + '\n');
}

/** A package this repo publishes, and where it sits. */
interface Publishable {
  name: string;
  dir: string;
}

/** A package is packed when it publishes — the derivation `publish-check` also makes. */
const publishable = (dir: string, found: Publishable[] = []): Publishable[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'templates' || e.name === 'tests') continue;
    if (e.isDirectory()) publishable(path.join(dir, e.name), found);
    else if (e.name === 'package.json') {
      const pkg = JSON.parse(readFileSync(path.join(dir, e.name), 'utf8'));
      if (pkg.name && pkg.private !== true) found.push({ name: pkg.name, dir });
    }
  }

  return found;
};

/** Scaffold one host from the tarballs, migrate, boot, and ask the domain — or throw saying where it stopped. */
async function open(host: string, name: PackageManager['name'], tarball: Record<string, string>): Promise<void> {
  const agent = agentOf(name);
  const manager = PackageManager.of(agent);
  const where = `${host} × ${name}`;
  const project = `door-${host}-${name}`;
  const app = path.join(work, project);
  console.log(`\n${where}: scaffolding outside the workspace`);
  run('node', [path.join(ROOT, 'packages/entry/create/dist/bin.js'), project, '--frond', 'blog', '--app', host], {
    cwd: work,
    env: { ...env, npm_config_user_agent: agent },
  });

  // The scaffold pins every @fougere dep to the CLI's version. Pointing them at the tarballs is
  // what makes this a test of THIS commit rather than of what is already on the registry.
  fromTarballs(app, manager, tarball);

  console.log(`${where}: installing from tarballs`);
  shell(name === 'pnpm' ? 'pnpm install --no-frozen-lockfile' : manager.install(), app);

  // The boot reads the schema and refuses a database behind it, so a newcomer migrates
  // first — and the `fougere` it runs is the one packed above.
  console.log(`${where}: migrating`);
  shell(manager.script('migrate'), app);

  console.log(`${where}: booting`);
  const [bin, ...args] = devOf[name];
  const server: ChildProcess = spawn(bin, args, {
    cwd: path.join(app, 'apps', host),
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    detached: true,
  });
  let log = '';
  server.stdout!.on('data', (chunk) => { log += chunk; });
  server.stderr!.on('data', (chunk) => { log += chunk; });

  try {
    const deadline = Date.now() + BOOT_MS;
    let status = 0;
    let body = '';
    while (Date.now() < deadline && server.exitCode === null) {
      await new Promise((wake) => setTimeout(wake, 2000));
      try {
        const res = await fetch(`http://localhost:${PORT}/`);
        status = res.status;
        if (status === 200) break;
        body = await res.text();
      } catch {
        /* not listening yet */
      }
    }

    if (status !== 200) {
      // A status alone does not say what to fix: a boot that failed and a page that threw
      // both answer non-200, and only the body separates them.
      console.error(log);
      if (body) console.error(body.slice(0, 4000));
      throw new Error(`${where}: the published facade did not open: GET / answered ${status || 'nothing'}`);
    }

    // A PAGE is not the facade. An app that boots with zero fronds renders every page and
    // answers NOT_FOUND to every call — the exact failure the scan exists to prevent, and
    // one a 200 cannot see. So the check asks the domain: the scaffold's own entity, listed.
    //
    // TWO operations, and the second is the one that measures anything: `post.list` comes
    // from a prefab, which declares its own contract in a static and survives whatever the
    // build does. `post.listPublished` is a method someone wrote — its contract is read
    // from SOURCE at scan time and no class carries it at runtime, so it answers only if
    // the statement the host boots from carried it across. Measured: it did not, and this
    // check said the facade was fine.
    // The example page imports the facade by name, which the welcome page does not: a host that
    // cannot resolve `@fronds/facade` answers `/` and fails here. Next 16's Turbopack did exactly that.
    const posts = await fetch(`http://localhost:${PORT}/posts`);
    if (posts.status !== 200) {
      console.error(log);
      console.error((await posts.text()).slice(0, 4000));
      throw new Error(`${where}: the example page did not open: GET /posts answered ${posts.status}`);
    }

    for (const method of ['post.list', 'post.listPublished']) {
      const call = await fetch(`http://localhost:${PORT}/_fougere/call`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
      });
      const answer = await call.json().then((json) => json as Record<string, unknown>).catch(() => null);
      if (!answer || !('result' in answer)) {
        console.error(log);
        console.error(JSON.stringify(answer)?.slice(0, 2000));
        throw new Error(`${where}: the facade opens but answers nothing: ${method} returned no result`);
      }
    }
    console.log(`${where}: the facade opens — GET / and /posts → 200, and post.list and post.listPublished answer`);
  } finally {
    try {
      process.kill(-server.pid!, 'SIGTERM');
    } catch {
      // the group is already gone
    }
  }
}

try {
  const pkgs = publishable(path.join(ROOT, 'packages'));
  console.log(`packing ${pkgs.length} packages`);
  const tarball: Record<string, string> = {};
  for (const { name, dir } of pkgs) {
    tarball[name] = run('pnpm', ['pack', '--pack-destination', store], { cwd: dir }).trim().split('\n').at(-1)!;
  }
  for (const host of hosts) for (const name of managers) await open(host, name, tarball);
} finally {
  rmSync(work, { recursive: true, force: true });
}
