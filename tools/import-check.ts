/**
 * Does every name this repo IMPORTS from its own packages still exist?
 *
 * `tsc` answers that for the files a tsconfig reads, which is not all of them: a `.mjs`
 * host script, a scaffold template, a fenced block in a README. All three name a package's
 * door and none is type-checked, so an export pass that counts callers sees them as zero
 * callers and cuts.
 *
 * Measured 2026-09-11, one day after such a pass: `generateSQL` was gone from
 * `adapter/sql`'s entry while `demos/cloudflare-d1/scripts/schema.mjs` still called it, and
 * `bootAppFromConfig` had been renamed under `packages/cli/templates/frond/serve.mjs` — the
 * file a new project is scaffolded from. Both failed at the first run, in the two places
 * nobody runs on the way to a green suite.
 *
 * VALUE imports only. A type import resolves nowhere at runtime, which is why the entry is
 * loaded rather than parsed: what a package's `exports` actually hands back is the question,
 * and the `.d.ts` barrel answers a different one.
 */
import { readFileSync, existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const root = process.cwd();

const tracked = (...globs: string[]): string[] =>
  execSync(`git ls-files ${globs.map((g) => `'${g}'`).join(' ')}`, { cwd: root, encoding: 'utf8', maxBuffer: 1 << 28 })
    .trim().split('\n').filter(Boolean);

/** Every workspace package, by the name the outside types. */
const packages = new Map<string, string>();
for (const manifest of tracked('packages/**/package.json').filter((p) => p.split('/').length <= 4)) {
  const declared = JSON.parse(readFileSync(path.join(root, manifest), 'utf8'));
  if (declared.name) packages.set(declared.name, path.join(root, path.dirname(manifest)));
}

/** The file a specifier resolves to, read from the package's own `exports`. */
function entryOf(specifier: string): string | undefined {
  const segments = specifier.split('/');
  const name = specifier.startsWith('@') ? segments.slice(0, 2).join('/') : segments[0];
  const directory = packages.get(name);
  if (!directory) return undefined;

  const declared = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8'));
  const subpath = specifier === name ? '.' : `.${specifier.slice(name.length)}`;
  const exported = declared.exports?.[subpath];
  const file = typeof exported === 'string' ? exported : exported?.import ?? exported?.default ?? declared.main;

  return file ? path.resolve(directory, file) : undefined;
}

/** `import { a, b } from '@fougere/x'` — never `import type`, never a `type a` specifier. */
const NAMED = /import\s+(type\s+)?\{([^}]*)\}\s*from\s*['"](@fougere\/[^'"]+|fougere)['"]/g;

const wanted = new Map<string, Map<string, string>>();
for (const file of tracked('*.ts', '*.tsx', '*.mjs', '*.js', '*.vue', '*.md', '*.svelte')) {
  let text: string;
  try {
    text = readFileSync(path.join(root, file), 'utf8');
  } catch {
    continue;
  }
  for (const found of text.matchAll(NAMED)) {
    if (found[1]) continue;
    const specifier = found[3];
    const names = wanted.get(specifier) ?? new Map<string, string>();
    wanted.set(specifier, names);
    for (const raw of found[2].split(',')) {
      const written = raw.trim();
      if (!written || /^type\s/.test(written)) continue;
      const name = written.split(/\s+as\s+/)[0].trim();
      // The FIRST file that names it, because that is the one a refusal should send you to.
      if (!names.has(name)) names.set(name, file);
    }
  }
}

const closed: string[] = [];
const unreadable: string[] = [];
for (const [specifier, names] of [...wanted].sort()) {
  const entry = entryOf(specifier);
  if (!entry || !existsSync(entry)) {
    unreadable.push(`${specifier} — ${entry ? 'not built' : 'no such export'}: ${entry ?? '(unresolved)'}`);
    continue;
  }
  let door: Record<string, unknown>;
  try {
    door = await import(pathToFileURL(entry).href);
  } catch (refused) {
    unreadable.push(`${specifier} — ${(refused as Error).message.split('\n')[0]}`);
    continue;
  }
  for (const [name, file] of names) {
    if (!(name in door)) closed.push(`${file} imports '${name}' from '${specifier}', which does not export it`);
  }
}

for (const line of unreadable) console.log(`  ?  ${line}`);
for (const line of closed) console.log(`  ✗  ${line}`);

const counted = `${wanted.size} specifier(s), ${[...wanted.values()].reduce((n, names) => n + names.size, 0)} name(s)`;
if (closed.length > 0) {
  console.log(`\n${closed.length} import(s) name a door that is closed — ${counted}`);
  process.exit(1);
}
console.log(`every imported name is exported — ${counted}`);
if (unreadable.length > 0) {
  console.log(`${unreadable.length} entry point(s) could not be read; run \`pnpm run build\` first`);
  process.exit(1);
}
