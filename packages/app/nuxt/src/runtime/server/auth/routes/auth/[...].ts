import { defineEventHandler } from 'h3';
import { useFougereAuth } from '@fougere/app';

export default defineEventHandler(async (event) => {
  const auth = await useFougereAuth();
  const webResponse = await auth.handler(toWebRequest(event));
  return sendWebResponse(event, webResponse);
});
