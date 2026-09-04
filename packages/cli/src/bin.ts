#!/usr/bin/env node
/** fougere CLI — a Fougere app powered by citty. */
import { createApp, setLogLevel, envLevel, type ScanResult } from '@fougere/core';
import { scanProject, getModuleLoader, frondDirsOf, DEFAULT_CONVENTIONS } from '@fougere/core/node';
import { readdir, stat } from 'node:fs/promises';
import { join } from 'node:path';
import { createContainer } from '@fougere/container';
import { ui } from './ui.js';
import { run } from './runner.js';
import { installLoader } from './loader.js';

await installLoader(process.cwd());

const cliRoot = new URL('..', import.meta.url).pathname;
const container = createContainer();
const terminal = ui();
container.registerValue('ui', terminal);
container.registerValue('cwd', process.cwd());

// The CLI is a Fougere app — silence its boot chatter unless explicitly asked. The
// threshold is SET, not only announced: a static import evaluates the logger module,
// its env read included, before this line runs.
process.env.FOUGERE_LOG_LEVEL ??= 'warn';
setLogLevel(envLevel() ?? 'warn');

/** The newest declaration under `fronds/`, or 0 when there is none to compare against. */
async function newestDeclaration(root: string): Promise<number> {
  const frondsDir = join(root, DEFAULT_CONVENTIONS.fronds);
  const names = await readdir(frondsDir, { withFileTypes: true }).catch(() => []);
  const dirs = names.filter((entry) => entry.isDirectory())
    .flatMap((entry) => [
      join(frondsDir, entry.name),
      ...frondDirsOf(DEFAULT_CONVENTIONS).map((dir) => join(frondsDir, entry.name, dir)),
    ]);

  const times = await Promise.all(dirs.map(async (dir) => {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const stats = await Promise.all(entries
      .filter((entry) => entry.isFile() && entry.name.endsWith('.ts'))
      .map((entry) => stat(join(dir, entry.name)).then((s) => s.mtimeMs).catch(() => 0)));
    return Math.max(0, ...stats);
  }));
  return Math.max(0, ...times);
}

/** The CLI is a Fougere app, so it reads its own written-down scan like any deployment — producing t… */
async function scanOf(root: string): Promise<ScanResult> {
  const written = join(root, '.fougere/scan.generated.ts');
  const writtenAt = await stat(written).then((s) => s.mtimeMs).catch(() => 0);
  if (writtenAt > 0 && writtenAt >= await newestDeclaration(root)) {
    return ((await getModuleLoader()(written)) as unknown as { scan: ScanResult }).scan;
  }

  // The only slow phase, and it announced nothing: the boot states it at `info`, which the
  // threshold above lowers to `warn`. The terminal says it instead, and a pipe keeps its
  // output parsable.
  const spin = process.stdout.isTTY ? terminal.spinner('reading fronds') : undefined;
  const scan = await scanProject(root);
  spin?.stop(`${scan.fronds.length} frond(s)`);
  return scan;
}

const scan = await scanOf(cliRoot);

const app = await createApp({ scan, createContainer: () => container });

container.registerValue('app', app);

await run(app);
