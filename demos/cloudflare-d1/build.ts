/**
 * The two halves of a deployment, in the order the gradient requires.
 *
 * `fougere build` READS the project — it needs `node:fs`, a TypeScript loader and the
 * whole scanner. esbuild then bundles a worker that reads nothing. The compiler never
 * reaches the artefact: what ships is the module the first half wrote.
 */
import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const here = new URL('.', import.meta.url).pathname;

// 1. The scan, written down. `.fougere/scan.generated.ts` is gitignored — it is
//    regenerable, which is the test that decides whether an artefact belongs in a tree.
execFileSync('node', [fileURLToPath(import.meta.resolve('@fougere/cli/bin')), 'build'], { cwd: here, stdio: 'inherit' });

// 2. The bundle. `conditions: ['workerd']` is what makes `#ambient` resolve to the queue
//    rather than AsyncLocalStorage — one line, and no `node:async_hooks` in the output.
await build({
  entryPoints: [`${here}src/worker.ts`],
  outfile: `${here}dist/worker.mjs`,
  bundle: true,
  format: 'esm',
  platform: 'neutral',
  conditions: ['workerd'],
  mainFields: ['module', 'main'],
  // Provided BY workerd, so it is external the way `node:` is for a Node bundle. This is
  // not the same category as the check below: `cloudflare:workers` exists on the target,
  // a `node:` builtin does not.
  external: ['cloudflare:workers'],
  logLevel: 'warning',
});

// 3. The claim, checked. A builtin that crept back in is a deploy that fails in
//    production, so it fails here instead.
const bundle = readFileSync(`${here}dist/worker.mjs`, 'utf8');
const builtins = [...new Set([...bundle.matchAll(/from *["'](node:[a-z/]+)["']/g)].map((m) => m[1]))];
if (builtins.length > 0) {
  console.error(`\n  This bundle imports ${builtins.join(', ')} — it will not run without nodejs_compat.\n`);
  process.exit(1);
}
console.log('\n  dist/worker.mjs — no node: builtin, no compatibility flag\n');
