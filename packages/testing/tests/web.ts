/** A request as a browser or a client sends it, and what the app answers to it. */
import { answer } from '@fougere/app/web';
import type { App } from '@fougere/core';

interface Asked {
  body?: unknown;
  headers?: Record<string, string>;
  /** A body that says when it is read — what proves a refusal came before it. */
  stream?: ReadableStream<Uint8Array>;
}

export interface Answered {
  status: number;
  headers: Record<string, string>;
  cookies: string[];
  body: unknown;
}

export function asked(method: string, path: string, { body, headers = {}, stream }: Asked = {}): Request {
  const sent = stream ?? (body === undefined ? undefined : JSON.stringify(body));

  return new Request(`http://localhost${path}`, {
    method,
    headers: { ...(sent !== undefined && { 'content-type': 'application/json' }), ...headers },
    ...(sent !== undefined && { body: sent, duplex: 'half' }),
  } as RequestInit);
}

/** What the app answers, read whole — `undefined` when no door of it is the request's. */
export async function answered(app: App, method: string, path: string, sent?: Asked): Promise<Answered | undefined> {
  const response = await answer(app, asked(method, path, sent));
  if (!response) return undefined;
  const text = await response.text();
  const raw = !(response.headers.get('content-type') ?? '').includes('json');

  return {
    status: response.status,
    headers: Object.fromEntries(response.headers),
    cookies: response.headers.getSetCookie(),
    body: !text ? null : raw ? text : JSON.parse(text),
  };
}

/** One call on the envelope a page knocks on. */
export async function called(app: App, method: string, params: object = {}, headers: Record<string, string> = {}): Promise<Answered> {
  return (await answered(app, 'POST', '/_fougere/call', { body: { jsonrpc: '2.0', id: 1, method, params }, headers }))!;
}
