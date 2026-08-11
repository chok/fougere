/**
 * `@fougere/app` — what an app host needs and what no host owns.
 *
 * Two adapters read this package: `@fougere/nuxt` and `@fougere/next`. Between
 * them they share the boot, the three doors' decisions, the REST table, the form
 * contract and the session view; what they do NOT share is how a request arrives,
 * how routes are mounted, and how a value becomes reactive.
 *
 * The root entry pulls in the boot, which reads the filesystem — client code wants
 * `@fougere/app/client`.
 */
export {
  configureFougere,
  useFougereApp,
  createMemoryOrm,
  type FougereServerConfig,
} from './boot.js';

export { useFougereAuth } from './auth.js';

export {
  tableOf,
  matchRoute,
  type Matchable,
  type RouteMatch,
} from './rest.js';

export {
  serveRest,
  shapeRest,
  serveRpc,
  surfaceOf,
  rpcParseError,
  invokeOn,
  type DoorRequest,
  type Outcome,
} from './serve.js';

export {
  formFieldsOf,
  payloadOf,
  errorsByField,
  type FormEntity,
  type FormField,
} from './form.js';

export { sessionViewOf, type SessionView } from './session.js';

export { stateFor } from './state.js';

export { serveGraphQL, type GraphQLRequest } from './graphql.js';
