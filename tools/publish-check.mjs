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
import { execSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { publint } from 'publint';
import { formatMessage } from 'publint/utils';

const ROOT = process.cwd();

/**
 * Scope is derived, not listed: a package is checked when it publishes an `exports`
 * map. `entry/` holds no code — `fougere` is a `bin` and resolves nothing — and a
 * scaffold template ships inside the CLI's own tarball rather than as a package.
 */
const publishable = (dir) => {
  const found = [];
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

const attwOf = (dir) => {
  // Through a file, not a pipe: a package with many entry points writes a resolution
  // table past what `execFileSync` hands back on a non-zero exit, and it exits non-zero
  // for every finding — including the ones filtered out just below.
  const report = path.join(tmpdir(), `attw-${path.basename(dir)}.json`);
  try {
    execSync(`"${path.join(ROOT, 'node_modules/.bin/attw')}" --pack . --profile node16 --format json > "${report}"`, {
      cwd: path.join(ROOT, dir), stdio: 'ignore',
    });
  } catch { /* a finding is an exit code; the report is on disk either way */ }
  const problems = JSON.parse(readFileSync(report, 'utf8')).problems ?? {};
  return Object.entries(problems)
    .filter(([kind]) => kind !== ESM_BY_DESIGN)
    .flatMap(([, hits]) => hits.filter((h) => h.resolutionKind !== PRE_EXPORTS))
    .map((h) => `${h.kind} — ${h.entrypoint} (${h.resolutionKind})`);
};

const packages = publishable('packages').sort((a, b) => a.name.localeCompare(b.name));
let failed = 0;

for (const { name, dir } of packages) {
  const lint = await publint({ pkgDir: dir, strict: true });
  const findings = [
    ...lint.messages
      .filter((m) => !(m.code === 'NESTED_PACKAGE_JSON_FIELD_IGNORED' && TEMPLATE.test(m.args.filePath)))
      .map((m) => formatMessage(m, lint.pkg))
      .filter(Boolean),
    ...attwOf(dir),
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
