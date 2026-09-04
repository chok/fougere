/** What Fougere does with a filesystem — the half of core that a Worker cannot run. */
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
export { adaptersOf } from './scan/adapters.js';

// Making a key and binding a name to it happen once, at a deployment, on a machine with
// a filesystem — the CLI speaking. Verifying happens per call, everywhere, and stays on
// the main entry behind `#crypto`.
export { generateKeyPair, issueGrant } from './identity-keys.js';
