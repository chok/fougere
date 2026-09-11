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
 * Its ceiling is that first second. It judges that a process came up, never that what it
 * printed is true — `pnpm -C demos/ports-swap dev` refusing the third payment is the whole
 * point of that demo, and this file cannot tell that refusal from a crash. The suite in
 * `packages/` holds the claims; this holds the door. What it catches is what no unit test
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

function devCommandOf(demo: string): string | undefined {
  const manifest = path.join(demosDirectory, demo, 'package.json');
  if (!existsSync(manifest)) return undefined;

  return JSON.parse(readFileSync(manifest, 'utf8')).scripts?.dev;
}

function start(demo: string): ChildProcess {
  return spawn('pnpm', ['-C', path.join('demos', demo), 'dev'], {
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

function run(demo: string): Promise<Verdict> {
  const child = start(demo);
  let output = '';

  child.stdout!.on('data', (chunk) => { output += chunk; });
  child.stderr!.on('data', (chunk) => { output += chunk; });

  return new Promise<Verdict>((resolve) => {
    const budget = setTimeout(() => {
      release(child);
      resolve({ shape: 'service', ok: true, output });
    }, BUDGET_MS);

    child.on('exit', (code) => {
      clearTimeout(budget);
      release(child);
      resolve({ shape: 'one shot', ok: code === 0, code, output });
    });
  });
}

const tail = (output: string) =>
  output.replace(/\x1b\[[0-9;]*m/g, '').trim().split('\n').filter(Boolean).slice(-4);

const demos = demosOf(demosDirectory);
const failures: [string, string][] = [];
const stated: [string, string][] = [];

for (const demo of demos) {
  if (!devCommandOf(demo)) {
    const reason = STATED.get(demo);
    if (reason) stated.push([demo, reason]);
    else failures.push([demo, 'no `dev` script, and this file does not say why']);
    continue;
  }

  process.stdout.write(`${demo.padEnd(20)} `);
  const verdict = await run(demo);

  if (verdict.ok) console.log(`ok   (${verdict.shape})`);
  else {
    console.log(`FAIL (exit ${verdict.code})`);
    failures.push([demo, tail(verdict.output).join('\n    ')]);
  }
}

console.log(`\n${demos.length - stated.length - failures.length} started, ${failures.length} failed, ${stated.length} stated`);

for (const [demo, reason] of stated) console.log(`  stated  ${demo} — ${reason.split('.')[0]}.`);

for (const [demo, why] of failures) console.log(`\n  ${demo}\n    ${why}`);

process.exit(failures.length === 0 ? 0 : 1);
