/** GraphQL, when the app declares `adapters: { graphql: true }` — the h3 half of `serveGraphQL`. */
import { defineEventHandler, readBody, createError, setResponseStatus } from 'h3';
import { serveGraphQL, useFougereApp } from '@fougere/app';
import { stateOf } from '../stateOf.js';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  const body = ((await readBody(event)) ?? {}) as { query?: string; variables?: Record<string, unknown>; operationName?: string };
  const outcome = await serveGraphQL(app, { ...body, state: stateOf(event) });

  if (outcome.kind === 'pass') return;

  if (outcome.kind === 'error') {
    throw createError({ statusCode: outcome.status, message: outcome.body.message, data: outcome.body });
  }

  setResponseStatus(event, outcome.status);

  return outcome.body;
});
