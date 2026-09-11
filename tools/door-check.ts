/**
 * Does the PUBLISHED door open? `publish:check` asks what a tarball promises in its
 * `exports`; nothing asked what it RESOLVES at runtime. A Nuxt module resolves its
 * runtime by path when the host boots, so a file absent from the tarball — or present
 * but uncompiled — is invisible to every check that reads the workspace, where pnpm's
 * links make `src/` and `dist/` equally reachable.
 *
 * Found on its first run: `@fougere/nuxt` shipped `src/runtime/*.ts` raw and pointed
 * the host at it, so `nuxt dev` died in Rollup on the first published version and on
 * the three that followed. Four releases, one command away from being caught.
 *
 * The scaffold is built OUTSIDE the repo on purpose: inside, pnpm resolves a workspace
 * link and the question cannot be asked at all.
 */
import { execFileSync, spawn, type ChildProcess, type ExecFileSyncOptions } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.DOOR_PORT ?? '3210';
const BOOT_MS = 180_000;

const run = (cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string =>
  execFileSync(cmd, args, { ...opts, encoding: 'utf8', stdio: opts.stdio ?? 'pipe' });

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

const work = mkdtempSync(path.join(tmpdir(), 'fougere-door-'));
const store = path.join(work, 'tarballs');
const app = path.join(work, 'app');

let server: ChildProcess | undefined;
try {
  const pkgs = publishable(path.join(ROOT, 'packages'));
  console.log(`packing ${pkgs.length} packages`);
  const tarball: Record<string, string> = {};
  for (const { name, dir } of pkgs) {
    tarball[name] = run('pnpm', ['pack', '--pack-destination', store], { cwd: dir }).trim().split('\n').at(-1)!;
  }

  console.log('scaffolding outside the workspace');
  run('node', [path.join(ROOT, 'packages/entry/create/dist/bin.js'), 'app', '--frond', 'blog', '--app', 'nuxt'], { cwd: work });

  // The scaffold writes `latest` for every @fougere dep. These overrides are what make
  // this a test of THIS commit rather than of what is already on the registry — and they
  // belong in the workspace file: pnpm 11 stopped reading `overrides` from package.json.
  const overrides = Object.entries(tarball).map(([n, f]) => `  '${n}': file:${f}`).join('\n');
  appendFileSync(path.join(app, 'pnpm-workspace.yaml'), `\noverrides:\n${overrides}\n`);

  console.log('installing from tarballs');
  run('pnpm', ['install', '--no-frozen-lockfile'], { cwd: app, stdio: 'inherit' });

  console.log('booting');
  const nuxtApp = path.join(app, 'apps/nuxt');
  server = spawn(path.join(nuxtApp, 'node_modules/.bin/nuxt'), ['dev', '--port', PORT], {
    cwd: nuxtApp,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  server.stdout!.on('data', (chunk) => { log += chunk; });
  server.stderr!.on('data', (chunk) => { log += chunk; });

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
    throw new Error(`the published door did not open: GET / answered ${status || 'nothing'}`);
  }

  // A PAGE is not the door. An app that boots with zero fronds renders every page and
  // answers NOT_FOUND to every call — the exact failure the scan exists to prevent, and
  // one a 200 cannot see. So the check asks the domain: the scaffold's own entity, listed.
  //
  // TWO operations, and the second is the one that measures anything: `post.list` comes
  // from a prefab, which declares its own contract in a static and survives whatever the
  // build does. `post.listPublished` is a method someone wrote — its contract is read
  // from SOURCE at scan time and no class carries it at runtime, so it answers only if
  // the statement the host boots from carried it across. Measured: it did not, and this
  // check said the door was fine.
  const ask = async (method: string): Promise<Record<string, unknown> | null> => {
    const call = await fetch(`http://localhost:${PORT}/_fougere/call`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params: {} }),
    });

    return call.json().then((answer) => answer as Record<string, unknown>).catch(() => null);
  };

  for (const method of ['post.list', 'post.listPublished']) {
    const answer = await ask(method);
    if (!answer || !('result' in answer)) {
      console.error(log);
      console.error(JSON.stringify(answer)?.slice(0, 2000));
      throw new Error(`the door opens but answers nothing: ${method} returned no result`);
    }
  }
  console.log(`the door opens: GET / → 200, and post.list and post.listPublished answer`);
} finally {
  server?.kill('SIGTERM');
  rmSync(work, { recursive: true, force: true });
}
