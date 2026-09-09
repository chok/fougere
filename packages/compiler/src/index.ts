/** The scan: reading a project's source to produce the descriptors core boots from. */
export { boot } from './boot.js';
export { scanProject, frondAliases, watchPathsOf } from './scan/scanner.js';
export {
  type Conventions, type ConventionsInput, DEFAULT_CONVENTIONS,
  resolveConventions, frondPackage, frondDirsOf, providerDirsOf,
} from '@fougere/core';
export { RUNTIME_PACKAGES } from './scan/bundling.js';
export { emitScan, type EmitOptions } from './scan/emit.js';
export { emitStatement } from './scan/statement.js';
export { adaptersOf } from './scan/adapters.js';
export { crossFrondImports, type CrossFrondImport } from './imports.js';
export { handlerDeclarations, type HandlerDeclaration } from './declarations.js';
export { outsideConventions, type OutsideConvention } from './placement.js';
