/** The scan: reading a project's source to produce the descriptors core boots from. */
export { boot } from './boot.js';
export { scanProject, frondAliases, watchPathsOf } from './scan/scanner.js';
export { RUNTIME_PACKAGES } from './scan/bundling.js';
export { emitScan } from './scan/emit.js';
export { emitStatement } from './scan/statement.js';
export { adaptersOf } from './scan/adapters.js';
export { crossFrondImports } from './imports.js';
export { handlerDeclarations } from './declarations.js';
export { outsideConventions } from './placement.js';
