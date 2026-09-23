/**
 * What a tarball promises and what it contains — the one question no other check in
 * this repo asks. `build`, `typecheck` and `test` all read the workspace, where a
 * subpath resolves through pnpm's links; `exports` is consulted only once the package
 * is installed from a registry, which is the first place a stale entry is found.
 *
 * Found on its first run: `@fougere/app` declared `./router` against a file deleted
 * three commits earlier. The declaration outlived what it named.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';
import { init, parse } from 'es-module-lexer';

const ROOT = process.cwd();

/**
 * Scope is derived, not listed: a package is checked when it publishes an `exports`
 * map. `entry/` holds no code — `fougere` is a `bin` and resolves nothing — and a
 * scaffold template ships inside the CLI's own tarball rather than as a package.
 */
/** A package this repo publishes, and where it sits. */
interface Publishable {
  name: string;
  dir: string;
}

const publishable = (dir: string): Publishable[] => {
  const found: Publishable[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.') || e.name === 'templates' || e.name === 'tests') continue;
    const child = path.join(dir, e.name);
    if (e.isDirectory()) found.push(...publishable(child));
    else if (e.name === 'package.json') {
      const pkg = JSON.parse(readFileSync(child, 'utf8'));
      if (pkg.name && pkg.private !== true && pkg.exports) found.push({ name: pkg.name, dir });
    }
  }

  return found;
};

/**
 * Three findings this repo already states elsewhere, so they are not restated per
 * package: the workspace is ESM (so a `require` reaching ESM is the design), resolution
 * is Node16 (so a subpath exists through `exports` or not at all), and a scaffold under
 * `templates/` is source for an app nobody is resolving — the reason `knip.ts` skips it.
 */
const ESM_BY_DESIGN = 'CJSResolvesToESM';
const PRE_EXPORTS = 'node10';
const TEMPLATE = /^\.\/templates\//;

/** One finding of `attw`, as its JSON report writes it. */
interface Problem {
  kind: string;
  entrypoint: string;
  resolutionKind: string;
}

const attwOf = (dir: string): string[] => {
  // Through a file, not a pipe: a package with many entry points writes a resolution
  // table past what `execFileSync` hands back on a non-zero exit, and it exits non-zero
  // for every finding — including the ones filtered out just below.
  const report = path.join(tmpdir(), `attw-${path.basename(dir)}.json`);
  try {
    execSync(`"${path.join(ROOT, 'node_modules/.bin/attw')}" --pack . --profile node16 --format json > "${report}"`, {
      cwd: path.join(ROOT, dir), stdio: 'ignore',
    });
  } catch { /* a finding is an exit code; the report is on disk either way */ }
  const problems: Record<string, Problem[]> = JSON.parse(readFileSync(report, 'utf8')).problems ?? {};

  return Object.entries(problems)
    .filter(([kind]) => kind !== ESM_BY_DESIGN)
    .flatMap(([, hits]) => hits.filter((hit) => hit.resolutionKind !== PRE_EXPORTS))
    .map((hit) => `${hit.kind} — ${hit.entrypoint} (${hit.resolutionKind})`);
};

/** The package a bare specifier names — `@fougere/schema/card` is `@fougere/schema`. */
const packageOf = (specifier: string): string | undefined => {
  if (specifier.startsWith('.') || specifier.startsWith('/') || specifier.startsWith('#')) return undefined;
  if (specifier.includes(':') || builtinModules.includes(specifier.split('/')[0]!)) return undefined;
  const parts = specifier.split('/');

  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
};

/**
 * What a published file imports and its package does not declare. Inside the workspace every
 * package is reachable, and an install that hoists hides it as well; pnpm isolates, and
 * `pnpm create fougere` died on `Cannot find package '@fougere/schema'` from the compiler.
 * Read with a lexer, so an import written inside a string — a generated script — is not one.
 */
const undeclaredOf = (dir: string): string[] => {
  const manifest = JSON.parse(readFileSync(path.join(dir, 'package.json'), 'utf8'));
  const declared = new Set<string>([
    manifest.name,
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.peerDependencies ?? {}),
    ...Object.keys(manifest.optionalDependencies ?? {}),
  ]);
  const missing = new Map<string, string>();
  const dist = path.join(dir, 'dist');
  for (const file of readdirSync(dist, { recursive: true, encoding: 'utf8' })) {
    if (!/\.m?js$/.test(file)) continue;
    const [imports] = parse(readFileSync(path.join(dist, file), 'utf8'));
    for (const { n } of imports) {
      const name = n === undefined ? undefined : packageOf(n);
      if (name !== undefined && !declared.has(name) && !missing.has(name)) missing.set(name, file);
    }
  }

  return [...missing].map(([name, file]) => `imports ${name}, which it does not declare — dist/${file}`);
};

await init;

const packages = publishable('packages').sort((one, other) => one.name.localeCompare(other.name));
let failed = 0;

for (const { name, dir } of packages) {
  const lint = await publint({ pkgDir: dir, strict: true });
  const findings = [
    ...lint.messages
      .filter((m) => !(m.code === 'NESTED_PACKAGE_JSON_FIELD_IGNORED' && TEMPLATE.test(m.args.filePath)))
      .map((m) => formatMessage(m, lint.pkg))
      .filter(Boolean),
    ...attwOf(dir),
    ...undeclaredOf(dir),
  ];
  if (findings.length === 0) {
    console.log(`ok    ${name}`);
    continue;
  }
  failed++;
  console.log(`FAIL  ${name}`);
  for (const f of findings) console.log(`        ${f}`);
}

console.log(`\n${packages.length - failed} ok, ${failed} failing, of ${packages.length} publishable packages.`);
process.exit(failed === 0 ? 0 : 1);
