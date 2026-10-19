/** GraphQL, when the app declares `protocols: { graphql: {} }` — the h3 half of `serveGraphQL`. */
import { defineEventHandler, createError, setResponseStatus, toWebRequest } from 'h3';
import { jsonBodyOf, serveGraphQL, useFougereApp } from '@fougere/app';
import { toHttpError } from '@fougere/core';
import { stateOf } from '../stateOf.js';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  let body: { query?: string; variables?: Record<string, unknown>; operationName?: string };
  try {
    body = ((await jsonBodyOf(toWebRequest(event))) ?? {}) as typeof body;
  } catch (refused) {
    const { status, body: error } = toHttpError(refused);
    throw createError({ statusCode: status, message: error.message, data: error });
  }
  const outcome = await serveGraphQL(app, { ...body, state: stateOf(event) });

  if (outcome.kind === 'pass') {
    throw createError({ statusCode: 404, message: 'GraphQL is not served by this app' });
  }

  if (outcome.kind === 'error') {
    throw createError({ statusCode: outcome.status, message: outcome.body.message, data: outcome.body });
  }

  setResponseStatus(event, outcome.status);

  return outcome.body;
});
