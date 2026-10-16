/** The GraphQL surface, in two calls. */
import './GraphQLProtocol.js';
export { registerAll } from './auto-register.js';
export { registerGraphQL } from './serve.js';
export { schemaOf, executeOn } from './app.js';
