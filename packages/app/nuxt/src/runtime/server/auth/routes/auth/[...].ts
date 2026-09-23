import { defineEventHandler, toWebRequest, sendWebResponse, createError } from 'h3';
import { authOf, useFougereApp } from '@fougere/app';

export default defineEventHandler(async (event) => {
  const auth = authOf(await useFougereApp());
  if (!auth) throw createError({ statusCode: 404, message: 'No auth is served by this process' });
  const webResponse = await auth.handler(toWebRequest(event));

  return sendWebResponse(event, webResponse);
});
