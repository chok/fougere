/** Every door an app opens on HTTP, answered from a Web-standard `Request` — on any runtime, a Worker included. */
import { createAppRunner, FougereError, maxBodyBytes, Protocols, readWithin, type App } from '@fougere/core';
import { pageDoor, PARSE_ERROR } from '@fougere/transport-http/receive';
import { stateFor } from './state.js';

export const CALL_PATH = '/_fougere/call';

export interface AnswerOptions {
  /** Who the caller is, when the host resolved it itself — read off the headers otherwise. */
  state?: Record<string, unknown>;
}

/** What the app answers to this request, or `undefined` when no door of it is the request's. */
export async function answer(app: App, request: Request, options: AnswerOptions = {}): Promise<Response | undefined> {
  const state = async () => options.state ?? stateFor(request.headers, app);
  if (request.method.toUpperCase() === 'POST' && new URL(request.url).pathname.startsWith(CALL_PATH)) return call(app, request, await state());

  for (const name of Object.keys(app.protocols)) {
    const answered = await Protocols.resolve(name, `protocols.${name}`).answer?.(app, request, state);
    if (answered) return answered;
  }

  return undefined;
}

/** The audience this envelope serves — the path segment after `/_fougere/call`. */
export function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));

  return named?.[1];
}

async function call(app: App, request: Request, state: Record<string, unknown>): Promise<Response> {
  let body: unknown;
  try {
    body = JSON.parse(await readWithin(request.body, maxBodyBytes(), request.headers.get('content-length')));
  } catch (failure) {
    if (failure instanceof FougereError) return Response.json({ message: 'Payload too large' }, { status: 413 });

    return Response.json({ jsonrpc: '2.0', id: null, error: { code: PARSE_ERROR, message: 'Parse error' } });
  }

  const response = new Headers();
  const door = pageDoor(createAppRunner(app, surfaceOf(new URL(request.url).pathname)), {
    state,
    carrier: { request: request.headers, response },
    listens: (address, op) => app.listens(address, op),
  });

  return Response.json(await app.answer(door, body), { headers: response });
}
