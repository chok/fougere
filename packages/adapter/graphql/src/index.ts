/** The GraphQL surface, in two calls. */
import './GraphQLProtocol.js';
export { registerAll } from './auto-register.js';
export { schemaOf, executeOn } from './app.js';
export { graphqlDoor, type GraphQLDocument, type GraphQLReceived } from './door.js';
