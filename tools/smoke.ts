/**
 * A demo is a process that says something, and this asks the one question every demo
 * answers the same way: does it start?
 *
 * The two shapes are not declared, they are READ. A demo that speaks and leaves — the
 * scanner, the container, the two payment providers — exits on its own, and its exit code
 * is the verdict. A demo that boots and stays — a server, a front-end — is still running
 * when the budget expires, and surviving IS the verdict. Nothing in `demos/` states which
 * one it is, and nothing should: the shape is a consequence of what the demo has to say.
 *
 * A service that publishes what it serves is asked: when an address it printed answers
 * `/api/openapi.json`, every read route there that takes no parameter is called, and a 404 or a
 * 5xx fails it — a process can stay up and answer nothing, which is how the split blog of
 * `demos/nuxt-blog` logged "REST served" over a door that answered 404 everywhere (2026-10-20).
 * A demo that publishes nothing keeps the first verdict. Every `dev:*` script of a demo is a
 * process it ships too, and runs beside `dev`.
 *
 * Its ceiling is still what a process says of itself. It judges that a process came up, never that what it
 * printed is true — `pnpm -C demos/ports-swap dev` refusing the third payment is the whole
 * point of that demo, and this file cannot tell that refusal from a crash. The suite in
 * `packages/` holds the claims; this holds the facade. What it catches is what no unit test
 * can see: a demo left behind by a rename, an import that moved, a port taken twice.
 *
 * Demos run one after another because several of them bind the same ports on purpose
 * (:4100 is the blog in five front-ends), and a run of the fleet in parallel would report
 * the collision as a defect of whichever lost.
 */
import { existsSync, readFileSync } from 'node:fs';
import { spawn, execFileSync, type ChildProcess } from 'node:child_process';
import path from 'node:path';

/** A demo this runner cannot start, and why the absence is the demo's shape, not a gap. */
const STATED = new Map([
  ['emit-fleet',
    'A hub and its nodes: `hub` and `node` are two commands that only say something ' +
    'together, and one of them alone says nothing. This runner reads a single command.'],
  ['emit-multirepo',
    'Two repositories and a carrier between them. The demo IS the pair, and neither half ' +
    'is a process this file could start.'],
  ['rust-frond',
    'The far side is not TypeScript: `frond` needs cargo. What the demo proves — that the ' +
    'validator stays ours across the wire — is not reachable by starting a node process.'],
]);

const BUDGET_MS = 20_000;
const demosDirectory = path.resolve('demos');

/** What a run said: a service still up when the budget ran out, or a process that left. */
interface Verdict {
  shape: 'service' | 'one shot';
  ok: boolean;
  output: string;
  code?: number | null;
}

/**
 * A demo is what the repository SHIPS, so git names them rather than the filesystem: a
 * spike left in `demos/` is not a demo, and `emit-multirepo` — two repositories and no
 * manifest of its own — is one.
 */
function demosOf(directory: string): string[] {
  const tracked = execFileSync('git', ['ls-files', directory], { encoding: 'utf8' });

  const inADemo = (file: string) => file.split('/').length > 2;

  return [...new Set(tracked.split('\n').filter(inADemo).map((file) => file.split('/')[1]!))].sort();
}

function scriptOf(demo: string, name: string): string | undefined {
  const manifest = path.join(demosDirectory, demo, 'package.json');
  if (!existsSync(manifest)) return undefined;

  return JSON.parse(readFileSync(manifest, 'utf8')).scripts?.[name];
}

/**
 * A demo whose database is a file migrates before it starts — the boot only reads the schema,
 * and a fresh checkout holds none. Its failure is the demo's, reported like a failed start.
 */
function migrated(demo: string): string | undefined {
  if (!scriptOf(demo, 'migrate')) return undefined;
  try {
    execFileSync('pnpm', ['-C', path.join('demos', demo), 'migrate'], { encoding: 'utf8', stdio: 'pipe' });

    return undefined;
  } catch (error) {
    const { stdout = '', stderr = '' } = error as { stdout?: string; stderr?: string };

    return tail(`${stdout}\n${stderr}`).join('\n    ');
  }
}

/** `dev`, then every `dev:*` — `dev:blog` is the split half of a demo, and a process of its own. */
function scriptsOf(demo: string): string[] {
  const manifest = path.join(demosDirectory, demo, 'package.json');
  if (!existsSync(manifest)) return [];
  const scripts = Object.keys(JSON.parse(readFileSync(manifest, 'utf8')).scripts ?? {});

  return [...scripts.filter((name) => name === 'dev'), ...scripts.filter((name) => name.startsWith('dev:')).sort()];
}

function start(demo: string, script: string): ChildProcess {
  return spawn('pnpm', ['-C', path.join('demos', demo), script], {
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function release(child: ChildProcess): void {
  try {
    process.kill(-child.pid!, 'SIGTERM');
  } catch {
    // the group is already gone
  }
}

/** What a process printed, its colours taken out. */
function plain(output: string): string {
  return output.replace(/\x1b\[[0-9;]*m/g, '');
}

/** Where a service said it listens — the addresses it printed, on this machine. */
function originsIn(output: string): string[] {
  const printed = plain(output).match(/https?:\/\/(?:127\.0\.0\.1|localhost|0\.0\.0\.0|\[::1\]):\d+/g) ?? [];

  return [...new Set(printed.map((url) => new URL(url).origin))];
}

/**
 * What a service that publishes its REST routes answers on them — the refusals, empty when it
 * publishes none. A route taking a parameter needs a value this file cannot invent, so only those
 * taking none are called.
 */
async function asked(output: string): Promise<string[]> {
  const refusals: string[] = [];
  for (const origin of originsIn(output)) {
    const published = await fetch(`${origin}/api/openapi.json`).catch(() => undefined);
    // A dev server answers its page for any path it does not know, and that page is no document.
    if (!published?.ok || !published.headers.get('content-type')?.includes('json')) continue;
    const document = await published.json().catch(() => ({})) as { paths?: Record<string, { get?: { parameters?: { in: string; required?: boolean }[] } }> };

    for (const [route, operations] of Object.entries(document.paths ?? {})) {
      if (!operations.get || route.includes('{') || operations.get.parameters?.some((one) => one.required)) continue;
      const answered = await fetch(origin + route).catch((error: Error) => ({ status: 0, statusText: error.message }));
      if (answered.status === 0 || answered.status === 404 || answered.status >= 500) {
        refusals.push(`GET ${origin}${route} → ${answered.status || answered.statusText}`);
      }
    }
  }

  return refusals;
}

function run(demo: string, script: string): Promise<Verdict> {
  const child = start(demo, script);
  let output = '';

  child.stdout!.on('data', (chunk) => { output += chunk; });
  child.stderr!.on('data', (chunk) => { output += chunk; });

  return new Promise<Verdict>((resolve) => {
    const budget = setTimeout(async () => {
      const refusals = await asked(output).catch((error: Error) => [`asking it failed: ${error.message}`]);
      release(child);
      resolve({ shape: 'service', ok: refusals.length === 0, output: [output, ...refusals].join('\n') });
    }, BUDGET_MS);

    child.on('exit', (code) => {
      clearTimeout(budget);
      release(child);
      resolve({ shape: 'one shot', ok: code === 0, code, output });
    });
  });
}

const tail = (output: string) =>
  plain(output).trim().split('\n').filter(Boolean).slice(-4);

// `pnpm smoke nuxt-blog` runs the demos named, every one with none.
const named = process.argv.slice(2);
const demos = demosOf(demosDirectory).filter((demo) => named.length === 0 || named.includes(demo));
const failures: [string, string][] = [];
const stated: [string, string][] = [];

for (const demo of demos) {
  const scripts = scriptsOf(demo);
  if (scripts.length === 0) {
    const reason = STATED.get(demo);
    if (reason) stated.push([demo, reason]);
    else failures.push([demo, 'no `dev` script, and this file does not say why']);
    continue;
  }

  const refused = migrated(demo);
  if (refused) {
    console.log(`${demo.padEnd(28)} FAIL (migrate)`);
    failures.push([demo, refused]);
    continue;
  }
  for (const script of scripts) {
    const named = script === 'dev' ? demo : `${demo} ${script}`;
    process.stdout.write(`${named.padEnd(28)} `);
    const verdict = await run(demo, script);

    if (verdict.ok) console.log(`ok   (${verdict.shape})`);
    else {
      console.log(verdict.shape === 'service' ? 'FAIL (asked)' : `FAIL (exit ${verdict.code})`);
      failures.push([named, tail(verdict.output).join('\n    ')]);
    }
  }
}

console.log(`\n${demos.length - stated.length - failures.length} started, ${failures.length} failed, ${stated.length} stated`);

for (const [demo, reason] of stated) console.log(`  stated  ${demo} — ${reason.split('.')[0]}.`);

for (const [demo, why] of failures) console.log(`\n  ${demo}\n    ${why}`);

process.exit(failures.length === 0 ? 0 : 1);
