/** What Fougere does with a filesystem, minus the scan — that is `@fougere/compiler`. */
export { setModuleLoader, getModuleLoader, type ModuleLoader } from './loader.js';
export { BUILD_DIRECTORY, configFileIn, appOptionsFileIn, loadConfig, loadNearestConfig, configFileNear, projectRootOf, remotesOf } from './config/FougereConfig.js';
export { configModules } from './project/ConfigModules.js';
export { defineFrond, frondConfigFileIn, loadFrondConfig } from './descriptor/FrondConfig.js';

export { generateKeyPair, issueGrant } from './identity/identity-keys.js';
export { ALIASES, frondAliases, frondNamesOf, MODULES, registerFrondAliases, REMOTES } from './project/FrondAliases.js';
export { codesOf, emitFacade, facadeModule, type Served } from './projection/FacadeModule.js';
export { emitNames, NAMES } from './projection/NamesModule.js';
export { FACADE } from './projection/FacadeModule.js';
export { appOptionsIn } from './project/appOptionsIn.js';
export { RUNTIME_PACKAGES } from './project/RuntimePackages.js';
