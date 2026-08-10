/**
 * Receiving end for the browser — the h3 half. The decision (which audience, which
 * runner, what a parse failure answers) lives in `@fougere/app`; what stays here is
 * getting a JSON payload out of an h3 event, which is the one thing that genuinely
 * differs between hosts. Next reads `await request.json()` and needs none of this.
 *
 * Trust boundary, unchanged: the browser sits outside the topology, so `state` is
 * stamped from the server-resolved session (event.context), never taken from the wire.
 */
import { defineEventHandler } from 'h3';
import { serveRpc, rpcParseError, useFougereApp } from '@fougere/app';

type NodeReq = {
  body?: unknown;
  on?: (event: 'data' | 'end' | 'error', cb: (arg: never) => void) => void;
};

type WebReq = {
  body?: { getReader?: () => { read: () => Promise<{ done: boolean; value?: Uint8Array }>; cancel?: () => Promise<void> } } | null;
  headers?: { get?: (name: string) => string | null };
  text?: () => Promise<string>;
  json?: () => Promise<unknown>;
};

const MAX_BODY_BYTES = 1024 * 1024;

function payloadTooLarge(): Error & { statusCode: number; statusMessage: string } {
  return Object.assign(new Error('Payload too large'), { statusCode: 413, statusMessage: 'Payload too large' });
}

function parseRawJson(raw: string): unknown {
  if (Buffer.byteLength(raw) > MAX_BODY_BYTES) throw payloadTooLarge();
  return raw ? JSON.parse(raw) : {};
}

async function readWebBody(req: WebReq): Promise<unknown> {
  const declaredLength = Number(req.headers?.get?.('content-length'));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) throw payloadTooLarge();

  const reader = req.body?.getReader?.();
  if (reader) {
    const chunks: Buffer[] = [];
    let size = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = Buffer.from(value ?? []);
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        await reader.cancel?.();
        throw payloadTooLarge();
      }
      chunks.push(chunk);
    }
    return parseRawJson(Buffer.concat(chunks).toString('utf8'));
  }

  if (typeof req.text === 'function') return parseRawJson(await req.text());
  // Legacy request-like implementations may expose only json(). The content-length
  // check above still rejects declared oversized payloads; standard Request objects
  // take the streamed branch and enforce the limit while reading.
  if (typeof req.json === 'function') return req.json();
  return {};
}

/**
 * Read the JSON-RPC payload from the h3 event, agnostic to h3 version AND trust
 * boundary. We read the event's shape directly instead of calling `readBody`,
 * whose static `from 'h3'` import can bind to a different h3 major than the one
 * that shaped the event (nitro's runtime is v1 here; devtools drag in v2) —
 * `readBody` v2 on a v1 event throws `event.req.text is not a function`.
 *
 * Two shapes occur, both verified:
 *  - SSR internal `$fetch`: a synthetic event whose `node.req.body` is already
 *    the raw JSON string — the mock stream is not readable, never drain it.
 *  - Browser POST: a real IncomingMessage, drained via stream events (`for
 *    await` fails: the SSR mock has no async iterator).
 * The `event.req.json()` branch is the future once nitro is fully on h3 v2.
 */
async function readJsonBody(event: { req?: unknown; node?: { req?: unknown } }): Promise<unknown> {
  const rawNodeReq = event.node?.req;
  const nodeReq = rawNodeReq && typeof rawNodeReq === 'object' ? rawNodeReq as NodeReq : undefined;
  const preset = nodeReq?.body;
  if (typeof preset === 'string') {
    if (Buffer.byteLength(preset) > MAX_BODY_BYTES) throw payloadTooLarge();
    return parseRawJson(preset);
  }
  if (preset instanceof Uint8Array) {
    if (preset.byteLength > MAX_BODY_BYTES) throw payloadTooLarge();
    const raw = Buffer.from(preset).toString('utf8');
    return parseRawJson(raw);
  }
  const webReq = event.req && typeof event.req === 'object' ? event.req as WebReq : undefined;
  if (
    webReq
    && (webReq.body?.getReader || typeof webReq.text === 'function' || typeof webReq.json === 'function')
  ) return readWebBody(webReq);
  if (nodeReq && typeof nodeReq.on === 'function') {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      let size = 0;
      let exceeded = false;
      nodeReq.on!('data', (chunk) => {
        if (exceeded) return;
        const buffer = Buffer.from(chunk);
        size += buffer.length;
        if (size > MAX_BODY_BYTES) {
          exceeded = true;
          reject(payloadTooLarge());
          return;
        }
        chunks.push(buffer);
      });
      nodeReq.on!('end', () => { if (!exceeded) resolve(Buffer.concat(chunks).toString('utf8')); });
      nodeReq.on!('error', reject);
    });
    return parseRawJson(raw);
  }
  return {};
}

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  try {
    return await serveRpc(app, {
      path: event.path,
      body: await readJsonBody(event),
      state: (event.context ?? {}) as Record<string, unknown>,
    });
  } catch (err) {
    if ((err as { statusCode?: number })?.statusCode === 413) throw err;
    return rpcParseError();
  }
});
