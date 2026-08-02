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

type NodeReq = {
  body?: unknown;
  on?: (event: 'data' | 'end' | 'error', cb: (arg: never) => void) => void;
};

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
async function readJsonBody(event: { req?: { json?: () => Promise<unknown> }; node?: { req?: NodeReq } }): Promise<unknown> {
  const nodeReq = event.node?.req;
  const preset = nodeReq?.body;
  if (typeof preset === 'string') return preset ? JSON.parse(preset) : {};
  if (preset instanceof Uint8Array) {
    const raw = Buffer.from(preset).toString('utf8');
    return raw ? JSON.parse(raw) : {};
  }
  if (event.req && typeof event.req.json === 'function') return event.req.json();
  if (nodeReq && typeof nodeReq.on === 'function') {
    const raw = await new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];
      nodeReq.on!('data', (chunk) => chunks.push(Buffer.from(chunk)));
      nodeReq.on!('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
      nodeReq.on!('error', reject);
    });
    return raw ? JSON.parse(raw) : {};
  }
  return {};
}

/**
 * The audience this door serves — the path segment after `/_fougere/call`.
 *
 * The envelope is a surface like REST and GraphQL, so it selects its audience like they
 * do; the difference is only that it takes it from the path instead of an option, because
 * a door is mounted, not called. The same word names the directory
 * (`handlers/public/`), the config key (`surfaces: { public: [...] }`) and this segment —
 * derived, never configured.
 *
 * No escalation to guard: a named surface serves the entities it names and nothing else
 * (closed by naming), so every one of them is a subset of what the bare path already
 * serves.
 */
function surfaceOf(path: string): string | undefined {
  const named = /^\/_fougere\/call\/([A-Za-z0-9_-]+)/.exec(path.replace(/\?.*$/, ''));
  return named?.[1];
}

export default defineEventHandler(async (event) => {
  const app = await useFougereApp();
  const runner = createAppRunner(app, surfaceOf(event.path));
  const stamped: Transport = (call, invocation) =>
    runner(call, { ...invocation, state: (event.context ?? {}) as Record<string, unknown> });
  return handleRpc(stamped, await readJsonBody(event));
});
