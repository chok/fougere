/** Receiving end for the browser — the h3 half. */
import { appendResponseHeader, defineEventHandler, getRequestHeader, getRequestHeaders, getRequestWebStream, type H3Event } from 'h3';
import { refusedRpc, serveRpc, rpcParseError, useFougereApp } from '@fougere/app';
import { BootRefusal, FougereError, maxBodyBytes, readWithin } from '@fougere/core';
import { stateOf } from '../stateOf.js';

/** The request's headers as a Web `Headers` — what a cookie-kept state arrives in. */
function requestHeadersOf(event: H3Event): Headers {
  return new Headers(Object.entries(getRequestHeaders(event)).filter((entry): entry is [string, string] => entry[1] !== undefined));
}

/** The JSON-RPC payload, read within `maxBodyBytes` whatever runtime h3 sits on. */
async function readJsonBody(event: H3Event): Promise<unknown> {
  let raw: string;
  try {
    raw = await readWithin(getRequestWebStream(event), maxBodyBytes(), getRequestHeader(event, 'content-length'));
  } catch (failure) {
    if (failure instanceof FougereError) {
      throw Object.assign(new Error('Payload too large'), { statusCode: 413, statusMessage: 'Payload too large' });
    }
    throw failure;
  }

  return raw ? JSON.parse(raw) : {};
}

export default defineEventHandler(async (event) => {
  const app = await useFougereApp().catch((failure: unknown) => {
    if (failure instanceof BootRefusal) return failure;
    throw failure;
  });
  if (app instanceof BootRefusal) {
    console.error(app.message);

    return refusedRpc(app, await readJsonBody(event), import.meta.dev);
  }
  try {
    const response = new Headers();
    const answered = await serveRpc(app, {
      path: event.path,
      body: await readJsonBody(event),
      state: stateOf(event),
      carrier: { request: requestHeadersOf(event), response },
    });
    for (const cookie of response.getSetCookie()) appendResponseHeader(event, 'set-cookie', cookie);

    return answered;
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 413) throw err;

    return rpcParseError();
  }
});
