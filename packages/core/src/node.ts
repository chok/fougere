/** What Fougere does with a filesystem, minus the scan — that is `@fougere/compiler`. */
export { setModuleLoader, getModuleLoader, type ModuleLoader } from './loader.js';
export { BUILT, configFileIn, statementFileIn, loadConfig, loadCascadedConfig, projectRootOf, remotesOf } from './FougereConfig.js';
export { statedModules } from './StatedModules.js';
export { defineFrond, frondConfigFileIn, loadFrondConfig } from './FrondConfig.js';

// Making a key and binding a name to it happen once, at a deployment, on a machine with
// a filesystem — the CLI speaking. Verifying happens per call, everywhere, and stays on
// the main entry behind `#crypto`.
export { generateKeyPair, issueGrant } from './identity-keys.js';
export { ALIASES, frondAliases, frondNamesOf, MODULES, registerFrondAliases, REMOTES } from './FrondAliases.js';
export { codesOf, emitFacade, facadeModule, type Served } from './projection/FacadeModule.js';
export { emitNames } from './projection/NamesModule.js';
export { statementIn, type Statement } from './Statement.js';
export { RUNTIME_PACKAGES } from './RuntimePackages.js';
