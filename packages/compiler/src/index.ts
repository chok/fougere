/** The scan: reading a project's source to produce the descriptors core boots from. */
export { scanProject } from './scan/scanner.js';
export { emitStatement } from './scan/statement.js';
// The third projection of one scan: the facades as TYPES, so a client can narrow a refusal.
export { adaptersOf } from './scan/adapters.js';
export { crossFrondImports } from './imports.js';
export { handlerDeclarations } from './declarations.js';
export { outsideConventions } from './placement.js';
export { writeStatement, writtenStatement } from './scan/written.js';
