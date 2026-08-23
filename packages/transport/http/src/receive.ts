/**
 * The envelope door for a host that speaks `Request`/`Response` — hono, a Worker, Next,
 * SvelteKit. It reads a `Request` body; `serve` reads a `node:http` stream, and the two
 * stay separate on purpose: putting Node through this reader HALVED the Node door
 * (0.677 → 0.341 of its baseline, measured 2026-08-22).
 *
 * What they share is `policy.ts` — the cap and the answers. Nothing here is edge-specific
 * beyond that: `handleRpc` is the wire and knows no HTTP at all.
 */
import { handleRpc, type ReceiveOptions } from './server.js';
import { MAX_BODY_BYTES, CALL_PATH, parseError, tooLarge } from './policy.js';
import type { Transport } from '@fougere/core/contract';

export interface ReceiveHttpOptions extends ReceiveOptions {
  /** Maximum JSON-RPC body size. Default: 1 MiB. */
  maxBodyBytes?: number;
  /** The path this door answers. Default: `/_fougere/call`. */
  path?: string;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

/** Distinguishes "the body was too large" from any body a caller could actually send. */
const TOO_LARGE = Symbol('too large');

/**
 * The declared length is a cheap refusal; the count is the real one. A `content-length` may
 * be absent, and it may lie — the copy that trusted it alone had no cap at all in that case.
 */
async function bodyWithin(request: Request, max: number): Promise<string | typeof TOO_LARGE> {
  const declared = Number(request.headers.get('content-length'));
  if (Number.isFinite(declared) && declared > max) return TOO_LARGE;

  const reader = request.body?.getReader();
  if (!reader) return '';

  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > max) {
      await reader.cancel();
      return TOO_LARGE;
    }
    chunks.push(value);
  }
  return new TextDecoder().decode(concat(chunks, size));
}

function concat(chunks: readonly Uint8Array[], size: number): Uint8Array {
  const all = new Uint8Array(size);
  let at = 0;
  for (const chunk of chunks) {
    all.set(chunk, at);
    at += chunk.byteLength;
  }
  return all;
}

export function receive(
  runner: Transport,
  options: ReceiveHttpOptions = {},
): (request: Request) => Promise<Response> {
  const max = options.maxBodyBytes ?? MAX_BODY_BYTES;
  const path = options.path ?? CALL_PATH;

  return async (request) => {
    if (request.method !== 'POST' || new URL(request.url).pathname !== path) {
      return new Response(null, { status: 404 });
    }

    const raw = await bodyWithin(request, max);
    if (raw === TOO_LARGE) return json(tooLarge(), 413);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      return json(parseError());
    }
    return json(await handleRpc(runner, parsed, options));
  };
}
