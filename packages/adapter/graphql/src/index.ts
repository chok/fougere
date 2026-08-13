/**
 * The GraphQL surface, in two calls: derive the schema, then mount it.
 *
 * The Pothos primitives `registerAll` stands on live one import away, under
 * `@fougere/adapter-graphql/pothos`. They are a complement — a field the projection cannot
 * derive — never a second way to build what it already gives. Offering them at the same
 * rank made that hierarchy invisible: an agent looking for "how do I declare a type" found
 * three doors and rebuilt two hundred lines by hand (measured 2026-08-02).
 */
export { registerAll } from './auto-register.js';
export type { RegisterAllOptions } from './auto-register.js';
export { registerGraphQL } from './serve.js';
export type { GraphQLServeOptions } from './serve.js';
