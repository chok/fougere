/** What Fougere does with a filesystem, minus the scan — that is `@fougere/compiler`. */
export { setModuleLoader, getModuleLoader, type ModuleLoader } from './loader.js';
export { BUILD_DIRECTORY, configFileIn, statementFileIn, loadConfig, loadNearestConfig, configFileNear, projectRootOf, remotesOf } from './FougereConfig.js';
export { configModules } from './ConfigModules.js';
export { defineFrond, frondConfigFileIn, loadFrondConfig } from './FrondConfig.js';

export { generateKeyPair, issueGrant } from './identity-keys.js';
export { ALIASES, frondAliases, frondNamesOf, MODULES, registerFrondAliases, REMOTES } from './FrondAliases.js';
export { codesOf, emitFacade, facadeModule, type Served } from './projection/FacadeModule.js';
export { emitNames, NAMES } from './projection/NamesModule.js';
export { FACADE } from './projection/FacadeModule.js';
export { statementIn, type Statement } from './Statement.js';
export { RUNTIME_PACKAGES } from './RuntimePackages.js';
