/**
 * Receiving end for the browser — same wire as process-to-process
 * (POST /_fougere/call, JSON-RPC), different trust boundary: the browser
 * sits outside the topology, so `state` is stamped from the server-resolved
 * session (event.context), never taken from the wire.
 *
 * The runner follows the app's topology: local façades and remote
 * doublures alike — the browser never knows where a Frond lives.
 */
import { defineEventHandler, readBody } from 'h3';
import { handleRpc } from '@fougere/transport-http';
import { createAppRunner } from '@fougere/core';
import type { Transport } from '@fougere/core';
import { useFougereApp } from '../utils/fougereApp';

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  const runner = createAppRunner(app);
  const stamped: Transport = (call, invocation) =>
    runner(call, { ...invocation, state: (event.context ?? {}) as Record<string, unknown> });
  return handleRpc(stamped, await readBody(event));
});
