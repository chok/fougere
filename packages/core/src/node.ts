/**
 * What Fougere does with a filesystem — the half of core that a Worker cannot run.
 *
 * The line is not "build vs runtime": `boot()` and `loadConfig` run in production, on a
 * server, every time. It is whether the thing reaches for a disk. Everything here does,
 * transitively, and nothing on the main entry does — which is what lets a bundler for a
 * runtime without `node:fs` trace the main entry and find no builtin at all.
 *
 * The third entry, `@fougere/core/contract`, answers a different question: what crosses a
 * process boundary. A foreign frond reads it without reading our boot.
 */
export { boot } from './boot/boot.js';

export { scanProject, frondAliases, watchPathsOf } from './scan/scanner.js';
export {
  type Conventions, type ConventionsInput, DEFAULT_CONVENTIONS,
  resolveConventions, frondPackage, frondDirsOf, providerDirsOf,
} from './scan/conventions.js';
export { RUNTIME_PACKAGES } from './scan/bundling.js';
export { emitScan, type EmitOptions } from './scan/emit.js';
export { emitStatement } from './scan/statement.js';
export { setModuleLoader, getModuleLoader } from './loader.js';
export { loadConfig, loadCascadedConfig } from './config-loader.js';
export { defineFrond } from './frond-config.js';
export { crossFrondImports } from './imports.js';

// Making a key and binding a name to it happen once, at a deployment, on a machine with
// a filesystem — the CLI speaking. Verifying happens per call, everywhere, and stays on
// the main entry behind `#crypto`.
export { generateKeyPair, issueGrant } from './identity-keys.js';
