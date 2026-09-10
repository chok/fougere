/** `@fougere/app` — what an app host needs and what no host owns. */
export {
  configureFougere,
  extendFougere,
  useFougereApp,
  reloadFougere,
  type FougereServerConfig,
} from './boot.js';

export { useFougereAuth } from './auth.js';

export { tableOf } from './rest.js';

export {
  serveRest,
  serveRpc,
  surfaceOf,
  rpcParseError,
  invokeOn,
} from './serve.js';

export {
  formFieldsOf,
  tableColumnsOf,
  payloadOf,
  errorsByField,
  type FormEntity,
  type FormField,
  type TableColumn,
} from './form.js';

export { sessionViewOf, type SessionView } from './session.js';

export { stateFor } from './state.js';

export { serveGraphQL, type GraphQLRequest } from './graphql.js';

// Re-exported where every host already looks for it; it lives in its own adapter now.
export { createMemoryStorage } from '@fougere/adapter-memory';
