/** The GraphQL surface, in two calls: */
export { registerAll } from './auto-register.js';
export type { RegisterAllOptions } from './auto-register.js';
export { registerGraphQL } from './serve.js';
export type { GraphQLServeOptions } from './serve.js';
export { schemaOf, executeOn, type AppQuery } from './app.js';
