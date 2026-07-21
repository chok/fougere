/**
 * Receiving end for the browser — same wire as process-to-process
 * (POST /_fougere/call, JSON-RPC), different trust boundary: the browser
 * sits outside the topology, so `state` is stamped from the server-resolved
 * session (event.context), never taken from the wire.
 *
 * The runner follows the app's topology: local façades and remote
 * doublures alike — the browser never knows where a Frond lives.
 */
import { defineEventHandler } from 'h3';
import { handleRpc } from '@fougere/transport-http';
import { createAppRunner } from '@fougere/core';
import type { Transport } from '@fougere/core';
import { useFougereApp } from '../utils/fougereApp';

/**
 * Read the JSON body across h3 versions (a linked module can pull a different
 * h3 than the running nitro): prefer a Web Request `.json()`, else drain the
 * node request stream. Avoids depending on `readBody`'s internals.
 */
async function readJsonBody(event: { req?: { json?: () => Promise<unknown> }; node?: { req?: AsyncIterable<Uint8Array> } }): Promise<unknown> {
  if (event.req && typeof event.req.json === 'function') return event.req.json();
  const nodeReq = event.node?.req;
  if (!nodeReq) return {};
  const chunks: Uint8Array[] = [];
  for await (const chunk of nodeReq) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  const runner = createAppRunner(app);
  const stamped: Transport = (call, invocation) =>
    runner(call, { ...invocation, state: (event.context ?? {}) as Record<string, unknown> });
  return handleRpc(stamped, await readJsonBody(event));
});
