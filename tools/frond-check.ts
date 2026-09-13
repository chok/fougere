/**
 * What is inside a frond, across every project in this repo.
 *
 * `arch` and `arch:cycles` ask about the structure of a PACKAGE — what a file reaches, and where
 * it lives. This asks the one question they cannot: whether a frond is a frond. Its rules are
 * the framework's own vocabulary — a word declared inside the handler that only it can reach, a
 * neighbour reached by `../../` rather than by name, a surface naming an adapter nothing loaded.
 *
 * It is the check the framework already shipped and nothing ran: `fougere check` existed, was
 * reachable, and found six real things across ten projects on the day this file was written —
 * three guards no second caller could reach, and three relative imports inside the very demo
 * that exists to prove a frond can be deployed on its own.
 *
 * A GATE on what blocks, a READING on the rest — the line this repo's CI already draws, and for
 * its stated reason: a gate asks no judgment call and starts green. Half of what this reports
 * asks one. `demos/together-frame` keeps a reader at the root of a frond whose own comment says
 * `Nothing here is part of Fougere`, and it is right — it is demo scaffolding, and no convention
 * directory is where it belongs. Failing the build on that would teach people to silence it.
 */
import { readdirSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, '..');
const cli = path.join(root, 'packages/cli/dist/bin.js');

interface Finding {
  severity: string;
  code: string;
  filePath?: string;
  subject?: string;
  message: string;
}

/** A project is a directory stating a config — the same file the boot reads. */
function projects(): string[] {
  const found = ['site'].filter((one) => existsSync(path.join(root, one, 'fougere.config.ts')));
  for (const entry of readdirSync(path.join(root, 'demos'), { withFileTypes: true })) {
    const at = path.join('demos', entry.name);
    if (entry.isDirectory() && existsSync(path.join(root, at, 'fougere.config.ts'))) found.push(at);
  }

  return found;
}

let failed = 0;
let read = 0;
for (const project of projects()) {
  let report: { findings: Finding[] };
  try {
    const out = execFileSync('node', [cli, 'check', '--json'], { cwd: path.join(root, project), encoding: 'utf8' });
    report = JSON.parse(out) as { findings: Finding[] };
  } catch (error) {
    console.error(`${project}: check could not run — ${(error as Error).message.split('\n')[0]}`);
    failed += 1;
    continue;
  }

  for (const finding of report.findings) {
    const where = finding.filePath ? path.relative(root, finding.filePath) : project;
    console.error(`${finding.severity} ${where}: ${finding.code}${finding.subject ? ` (${finding.subject})` : ''}\n  ${finding.message}`);
    read += 1;
    if (finding.severity === 'blocking') failed += 1;
  }
}

console.log(`frond-check: ${projects().length} project(s), ${read} finding(s), ${failed} blocking`);
process.exit(failed === 0 ? 0 : 1);
