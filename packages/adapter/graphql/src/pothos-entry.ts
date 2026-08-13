/**
 * The Pothos primitives — for what `registerAll` cannot derive, never to replace it.
 *
 * Reach for these to add a field the projection has no way to know about. Rebuilding
 * types, inputs and operations with them reimplements `registerAll` by hand and drops
 * what it wires for free: relations, and a presenter's computed fields.
 */
export { registerType, registerInput, registerOperations, registerObjectType } from './pothos.js';
export type { TypeConfig, InputConfig, OperationsConfig, ObjectFieldDef } from './pothos.js';
