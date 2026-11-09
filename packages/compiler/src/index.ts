/** The scan: reading a project's source to produce the descriptors core boots from. */
export { scanProject } from './scan/scanner.js';
export { emitStatement } from './scan/statement.js';
export { adaptersOf } from './scan/adapters.js';
export { crossFrondImports } from './imports.js';
export { handlerDeclarations } from './declarations.js';
export { outsideConventions } from './placement.js';
export { writeDerived, writeStatement, writtenStatement } from './scan/written.js';
export { compileProject, type Compiled } from './compile.js';
