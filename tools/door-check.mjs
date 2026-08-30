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
import { execFileSync, spawn } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const ROOT = process.cwd();
const PORT = process.env.DOOR_PORT ?? '3210';
const BOOT_MS = 180_000;

const run = (cmd, args, opts = {}) =>
  execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts });

/** A package is packed when it publishes — the derivation `publish-check` also makes. */
const publishable = (dir, found = []) => {
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

let server;
try {
  const pkgs = publishable(path.join(ROOT, 'packages'));
  console.log(`packing ${pkgs.length} packages`);
  const tarball = {};
  for (const { name, dir } of pkgs) {
    tarball[name] = run('pnpm', ['pack', '--pack-destination', store], { cwd: dir }).trim().split('\n').at(-1);
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
  server.stdout.on('data', (d) => { log += d; });
  server.stderr.on('data', (d) => { log += d; });

  const deadline = Date.now() + BOOT_MS;
  let status = 0;
  while (Date.now() < deadline && server.exitCode === null) {
    await new Promise((r) => setTimeout(r, 2000));
    try {
      status = (await fetch(`http://localhost:${PORT}/`)).status;
      if (status === 200) break;
    } catch {
      /* not listening yet */
    }
  }

  if (status !== 200) {
    console.error(log);
    throw new Error(`the published door did not open: GET / answered ${status || 'nothing'}`);
  }
  console.log(`the door opens: GET / → 200`);
} finally {
  server?.kill('SIGTERM');
  rmSync(work, { recursive: true, force: true });
}
