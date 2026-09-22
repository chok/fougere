/** `@fougere/app` — what an app host needs and what no host owns. */
export {
  configureFougere,
  extendFougere,
  useFougereApp,
  reloadFougere,
  type FougereServerConfig,
} from './boot.js';

export { authOf, useFougereAuth } from './auth.js';

export { tableOf } from './RouteMatch.js';

export { invokeOn, rpcParseError, serveRest, serveRpc, surfaceOf } from './Outcome.js';

export { errorsByField, formFieldsOf, payloadOf, tableColumnsOf, type FormEntity } from './FormEntity.js';
export { type FormField } from './FormField.js';
export { type TableColumn } from './TableColumn.js';

export { sessionViewOf, type SessionView } from './session.js';

export { stateFor } from './state.js';

export { serveGraphQL, type GraphQLRequest } from './graphql.js';

// Re-exported where every host already looks for it; it lives in its own adapter now.
export { createMemoryStorage } from '@fougere/adapter-memory';
