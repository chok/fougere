/** What Fougere does with a filesystem, minus the scan — that is `@fougere/compiler`. */
export { setModuleLoader, getModuleLoader } from './loader.js';
export { loadConfig, loadCascadedConfig, remotesOf } from './FougereConfig.js';
export { statedModules } from './StatedModules.js';
export { defineFrond, loadFrondConfig } from './FrondConfig.js';

// Making a key and binding a name to it happen once, at a deployment, on a machine with
// a filesystem — the CLI speaking. Verifying happens per call, everywhere, and stays on
// the main entry behind `#crypto`.
export { generateKeyPair, issueGrant } from './identity-keys.js';
