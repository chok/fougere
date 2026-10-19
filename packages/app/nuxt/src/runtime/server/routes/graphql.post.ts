/** GraphQL, when the app declares `protocols: { graphql: {} }` — the h3 half of `serveGraphQL`. */
import { defineEventHandler, createError, setResponseStatus, toWebRequest } from 'h3';
import { graphqlSurfaceOf, jsonBodyOf, serveGraphQL, useFougereApp, type GraphQLDocument } from '@fougere/app';
import { stateOf } from '../stateOf.js';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  const outcome = await serveGraphQL(app, {
    document: async () => (await jsonBodyOf(toWebRequest(event))) as GraphQLDocument | undefined,
    surface: graphqlSurfaceOf(event.path),
    state: stateOf(event),
  });

  if (outcome.kind === 'pass') {
    throw createError({ statusCode: 404, message: 'GraphQL is not served by this app' });
  }

  if (outcome.kind === 'error') {
    throw createError({ statusCode: outcome.status, message: outcome.body.message, data: outcome.body });
  }

  setResponseStatus(event, outcome.status);

  return outcome.body;
});
